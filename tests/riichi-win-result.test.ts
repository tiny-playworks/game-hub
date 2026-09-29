import { describe, expect, test } from '@rstest/core';
import {
  applyEvent,
  evaluateSeatWin,
} from '../src/pages/mahjong/japanese/engine';
import { toWinResult } from '../src/pages/mahjong/japanese/engine/evaluate';
import { createTestRound, matchWithRound } from './helpers/riichiState';

describe('日麻引擎和牌结果链路', () => {
  test('规则门面结果原样进入局内结果与精确自摸支付', () => {
    const state = createTestRound(1, 1);
    state.hands[0] = [0, 1, 2, 3, 4, 5, 26, 26];
    state.melds[0] = [
      { type: 'chi', tiles: [6, 7, 8] },
      { type: 'angang', tiles: [22, 22, 22, 22] },
    ];
    state.doraIndicators = [1];
    state.drawnTile = 26;
    const step = applyEvent(matchWithRound(state), { type: 'tsumo', seat: 0 });
    const result = step?.match.round.result;
    expect(result?.type).toBe('win');
    if (result?.type !== 'win') throw new Error('未和了');
    expect(result.wins[0].ten).toBe(2700);
    expect(result.wins[0].tsumoPayments).toEqual({
      dealerOrAll: 1300,
      nonDealer: 700,
    });
    expect(result.settlement.deltas).toEqual([2700, -1300, -700, -700]);
  });

  test('非法和牌不可构造结果，也不能通过事件入口结算', () => {
    const state = createTestRound();
    const evaluation = evaluateSeatWin({
      state,
      seat: 0,
      isTsumo: true,
      winningTile: state.drawnTile!,
    });
    expect(evaluation.legalWin).toBe(false);
    expect(() =>
      toWinResult(state, 0, true, state.drawnTile!, null, evaluation, null),
    ).toThrow('illegal evaluation');
    expect(
      applyEvent(matchWithRound(state), { type: 'tsumo', seat: 0 }),
    ).toBeNull();
  });

  test('役满倍数进入结果与日志，不使用 0 符 0 番', () => {
    const state = createTestRound(1, 1);
    state.hands[0] = [0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    state.drawnTile = 33;
    const step = applyEvent(matchWithRound(state), { type: 'tsumo', seat: 0 });
    const result = step?.match.round.result;
    expect(result?.type).toBe('win');
    if (result?.type !== 'win') throw new Error('未和了');
    expect(result.wins[0].yakuman).toBe(1);
    expect(step?.match.log.at(-1)?.key).toBe('riichi.log.tsumoYakuman');
  });

  test('岭上摸牌使仅靠岭上役成立的开放手合法和牌', () => {
    const state = createTestRound(1, 1);
    state.hands[0] = [1, 2, 3, 14, 15, 16, 21, 22, 23, 26, 26];
    state.melds[0] = [{ type: 'mingang', tiles: [0, 0, 0, 0] }];
    state.drawnTile = 16;
    const ordinary = evaluateSeatWin({
      state,
      seat: 0,
      isTsumo: true,
      winningTile: 16,
    });
    expect(ordinary.structuralAgari).toBe(true);
    expect(ordinary.legalWin).toBe(false);
    state.lastDrawWasRinshan = true;
    const rinshan = evaluateSeatWin({
      state,
      seat: 0,
      isTsumo: true,
      winningTile: 16,
    });
    expect(rinshan.legalWin).toBe(true);
    expect(rinshan.yaku).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '38' })]),
    );
  });
});
