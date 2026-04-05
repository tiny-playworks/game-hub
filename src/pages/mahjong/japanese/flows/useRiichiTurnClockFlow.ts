import { useEffect, useRef } from 'react';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import { consumeTimeBankSeconds, isTurnTimeout } from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import { SEAT_NAMES } from '../constants';
import {
  canSeatRonByRules,
  getDecisionSeat,
  needsTimedDecision,
} from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import {
  applyClaimPassToState,
  applyKakanRinshanAfterPass,
} from '../shared/claimTransitions';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import { buildStateAfterTimeoutDiscard } from '../shared/timeoutTransitions';

interface TurnClockFlowExtra {
  decisionSeat: number | null;
  currentTurnRemainSeconds: number | null;
}

export function useRiichiTurnClockFlow(
  ctx: RiichiRuntimeContext,
  extra: TurnClockFlowExtra,
) {
  const {
    game,
    winResult,
    setGame,
    clockNowMs,
    setClockNowMs,
    turnClockRef,
    addLogRef,
    sounds,
  } = ctx;
  const { decisionSeat, currentTurnRemainSeconds } = extra;
  const playTimeWarning = sounds.playTimeWarning;
  useEffect(() => {
    const id = window.setInterval(() => setClockNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [setClockNowMs]);

  useEffect(() => {
    if (winResult) {
      turnClockRef.current = null;
      return;
    }
    if (!game || !needsTimedDecision(game)) {
      turnClockRef.current = null;
      return;
    }
    const decisionSeatInState = getDecisionSeat(game);
    const current = turnClockRef.current;
    if (!current || current.player !== decisionSeatInState) {
      turnClockRef.current = {
        player: decisionSeatInState,
        startedAt: Date.now(),
      };
    }
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.claimIndex,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.drawnTile,
    game?.hands?.[game?.currentPlayer ?? 0]?.length,
    game,
    winResult,
    turnClockRef,
  ]);

  useEffect(() => {
    if (winResult || !game || !needsTimedDecision(game)) return;
    const player = getDecisionSeat(game);
    const c = turnClockRef.current;
    if (!c || c.player !== player) return;
    const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
    if (!isTurnTimeout(game.timeBanks[player], elapsed)) return;
    setGame((g) => {
      if (!g || !needsTimedDecision(g) || getDecisionSeat(g) !== player)
        return g;
      const nextBanks = g.timeBanks.map((tb, i) =>
        i === player ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      if (g.phase === 'claim' && g.lastDiscardFrom !== null) {
        const ronDeclined = canSeatRonByRules(g, player);
        const nextFuritenStates = ronDeclined
          ? g.furitenStates.map((s, i) =>
              i === player
                ? applyRonDeclinedFuriten(
                    s ?? createInitialFuritenState(),
                    g.riichiDeclared[player],
                  )
                : s,
            )
          : g.furitenStates;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        const next =
          g.lastClaimWasKakan && passResult.type === 'draw'
            ? applyKakanRinshanAfterPass(g, {
                timeBanks: nextBanks,
                furitenStates: nextFuritenStates,
                lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
              })
            : applyClaimPassToState(g, passResult, {
                timeBanks: nextBanks,
                furitenStates: nextFuritenStates,
                lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
              });
        addLogRef.current(
          passResult.type === 'ryuukyoku'
            ? `${SEAT_NAMES[player]} 要牌超时，自动过（流局）`
            : `${SEAT_NAMES[player]} 要牌超时，自动过`,
        );
        turnClockRef.current = null;
        return next;
      }
      const toDiscard = g.drawnTile ?? g.hands[player][0];
      if (toDiscard === undefined) return g;
      addLogRef.current(
        `${SEAT_NAMES[player]} 超时，自动打出 ${getTileLabel(toDiscard)}`,
      );
      const timeoutEvent = `${SEAT_NAMES[player]} 超时自动打出 ${getTileLabel(toDiscard)}`;
      turnClockRef.current = null;
      const nextState = buildStateAfterTimeoutDiscard(
        g,
        player,
        nextBanks,
        toDiscard,
        timeoutEvent,
        `${SEAT_NAMES[player]} 超时自动出牌`,
      );
      const { state: afterAbortive } = applyAbortiveDrawChecks(nextState);
      if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
        addLogRef.current(`流局（${afterAbortive.ryuukyokuReason}）`);
      }
      return afterAbortive;
    });
  }, [clockNowMs, game, winResult, setGame, turnClockRef, addLogRef]);

  const decisionTurnKey =
    game && decisionSeat !== null
      ? `${game.phase}:${decisionSeat}:${game.currentPlayer}:${game.claimIndex}:${game.lastDiscardFrom ?? -1}:${game.lastDiscard ?? -1}`
      : null;

  const lowTimeWarnedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (winResult) return;
    if (!game || decisionSeat !== 0 || currentTurnRemainSeconds == null) return;
    if (currentTurnRemainSeconds > 3 || currentTurnRemainSeconds <= 0) return;
    if (!decisionTurnKey) return;
    if (lowTimeWarnedTurnRef.current === decisionTurnKey) return;
    playTimeWarning();
    lowTimeWarnedTurnRef.current = decisionTurnKey;
  }, [
    winResult,
    game,
    decisionSeat,
    currentTurnRemainSeconds,
    decisionTurnKey,
    playTimeWarning,
  ]);
}
