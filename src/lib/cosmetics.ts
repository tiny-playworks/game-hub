import { commitStorageChanges, gameStorage } from '@/lib/storage';
import { getUnlockedIds } from './achievements';
import {
  CHARACTER_DEFS,
  CHARACTER_RANK_BANDS,
  getPlayerCharacterState,
  type RankBand,
} from './playerCharacters';
import { getRankedState } from './ranked';
import {
  getWalletState,
  WALLET_CHANGED_EVENT,
  WALLET_STORAGE_KEY,
} from './wallet';

export const COSMETICS_STORAGE_KEY = 'game-hub-cosmetics-v1';
export const COSMETICS_CHANGED_EVENT = 'game-hub:cosmetics-changed';
export const COSMETIC_CATEGORIES = [
  'tile-back',
  'table-felt',
  'riichi-effect',
  'win-effect',
  'avatar-frame',
] as const;
export type CosmeticCategory = (typeof COSMETIC_CATEGORIES)[number];
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface CosmeticDef {
  id: string;
  category: CosmeticCategory;
  nameKey: string;
  descKey: string;
  rarity: CosmeticRarity;
  price: number | null;
  unlock?:
    | { type: 'affinity'; characterId: string; stage: number }
    | { type: 'rank'; band: RankBand }
    | { type: 'achievement'; achievementId: string };
  preview: string;
}
export interface CosmeticsState {
  version: 1;
  owned: string[];
  equipped: Record<CosmeticCategory, string>;
}
const prices: Record<CosmeticRarity, number> = {
  common: 300,
  rare: 800,
  epic: 1800,
  legendary: 3000,
};
function item(
  id: string,
  category: CosmeticCategory,
  rarity: CosmeticRarity = 'common',
  unlock?: CosmeticDef['unlock'],
  free = false,
): CosmeticDef {
  return {
    id,
    category,
    rarity,
    nameKey: `cosmetic.${id}.name`,
    descKey: `cosmetic.${id}.desc`,
    price: unlock ? null : free ? 0 : prices[rarity],
    unlock,
    preview: id,
  };
}
export const DEFAULT_COSMETICS: Record<CosmeticCategory, string> = {
  'tile-back': 'back-blue',
  'table-felt': 'felt-green',
  'riichi-effect': 'riichi-default',
  'win-effect': 'win-default',
  'avatar-frame': 'frame-wood',
};
export const COSMETIC_DEFS: CosmeticDef[] = [
  item('back-blue', 'tile-back', 'common', undefined, true),
  item('back-vermilion', 'tile-back'),
  item('back-sakura', 'tile-back', 'rare'),
  item('back-waves', 'tile-back', 'epic'),
  item('back-gold', 'tile-back', 'legendary', { type: 'rank', band: 'saint' }),
  item('felt-green', 'table-felt', 'common', undefined, true),
  item('felt-blue', 'table-felt'),
  item('felt-wine', 'table-felt', 'rare'),
  item('felt-tatami', 'table-felt', 'epic'),
  item('felt-night', 'table-felt', 'legendary', {
    type: 'rank',
    band: 'master',
  }),
  item('riichi-default', 'riichi-effect', 'common', undefined, true),
  item('riichi-sparks', 'riichi-effect'),
  item('riichi-sakura', 'riichi-effect', 'rare'),
  item('riichi-lightning', 'riichi-effect', 'epic'),
  item('riichi-ink', 'riichi-effect', 'legendary'),
  item('win-default', 'win-effect', 'common', undefined, true),
  item('win-fireworks', 'win-effect'),
  item('win-sakura', 'win-effect', 'rare'),
  item('win-dragon', 'win-effect', 'epic'),
  item('win-galaxy', 'win-effect', 'legendary'),
  item('frame-wood', 'avatar-frame', 'common', undefined, true),
  item('frame-gold', 'avatar-frame'),
  item('frame-sakura', 'avatar-frame', 'rare'),
  item('frame-rank-adept', 'avatar-frame', 'rare', {
    type: 'rank',
    band: 'adept',
  }),
  item('frame-mio', 'avatar-frame', 'legendary', {
    type: 'affinity',
    characterId: 'mio',
    stage: 4,
  }),
  ...CHARACTER_RANK_BANDS.filter((band) => band !== 'adept').map((band) =>
    item(`frame-rank-${band}`, 'avatar-frame', 'epic', { type: 'rank', band }),
  ),
  ...CHARACTER_DEFS.map((character, index) =>
    item(
      `${index % 2 ? 'win' : 'back'}-${character.id}`,
      index % 2 ? 'win-effect' : 'tile-back',
      'epic',
      { type: 'affinity', characterId: character.id, stage: 3 },
    ),
  ),
  ...CHARACTER_DEFS.filter((character) => character.id !== 'mio').map(
    (character) =>
      item(`frame-${character.id}`, 'avatar-frame', 'legendary', {
        type: 'affinity',
        characterId: character.id,
        stage: 4,
      }),
  ),
];

export function getCosmetic(id: string): CosmeticDef | undefined {
  return COSMETIC_DEFS.find((def) => def.id === id);
}
export function normalizeCosmetics(raw: unknown): CosmeticsState {
  const state =
    raw && typeof raw === 'object' ? (raw as Partial<CosmeticsState>) : {};
  const owned = [
    ...new Set([
      ...Object.values(DEFAULT_COSMETICS),
      ...(Array.isArray(state.owned)
        ? state.owned.filter(
            (id): id is string => typeof id === 'string' && !!getCosmetic(id),
          )
        : []),
    ]),
  ];
  const equipped = { ...DEFAULT_COSMETICS };
  for (const category of COSMETIC_CATEGORIES) {
    const id = state.equipped?.[category];
    if (id && owned.includes(id) && getCosmetic(id)?.category === category)
      equipped[category] = id;
  }
  return { version: 1, owned, equipped };
}
function readCosmetics(): CosmeticsState {
  try {
    return normalizeCosmetics(
      JSON.parse(gameStorage.getItem(COSMETICS_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return normalizeCosmetics(null);
  }
}
function earnedRewards(): string[] {
  const characters = getPlayerCharacterState();
  const band = getRankedState().peak.band;
  const achievements = new Set(getUnlockedIds());
  return COSMETIC_DEFS.filter(({ unlock }) => {
    if (!unlock) return false;
    if (unlock.type === 'affinity')
      return (
        (characters.rewardStageByCharacter[unlock.characterId] ?? 0) >=
        unlock.stage
      );
    if (unlock.type === 'rank')
      return (
        CHARACTER_RANK_BANDS.indexOf(band) >=
        CHARACTER_RANK_BANDS.indexOf(unlock.band)
      );
    return achievements.has(unlock.achievementId);
  }).map(({ id }) => id);
}
export function getCosmeticsState(): CosmeticsState {
  const current = readCosmetics();
  return {
    ...current,
    owned: [...new Set([...current.owned, ...earnedRewards()])],
  };
}
function notify(): void {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(COSMETICS_CHANGED_EVENT));
}
function save(state: CosmeticsState): void {
  gameStorage.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(state));
  notify();
}
export function syncCosmeticRewards(): void {
  const current = readCosmetics();
  const next = getCosmeticsState();
  if (
    next.owned.length !== current.owned.length ||
    !gameStorage.getItem(COSMETICS_STORAGE_KEY)
  )
    save(next);
}
export function equipCosmetic(id: string): boolean {
  const def = getCosmetic(id);
  const state = getCosmeticsState();
  if (!def || !state.owned.includes(id)) return false;
  save({ ...state, equipped: { ...state.equipped, [def.category]: id } });
  return true;
}
export type PurchaseResult =
  | 'purchased'
  | 'owned'
  | 'locked'
  | 'insufficient'
  | 'failed';
/** Both local records commit together; restore the previous records if either write fails. */
export function purchaseCosmetic(id: string, at = Date.now()): PurchaseResult {
  const def = getCosmetic(id);
  if (!def) return 'locked';
  const cosmetics = getCosmeticsState();
  if (cosmetics.owned.includes(id)) return 'owned';
  if (def.price === null) return 'locked';
  const wallet = getWalletState();
  if (wallet.coins < def.price) return 'insufficient';
  try {
    commitStorageChanges({
      [WALLET_STORAGE_KEY]: JSON.stringify({
        ...wallet,
        coins: wallet.coins - def.price,
        ledger: [
          ...wallet.ledger,
          { at, delta: -def.price, reasonKey: 'wallet.reason.cosmetic' },
        ].slice(-50),
      }),
      [COSMETICS_STORAGE_KEY]: JSON.stringify({
        ...cosmetics,
        owned: [...cosmetics.owned, id],
      }),
    });
  } catch {
    notify();
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
    return 'failed';
  }
  notify();
  window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
  return 'purchased';
}
