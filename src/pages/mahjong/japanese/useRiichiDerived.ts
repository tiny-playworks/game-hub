import { type RefObject, useCallback, useMemo } from 'react';
import {
  canMingangRiichi,
  canPengRiichi,
  computeYaku,
  countDoraInHand,
  getAngangOptionsRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getDoraFromIndicator,
  getTileLabel,
  getTotalHan,
  hasYaku,
  isWinShapeRiichi,
} from '@/lib/mahjongRiichi';
import { canDeclareKyuushuKyuuhai } from '@/lib/riichiAbortiveDraw';
import { canOfferRon } from '@/lib/riichiClaimFlow';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import {
  createInitialFuritenState,
  isRonForbiddenByFuriten,
} from '@/lib/riichiFuriten';
import {
  type PaymentDetail,
  settleRyuukyoku,
  settleWin,
} from '@/lib/riichiSettlement';
import { resolveWinBaseTen } from './gameLogic/winResult';
import {
  countVisibleTilesByBase,
  getDecisionSeat,
  getKakanOptions,
  getSeatWind,
  getTenpaiSeatsForDraw,
  needsTimedDecision,
  summarizeWinnerPayments,
} from './helpers';
import type { RiichiWinResult } from './store/riichiGameStore';
import type { RiichiGameState, RiichiMeld } from './types';

type TurnClock = { player: number; startedAt: number } | null;

type WaitingTilesFn = (
  hand: number[],
  melds: RiichiMeld[],
  gameState?: RiichiGameState | null,
  options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
) => number[];

type UseRiichiDerivedParams = {
  game: RiichiGameState | null;
  winResult: RiichiWinResult | null;
  declinedRonToken: string | null;
  getWaitingTilesRiichi: WaitingTilesFn;
  clockNowMs: number;
  turnClockRef: RefObject<TurnClock>;
};

export function useRiichiDerived({
  game,
  winResult,
  declinedRonToken,
  getWaitingTilesRiichi,
  clockNowMs,
  turnClockRef,
}: UseRiichiDerivedParams) {
  const tenpaiHint = useMemo(() => {
    if (!game || game.ryuukyoku) return null;
    const hand = game.hands[0];
    const melds = game.melds[0];
    const visibleCounts = countVisibleTilesByBase(game);
    const remaining = (baseTile: number) =>
      Math.max(0, 4 - (visibleCounts[baseTile] ?? 0));
    const doraTypes = game.doraIndicators.map(getDoraFromIndicator);

    const getWaitingTilesShapeOnly = (
      hand13: number[],
      meldList: RiichiMeld[],
    ): number[] => {
      if (hand13.length !== 13) return [];
      const out: number[] = [];
      for (let t = 0; t < 34; t++) {
        if (isWinShapeRiichi([...hand13, t], meldList)) out.push(t);
      }
      return out;
    };

    const getHanForWaitingTile = (
      hand13: number[],
      baseTile: number,
    ): number => {
      const handWithWin = [...hand13, baseTile];
      const ctx = {
        hand: handWithWin,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: melds.every((m) => m.type === 'angang'),
        isTsumo: true,
        isRiichi: game.riichiDeclared[0],
        ippatsuPossible: false,
        seatWind: getSeatWind(game.roundWind, 0, game.dealer),
        roundWind: game.roundWind,
      };
      const yaku = computeYaku(ctx);
      const allTiles = [...handWithWin, ...melds.flatMap((m) => m.tiles)];
      const doraHan = countDoraInHand(allTiles, doraTypes, true);
      return getTotalHan(yaku) + doraHan;
    };

    const formatWait = (hand13: number[], baseTile: number): string => {
      const han = getHanForWaitingTile(hand13, baseTile);
      const hanStr = han > 0 ? `${han}番` : '无役';
      return `${getTileLabel(baseTile)}(剩${remaining(baseTile)}, ${hanStr})`;
    };

    if (hand.length === 13) {
      const waitingShape = getWaitingTilesShapeOnly(hand, melds);
      if (waitingShape.length === 0) return null;
      const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
      return {
        kind: 'current' as const,
        line: `听牌：${uniqueBase.map((b) => formatWait(hand, b)).join(' ')}`,
        waiting: uniqueBase,
        remaining,
      };
    }
    if (hand.length === 14) {
      const options: {
        discardTile: number;
        discardLabel: string;
        waiting: number[];
        line: string;
      }[] = [];
      for (let i = 0; i < hand.length; i++) {
        const handWithout = hand.filter((_, j) => j !== i);
        const waitingShape = getWaitingTilesShapeOnly(handWithout, melds);
        if (waitingShape.length === 0) continue;
        const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
        options.push({
          discardTile: hand[i],
          discardLabel: getTileLabel(hand[i]),
          waiting: uniqueBase,
          line: `打 ${getTileLabel(hand[i])} 听 ${uniqueBase.map((b) => formatWait(handWithout, b)).join(' ')}`,
        });
      }
      if (options.length === 0) return null;
      return { kind: 'choices' as const, options, remaining };
    }
    return null;
  }, [game]);

  const angangOptions =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14
      ? getAngangOptionsRiichi(game.hands[0])
      : [];
  const kakanOptions = game ? getKakanOptions(game, 0) : [];
  const canKyuushuKyuuhai =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    game.discardPiles[0].length === 0 &&
    canDeclareKyuushuKyuuhai(game.hands[0]);

  const isMyTurn =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.wall.length >= 0;
  const isClaimPhase = game?.phase === 'claim' && game.lastDiscard !== null;
  const claimPlayer =
    game?.phase === 'claim' && game.lastDiscardFrom !== null
      ? (game.lastDiscardFrom + 1 + game.claimIndex) % 4
      : null;
  const isMyClaim = isClaimPhase && claimPlayer === 0;
  const currentClaimToken =
    game &&
    isClaimPhase &&
    game.lastDiscardFrom !== null &&
    game.lastDiscard !== null
      ? `${game.roundWind}:${game.roundNumber}:${game.honba}:${game.wall.length}:${game.lastDiscardFrom}:${game.lastDiscard}:${game.discardPiles[game.lastDiscardFrom]?.length ?? 0}`
      : null;
  const riichiNoClaim = game?.riichiDeclared[0] ?? false;
  const chiOptions =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    game.lastDiscardFrom !== null
      ? getChiOptionsRiichi(
          game.hands[0],
          game.lastDiscard,
          game.lastDiscardFrom,
          0,
        )
      : [];
  const canPeng =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canPengRiichi(game.hands[0], game.lastDiscard);
  const canMingang =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canMingangRiichi(game.hands[0], game.lastDiscard);

  const buildYakuCtx = useCallback(
    (seat: number, hand: number[], isTsumo: boolean) => {
      if (!game) return null;
      const melds = game.melds[seat];
      const menzen = melds.every((m) => m.type === 'angang');
      return {
        hand,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: menzen,
        isTsumo,
        isRiichi: game.riichiDeclared[seat],
        ippatsuPossible: false,
        seatWind: getSeatWind(game.roundWind, seat, game.dealer),
        roundWind: game.roundWind,
      };
    },
    [game],
  );

  const getRonWaitingTilesForSeat = useCallback(
    (seat: number, state: RiichiGameState): number[] =>
      getWaitingTilesRiichi(state.hands[seat], state.melds[seat], state, {
        seat,
        isTsumo: false,
      }),
    [getWaitingTilesRiichi],
  );

  const isSeatFuriten = useCallback(
    (seat: number, state: RiichiGameState): boolean =>
      isRonForbiddenByFuriten({
        waitingTiles: getRonWaitingTilesForSeat(seat, state),
        ownDiscards: state.discardPiles[seat],
        state: state.furitenStates[seat] ?? createInitialFuritenState(),
      }),
    [getRonWaitingTilesForSeat],
  );

  const canTsumo =
    game &&
    game.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    isWinShapeRiichi(game.hands[0], game.melds[0]) &&
    (() => {
      const ctx = buildYakuCtx(0, game.hands[0], true);
      return ctx ? hasYaku(ctx) : false;
    })();

  const canRon =
    game &&
    (() => {
      const lastD = game.lastDiscard;
      if (lastD === null) return false;
      const handWithClaim = [...game.hands[0], lastD];
      const winShape = isWinShapeRiichi(handWithClaim, game.melds[0]);
      const ctx = buildYakuCtx(0, handWithClaim, false);
      const yakuReady = ctx ? hasYaku(ctx) : false;
      const furitenBlocked = isSeatFuriten(0, game);
      return canOfferRon({
        phase: game.phase,
        lastDiscard: game.lastDiscard,
        lastDiscardFrom: game.lastDiscardFrom,
        currentClaimToken,
        declinedRonToken,
        isWinShape: winShape,
        hasYaku: yakuReady && !furitenBlocked,
      });
    })();

  const hasNonRonClaimOption =
    !game?.lastClaimWasKakan &&
    (chiOptions.length > 0 || canPeng || canMingang);
  const hasAnyClaimOption = hasNonRonClaimOption || canRon;
  const decisionSeat =
    game && needsTimedDecision(game) ? getDecisionSeat(game) : null;
  const decisionSeatRemainSeconds =
    game && decisionSeat !== null
      ? (() => {
          const c = turnClockRef.current;
          if (!c || c.player !== decisionSeat) {
            return getTurnTotalSeconds(game.timeBanks[decisionSeat]);
          }
          const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
          return Math.max(
            0,
            Math.ceil(
              getTurnTotalSeconds(game.timeBanks[decisionSeat]) - elapsed,
            ),
          );
        })()
      : null;
  const currentTurnRemainSeconds =
    game && decisionSeat === 0 ? decisionSeatRemainSeconds : null;
  const timerTextClass = (seat: number): string => {
    const active = decisionSeat === seat && decisionSeatRemainSeconds != null;
    if (!active) return 'text-[#a8dadc]';
    if (decisionSeatRemainSeconds <= 3)
      return 'text-red-300 animate-pulse font-semibold';
    if (decisionSeatRemainSeconds <= 8) return 'text-amber-300 font-semibold';
    return 'text-emerald-300';
  };

  const myFuritenReason =
    game && isClaimPhase
      ? (() => {
          const waits = getRonWaitingTilesForSeat(0, game);
          const st = game.furitenStates[0] ?? createInitialFuritenState();
          const sutehai = isRonForbiddenByFuriten({
            waitingTiles: waits,
            ownDiscards: game.discardPiles[0],
            state: { ...st, doujun: false, riichi: false, sutehai: false },
          });
          if (st.riichi) return '立直振听（本局不可荣和）';
          if (st.doujun) return '同巡振听（下次摸牌后解除）';
          if (sutehai) return '舍张振听（当前听牌牌种与自家河重复）';
          return null;
        })()
      : null;

  const winSettlementPreview = useMemo(() => {
    if (!game || !winResult) return null;
    const baseTen = resolveWinBaseTen(winResult, game);
    try {
      return settleWin({
        scores: game.scores,
        winner: winResult.winner,
        isTsumo: winResult.isTsumo,
        baseTen,
        dealer: game.dealer,
        honba: game.honba,
        riichiPot: game.riichiPot,
        ronFrom: game.lastDiscardFrom,
      });
    } catch {
      return null;
    }
  }, [game, winResult]);

  const drawSettlementPreview = useMemo(() => {
    if (!game || !game.ryuukyoku) return null;
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
    return { tenpaiSeats, settlement };
  }, [game, getWaitingTilesRiichi]);

  const winnerPaymentSummary = useMemo(() => {
    if (!winResult || !winSettlementPreview) return null;
    return summarizeWinnerPayments(
      winSettlementPreview.payments,
      winResult.winner,
    );
  }, [winResult, winSettlementPreview]);

  return {
    tenpaiHint,
    angangOptions,
    kakanOptions,
    canKyuushuKyuuhai,
    isMyTurn,
    isClaimPhase,
    claimPlayer,
    isMyClaim,
    currentClaimToken,
    riichiNoClaim,
    chiOptions,
    canPeng,
    canMingang,
    buildYakuCtx,
    getRonWaitingTilesForSeat,
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
  };
}
