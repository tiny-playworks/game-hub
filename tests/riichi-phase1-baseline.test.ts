import { describe, expect, test } from '@rstest/core';
import { getDoraFromIndicator } from '../src/lib/mahjongRiichi';
import {
  afterDrawConcealedCount,
  sumMeldShapeTileCount,
  sumMeldTileCount,
  tenpaiConcealedCount,
} from '../src/lib/riichiTenpaiHelpers';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';
import {
  countVisibleTilesByBase,
  getSeatWind,
} from '../src/pages/mahjong/japanese/helpers';

describe('Phase 1：牌形张数与自风', () => {
  test('杠子物理 4 张，但牌形只占一个 3 张面子', () => {
    const melds = [{ tiles: [4, 4, 4, 4] }];
    expect(sumMeldTileCount(melds)).toBe(4);
    expect(sumMeldShapeTileCount(melds)).toBe(3);
    expect(tenpaiConcealedCount(melds)).toBe(10);
    expect(afterDrawConcealedCount(melds)).toBe(11);
  });

  test('多个吃碰杠都按面子数推导门前张数', () => {
    const melds = [
      { tiles: [0, 1, 2] },
      { tiles: [9, 9, 9] },
      { tiles: [18, 18, 18, 18] },
    ];
    expect(sumMeldTileCount(melds)).toBe(10);
    expect(sumMeldShapeTileCount(melds)).toBe(9);
    expect(tenpaiConcealedCount(melds)).toBe(4);
    expect(afterDrawConcealedCount(melds)).toBe(5);
  });

  test('自风只取决于相对庄家座位，与场风无关', () => {
    expect(getSeatWind(0, 2, 2)).toBe(0);
    expect(getSeatWind(1, 2, 2)).toBe(0);
    expect(getSeatWind(1, 3, 2)).toBe(1);
    expect(getSeatWind(2, 1, 2)).toBe(3);
  });
});

describe('Phase 1：三元牌宝牌循环', () => {
  test('白→发、发→中、中→白与项目字牌 ID 一致', () => {
    expect(getDoraFromIndicator(33)).toBe(32);
    expect(getDoraFromIndicator(32)).toBe(31);
    expect(getDoraFromIndicator(31)).toBe(33);
  });
});

describe('Phase 1：公开牌计数', () => {
  test('剩余枚数使用的可见牌包含四家全部副露', () => {
    const state = initRiichiGame();
    state.hands[0] = [0, 0, 4];
    state.melds = [
      [{ type: 'chi', tiles: [1, 2, 3] }],
      [{ type: 'peng', tiles: [9, 9, 9], fromPlayer: 0 }],
      [{ type: 'mingang', tiles: [18, 18, 18, 18], fromPlayer: 1 }],
      [],
    ];
    state.discardPiles = [[27], [28], [], []];
    state.doraIndicators = [29];

    const visible = countVisibleTilesByBase(state);
    expect(visible[0]).toBe(2);
    expect(visible[1]).toBe(1);
    expect(visible[9]).toBe(3);
    expect(visible[18]).toBe(4);
    expect(visible[27]).toBe(1);
    expect(visible[28]).toBe(1);
    expect(visible[29]).toBe(1);
  });
});
