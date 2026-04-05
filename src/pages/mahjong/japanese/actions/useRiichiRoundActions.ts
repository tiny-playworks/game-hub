import { useCallback } from 'react';
import { rankSeatsByScore, resolveRiichiMatchEnd } from '@/lib/riichiGameEnd';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import {
  type PaymentDetail,
  settleRyuukyoku,
  settleWin,
} from '@/lib/riichiSettlement';
import { DEFAULT_SCORES, DEFAULT_TIME_BANKS, SEAT_NAMES } from '../constants';
import { resolveWinBaseTen } from '../gameLogic/winResult';
import { initRiichiGame } from '../gameState';
import {
  formatPoints,
  getMatchEndReasonText,
  getNextRound,
  getTenpaiSeatsForDraw,
} from '../helpers';
import type { RiichiRoundContext } from '../shared/riichiRoundContext';

export function useRiichiRoundActions(ctx: RiichiRoundContext) {
  const {
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
  } = ctx;
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    undoingRef.current = true;
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    addLog('回退一步');
  }, [
    history.length,
    addLog,
    history[history.length - 1],
    setGame,
    setHistory,
    undoingRef,
  ]);

  const startGame = useCallback(() => {
    setHistory([]);
    setGameLog([]);
    setWinResult(null);
    setMatchEnd(null);
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        0,
        0,
        1,
        0,
        DEFAULT_SCORES,
        DEFAULT_TIME_BANKS,
        0,
        undefined,
        matchLength,
      ),
    );
    recordRiichiProgressEvent('enter-game');
    setView('game');
    addLog(matchLength === 'east' ? '东风场 新一局' : '南风场 新一局');
  }, [
    addLog,
    matchLength,
    setDeclinedRonToken,
    setGame,
    setGameLog,
    setHistory,
    setMatchEnd,
    setView,
    setWinResult,
  ]);

  const proceedToNextRound = useCallback(() => {
    if (!game || !winResult) return;
    const baseTen = resolveWinBaseTen(winResult, game);
    const settlement = settleWin({
      scores: game.scores,
      winner: winResult.winner,
      isTsumo: winResult.isTsumo,
      baseTen,
      dealer: game.dealer,
      honba: game.honba,
      riichiPot: game.riichiPot,
      ronFrom: game.lastDiscardFrom,
    });
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`本局结算：${scoreLine}`);
    const dealerWon = game.dealer === winResult.winner;
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays: dealerWon,
      matchLength: game.matchLength,
    });
    if (end.end && end.reason) {
      setWinResult(null);
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      dealerWon,
    );
    setWinResult(null);
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          timeoutEvents: game.timeoutEvents,
        },
        game.matchLength,
      ),
    );
    addLog(dealerWon ? '庄家胡，连庄' : '子家胡，换庄');
  }, [
    game,
    winResult,
    addLog,
    setDeclinedRonToken,
    setGame,
    setMatchEnd,
    setWinResult,
  ]);

  const proceedAfterRyuukyoku = useCallback(() => {
    if (!game?.ryuukyoku) return;
    const reason = game.ryuukyokuReason ?? '荒牌';
    const isExhaustiveDraw = reason === '荒牌';
    const tenpaiSeats = isExhaustiveDraw
      ? getTenpaiSeatsForDraw(game, getWaitingTilesRiichi)
      : [];
    const settlement = isExhaustiveDraw
      ? settleRyuukyoku(game.scores, tenpaiSeats, game.riichiPot)
      : {
          payments: [] as PaymentDetail[],
          deltas: [0, 0, 0, 0],
          newScores: [...game.scores],
          nextRiichiPot: game.riichiPot,
        };
    const dealerStays = isExhaustiveDraw
      ? tenpaiSeats.includes(game.dealer)
      : true;
    const tenpaiText = !isExhaustiveDraw
      ? '途中流局（不执行不听罚符）'
      : tenpaiSeats.length === 0
        ? '无人听牌'
        : tenpaiSeats.length === 4
          ? '全员听牌'
          : `听牌：${tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`;
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`流局结算（${tenpaiText}）：${scoreLine}`);
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays,
      matchLength: game.matchLength,
    });
    if (end.end && end.reason) {
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      dealerStays,
    );
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          tenpaiSeats: isExhaustiveDraw ? tenpaiSeats : undefined,
          timeoutEvents: game.timeoutEvents,
        },
        game.matchLength,
      ),
    );
    addLog(`流局（${reason}），${dealerStays ? '连庄' : '换庄'}`);
  }, [
    game,
    addLog,
    getWaitingTilesRiichi,
    setDeclinedRonToken,
    setGame,
    setMatchEnd,
  ]);

  return {
    undo,
    startGame,
    proceedToNextRound,
    proceedAfterRyuukyoku,
  };
}
