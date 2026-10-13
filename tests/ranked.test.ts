import { beforeEach, describe, expect, test } from 'rstack/test';
import { CHARACTER_DEFS, getCharacterById } from '../src/lib/playerCharacters';
import {
  applyPtDelta,
  computePtDelta,
  getRankedState,
  normalizeRankedState,
  type Rank,
  type RankedState,
  type RankedTicket,
  saveRankedState,
  selectRankedOpponents,
} from '../src/lib/ranked';
import { settleRankedMatch } from '../src/lib/rankedSettlement';
import {
  createSaveFile,
  importSaveFile,
  resetSaveData,
} from '../src/lib/saveTransfer';
import { getWalletState } from '../src/lib/wallet';

const fresh = (): RankedState => normalizeRankedState(null);
const at = (
  band: Rank['band'],
  level: Rank['level'],
  pt: number,
): RankedState => ({
  ...fresh(),
  band,
  level,
  pt,
  peak: { band, level },
});

function ticketFor(
  state: RankedState,
  id = 'match-1',
  matchLength: 'east' | 'south' = 'east',
): RankedTicket {
  return {
    id,
    seed: 7,
    at: 1,
    band: state.band,
    level: state.level,
    matchLength,
    characterId: 'mio',
    affinityStart: 0,
    ...selectRankedOpponents(state, 'mio', 7),
  };
}
function startRanked(state: RankedState, ticket: RankedTicket): void {
  saveRankedState({ ...state, activeMatchId: ticket.id, activeTicket: ticket });
}

beforeEach(() => localStorage.clear());

describe('3.5 pt 公式', () => {
  test('名次基础分 + 终局点数修正，修正上下限 ±30', () => {
    expect(
      computePtDelta({
        band: 'novice',
        placement: 1,
        finalScore: 30000,
        matchLength: 'east',
      }),
    ).toBe(35);
    expect(
      computePtDelta({
        band: 'novice',
        placement: 4,
        finalScore: 25000,
        matchLength: 'east',
      }),
    ).toBe(0);
    expect(
      computePtDelta({
        band: 'adept',
        placement: 4,
        finalScore: 18000,
        matchLength: 'east',
      }),
    ).toBe(-27);
    expect(
      computePtDelta({
        band: 'expert',
        placement: 1,
        finalScore: 90000,
        matchLength: 'east',
      }),
    ).toBe(80);
    expect(
      computePtDelta({
        band: 'master',
        placement: 3,
        finalScore: 24600,
        matchLength: 'east',
      }),
    ).toBe(0);
  });
  test('半庄 ×1.5 四舍五入；被飞额外 -10', () => {
    expect(
      computePtDelta({
        band: 'adept',
        placement: 1,
        finalScore: 40000,
        matchLength: 'south',
      }),
    ).toBe(83);
    expect(
      computePtDelta({
        band: 'saint',
        placement: 4,
        finalScore: -5000,
        matchLength: 'east',
      }),
    ).toBe(-130);
    expect(
      computePtDelta({
        band: 'saint',
        placement: 4,
        finalScore: -5000,
        matchLength: 'south',
      }),
    ).toBe(-190);
  });
});

describe('3.4 升降级', () => {
  test('新玩家为初心 1 级 0pt', () => {
    expect(getRankedState()).toMatchObject({
      band: 'novice',
      level: 1,
      pt: 0,
      peak: { band: 'novice', level: 1 },
      history: [],
      activeMatchId: null,
    });
  });
  test('pt ≥ max 晋级并置为下一级 start，历史最高同步更新', () => {
    const result = applyPtDelta(at('novice', 3, 190), 15);
    expect(result.change).toBe('up');
    expect(result.state).toMatchObject({
      band: 'adept',
      level: 1,
      pt: 300,
      peak: { band: 'adept', level: 1 },
    });
    expect(applyPtDelta(at('adept', 1, 300), 299)).toMatchObject({
      change: null,
      state: { pt: 599 },
    });
  });
  test('初心不降级，pt 不低于 0', () => {
    expect(applyPtDelta(at('novice', 2, 5), -50)).toMatchObject({
      change: null,
      state: { band: 'novice', level: 2, pt: 0 },
    });
  });
  test('跨段降级（雀士 1 → 初心 3），历史最高保持', () => {
    const result = applyPtDelta(at('adept', 1, 10), -27);
    expect(result.change).toBe('down');
    expect(result.state).toMatchObject({
      band: 'novice',
      level: 3,
      pt: 0,
      peak: { band: 'adept', level: 1 },
    });
    expect(applyPtDelta(at('expert', 2, 3), -40).state).toMatchObject({
      band: 'expert',
      level: 1,
      pt: 600,
    });
  });
  test('雀圣 3 级没有上限', () => {
    expect(applyPtDelta(at('saint', 3, 4500), 100000)).toMatchObject({
      change: null,
      state: { band: 'saint', level: 3, pt: 104500 },
    });
  });
  test('验收：新号连拿 1 位逐级晋级；雀士连续 4 位最终降级', () => {
    let state = fresh();
    const ups: string[] = [];
    for (let game = 0; game < 4; game++) {
      const result = applyPtDelta(
        state,
        computePtDelta({
          band: state.band,
          placement: 1,
          finalScore: 40000,
          matchLength: 'east',
        }),
      );
      if (result.change === 'up')
        ups.push(`${result.state.band}${result.state.level}`);
      state = result.state;
    }
    expect(ups[0]).toBe('novice2');
    expect(ups.length).toBeGreaterThanOrEqual(2);

    state = at('adept', 1, 300);
    let games = 0;
    let change: 'up' | 'down' | null = null;
    while (change !== 'down' && games < 50) {
      const result = applyPtDelta(
        state,
        computePtDelta({
          band: state.band,
          placement: 4,
          finalScore: 20000,
          matchLength: 'east',
        }),
      );
      ({ change } = result);
      state = result.state;
      games++;
    }
    expect(change).toBe('down');
    expect(games).toBe(13); // 每局 -25：300 → -25
    expect(state).toMatchObject({ band: 'novice', level: 3, pt: 0 });
  });
});

describe('3.6 对手匹配', () => {
  const ranks: Rank[] = (
    ['novice', 'adept', 'expert', 'master', 'saint'] as const
  ).flatMap((band) =>
    [1, 2, 3].map((level) => ({ band, level: level as Rank['level'] })),
  );
  const bandOf = (id: string) => getCharacterById(id).rankBand;

  test('所有段位与主角色：三名不重复对手、不含主角色、同 seed 可复现', () => {
    for (const rank of ranks)
      for (const player of CHARACTER_DEFS)
        for (let seed = 1; seed <= 20; seed++) {
          const { opponents, seatAiLevels } = selectRankedOpponents(
            rank,
            player.id,
            seed,
          );
          expect(new Set(opponents).size).toBe(3);
          expect(opponents).not.toContain(player.id);
          expect(seatAiLevels).toHaveLength(4);
          expect(selectRankedOpponents(rank, player.id, seed)).toEqual({
            opponents,
            seatAiLevels,
          });
        }
  });
  test('初心：初心角色优先、AI 为 beginner；3 级混入一名 standard 雀士', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const low = selectRankedOpponents(
        { band: 'novice', level: 1 },
        'mio',
        seed,
      );
      expect(low.opponents).toContain('koharu');
      expect(low.seatAiLevels.slice(1)).toEqual([
        'beginner',
        'beginner',
        'beginner',
      ]);
      const high = selectRankedOpponents(
        { band: 'novice', level: 3 },
        'mio',
        seed,
      );
      expect(high.opponents).toContain('koharu');
      for (const [index, id] of high.opponents.entries()) {
        expect(high.seatAiLevels[index + 1]).toBe(
          bandOf(id) === 'novice' ? 'beginner' : 'standard',
        );
      }
    }
  });
  test('雀士：两名雀士 + 一名初心或雀杰，AI 全为 standard', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { opponents, seatAiLevels } = selectRankedOpponents(
        { band: 'adept', level: 2 },
        'mio',
        seed,
      );
      expect(opponents.filter((id) => bandOf(id) === 'adept')).toHaveLength(2);
      expect(['novice', 'expert']).toContain(
        opponents.map(bandOf).find((band) => band !== 'adept'),
      );
      expect(seatAiLevels.slice(1)).toEqual([
        'standard',
        'standard',
        'standard',
      ]);
    }
  });
  test('雀杰：两名雀杰 + 雀士/雀豪，standard 与 strong 混合', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { opponents, seatAiLevels } = selectRankedOpponents(
        { band: 'expert', level: 1 },
        'mio',
        seed,
      );
      expect(opponents.filter((id) => bandOf(id) === 'expert')).toHaveLength(2);
      expect(['adept', 'master']).toContain(
        opponents.map(bandOf).find((band) => band !== 'expert'),
      );
      expect(seatAiLevels.slice(1)).toContain('strong');
      expect(seatAiLevels.slice(1)).toContain('standard');
    }
  });
  test('雀豪：雀豪与雀杰、strong；雀圣：yoru 必定出场、expert', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const master = selectRankedOpponents(
        { band: 'master', level: 2 },
        'mio',
        seed,
      );
      expect(
        master.opponents
          .map(bandOf)
          .every((band) => band === 'master' || band === 'expert'),
      ).toBe(true);
      expect(master.seatAiLevels.slice(1)).toEqual([
        'strong',
        'strong',
        'strong',
      ]);
      const saint = selectRankedOpponents(
        { band: 'saint', level: 1 },
        'mio',
        seed,
      );
      expect(saint.opponents).toContain('yoru');
      expect(
        saint.opponents
          .map(bandOf)
          .every((band) => band !== 'novice' && band !== 'adept'),
      ).toBe(true);
      expect(saint.seatAiLevels.slice(1)).toEqual([
        'expert',
        'expert',
        'expert',
      ]);
    }
  });
});

describe('段位战结算', () => {
  test('写入战绩、清除进行中对局、发放 +20% 雀币，重复结算幂等', () => {
    const state = at('adept', 1, 300);
    const ticket = ticketFor(state);
    startRanked(state, ticket);
    const entry = settleRankedMatch(ticket, [42000, 30000, 18000, 10000]);
    expect(entry).toMatchObject({
      placement: 1,
      finalScore: 42000,
      ptDelta: 57,
      forfeit: false,
      change: null,
      coins: 144,
    });
    const after = getRankedState();
    expect(after).toMatchObject({
      band: 'adept',
      level: 1,
      pt: 357,
      activeMatchId: null,
      activeTicket: null,
    });
    expect(after.history).toHaveLength(1);
    const coins = getWalletState().coins;
    expect(coins).toBe(144);

    expect(settleRankedMatch(ticket, [42000, 30000, 18000, 10000])).toEqual(
      entry,
    );
    expect(getRankedState().pt).toBe(357);
    expect(getRankedState().history).toHaveLength(1);
    expect(getWalletState().coins).toBe(coins);
  });
  test('弃赛按第 4 名、至多原点结算，不发雀币', () => {
    const state = at('adept', 1, 310);
    const ticket = ticketFor(state, 'forfeit-1');
    startRanked(state, ticket);
    const entry = settleRankedMatch(ticket, [48000, 20000, 17000, 15000], true);
    expect(entry).toMatchObject({
      placement: 4,
      finalScore: 25000,
      ptDelta: -20,
      forfeit: true,
      coins: 0,
    });
    expect(entry?.ranking.at(-1)).toBe(0);
    expect(getRankedState().pt).toBe(290);
    expect(getWalletState().coins).toBe(0);
  });
  test('非进行中的对局不会结算', () => {
    const ticket = ticketFor(fresh(), 'stale');
    expect(settleRankedMatch(ticket, [40000, 30000, 20000, 10000])).toBeNull();
    expect(getRankedState().history).toHaveLength(0);
  });
  test('晋级到雀士带解锁 rank-band 角色', () => {
    const state = at('novice', 3, 190);
    const ticket = ticketFor(state, 'promote');
    startRanked(state, ticket);
    const entry = settleRankedMatch(ticket, [35000, 25000, 22000, 18000]);
    expect(entry?.change).toBe('up');
    expect(entry?.unlocked).toContain('chitose');
    expect(getRankedState().history.at(-1)?.unlocked).toContain('chitose');
  });
});

test('导出/导入存档后段位保留', () => {
  saveRankedState({ ...at('expert', 2, 900), history: [] });
  const save = createSaveFile();
  resetSaveData();
  expect(getRankedState()).toMatchObject({ band: 'novice', level: 1, pt: 0 });
  importSaveFile(save);
  expect(getRankedState()).toMatchObject({ band: 'expert', level: 2, pt: 900 });
});
