import { describe, expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { useRiichiClaimActions } from '../src/pages/mahjong/japanese/actions/useRiichiClaimActions';
import { initRiichiGame } from '../src/pages/mahjong/japanese/gameState';
import type { RiichiRuntimeContext } from '../src/pages/mahjong/japanese/shared/riichiRuntimeContext';
import type { RiichiGameState } from '../src/pages/mahjong/japanese/types';

function noop() {}

function DiscardHarness({
  initialGame,
  tile,
  onStateChange,
}: {
  initialGame: RiichiGameState;
  tile: number;
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
    winResult: null,
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
  const { discard } = useRiichiClaimActions(ctx);
  return (
    <button type="button" onClick={() => discard(0, tile)}>
      discard
    </button>
  );
}

describe('日麻手动出牌动作', () => {
  test('自家出牌后进入 claim，并把 currentPlayer 推到下家保持状态语义一致', () => {
    const initial = initRiichiGame();
    const tile = initial.hands[0][0];
    let captured: RiichiGameState | undefined;

    render(
      <DiscardHarness
        initialGame={initial}
        tile={tile}
        onStateChange={(next) => {
          captured = next;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'discard' }));

    expect(captured?.phase).toBe('claim');
    expect(captured?.lastDiscard).toBe(tile);
    expect(captured?.lastDiscardFrom).toBe(0);
    expect(captured?.currentPlayer).toBe(1);
  });
});
