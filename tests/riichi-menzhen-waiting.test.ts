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

/** 与 helpers 中委托路径对齐：荣和听牌 = computeWaitingTilesRiichi(..., isTsumo: false) */
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
    expect(isMenzhen([{ type: 'peng', tiles: [9, 10, 11] }])).toBe(false);
    expect(isMenzhen([{ type: 'mingang', tiles: [12, 13, 14, 15] }])).toBe(
      false,
    );
    expect(isMenzhen([{ type: 'kakan', tiles: [16, 17, 18, 19] }])).toBe(false);
  });

  test('暗杠与副露并存时非门前清', () => {
    expect(
      isMenzhen([
        { type: 'angang', tiles: [0, 0, 0, 0] },
        { type: 'peng', tiles: [4, 5, 6] },
      ]),
    ).toBe(false);
  });

  test('isOpenMeld 与 isMenzhen 互斥定义', () => {
    const types = ['chi', 'peng', 'mingang', 'angang', 'kakan'] as const;
    for (const t of types) {
      const m: RiichiMeld = {
        type: t,
        tiles: [0, 1, 2, 3].slice(0, t === 'chi' || t === 'peng' ? 3 : 4),
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

  test('带暗杠副露：两路径仍一致', () => {
    const state = initRiichiGame(1);
    state.melds[0] = [{ type: 'angang', tiles: [0, 0, 0, 0] }];
    const a = getRonWaitingTilesForSeatInState(state, 0);
    const b = ronWaitingDirect(state, 0);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('带明杠副露：两路径仍一致', () => {
    const state = initRiichiGame(1);
    state.melds[0] = [{ type: 'mingang', tiles: [12, 13, 14, 15] }];
    const a = getRonWaitingTilesForSeatInState(state, 0);
    const b = ronWaitingDirect(state, 0);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('带吃副露：两路径仍一致', () => {
    const state = initRiichiGame();
    state.melds[1] = [{ type: 'chi', tiles: [18, 19, 20] }];
    const a = getRonWaitingTilesForSeatInState(state, 1);
    const b = ronWaitingDirect(state, 1);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('立直宣言后：两路径仍一致', () => {
    const state = initRiichiGame();
    state.riichiDeclared[2] = true;
    const a = getRonWaitingTilesForSeatInState(state, 2);
    const b = ronWaitingDirect(state, 2);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('场风/庄家变化：两路径仍一致', () => {
    const state = initRiichiGame(2, 1, 3);
    const a = getRonWaitingTilesForSeatInState(state, 1);
    const b = ronWaitingDirect(state, 1);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('带明杠副露：两路径仍一致', () => {
    const state = initRiichiGame();
    state.melds[0] = [{ type: 'mingang', tiles: [12, 13, 14, 15] }];
    const a = getRonWaitingTilesForSeatInState(state, 0);
    const b = ronWaitingDirect(state, 0);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('带加杠副露：两路径仍一致', () => {
    const state = initRiichiGame();
    state.melds[2] = [{ type: 'kakan', tiles: [16, 17, 18, 19] }];
    const a = getRonWaitingTilesForSeatInState(state, 2);
    const b = ronWaitingDirect(state, 2);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('多副露（吃+碰）：两路径仍一致', () => {
    const state = initRiichiGame();
    state.melds[3] = [
      { type: 'chi', tiles: [18, 19, 20] },
      { type: 'peng', tiles: [21, 22, 23] },
    ];
    const a = getRonWaitingTilesForSeatInState(state, 3);
    const b = ronWaitingDirect(state, 3);
    expect(sortNum(a)).toEqual(sortNum(b));
  });

  test('多副露（暗杠+碰）：两路径仍一致', () => {
    const state = initRiichiGame();
    state.melds[1] = [
      { type: 'angang', tiles: [0, 0, 0, 0] },
      { type: 'peng', tiles: [8, 9, 10] },
    ];
    const a = getRonWaitingTilesForSeatInState(state, 1);
    const b = ronWaitingDirect(state, 1);
    expect(sortNum(a)).toEqual(sortNum(b));
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
