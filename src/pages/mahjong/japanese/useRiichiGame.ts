import { useCallback, useEffect, useRef } from 'react';
import { useRiichiSounds } from '@/hooks/useRiichiSounds';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import { computeWaitingTilesRiichi } from '@/lib/riichiWaitingTiles';
import { useRiichiClaimActions } from './actions/useRiichiClaimActions';
import { useRiichiRoundActions } from './actions/useRiichiRoundActions';
import { useRiichiWinSpecialActions } from './actions/useRiichiWinSpecialActions';
import { MAX_HISTORY, MAX_LOG } from './constants';
import { useRiichiClaimFlow } from './flows/useRiichiClaimFlow';
import { useRiichiDrawAiFlow } from './flows/useRiichiDrawAiFlow';
import { useRiichiTurnClockFlow } from './flows/useRiichiTurnClockFlow';
import type { RiichiRoundContext } from './shared/riichiRoundContext';
import type { RiichiRuntimeContext } from './shared/riichiRuntimeContext';
import { useRiichiGameStore } from './store/riichiGameStore';
import type { RiichiGameState, RiichiMeld } from './types';
import { useRiichiDerived } from './useRiichiDerived';

export function useRiichiGame() {
  const sounds = useRiichiSounds();
  const {
    view,
    setView,
    matchLength,
    setMatchLength,
    game,
    setGame,
    history,
    setHistory,
    gameLog,
    setGameLog,
    logOpen,
    setLogOpen,
    winResult,
    setWinResult,
    showGuide,
    setShowGuide,
    declinedRonToken,
    setDeclinedRonToken,
    clockNowMs,
    setClockNowMs,
    matchEnd,
    setMatchEnd,
  } = useRiichiGameStore((s) => ({
    view: s.view,
    setView: s.setView,
    matchLength: s.matchLength,
    setMatchLength: s.setMatchLength,
    game: s.game,
    setGame: s.setGame,
    history: s.history,
    setHistory: s.setHistory,
    gameLog: s.gameLog,
    setGameLog: s.setGameLog,
    logOpen: s.logOpen,
    setLogOpen: s.setLogOpen,
    winResult: s.winResult,
    setWinResult: s.setWinResult,
    showGuide: s.showGuide,
    setShowGuide: s.setShowGuide,
    declinedRonToken: s.declinedRonToken,
    setDeclinedRonToken: s.setDeclinedRonToken,
    clockNowMs: s.clockNowMs,
    setClockNowMs: s.setClockNowMs,
    matchEnd: s.matchEnd,
    setMatchEnd: s.setMatchEnd,
  }));
  const prevGameRef = useRef<RiichiGameState | null>(null);
  const undoingRef = useRef(false);
  const addLogRef = useRef<(msg: string) => void>(() => {});
  const turnClockRef = useRef<{ player: number; startedAt: number } | null>(
    null,
  );

  const addLog = useCallback(
    (msg: string) => {
      const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
      setGameLog((l) => [...l, line].slice(-MAX_LOG));
    },
    [setGameLog],
  );
  addLogRef.current = addLog;

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      return;
    }
    if (undoingRef.current) {
      undoingRef.current = false;
      prevGameRef.current = game;
      return;
    }
    if (prevGameRef.current != null) {
      try {
        setHistory((h) =>
          [...h, JSON.parse(JSON.stringify(prevGameRef.current))].slice(
            -MAX_HISTORY,
          ),
        );
      } catch {
        // skip clone if too large
      }
    }
    prevGameRef.current = game;
  }, [game, setHistory]);

  const getElapsedSecondsForSeat = useCallback((seat: number): number => {
    const c = turnClockRef.current;
    if (!c || c.player !== seat) return 0;
    return Math.max(0, (Date.now() - c.startedAt) / 1000);
  }, []);

  const consumeSeatTimeBank = useCallback(
    (state: RiichiGameState, seat: number): number[] => {
      const elapsed = getElapsedSecondsForSeat(seat);
      if (elapsed <= 0) return state.timeBanks;
      return state.timeBanks.map((tb, i) =>
        i === seat ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
    },
    [getElapsedSecondsForSeat],
  );

  const markSeatRonDeclined = useCallback(
    (seat: number) => {
      setGame((g) => {
        if (!g) return g;
        const furitenStates = g.furitenStates.map((s, i) =>
          i === seat
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                g.riichiDeclared[seat],
              )
            : s,
        );
        return { ...g, furitenStates };
      });
    },
    [setGame],
  );

  /** 获取听牌信息（需传入 game 以取 roundWind/dealer） */
  const getWaitingTilesRiichi = useCallback(
    (
      hand: number[],
      melds: RiichiMeld[],
      gameState?: RiichiGameState | null,
      options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
    ): number[] => {
      const slice = gameState
        ? {
            roundWind: gameState.roundWind,
            dealer: gameState.dealer,
            riichiDeclared: gameState.riichiDeclared,
          }
        : undefined;
      return computeWaitingTilesRiichi(hand, melds, slice, options);
    },
    [],
  );

  const {
    tenpaiHint,
    angangOptions,
    kakanOptions,
    canKyuushuKyuuhai,
    isMyTurn,
    isClaimPhase,
    claimPlayer,
    isMyClaim,
    currentClaimToken,
    chiOptions,
    canPeng,
    canMingang,
    isSeatFuriten,
    canTsumo,
    canRon,
    hasNonRonClaimOption,
    hasAnyClaimOption,
    decisionSeat,
    decisionSeatRemainSeconds,
    currentTurnRemainSeconds,
    timerTextClass,
    myFuritenReason,
    winSettlementPreview,
    drawSettlementPreview,
    winnerPaymentSummary,
  } = useRiichiDerived({
    game,
    winResult,
    declinedRonToken,
    getWaitingTilesRiichi,
    clockNowMs,
    turnClockRef,
  });

  const riichiContext: RiichiRuntimeContext = {
    game,
    winResult,
    setGame,
    addLog,
    addLogRef,
    turnClockRef,
    sounds,
    setWinResult,
    consumeSeatTimeBank,
    getElapsedSecondsForSeat,
    getWaitingTilesRiichi,
    clockNowMs,
    setClockNowMs,
    setDeclinedRonToken,
    markSeatRonDeclined,
  };

  const { discard, passClaim, doChi, doPeng, doMingang } =
    useRiichiClaimActions(riichiContext);

  useRiichiTurnClockFlow(riichiContext, {
    decisionSeat,
    currentTurnRemainSeconds,
  });

  useRiichiDrawAiFlow(riichiContext);

  const {
    doTsumo,
    doRon,
    passRonOpportunity,
    doRiichi,
    doAngang,
    doKakan,
    doKyuushuKyuuhai,
  } = useRiichiWinSpecialActions(riichiContext, {
    canTsumo,
    canRon,
    canKyuushuKyuuhai,
    currentClaimToken,
  });

  const riichiRoundContext: RiichiRoundContext = {
    history,
    matchLength,
    game,
    winResult,
    setView,
    setGame,
    setHistory,
    setGameLog,
    setWinResult,
    setMatchEnd,
    setDeclinedRonToken,
    undoingRef,
    addLog,
    getWaitingTilesRiichi,
  };

  const { undo, startGame, proceedToNextRound, proceedAfterRyuukyoku } =
    useRiichiRoundActions(riichiRoundContext);

  useRiichiClaimFlow(riichiContext, {
    claimPlayer,
    hasAnyClaimOption: Boolean(hasAnyClaimOption),
    canRon: Boolean(canRon),
    isSeatFuriten,
  });

  return {
    view,
    setView,
    matchLength,
    setMatchLength,
    game,
    setGame,
    history,
    gameLog,
    logOpen,
    setLogOpen,
    winResult,
    showGuide,
    setShowGuide,
    matchEnd,
    startGame,
    undo,
    addLog,
    discard,
    doTsumo,
    doRon,
    doChi,
    doPeng,
    doMingang,
    doAngang,
    doKakan,
    doRiichi,
    doKyuushuKyuuhai,
    passClaim,
    passRonOpportunity,
    proceedToNextRound,
    proceedAfterRyuukyoku,
    isClaimPhase,
    claimPlayer,
    isMyTurn,
    isMyClaim,
    chiOptions,
    canPeng,
    canMingang,
    canRon,
    hasAnyClaimOption,
    hasNonRonClaimOption,
    myFuritenReason,
    tenpaiHint,
    winSettlementPreview,
    drawSettlementPreview,
    winnerPaymentSummary,
    decisionSeat,
    decisionSeatRemainSeconds,
    currentTurnRemainSeconds,
    timerTextClass,
    angangOptions,
    kakanOptions,
    canKyuushuKyuuhai,
    getWaitingTilesRiichi,
    canTsumo,
  };
}
