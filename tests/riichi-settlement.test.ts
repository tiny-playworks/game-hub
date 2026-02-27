import { describe, expect, test } from '@rstest/core';
import {
  RIICHI_INITIAL_POINTS,
  settleRyuukyoku,
  settleWin,
} from '../src/lib/riichiSettlement';

describe('日麻计分结算', () => {
  test('荣和：点炮者支付和牌点+本场，和了者收立直棒', () => {
    const result = settleWin({
      scores: [24000, 25000, 25000, 26000],
      winner: 0,
      isTsumo: false,
      baseTen: 7700,
      dealer: 1,
      honba: 2,
      riichiPot: 1000,
      ronFrom: 3,
    });
    expect(result.newScores).toEqual([33300, 25000, 25000, 17700]);
    expect(result.nextRiichiPot).toBe(0);
  });

  test('子家自摸：庄家付 1/2，闲家付 1/4，并加本场', () => {
    const result = settleWin({
      scores: [
        RIICHI_INITIAL_POINTS,
        RIICHI_INITIAL_POINTS,
        RIICHI_INITIAL_POINTS,
        RIICHI_INITIAL_POINTS,
      ],
      winner: 0,
      isTsumo: true,
      baseTen: 8000,
      dealer: 1,
      honba: 1,
      riichiPot: 0,
    });
    expect(result.newScores).toEqual([33300, 20900, 22900, 22900]);
  });

  test('流局：2 家听牌，2 家不听，执行 3000 不听罚符', () => {
    const result = settleRyuukyoku([25000, 25000, 25000, 25000], [0, 2], 1000);
    expect(result.newScores).toEqual([26500, 23500, 26500, 23500]);
    expect(result.nextRiichiPot).toBe(1000);
  });
});
