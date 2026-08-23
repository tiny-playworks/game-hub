import { describe, expect, test } from '@rstest/core';
import {
  createRiichiWinResult,
  evaluateGameWin,
  formatRiichiWinValue,
  resolveWinBaseTen,
} from '../src/pages/mahjong/japanese/gameLogic/winResult';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';

describe('日麻生产和牌结果链路', () => {
  test('规则门面结果原样进入局内结果与精确自摸支付', () => {
    const state = initRiichiGame(1, 1);
    state.hands[0] = [0, 1, 2, 3, 4, 5, 26, 26];
    state.melds[0] = [
      { type: 'chi', tiles: [6, 7, 8] },
      { type: 'angang', tiles: [22, 22, 22, 22] },
    ];
    state.doraIndicators = [1];
    state.drawnTile = 26;

    const evaluation = evaluateGameWin({
      state,
      winner: 0,
      isTsumo: true,
      winningTile: 26,
    });
    const result = createRiichiWinResult(state, 0, true, evaluation);

    expect(result.ten).toBe(2700);
    expect(result.tsumoPayments).toEqual({
      dealerOrAll: 1300,
      nonDealer: 700,
    });
    expect(resolveWinBaseTen(result, state)).toBe(2700);
  });

  test('缺少权威点数时直接拒绝，不再以简化公式回退', () => {
    const state = initRiichiGame();
    expect(() => resolveWinBaseTen({ ten: undefined }, state)).toThrow(
      'authoritative score',
    );
  });

  test('役满倍数原样进入局内结果并使用役满文案', () => {
    const state = initRiichiGame(1, 1);
    state.hands[0] = [0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    state.melds[0] = [];
    state.drawnTile = 33;

    const evaluation = evaluateGameWin({
      state,
      winner: 0,
      isTsumo: true,
      winningTile: 33,
    });
    const result = createRiichiWinResult(state, 0, true, evaluation);

    expect(evaluation.yakuman).toBe(1);
    expect(result.yakuman).toBe(1);
    expect(formatRiichiWinValue(evaluation)).toMatch(/^役满 \d+点$/);
    expect(formatRiichiWinValue(evaluation)).not.toContain('0符 0番');
  });

  test('岭上摸牌状态进入规则门面，使仅靠岭上役成立的开放手合法和牌', () => {
    const state = initRiichiGame(1, 1);
    state.hands[0] = [1, 2, 3, 14, 15, 16, 21, 22, 23, 26, 26];
    state.melds[0] = [{ type: 'mingang', tiles: [0, 0, 0, 0] }];
    state.drawnTile = 16;
    state.lastDrawWasRinshan = false;

    const ordinaryDraw = evaluateGameWin({
      state,
      winner: 0,
      isTsumo: true,
      winningTile: 16,
    });
    expect(ordinaryDraw.structuralAgari).toBe(true);
    expect(ordinaryDraw.legalWin).toBe(false);

    state.lastDrawWasRinshan = true;
    const rinshanDraw = evaluateGameWin({
      state,
      winner: 0,
      isTsumo: true,
      winningTile: 16,
    });
    expect(rinshanDraw.legalWin).toBe(true);
    expect(rinshanDraw.yaku).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '38' })]),
    );
  });
});
