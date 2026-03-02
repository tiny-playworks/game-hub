/**
 * 日麻 flow 集成测试：用最小 context 驱动 effect，断言 setGame 得到的状态。
 * 覆盖「要牌自动过」路径（claimPlayer=0、无吃碰杠选项时自动 applyClaimPassToState）。
 */
import { describe, expect, test } from '@rstest/core';
import { act, render } from '@testing-library/react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { useRiichiClaimFlow } from '../src/pages/mahjong/japanese/flows/useRiichiClaimFlow';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';
import type { RiichiRuntimeContext } from '../src/pages/mahjong/japanese/shared/riichiRuntimeContext';
import type { RiichiGameState } from '../src/pages/mahjong/japanese/types';

/** 要牌阶段、claimPlayer=0、无吃碰杠：lastDiscardFrom=3, claimIndex=0, hands[0] 与 lastDiscard 不组成吃碰杠 */
function claimPhaseStatePlayer0(
  overrides: Partial<RiichiGameState> = {},
): RiichiGameState {
  const base = initRiichiGame();
  return {
    ...base,
    phase: 'claim',
    lastDiscard: 33,
    lastDiscardFrom: 3,
    claimIndex: 0,
    wall: [1, 2, 3],
    hands: [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      base.hands[1],
      base.hands[2],
      base.hands[3],
    ],
    ...overrides,
  };
}

function noop() {}

function TestHarness({
  initialGame,
  onStateChange,
}: {
  initialGame: RiichiGameState;
  onStateChange: (next: RiichiGameState) => void;
}) {
  const [game, setGameState] = useState<RiichiGameState | null>(initialGame);
  const addLogRef = useRef<(msg: string) => void>(noop);
  const turnClockRef = useRef<{ player: number; startedAt: number } | null>(
    null,
  );

  const setGame = useCallback(
    (
      updater:
        | RiichiGameState
        | null
        | ((prev: RiichiGameState | null) => RiichiGameState | null),
    ) => {
      setGameState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next) onStateChange(next);
        return next;
      });
    },
    [onStateChange],
  );

  const ctx: RiichiRuntimeContext = {
    game,
    setGame,
    addLog: noop,
    addLogRef: addLogRef as RefObject<(msg: string) => void>,
    turnClockRef: turnClockRef as RiichiRuntimeContext['turnClockRef'],
    sounds: {
      playRon: noop,
      playRyuukyoku: noop,
      playRiichi: noop,
      playChi: noop,
      playPon: noop,
      playKan: noop,
      playTsumo: noop,
      playDiscard: noop,
      playDraw: noop,
      playTimeWarning: noop,
    },
    setWinResult: noop,
    consumeSeatTimeBank: (s) => s.timeBanks,
    getElapsedSecondsForSeat: () => 0,
    getWaitingTilesRiichi: () => [],
    buildYakuCtx: () => null,
    clockNowMs: 0,
    setClockNowMs: noop,
    setDeclinedRonToken: noop,
    markSeatRonDeclined: noop,
  };

  useRiichiClaimFlow(ctx, {
    claimPlayer: 0,
    hasAnyClaimOption: false,
    canRon: false,
    isSeatFuriten: () => false,
  });

  return <div data-testid="harness" />;
}

describe('日麻 flow 集成（要牌自动过）', () => {
  test('claimPlayer=0 且无吃碰杠时，effect 推进 claimIndex（passResult=next）', () => {
    const initial = claimPhaseStatePlayer0({ claimIndex: 0, wall: [1, 2, 3] });
    let captured: RiichiGameState | undefined;
    let captureCount = 0;
    render(
      <TestHarness
        initialGame={initial}
        onStateChange={(next) => {
          if (captureCount++ === 0) captured = next;
        }}
      />,
    );
    act(() => {});
    expect(captured).toBeDefined();
    expect(captured?.phase).toBe('claim');
    expect(captured?.claimIndex).toBe(1);
    expect(captured?.lastDiscardFrom).toBe(3);
  });

  test('claimIndex=2 且 wall 有一张时，effect 进入 draw：phase=discard、下家摸牌', () => {
    const initial = claimPhaseStatePlayer0({
      claimIndex: 2,
      wall: [99],
      lastDiscardFrom: 1,
    });
    let captured: RiichiGameState | undefined;
    render(
      <TestHarness
        initialGame={initial}
        onStateChange={(next) => {
          captured = next;
        }}
      />,
    );
    act(() => {});
    expect(captured).toBeDefined();
    expect(captured?.phase).toBe('discard');
    expect(captured?.currentPlayer).toBe(2);
    expect(captured?.drawnTile).toBe(99);
    expect(captured?.wall).toEqual([]);
  });

  test('claimIndex=2 且 wall 空时，effect 进入荒牌流局', () => {
    const initial = claimPhaseStatePlayer0({
      claimIndex: 2,
      wall: [],
      lastDiscardFrom: 1,
    });
    let captured: RiichiGameState | undefined;
    render(
      <TestHarness
        initialGame={initial}
        onStateChange={(next) => {
          captured = next;
        }}
      />,
    );
    act(() => {});
    expect(captured).toBeDefined();
    expect(captured?.phase).toBe('discard');
    expect(captured?.ryuukyoku).toBe(true);
    expect(captured?.ryuukyokuReason).toBe('荒牌');
    expect(captured?.currentPlayer).toBe(2);
  });
});
