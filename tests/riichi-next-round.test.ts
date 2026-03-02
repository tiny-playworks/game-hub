import { describe, expect, test } from '@rstest/core';
import { getNextRound } from '../src/pages/GameMahjongJapanese';

describe('getNextRound 局数推进', () => {
  test('东4局 dealer=3 子家胡 → 南1局，不会出现东5局', () => {
    const next = getNextRound(3, 0, 4, 0, false);
    expect(next).toEqual({
      dealer: 0,
      roundWind: 1,
      roundNumber: 1,
      honba: 0,
    });
  });

  test('东4局 state 错乱 dealer=0 子家胡时，用 nextDealer 推导得东2局而非东5局', () => {
    const next = getNextRound(0, 0, 4, 0, false);
    expect(next.roundWind).toBe(0);
    expect(next.roundNumber).toBe(2);
    expect(next.dealer).toBe(1);
  });

  test('庄家胡/流局连庄：局数不变，本场+1', () => {
    const next = getNextRound(2, 0, 3, 1, true);
    expect(next).toEqual({
      dealer: 2,
      roundWind: 0,
      roundNumber: 3,
      honba: 2,
    });
  });

  test('东1局子家胡 → 东2局', () => {
    const next = getNextRound(0, 0, 1, 0, false);
    expect(next).toEqual({
      dealer: 1,
      roundWind: 0,
      roundNumber: 2,
      honba: 0,
    });
  });

  test('南4局 dealer=3 子家胡 → 西1局', () => {
    const next = getNextRound(3, 1, 4, 0, false);
    expect(next).toEqual({
      dealer: 0,
      roundWind: 2,
      roundNumber: 1,
      honba: 0,
    });
  });
});
