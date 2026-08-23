import { useCallback } from 'react';
import { getBaseTile, getTileLabel, isMenzhen } from '@/lib/mahjongRiichi';
import { shouldAbortOnSuukaikan } from '@/lib/riichiAbortiveDraw';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import {
  createRiichiWinResult,
  evaluateGameWin,
  formatRiichiWinValue,
} from '../gameLogic/winResult';
import { clearSeatDoujunStates } from '../helpers';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';

interface WinSpecialActionsExtra {
  canTsumo: boolean | null | undefined;
  canRon: boolean | null | undefined;
  canKyuushuKyuuhai: boolean | null | undefined;
  currentClaimToken: string | null;
}

export function useRiichiWinSpecialActions(
  ctx: RiichiRuntimeContext,
  extra: WinSpecialActionsExtra,
) {
  const {
    game,
    setGame,
    setWinResult,
    addLog,
    sounds,
    setDeclinedRonToken,
    consumeSeatTimeBank,
    markSeatRonDeclined,
    turnClockRef,
    getWaitingTilesRiichi,
  } = ctx;
  const { canTsumo, canRon, canKyuushuKyuuhai, currentClaimToken } = extra;
  const doRiichi = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.riichiDeclared[0]
    )
      return;

    const melds = game.melds[0];
    if (!isMenzhen(melds)) return;

    const waitingTiles = getWaitingTilesRiichi(game.hands[0], melds, game, {
      seat: 0,
      isTsumo: false,
      treatAsRiichi: true,
    });
    if (waitingTiles.length === 0) return;
    if (game.scores[0] < 1000) {
      addLog('点数不足 1000，不能立直');
      return;
    }

    addLog('自家 立直宣言！（-1000 点）');
    sounds.playRiichi();

    setGame({
      ...game,
      scores: game.scores.map((v, i) => (i === 0 ? v - 1000 : v)),
      riichiPot: game.riichiPot + 1000,
      riichiDeclared: game.riichiDeclared.map((declared, i) =>
        i === 0 ? true : declared,
      ),
      ippatsuPossible: game.ippatsuPossible.map((v, i) => (i === 0 ? true : v)),
      lastClaimMsg: '立直宣言！听牌固定，不能换牌',
    });
    recordRiichiProgressEvent('declare-riichi');
  }, [game, addLog, getWaitingTilesRiichi, sounds, setGame]);

  const doAngang = useCallback(
    (fourTiles: number[]) => {
      if (
        !game ||
        game.phase !== 'discard' ||
        game.currentPlayer !== 0 ||
        game.wall.length < 2
      )
        return;
      const h0 = [...game.hands[0]];
      for (const t of fourTiles) {
        const i = h0.indexOf(t);
        if (i === -1) return;
        h0.splice(i, 1);
      }
      if (h0.length !== 10) return;
      const handAfterKan = [...h0];
      const melds = game.melds.map((m, i) =>
        i === 0 ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
      );
      if (shouldAbortOnSuukaikan(melds)) {
        addLog('流局（四开杠）');
        sounds.playRyuukyoku();
        recordRiichiProgressEvent('finish-round');
        setGame({
          ...game,
          hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
          melds,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: 0,
          drawnTile: null,
          lastDrawWasRinshan: false,
          lastClaimMsg: null,
          ryuukyoku: true,
          ryuukyokuReason: '四开杠',
        });
        return;
      }
      addLog(`自家 暗杠 ${getTileLabel(fourTiles[0])}`);
      sounds.playKan();
      setGame({
        ...game,
        hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
        melds,
        phase: 'claim',
        lastDiscard: fourTiles[0],
        lastDiscardFrom: 0,
        claimIndex: 0,
        currentPlayer: 1,
        drawnTile: null,
        lastDrawWasRinshan: false,
        lastClaimMsg: `自家 暗杠 ${getTileLabel(fourTiles[0])}`,
        lastClaimWasKakan: true,
        ippatsuPossible: [false, false, false, false],
        furitenStates: clearSeatDoujunStates(game.furitenStates, 0),
      });
    },
    [game, addLog, sounds, setGame],
  );

  const doKakan = useCallback(
    (meldIndex: number) => {
      if (
        !game ||
        game.phase !== 'discard' ||
        game.currentPlayer !== 0 ||
        game.drawnTile === null
      )
        return;
      const melds0 = game.melds[0];
      const m = melds0[meldIndex];
      if (!m || m.type !== 'peng' || m.tiles.length !== 3) return;
      const drawn = game.drawnTile;
      if (getBaseTile(drawn) !== getBaseTile(m.tiles[0])) return;
      const hand0 = [...game.hands[0]];
      const idx = hand0.indexOf(drawn);
      if (idx === -1) return;
      hand0.splice(idx, 1);
      const newMelds = game.melds.map((melds, i) =>
        i === 0
          ? melds.map((mm, j) =>
              j === meldIndex
                ? { ...mm, type: 'kakan' as const, tiles: [...mm.tiles, drawn] }
                : mm,
            )
          : melds,
      );
      addLog(`自家 加杠 ${getTileLabel(drawn)}`);
      sounds.playKan();
      setGame({
        ...game,
        hands: game.hands.map((h, i) => (i === 0 ? hand0 : h)),
        melds: newMelds,
        phase: 'claim',
        lastDiscard: drawn,
        lastDiscardFrom: 0,
        claimIndex: 0,
        drawnTile: null,
        lastDrawWasRinshan: false,
        lastClaimMsg: null,
        lastClaimWasKakan: true,
        ippatsuPossible: [false, false, false, false],
      });
    },
    [game, addLog, sounds, setGame],
  );

  const doKyuushuKyuuhai = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.hands[0].length !== 14
    )
      return;
    const isFirstTurnSelf = game.discardPiles[0].length === 0;
    if (!isFirstTurnSelf) return;
    if (!canKyuushuKyuuhai) return;
    addLog('自家 九种九牌，途中流局');
    sounds.playRyuukyoku();
    recordRiichiProgressEvent('finish-round');
    setGame({
      ...game,
      ryuukyoku: true,
      ryuukyokuReason: '九种九牌',
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      lastClaimMsg: null,
    });
  }, [game, canKyuushuKyuuhai, addLog, sounds, setGame]);

  const doTsumo = useCallback(() => {
    if (!game || !canTsumo || game.drawnTile === null) return;
    let evaluation: ReturnType<typeof evaluateGameWin>;
    try {
      evaluation = evaluateGameWin({
        state: game,
        winner: 0,
        isTsumo: true,
        winningTile: game.drawnTile,
      });
    } catch {
      addLog('规则计算失败，本次自摸未结算');
      return;
    }
    if (!evaluation.legalWin) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    addLog(`自家 自摸！${formatRiichiWinValue(evaluation)}`);
    sounds.playTsumo();
    recordRiichiProgressEvent('win-hand');
    recordRiichiProgressEvent('tsumo-win');
    recordRiichiProgressEvent('finish-round');
    setWinResult(createRiichiWinResult(game, 0, true, evaluation));
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canTsumo,
    addLog,
    sounds,
    consumeSeatTimeBank,
    setGame,
    setWinResult,
    turnClockRef,
  ]);

  const doRon = useCallback(() => {
    if (!game || !canRon || game.lastDiscard === null) return;
    let evaluation: ReturnType<typeof evaluateGameWin>;
    try {
      evaluation = evaluateGameWin({
        state: game,
        winner: 0,
        isTsumo: false,
        winningTile: game.lastDiscard,
        afterKan: game.lastClaimWasKakan ?? false,
      });
    } catch {
      addLog('规则计算失败，本次荣和未结算');
      return;
    }
    if (!evaluation.legalWin) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    addLog(
      `自家 荣和 ${getTileLabel(game.lastDiscard)}！${formatRiichiWinValue(evaluation)}`,
    );
    sounds.playRon();
    recordRiichiProgressEvent('win-hand');
    recordRiichiProgressEvent('finish-round');
    setWinResult(createRiichiWinResult(game, 0, false, evaluation));
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canRon,
    addLog,
    sounds,
    consumeSeatTimeBank,
    setGame,
    setWinResult,
    turnClockRef,
  ]);

  const passRonOpportunity = useCallback(() => {
    if (!currentClaimToken) return;
    markSeatRonDeclined(0);
    setGame((g) => (g ? { ...g, timeBanks: consumeSeatTimeBank(g, 0) } : g));
    turnClockRef.current = null;
    setDeclinedRonToken(currentClaimToken);
    addLog('自家 过（放弃荣和）');
  }, [
    currentClaimToken,
    addLog,
    markSeatRonDeclined,
    consumeSeatTimeBank,
    setDeclinedRonToken,
    setGame,
    turnClockRef,
  ]);

  return {
    doTsumo,
    doRon,
    passRonOpportunity,
    doRiichi,
    doAngang,
    doKakan,
    doKyuushuKyuuhai,
  };
}
