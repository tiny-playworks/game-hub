import { describe, expect, test } from '@rstest/core';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';
import { getKakanOptions } from '../src/pages/mahjong/japanese/helpers';
import { applyAbortiveDrawChecks } from '../src/pages/mahjong/japanese/shared/abortiveDrawChecks';
import {
  applyClaimPassToState,
  applyKakanRinshanAfterPass,
} from '../src/pages/mahjong/japanese/shared/claimTransitions';
import {
  appendTimeoutEvent,
  buildStateAfterTimeoutDiscard,
} from '../src/pages/mahjong/japanese/shared/timeoutTransitions';
import type { RiichiGameState } from '../src/pages/mahjong/japanese/types';

/** 要牌阶段用的最小 state：lastDiscardFrom、wall、claimIndex 等已设好 */
function claimPhaseState(
  overrides: Partial<RiichiGameState> = {},
): RiichiGameState {
  const base = initRiichiGame();
  return {
    ...base,
    phase: 'claim',
    lastDiscard: 0,
    lastDiscardFrom: 2,
    claimIndex: 0,
    wall: [1, 2, 3],
    ...overrides,
  };
}

describe('日麻 shared/claimTransitions', () => {
  test('applyClaimPassToState(type=next) 只推进 claimIndex', () => {
    const g = claimPhaseState({ claimIndex: 0 });
    const next = applyClaimPassToState(g, { type: 'next', nextClaimIndex: 1 });
    expect(next.phase).toBe('claim');
    expect(next.claimIndex).toBe(1);
    expect(next.lastDiscardFrom).toBe(2);
  });

  test('applyClaimPassToState(type=ryuukyoku) 设为荒牌流局，下一家 currentPlayer', () => {
    const g = claimPhaseState({ claimIndex: 2, wall: [] });
    const next = applyClaimPassToState(g, { type: 'ryuukyoku' });
    expect(next.phase).toBe('discard');
    expect(next.ryuukyoku).toBe(true);
    expect(next.ryuukyokuReason).toBe('荒牌');
    expect(next.currentPlayer).toBe(3);
    expect(next.lastDiscard).toBeNull();
    expect(next.claimIndex).toBe(0);
  });

  test('applyClaimPassToState(type=draw) 下家摸牌、phase 回 discard、drawnTile 为摸的牌', () => {
    const g = claimPhaseState({ wall: [42, 43], lastDiscardFrom: 1 });
    const next = applyClaimPassToState(g, { type: 'draw' });
    expect(next.phase).toBe('discard');
    expect(next.currentPlayer).toBe(2);
    expect(next.drawnTile).toBe(42);
    expect(next.wall).toEqual([43]);
    expect(next.hands[2]).toContain(42);
    expect(next.lastDiscard).toBeNull();
    expect(next.claimIndex).toBe(0);
  });

  test('applyClaimPassToState(type=draw) 摸牌者 ippatsuPossible 被清除', () => {
    const g = claimPhaseState({
      wall: [42, 43],
      lastDiscardFrom: 1,
      ippatsuPossible: [false, true, false, false],
    });
    const next = applyClaimPassToState(g, { type: 'draw' });
    expect(next.ippatsuPossible[2]).toBe(false);
    expect(next.currentPlayer).toBe(2);
  });

  test('applyKakanRinshanAfterPass 加杠者摸岭上、翻杠宝牌、清除 lastClaimWasKakan', () => {
    const g = claimPhaseState({
      lastDiscard: 4,
      lastDiscardFrom: 0,
      lastClaimWasKakan: true,
      claimIndex: 3,
      wall: [50, 51],
      doraIndicators: [10],
      hands: [
        [0, 1, 2, 3, 5, 6, 7, 8, 9, 10],
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
      ],
    });
    const next = applyKakanRinshanAfterPass(g);
    expect(next.phase).toBe('discard');
    expect(next.currentPlayer).toBe(0);
    expect(next.drawnTile).toBe(50);
    expect(next.wall).toEqual([]);
    expect(next.doraIndicators).toEqual([10, 51]);
    expect(next.lastClaimWasKakan).toBeUndefined();
    expect(next.hands[0]).toContain(50);
    expect(next.ippatsuPossible).toEqual([false, false, false, false]);
  });

  test('opts 可覆盖 timeBanks / furitenStates / lastClaimMsg', () => {
    const g = claimPhaseState({ claimIndex: 0 });
    const next = applyClaimPassToState(
      g,
      { type: 'next', nextClaimIndex: 1 },
      {
        timeBanks: [0, 0, 0, 0],
        lastClaimMsg: '超时自动过',
      },
    );
    expect(next.claimIndex).toBe(1);
    expect(next.timeBanks).toEqual([0, 0, 0, 0]);
    expect(next.lastClaimMsg).toBe('超时自动过');
  });
});

describe('日麻 shared/timeoutTransitions', () => {
  test('buildStateAfterTimeoutDiscard 从 hand 移除牌、进 pile、下一家、phase=claim', () => {
    const base = initRiichiGame();
    const tile = base.hands[0][0];
    const next = buildStateAfterTimeoutDiscard(
      base,
      0,
      [10, 10, 10, 10],
      tile,
      '自家 超时自动打出',
      '超时自动出牌',
    );
    expect(next.currentPlayer).toBe(1);
    expect(next.phase).toBe('claim');
    expect(next.lastDiscard).toBe(tile);
    expect(next.lastDiscardFrom).toBe(0);
    expect(next.drawnTile).toBeNull();
    expect(next.hands[0]).not.toContain(tile);
    expect(next.discardPiles[0]).toContain(tile);
    expect(next.timeoutEvents).toContain('自家 超时自动打出');
    expect(next.lastClaimMsg).toBe('超时自动出牌');
  });

  test('buildStateAfterTimeoutDiscard 若 hand 无该牌则返回原 state', () => {
    const base = initRiichiGame();
    const next = buildStateAfterTimeoutDiscard(
      base,
      0,
      base.timeBanks,
      99999,
      'ev',
      'msg',
    );
    expect(next).toBe(base);
  });

  test('appendTimeoutEvent 追加事件并保留最近 20 条', () => {
    const base = initRiichiGame();
    const withOne = appendTimeoutEvent(base, 'e1');
    expect(withOne.timeoutEvents).toEqual(['e1']);
    let s = withOne;
    for (let i = 2; i <= 25; i++) s = appendTimeoutEvent(s, `e${i}`);
    expect(s.timeoutEvents).toHaveLength(20);
    expect(s.timeoutEvents[0]).toBe('e6');
    expect(s.timeoutEvents[19]).toBe('e25');
  });
});

describe('日麻 shared/abortiveDrawChecks', () => {
  test('无任一条件时返回原 state、无 ryuukyokuReason', () => {
    const base = initRiichiGame();
    const { state, ryuukyokuReason } = applyAbortiveDrawChecks(base);
    expect(state).toBe(base);
    expect(state.ryuukyoku).toBeUndefined();
    expect(ryuukyokuReason).toBeUndefined();
  });

  test('四家立直优先于四风连打、四开杠', () => {
    const base = initRiichiGame();
    const state: RiichiGameState = {
      ...base,
      riichiDeclared: [true, true, true, true],
      discardPiles: [[27], [27], [27], [27]],
      melds: [[], [], [], []],
    };
    const { state: next, ryuukyokuReason } = applyAbortiveDrawChecks(state);
    expect(ryuukyokuReason).toBe('四家立直');
    expect(next.ryuukyoku).toBe(true);
    expect(next.ryuukyokuReason).toBe('四家立直');
  });

  test('无四家立直时四风连打可触发', () => {
    const base = initRiichiGame();
    const state: RiichiGameState = {
      ...base,
      riichiDeclared: [false, false, false, false],
      discardPiles: [[27], [27], [27], [27]],
      melds: [[], [], [], []],
    };
    const { state: next, ryuukyokuReason } = applyAbortiveDrawChecks(state);
    expect(ryuukyokuReason).toBe('四风连打');
    expect(next.ryuukyokuReason).toBe('四风连打');
  });

  test('四开杠在四家立直、四风连打都不满足时触发', () => {
    const base = initRiichiGame();
    const state: RiichiGameState = {
      ...base,
      riichiDeclared: [false, false, false, false],
      discardPiles: [[0], [1], [2], [3]],
      melds: [
        [
          { type: 'mingang', tiles: [0, 1, 2, 3] },
          { type: 'angang', tiles: [4, 5, 6, 7] },
        ],
        [
          { type: 'mingang', tiles: [8, 9, 10, 11] },
          { type: 'angang', tiles: [12, 13, 14, 15] },
        ],
        [],
        [],
      ],
    };
    const { state: next, ryuukyokuReason } = applyAbortiveDrawChecks(state);
    expect(ryuukyokuReason).toBe('四开杠');
    expect(next.ryuukyokuReason).toBe('四开杠');
  });
});

describe('日麻 helpers', () => {
  test('getKakanOptions 无 drawnTile 或非 discard 阶段返回空', () => {
    const base = initRiichiGame();
    expect(getKakanOptions({ ...base, drawnTile: null }, 0)).toEqual([]);
    expect(
      getKakanOptions(
        { ...base, phase: 'claim', drawnTile: 4, currentPlayer: 0 },
        0,
      ),
    ).toEqual([]);
  });

  test('getKakanOptions 有碰且摸到同种第 4 张时返回该碰的下标', () => {
    const base = initRiichiGame();
    const state: RiichiGameState = {
      ...base,
      phase: 'discard',
      currentPlayer: 0,
      drawnTile: 4,
      hands: [
        [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11],
        base.hands[1],
        base.hands[2],
        base.hands[3],
      ],
      melds: [[{ type: 'peng', tiles: [4, 4, 4] }], [], [], []],
    };
    expect(getKakanOptions(state, 0)).toEqual([0]);
  });

  test('getKakanOptions 摸牌与碰不同种时返回空', () => {
    const base = initRiichiGame();
    const state: RiichiGameState = {
      ...base,
      phase: 'discard',
      currentPlayer: 0,
      drawnTile: 0,
      hands: [
        [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
        base.hands[1],
        base.hands[2],
        base.hands[3],
      ],
      melds: [[{ type: 'peng', tiles: [4, 4, 4] }], [], [], []],
    };
    expect(getKakanOptions(state, 0)).toEqual([]);
  });
});
