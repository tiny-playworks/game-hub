import { useCallback } from 'react';
import {
  calcFu,
  calcScore,
  computeYaku,
  getBaseTile,
  getTileLabel,
  getTotalHan,
  isMenzhen,
} from '@/lib/mahjongRiichi';
import { shouldAbortOnSuukaikan } from '@/lib/riichiAbortiveDraw';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import {
  buildRiichiInput,
  calcWithRiichiRs,
  type GameStateForRs,
} from '@/lib/riichiRsAdapter';
import { enrichWinResultWithUra } from '../gameLogic/winResult';
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
    buildYakuCtx,
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
    if (!game || !canTsumo) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const hand = game.hands[0];
    const stateForRs: GameStateForRs = {
      hand,
      melds: game.melds[0],
      doraIndicators: game.doraIndicators,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
      ippatsu: game.riichiDeclared[0] && (game.ippatsuPossible?.[0] ?? false),
      winnerSeat: 0,
    };
    const input = buildRiichiInput(stateForRs, true);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(`自家 自摸！${rs.fu}符 ${rs.han}番 ${rs.ten}点`);
      sounds.playTsumo();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: true,
        handWithWin: hand,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      recordRiichiProgressEvent('win-hand');
      recordRiichiProgressEvent('tsumo-win');
      recordRiichiProgressEvent('finish-round');
      setWinResult({
        winner: 0,
        isTsumo: true,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, hand, true);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(`自家 自摸！役: ${yaku.map((y) => y.name).join(' ')}`);
    sounds.playTsumo();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: true,
      isMenzhen: isMenzhen(game.melds[0]),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, true);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: true,
      handWithWin: hand,
      yaku,
      fu,
      han,
      ten,
    });
    recordRiichiProgressEvent('win-hand');
    recordRiichiProgressEvent('tsumo-win');
    recordRiichiProgressEvent('finish-round');
    setWinResult({
      winner: 0,
      isTsumo: true,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canTsumo,
    buildYakuCtx,
    addLog,
    sounds,
    consumeSeatTimeBank,
    setGame,
    setWinResult,
    turnClockRef,
  ]);

  const doRon = useCallback(() => {
    if (!game || !canRon || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const handWithClaim = [...game.hands[0], game.lastDiscard];
    const stateForRs: GameStateForRs = {
      hand: handWithClaim,
      melds: game.melds[0],
      doraIndicators: game.doraIndicators,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
      ippatsu: game.riichiDeclared[0] && (game.ippatsuPossible?.[0] ?? false),
      afterKan: game.lastClaimWasKakan ?? false,
      winnerSeat: 0,
    };
    const input = buildRiichiInput(stateForRs, false, game.lastDiscard);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(
        `自家 荣和 ${getTileLabel(game.lastDiscard)}！${rs.fu}符 ${rs.han}番 ${rs.ten}点`,
      );
      sounds.playRon();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: false,
        handWithWin: handWithClaim,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      recordRiichiProgressEvent('win-hand');
      recordRiichiProgressEvent('finish-round');
      setWinResult({
        winner: 0,
        isTsumo: false,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, handWithClaim, false);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(
      `自家 荣和 ${getTileLabel(game.lastDiscard)}！役: ${yaku.map((y) => y.name).join(' ')}`,
    );
    sounds.playRon();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: false,
      isMenzhen: isMenzhen(game.melds[0]),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, false);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: false,
      handWithWin: handWithClaim,
      yaku,
      fu,
      han,
      ten,
    });
    recordRiichiProgressEvent('win-hand');
    recordRiichiProgressEvent('finish-round');
    setWinResult({
      winner: 0,
      isTsumo: false,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canRon,
    buildYakuCtx,
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
