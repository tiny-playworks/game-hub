import { beforeEach, describe, expect, rstest, test } from 'rstack/test';
import { CHARACTER_STORIES } from '../src/lib/characterStories';
import {
  COSMETIC_CATEGORIES,
  COSMETIC_DEFS,
  COSMETICS_STORAGE_KEY,
  DEFAULT_COSMETICS,
  equipCosmetic,
  getCosmeticsState,
  normalizeCosmetics,
  purchaseCosmetic,
  syncCosmeticRewards,
} from '../src/lib/cosmetics';
import { getMessage } from '../src/lib/i18n';
import {
  AFFINITY_STAGE_EVENT,
  CHARACTER_DEFS,
  CHARACTER_LINE_TRIGGERS,
  getCharacterLines,
  getPlayerCharacterState,
  normalizePlayerCharacterState,
  recordCharacterMatchFinish,
  setActiveCharacter,
  updatePlayerCharacterState,
} from '../src/lib/playerCharacters';
import {
  getRankedState,
  type RankedTicket,
  saveRankedState,
  selectRankedOpponents,
} from '../src/lib/ranked';
import { settleRankedMatch } from '../src/lib/rankedSettlement';
import { recordRiichiProgressEvent } from '../src/lib/riichiProgress';
import {
  createSaveFile,
  importSaveFile,
  resetSaveData,
} from '../src/lib/saveTransfer';
import { addCoins, getWalletState } from '../src/lib/wallet';
import { useRiichiStore } from '../src/pages/mahjong/japanese/store/riichiMatchStore';
import { nextAutoEvent } from './helpers/riichiSim';

beforeEach(() => {
  localStorage.clear();
  useRiichiStore.setState({
    match: null,
    view: 'rules',
    cutIns: [],
    moments: [],
    sessionId: '',
    processedProgress: [],
    showGuide: false,
    showMenu: false,
  });
});

describe('Cosmetic purchases and permanent rewards', () => {
  test('five legacy base items per category, a free venue cloth, and character rewards', () => {
    expect(new Set(COSMETIC_DEFS.map((item) => item.id)).size).toBe(
      COSMETIC_DEFS.length,
    );
    for (const category of COSMETIC_CATEGORIES)
      expect(
        COSMETIC_DEFS.filter((item) => item.id !== 'felt-venue')
          .slice(0, 25)
          .filter((item) => item.category === category),
      ).toHaveLength(5);
    for (const character of CHARACTER_DEFS)
      for (const stage of [3, 4])
        expect(
          COSMETIC_DEFS.filter(
            (item) =>
              item.unlock?.type === 'affinity' &&
              item.unlock.characterId === character.id &&
              item.unlock.stage === stage,
          ),
        ).toHaveLength(1);
  });
  test('corrupt equipment and missing fields fall back to owned defaults', () => {
    expect(normalizeCosmetics(null).equipped).toEqual(DEFAULT_COSMETICS);
    const legacy = normalizeCosmetics({
      version: 1,
      owned: ['felt-green', 'back-sakura'],
      equipped: { 'table-felt': 'felt-green', 'tile-back': 'back-sakura' },
    });
    expect(legacy.equipped['table-felt']).toBe('felt-green');
    expect(legacy.equipped['tile-back']).toBe('back-sakura');
    expect(legacy.owned).toContain('felt-venue');
    const state = normalizeCosmetics({
      owned: ['unknown', 'back-sakura', 'back-sakura'],
      equipped: { 'tile-back': 'felt-green', 'table-felt': 'felt-wine' },
    });
    expect(state.owned).not.toContain('unknown');
    expect(state.owned.filter((id) => id === 'back-sakura')).toHaveLength(1);
    expect(state.equipped).toEqual(DEFAULT_COSMETICS);
  });
  test('purchase deducts exactly once, records spending, and equips only an owned item of its category', () => {
    addCoins(1000, 'test');
    expect(purchaseCosmetic('back-vermilion', 10)).toBe('purchased');
    expect(getWalletState()).toMatchObject({
      coins: 700,
      lifetimeEarned: 1000,
    });
    expect(getWalletState().ledger.at(-1)).toEqual({
      at: 10,
      delta: -300,
      reasonKey: 'wallet.reason.cosmetic',
    });
    expect(purchaseCosmetic('back-vermilion')).toBe('owned');
    expect(getWalletState().coins).toBe(700);
    expect(equipCosmetic('back-vermilion')).toBe(true);
    expect(getCosmeticsState().equipped['tile-back']).toBe('back-vermilion');
    expect(equipCosmetic('back-sakura')).toBe(false);
    expect(getCosmeticsState().equipped['table-felt']).toBe('felt-venue');
  });
  test('insufficient coins and locked rewards cannot be purchased', () => {
    addCoins(299, 'test');
    expect(purchaseCosmetic('back-vermilion')).toBe('insufficient');
    expect(purchaseCosmetic('back-gold')).toBe('locked');
    expect(purchaseCosmetic('unknown')).toBe('locked');
    expect(getWalletState().coins).toBe(299);
  });
  test('a failed inventory write restores the wallet and inventory', () => {
    addCoins(500, 'test');
    syncCosmeticRewards();
    const wallet = getWalletState();
    const inventory = getCosmeticsState();
    const original = localStorage.setItem.bind(localStorage);
    let failed = false;
    const spy = rstest
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === COSMETICS_STORAGE_KEY && !failed) {
          failed = true;
          throw new Error('Quota exceeded');
        }
        original(key, value);
      });
    try {
      expect(purchaseCosmetic('back-vermilion')).toBe('failed');
    } finally {
      spy.mockRestore();
    }
    expect(getWalletState()).toEqual(wallet);
    expect(getCosmeticsState()).toEqual(inventory);
  });
  test('rank and affinity rewards become owned automatically and remain owned after a lower value', () => {
    const ranked = getRankedState();
    saveRankedState({
      ...ranked,
      band: 'saint',
      peak: { band: 'saint', level: 1 },
    });
    updatePlayerCharacterState({ affinityByCharacter: { mio: 50 } });
    syncCosmeticRewards();
    expect(getCosmeticsState().owned).toEqual(
      expect.arrayContaining([
        'back-gold',
        'felt-night',
        'win-mio',
        'frame-mio',
        'frame-rank-saint',
      ]),
    );
    updatePlayerCharacterState({ affinityByCharacter: { mio: 1 } });
    saveRankedState(ranked);
    expect(getCosmeticsState().owned).toContain('back-gold');
    expect(getPlayerCharacterState().rewardStageByCharacter.mio).toBe(4);
    expect(getCosmeticsState().owned).toContain('frame-mio');
  });
});

describe('Whole-match affinity and legacy saves', () => {
  const finish = {
    matchId: 'free-test',
    characterId: 'mio',
    opponents: ['koharu', 'rin', 'chitose'],
    ranking: [1, 0, 3, 2],
  };
  test('companion +2; opponents +1 and another +1 for finishing below you; repeat is a no-op', () => {
    const state = recordCharacterMatchFinish(finish);
    expect(state.affinityByCharacter).toMatchObject({
      mio: 2,
      koharu: 1,
      rin: 2,
      chitose: 2,
    });
    expect(state.encountersByCharacter.rin).toEqual({
      matches: 1,
      playerAbove: 1,
    });
    expect(state.encountersByCharacter.koharu).toEqual({
      matches: 1,
      playerAbove: 0,
    });
    setActiveCharacter('koharu');
    recordCharacterMatchFinish(finish);
    expect(getPlayerCharacterState().affinityByCharacter).toEqual(
      state.affinityByCharacter,
    );
    expect(getPlayerCharacterState().encountersByCharacter).toEqual(
      state.encountersByCharacter,
    );
  });
  test('finish-round keeps stats but gives no affinity', () => {
    updatePlayerCharacterState({ affinityByCharacter: { mio: 4 } });
    const result = recordRiichiProgressEvent('finish-round');
    expect(result.statDelta.riichiRounds).toBe(1);
    expect(result.characterProgress).toBeNull();
    expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(4);
  });
  test('old affinity values migrate to four stages without losing earned stages', () => {
    const state = normalizePlayerCharacterState({
      activeCharacterId: 'mio',
      affinityByCharacter: { mio: 31, yoru: 51 },
    });
    expect(state.affinityByCharacter).toMatchObject({ mio: 31, yoru: 51 });
    expect(state.rewardStageByCharacter).toMatchObject({ mio: 3, yoru: 4 });
    const lower = normalizePlayerCharacterState({
      ...state,
      affinityByCharacter: { mio: 2 },
    });
    expect(lower.rewardStageByCharacter.mio).toBe(3);
    expect(lower.encounteredCharacterIds).toContain('yoru');
  });
  test('a stage increase emits a story notice once and unlocks bonus event lines at stage 2', () => {
    updatePlayerCharacterState({ affinityByCharacter: { mio: 4 } });
    const received: unknown[] = [];
    const listener = (event: Event) =>
      received.push((event as CustomEvent).detail);
    window.addEventListener(AFFINITY_STAGE_EVENT, listener);
    try {
      recordCharacterMatchFinish(finish);
      recordCharacterMatchFinish(finish);
    } finally {
      window.removeEventListener(AFFINITY_STAGE_EVENT, listener);
    }
    expect(received).toEqual([[{ characterId: 'mio', stage: 1 }]]);
    const mio = CHARACTER_DEFS.find((character) => character.id === 'mio');
    if (!mio) throw new Error('Missing Mio');
    expect(getCharacterLines(mio, 'riichi')).toEqual(mio.lines.riichi);
    updatePlayerCharacterState({ affinityByCharacter: { mio: 15 } });
    for (const trigger of CHARACTER_LINE_TRIGGERS)
      expect(getCharacterLines(mio, trigger)).toContain(
        `character.affinityLine.mio.${trigger}`,
      );
  });
  test('ranked settlement gives whole-match affinity once; forfeits and legacy receipts do not', () => {
    const ranked = getRankedState();
    const ticket: RankedTicket = {
      id: 'p5-ranked',
      seed: 7,
      at: 1,
      ...ranked,
      characterId: 'mio',
      affinityStart: 0,
      matchLength: 'south',
      ...selectRankedOpponents(ranked, 'mio', 7),
    };
    saveRankedState({
      ...ranked,
      activeMatchId: ticket.id,
      activeTicket: ticket,
    });
    const entry = settleRankedMatch(ticket, [40000, 30000, 20000, 10000]);
    expect(entry?.affinityDelta).toBe(2);
    expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(2);
    settleRankedMatch(ticket, [40000, 30000, 20000, 10000]);
    expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(2);
    const next = { ...ticket, id: 'p5-forfeit' };
    saveRankedState({
      ...getRankedState(),
      activeMatchId: next.id,
      activeTicket: next,
    });
    settleRankedMatch(next, [50000, 20000, 20000, 10000], true);
    expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(2);
    const old = getRankedState();
    saveRankedState({
      ...old,
      history: old.history.map((item) => ({
        ...item,
        id: 'legacy',
        affinityRule: undefined,
      })),
    });
    settleRankedMatch(
      { ...ticket, id: 'legacy' },
      [40000, 30000, 20000, 10000],
    );
    expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(2);
  });
  test('live free-match completion and cold resume keep the original companion, and each length gives +2', async () => {
    for (const matchLength of ['east', 'south'] as const) {
      setActiveCharacter('mio');
      useRiichiStore.getState().setMatchLength(matchLength);
      await useRiichiStore.getState().startMatch({
        seed: 7,
        seatCharacters: [null, 'koharu', 'rin', 'chitose'],
      });
      const id = useRiichiStore.getState().sessionId;
      for (let i = 0; i < 12; i++) await step();
      setActiveCharacter('koharu');
      useRiichiStore.setState({
        match: null,
        playerCharacterId: 'koharu',
        sessionId: '',
      });
      expect(await useRiichiStore.getState().resumeSaved()).toBe(true);
      expect(useRiichiStore.getState().sessionId).toBe(id);
      expect(useRiichiStore.getState().playerCharacterId).toBe('mio');
      for (
        let i = 0;
        i < 3000 && useRiichiStore.getState().match?.status !== 'matchEnd';
        i++
      )
        await step();
      expect(useRiichiStore.getState().match?.status).toBe('matchEnd');
      expect(getPlayerCharacterState().affinityByCharacter.mio).toBe(
        matchLength === 'east' ? 2 : 4,
      );
      expect(getPlayerCharacterState().rewardedMatchIds).toContain(id);
      expect(getWalletState().rewardedMatchIds).toContain(id);
    }
    expect(getPlayerCharacterState().rewardedMatchIds).toHaveLength(2);
    async function step() {
      const store = useRiichiStore.getState();
      store.clearCutIns();
      if (!store.match) throw new Error('Missing match');
      const event = nextAutoEvent(store.match);
      if (!event) throw new Error('No event');
      expect(await store.dispatch(event)).toBe(true);
    }
  }, 30000);
});

test('export/import restores equipment, purchases, affinity rewards and encounter receipts', () => {
  addCoins(2000, 'test');
  purchaseCosmetic('back-sakura');
  equipCosmetic('back-sakura');
  updatePlayerCharacterState({ affinityByCharacter: { mio: 50 } });
  syncCosmeticRewards();
  equipCosmetic('frame-mio');
  recordCharacterMatchFinish({
    matchId: 'saved-match',
    characterId: 'mio',
    opponents: ['koharu', 'rin', 'chitose'],
    ranking: [0, 1, 2, 3],
  });
  const cosmetics = getCosmeticsState();
  const characters = getPlayerCharacterState();
  const wallet = getWalletState();
  const save = createSaveFile();
  resetSaveData();
  expect(getCosmeticsState().equipped['tile-back']).toBe('back-blue');
  importSaveFile(save);
  expect(getCosmeticsState()).toEqual(cosmetics);
  expect(getPlayerCharacterState()).toEqual(characters);
  expect(getWalletState()).toEqual(wallet);
});

test('all character stories, cosmetics and bonus lines have Chinese and English text', () => {
  const p5Characters = CHARACTER_DEFS.slice(0, 8);
  const stories = CHARACTER_STORIES.filter((story) =>
    p5Characters.some((char) => char.id === story.characterId),
  );
  expect(stories).toHaveLength(32);
  const keys = [
    ...stories.flatMap((story) => {
      expect(story.lines.length).toBeGreaterThanOrEqual(3);
      expect(story.lines.length).toBeLessThanOrEqual(5);
      return [story.titleKey, ...story.lines.map((line) => line.textKey)];
    }),
    ...COSMETIC_DEFS.flatMap((item) => [item.nameKey, item.descKey]),
    ...p5Characters.flatMap((character) =>
      CHARACTER_LINE_TRIGGERS.map(
        (trigger) => `character.affinityLine.${character.id}.${trigger}`,
      ),
    ),
  ];
  for (const key of keys)
    for (const locale of ['zh', 'en'] as const)
      expect(getMessage(locale, key)).not.toBe(key);
});
