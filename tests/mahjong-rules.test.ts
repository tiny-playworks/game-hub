import { describe, expect, test } from '@rstest/core';
import {
  AKA_5_MAN,
  AKA_5_PIN,
  AKA_5_SOU,
  createRiichiDeck,
  getBaseTile,
  getTileLabel,
} from '../src/lib/mahjongRiichi';

import { evaluateSeatWin } from '../src/pages/mahjong/japanese/engine';
import { createTestRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

describe('日麻 - 赤宝牌映射修复', () => {
  test('AKA_5_PIN 映射到五筒(22)', () => {
    expect(getBaseTile(AKA_5_PIN)).toBe(22);
    expect(getTileLabel(AKA_5_PIN)).toBe('五筒');
  });

  test('AKA_5_SOU 映射到五条(13)', () => {
    expect(getBaseTile(AKA_5_SOU)).toBe(13);
    expect(getTileLabel(AKA_5_SOU)).toBe('五条');
  });

  test('AKA_5_MAN 映射正确', () => {
    expect(getBaseTile(AKA_5_MAN)).toBe(4);
    expect(getTileLabel(AKA_5_MAN)).toBe('五万');
  });

  test('牌堆含 136 张且赤牌正确', () => {
    const deck = createRiichiDeck();
    expect(deck).toHaveLength(136);
    const fiveManCount = deck.filter((t) => t === 4 || t === AKA_5_MAN).length;
    const fiveSouCount = deck.filter((t) => t === 13 || t === AKA_5_SOU).length;
    const fivePinCount = deck.filter((t) => t === 22 || t === AKA_5_PIN).length;
    expect(fiveManCount).toBe(4);
    expect(fiveSouCount).toBe(4);
    expect(fivePinCount).toBe(4);
  });
});

function evaluateHand(hand: number[], winningTile: number, isTsumo: boolean) {
  const state = createTestRound(1);
  state.hands[0] = [...hand];
  state.drawnTile = winningTile;
  if (!isTsumo) state.hands[0].splice(state.hands[0].indexOf(winningTile), 1);
  return evaluateSeatWin({ state, seat: 0, winningTile, isTsumo });
}

describe('日麻 - WASM 符数与平和回归', () => {
  const pinfu = tiles('123456m234p678s55p');
  test('平和自摸为 20 符', () => {
    expect(evaluateHand(pinfu, tile('6m'), true).fu).toBe(20);
  });
  test('平和荣和为 30 符', () => {
    expect(evaluateHand(pinfu, tile('6m'), false).fu).toBe(30);
  });
  test('七对子为 25 符', () => {
    expect(
      evaluateHand(tiles('1122m3344p5566s77z'), tile('7z'), false).fu,
    ).toBe(25);
  });
  test('同牌 3 张跨顺子的手牌可以有平和', () => {
    const result = evaluateHand(tiles('122233344m678p55s'), tile('4m'), false);
    expect(result.yaku.some((y) => y.name === '平和')).toBe(true);
  });
  test('含刻子的手牌没有平和', () => {
    const result = evaluateHand(
      [0, 0, 0, 1, 2, 3, 4, 4, 9, 10, 11, 18, 19, 20],
      20,
      false,
    );
    expect(result.yaku.some((y) => y.name === '平和')).toBe(false);
  });
  test('役牌雀头没有平和', () => {
    const result = evaluateHand(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 33, 33],
      11,
      false,
    );
    expect(result.yaku.some((y) => y.name === '平和')).toBe(false);
  });
});
