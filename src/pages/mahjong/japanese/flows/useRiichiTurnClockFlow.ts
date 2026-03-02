import { type RefObject, useEffect, useRef } from 'react';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import {
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
} from '@/lib/riichiAbortiveDraw';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import { consumeTimeBankSeconds, isTurnTimeout } from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import { SEAT_NAMES } from '../constants';
import {
  canSeatRonByRules,
  clearSeatDoujunStates,
  getDecisionSeat,
  needsTimedDecision,
} from '../helpers';
import type { RiichiGameState } from '../types';

type TurnClockRef = RefObject<{
  player: number;
  startedAt: number;
} | null>;

type AddLogRef = RefObject<(msg: string) => void>;

type SetGame = (
  updater:
    | RiichiGameState
    | null
    | ((prev: RiichiGameState | null) => RiichiGameState | null),
) => void;

type SetClockNowMs = (value: number) => void;

interface UseRiichiTurnClockFlowParams {
  game: RiichiGameState | null;
  setGame: SetGame;
  clockNowMs: number;
  setClockNowMs: SetClockNowMs;
  turnClockRef: TurnClockRef;
  addLogRef: AddLogRef;
  decisionSeat: number | null;
  currentTurnRemainSeconds: number | null;
  playTimeWarning: () => void;
}

export function useRiichiTurnClockFlow({
  game,
  setGame,
  clockNowMs,
  setClockNowMs,
  turnClockRef,
  addLogRef,
  decisionSeat,
  currentTurnRemainSeconds,
  playTimeWarning,
}: UseRiichiTurnClockFlowParams) {
  useEffect(() => {
    const id = window.setInterval(() => setClockNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [setClockNowMs]);

  useEffect(() => {
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
    turnClockRef,
  ]);

  useEffect(() => {
    if (!game || !needsTimedDecision(game)) return;
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
        if (passResult.type === 'next') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            claimIndex: passResult.nextClaimIndex,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
          };
        }
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (passResult.type === 'ryuukyoku') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过（流局）`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
            ryuukyoku: true,
            ryuukyokuReason: '荒牌',
          };
        }
        const draw = g.wall[0];
        const newWall = g.wall.slice(1);
        const newHands = g.hands.map((h) => [...h]);
        newHands[nextPlayer].push(draw);
        newHands[nextPlayer].sort(
          (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
        );
        addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
        turnClockRef.current = null;
        return {
          ...g,
          timeBanks: nextBanks,
          furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
          hands: newHands,
          wall: newWall,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
        };
      }
      const toDiscard = g.drawnTile ?? g.hands[player][0];
      if (toDiscard === undefined) return g;
      const hand = [...g.hands[player]];
      const idx = hand.indexOf(toDiscard);
      if (idx < 0) return g;
      hand.splice(idx, 1);
      const piles = g.discardPiles.map((q) => [...q]);
      piles[player].push(toDiscard);
      const nextPlayer = (player + 1) % 4;
      addLogRef.current(
        `${SEAT_NAMES[player]} 超时，自动打出 ${getTileLabel(toDiscard)}`,
      );
      const timeoutEvent = `${SEAT_NAMES[player]} 超时自动打出 ${getTileLabel(toDiscard)}`;
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...g,
        timeoutEvents: [...g.timeoutEvents, timeoutEvent].slice(-20),
        timeBanks: nextBanks,
        hands: g.hands.map((h, i) => (i === player ? hand : h)),
        discardPiles: piles,
        currentPlayer: nextPlayer,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: player,
        claimIndex: 0,
        lastClaimMsg: `${SEAT_NAMES[player]} 超时自动出牌`,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLogRef.current('流局（四家立直）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        };
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLogRef.current('流局（四风连打）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        };
      }
      return nextState;
    });
  }, [clockNowMs, game, setGame, turnClockRef, addLogRef]);

  const decisionTurnKey =
    game && decisionSeat !== null
      ? `${game.phase}:${decisionSeat}:${game.currentPlayer}:${game.claimIndex}:${game.lastDiscardFrom ?? -1}:${game.lastDiscard ?? -1}`
      : null;

  const lowTimeWarnedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game || decisionSeat !== 0 || currentTurnRemainSeconds == null) return;
    if (currentTurnRemainSeconds > 3 || currentTurnRemainSeconds <= 0) return;
    if (!decisionTurnKey) return;
    if (lowTimeWarnedTurnRef.current === decisionTurnKey) return;
    playTimeWarning();
    lowTimeWarnedTurnRef.current = decisionTurnKey;
  }, [
    game,
    decisionSeat,
    currentTurnRemainSeconds,
    decisionTurnKey,
    playTimeWarning,
  ]);
}
