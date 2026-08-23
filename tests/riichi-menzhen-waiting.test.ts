import { describe, expect, test } from '@rstest/core';
import { isMenzhen, isOpenMeld } from '../src/lib/mahjongRiichi';
import { computeWaitingTilesRiichi } from '../src/lib/riichiWaitingTiles';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';
import {
  canSeatRonByRules,
  getRonWaitingTilesForSeatInState,
} from '../src/pages/mahjong/japanese/helpers';
import type {
  RiichiGameState,
  RiichiMeld,
} from '../src/pages/mahjong/japanese/types';

/** 与 helpers 中委托路径对齐：荣和振听使用纯结构待牌。 */
function ronWaitingDirect(state: RiichiGameState, seat: number): number[] {
  return computeWaitingTilesRiichi(
    state.hands[seat],
    state.melds[seat],
    state,
    { seat, isTsumo: false },
  );
}

function sortNum(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

/** 无副露：四组面子 + 东单骑，结构上听东。 */
const CLOSED_TENPAI_WAIT_EAST = [
  0,
  1,
  2, // 123m
  3,
  4,
  5, // 456m
  12,
  13,
  14, // 456s
  24,
  25,
  26, // 789p
  27, // 东单骑
];

/** 一副露时合法的 10 张门前牌：三组面子 + 东单骑。 */
const ONE_MELD_TENPAI_WAIT_EAST = [
  0,
  1,
  2, // 123m
  12,
  13,
  14, // 456s
  24,
  25,
  26, // 789p
  27, // 东单骑
];

/** 两副露时合法的 7 张门前牌：两组面子 + 东单骑。 */
const TWO_MELD_TENPAI_WAIT_EAST = [
  0,
  1,
  2, // 123m
  12,
  13,
  14, // 456s
  27, // 东单骑
];

function expectStructuralWaitsAgree(
  state: RiichiGameState,
  seat: number,
  expectedWait: number,
): void {
  const fromHelper = sortNum(getRonWaitingTilesForSeatInState(state, seat));
  const direct = sortNum(ronWaitingDirect(state, seat));
  expect(fromHelper).toEqual(direct);
  expect(fromHelper.length).toBeGreaterThan(0);
  expect(fromHelper).toContain(expectedWait);
}

describe('门前清 isMenzhen / 副露 isOpenMeld', () => {
  test('空副露为门前清', () => {
    expect(isMenzhen([])).toBe(true);
  });

  test('仅暗杠仍为门前清（暗杠不算副露）', () => {
    expect(isMenzhen([{ type: 'angang', tiles: [0, 0, 0, 0] }])).toBe(true);
    expect(
      isMenzhen([
        { type: 'angang', tiles: [4, 4, 4, 4] },
        { type: 'angang', tiles: [8, 8, 8, 8] },
      ]),
    ).toBe(true);
  });

  test('吃/碰/明杠/加杠任一则非门前清', () => {
    expect(isMenzhen([{ type: 'chi', tiles: [0, 1, 2] }])).toBe(false);
    expect(isMenzhen([{ type: 'peng', tiles: [9, 9, 9] }])).toBe(false);
    expect(isMenzhen([{ type: 'mingang', tiles: [12, 12, 12, 12] }])).toBe(
      false,
    );
    expect(isMenzhen([{ type: 'kakan', tiles: [16, 16, 16, 16] }])).toBe(false);
  });

  test('暗杠与副露并存时非门前清', () => {
    expect(
      isMenzhen([
        { type: 'angang', tiles: [0, 0, 0, 0] },
        { type: 'peng', tiles: [4, 4, 4] },
      ]),
    ).toBe(false);
  });

  test('isOpenMeld 与 isMenzhen 互斥定义', () => {
    const types = ['chi', 'peng', 'mingang', 'angang', 'kakan'] as const;
    for (const t of types) {
      const tiles =
        t === 'chi' ? [0, 1, 2] : t === 'peng' ? [0, 0, 0] : [0, 0, 0, 0];
      const m: RiichiMeld = {
        type: t,
        tiles,
      };
      expect(isOpenMeld(m)).toBe(t !== 'angang');
      expect(!isOpenMeld(m)).toBe(isMenzhen([m]));
    }
  });
});

describe('荣和听牌：getRonWaitingTilesForSeatInState 与 computeWaitingTilesRiichi 一致', () => {
  test('默认开局状态（各座 13 张）：两路径结果相同', () => {
    const state = initRiichiGame();
    for (let seat = 0; seat < 4; seat++) {
      const a = getRonWaitingTilesForSeatInState(state, seat);
      const b = ronWaitingDirect(state, seat);
      expect(sortNum(a)).toEqual(sortNum(b));
    }
  });

  test('手牌张数非 13 时 helpers 返回 []，与直接计算一致', () => {
    const state = initRiichiGame();
    state.hands[0] = state.hands[0].slice(0, 12);
    expect(getRonWaitingTilesForSeatInState(state, 0)).toEqual([]);
    expect(ronWaitingDirect(state, 0)).toEqual([]);
  });

  test('带暗杠副露：10 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame(1);
    state.hands[0] = [...ONE_MELD_TENPAI_WAIT_EAST];
    state.melds[0] = [{ type: 'angang', tiles: [22, 22, 22, 22] }];
    expectStructuralWaitsAgree(state, 0, 27);
  });

  test('带明杠副露：10 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame(1);
    state.hands[0] = [...ONE_MELD_TENPAI_WAIT_EAST];
    state.melds[0] = [{ type: 'mingang', tiles: [22, 22, 22, 22] }];
    expectStructuralWaitsAgree(state, 0, 27);
  });

  test('带吃副露：10 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame();
    state.hands[1] = [...ONE_MELD_TENPAI_WAIT_EAST];
    state.melds[1] = [{ type: 'chi', tiles: [3, 4, 5] }];
    expectStructuralWaitsAgree(state, 1, 27);
  });

  test('立直状态不改变纯结构待牌', () => {
    const state = initRiichiGame();
    state.hands[2] = [...CLOSED_TENPAI_WAIT_EAST];
    const beforeRiichi = ronWaitingDirect(state, 2);
    state.riichiDeclared[2] = true;
    expectStructuralWaitsAgree(state, 2, 27);
    expect(sortNum(ronWaitingDirect(state, 2))).toEqual(sortNum(beforeRiichi));
  });

  test('场风/庄家变化不改变纯结构待牌', () => {
    const state = initRiichiGame(2, 1, 3);
    state.hands[1] = [...CLOSED_TENPAI_WAIT_EAST];
    expectStructuralWaitsAgree(state, 1, 27);
  });

  test('带加杠副露：10 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame();
    state.hands[2] = [...ONE_MELD_TENPAI_WAIT_EAST];
    state.melds[2] = [{ type: 'kakan', tiles: [22, 22, 22, 22] }];
    expectStructuralWaitsAgree(state, 2, 27);
  });

  test('多副露（吃+碰）：7 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame();
    state.hands[3] = [...TWO_MELD_TENPAI_WAIT_EAST];
    state.melds[3] = [
      { type: 'chi', tiles: [24, 25, 26] },
      { type: 'peng', tiles: [22, 22, 22] },
    ];
    expectStructuralWaitsAgree(state, 3, 27);
  });

  test('多副露（暗杠+碰）：7 张门前牌得到非空结构待牌，两路径一致', () => {
    const state = initRiichiGame();
    state.hands[1] = [...TWO_MELD_TENPAI_WAIT_EAST];
    state.melds[1] = [
      { type: 'angang', tiles: [22, 22, 22, 22] },
      { type: 'peng', tiles: [6, 6, 6] },
    ];
    expectStructuralWaitsAgree(state, 1, 27);
  });
});

/** 断幺九形：听 2m（index 1），荣和成立时有役 */
const TANYAO_13_WAITING_2M = [2, 3, 4, 5, 6, 6, 6, 10, 11, 12, 13, 14, 15];
const TILE_2M = 1;

describe('canSeatRonByRules 与荣和听牌 / 规则集成', () => {
  function baseClaimState(): RiichiGameState {
    const state = initRiichiGame(0, 0, 1);
    state.phase = 'claim';
    state.hands[1] = [...TANYAO_13_WAITING_2M];
    state.lastDiscard = TILE_2M;
    state.lastDiscardFrom = 0;
    return state;
  }

  test('claim 阶段、他家打出所听牌、断幺九形：canSeatRonByRules 为 true', () => {
    const state = baseClaimState();
    expect(canSeatRonByRules(state, 1)).toBe(true);
    expect(sortNum(getRonWaitingTilesForSeatInState(state, 1))).toContain(
      TILE_2M,
    );
  });

  test('phase 非 claim：荣和规则不通过', () => {
    const state = baseClaimState();
    state.phase = 'discard';
    expect(canSeatRonByRules(state, 1)).toBe(false);
  });

  test('无舍牌（lastDiscard 为空）：荣和规则不通过', () => {
    const state = baseClaimState();
    state.lastDiscard = null;
    expect(canSeatRonByRules(state, 1)).toBe(false);
  });

  test('舍牌来自本家：荣和规则不通过', () => {
    const state = baseClaimState();
    state.lastDiscardFrom = 1;
    expect(canSeatRonByRules(state, 1)).toBe(false);
  });

  test('手牌+舍牌不成和：荣和规则不通过', () => {
    const state = baseClaimState();
    state.lastDiscard = 33;
    expect(canSeatRonByRules(state, 1)).toBe(false);
  });

  test('舍牌振听：同巡听牌内曾打出所听牌，荣和被挡', () => {
    const state = baseClaimState();
    state.discardPiles[1] = [TILE_2M];
    expect(canSeatRonByRules(state, 1)).toBe(false);
  });
});
