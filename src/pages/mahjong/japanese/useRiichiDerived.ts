import { type RefObject, useCallback, useMemo } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  canMingangRiichi,
  canPengRiichi,
  getAngangOptionsRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getTileLabel,
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
import {
  afterDrawConcealedCount,
  enumerateTenpaiConcealedStates,
  tenpaiConcealedCount,
} from '@/lib/riichiTenpaiHelpers';
import { evaluateGameWin, resolveWinBaseTen } from './gameLogic/winResult';
import {
  countVisibleTilesByBase,
  getDecisionSeat,
  getKakanOptions,
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
  const { locale, t } = useLocale();
  const tenpaiHint = useMemo(() => {
    if (winResult) return null;
    if (!game || game.ryuukyoku) return null;
    const hand = game.hands[0];
    const melds = game.melds[0];
    const visibleCounts = countVisibleTilesByBase(game);
    const remaining = (baseTile: number) =>
      Math.max(0, 4 - (visibleCounts[baseTile] ?? 0));
    const tc = tenpaiConcealedCount(melds);

    const getWaitingTilesShapeOnly = (handTc: number[]): number[] =>
      handTc.length === tc ? getWaitingTilesRiichi(handTc, melds, game) : [];

    const getValueForWaitingTile = (
      hand13: number[],
      baseTile: number,
    ): { han: number; yakuman: number } => {
      const handWithWin = [...hand13, baseTile];
      const previewState: RiichiGameState = {
        ...game,
        // 待牌提示只估算稳定、可见的未来条件，不继承一发/岭上/海底，也不偷看里宝牌。
        lastDrawWasRinshan: false,
        uraDoraIndicators: [],
        ippatsuPossible: game.ippatsuPossible.map((possible, seat) =>
          seat === 0 ? false : possible,
        ),
        wall: game.wall.length === 0 ? [0] : game.wall,
        hands: game.hands.map((seatHand, seat) =>
          seat === 0 ? handWithWin : seatHand,
        ),
      };
      const evaluation = evaluateGameWin({
        state: previewState,
        winner: 0,
        isTsumo: true,
        winningTile: baseTile,
      });
      return evaluation.legalWin
        ? { han: evaluation.han, yakuman: evaluation.yakuman }
        : { han: 0, yakuman: 0 };
    };

    const formatWait = (handTc: number[], waitTile: number): string => {
      const { han, yakuman } = getValueForWaitingTile(handTc, waitTile);
      const hanStr =
        yakuman > 1
          ? formatMessage(locale, 'game.mahjong.multipleYakuman', {
              count: yakuman,
            })
          : yakuman === 1
            ? t('game.mahjong.yakuman')
            : han > 0
              ? formatMessage(locale, 'game.mahjong.hanCount', { count: han })
              : t('game.mahjong.noYaku');
      return formatMessage(locale, 'game.mahjong.waitFormat', {
        tile: getTileLabel(waitTile, locale),
        remaining: remaining(waitTile),
        han: hanStr,
      });
    };

    const extra = hand.length - tc;
    if (extra < 0) return null;

    if (extra === 0) {
      const waitingShape = getWaitingTilesShapeOnly(hand);
      if (waitingShape.length === 0) return null;
      const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
      return {
        kind: 'current' as const,
        line: formatMessage(locale, 'game.mahjong.tenpaiLine', {
          waits: uniqueBase
            .map((b) => {
              const w =
                waitingShape.find((x) => getBaseTile(x) === b) ??
                waitingShape[0];
              return formatWait(hand, w);
            })
            .join(' '),
        }),
        waiting: uniqueBase,
        remaining,
      };
    }

    if (extra === 1) {
      const options: {
        discardTile: number;
        discardLabel: string;
        waiting: number[];
        line: string;
      }[] = [];
      for (let i = 0; i < hand.length; i++) {
        const handWithout = hand.filter((_, j) => j !== i);
        const waitingShape = getWaitingTilesShapeOnly(handWithout);
        if (waitingShape.length === 0) continue;
        const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
        options.push({
          discardTile: hand[i],
          discardLabel: getTileLabel(hand[i], locale),
          waiting: uniqueBase,
          line: formatMessage(locale, 'game.mahjong.discardAndTenpai', {
            discard: getTileLabel(hand[i], locale),
            waits: uniqueBase
              .map((b) => {
                const w =
                  waitingShape.find((x) => getBaseTile(x) === b) ??
                  waitingShape[0];
                return formatWait(handWithout, w);
              })
              .join(' '),
          }),
        });
      }
      if (options.length === 0) return null;
      return { kind: 'choices' as const, options, remaining };
    }

    const states = enumerateTenpaiConcealedStates(hand, melds);
    const unionWaits = new Set<number>();
    for (const st of states) {
      for (const w of getWaitingTilesShapeOnly(st)) unionWaits.add(w);
    }
    if (unionWaits.size === 0) return null;
    const sortedWaits = Array.from(unionWaits).sort((a, b) => a - b);
    const uniqueBase = [...new Set(sortedWaits.map(getBaseTile))];
    const line = formatMessage(locale, 'game.mahjong.needDiscardAndTenpai', {
      extra,
      waits: uniqueBase
        .map((b) => {
          const waitTile =
            sortedWaits.find((w) => getBaseTile(w) === b) ?? sortedWaits[0];
          const repHand = states.find((s) =>
            getWaitingTilesShapeOnly(s).includes(waitTile),
          );
          return repHand
            ? formatWait(repHand, waitTile)
            : formatMessage(locale, 'game.mahjong.waitFormatSimple', {
                tile: getTileLabel(waitTile, locale),
                remaining: remaining(waitTile),
              });
        })
        .join(' '),
    });
    return {
      kind: 'current' as const,
      line,
      waiting: uniqueBase,
      remaining,
    };
  }, [game, winResult, locale, t, getWaitingTilesRiichi]);

  const angangOptions =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === afterDrawConcealedCount(game.melds[0])
      ? getAngangOptionsRiichi(game.hands[0])
      : [];
  const kakanOptions = game ? getKakanOptions(game, 0) : [];
  const canKyuushuKyuuhai =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === afterDrawConcealedCount(game.melds[0]) &&
    game.discardPiles[0].length === 0 &&
    canDeclareKyuushuKyuuhai(game.hands[0]);

  const isMyTurn = game?.phase === 'discard' && game.currentPlayer === 0;
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

  const tsumoEvaluation = useMemo(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile === null ||
      game.hands[0].length !== afterDrawConcealedCount(game.melds[0])
    ) {
      return null;
    }
    return evaluateGameWin({
      state: game,
      winner: 0,
      isTsumo: true,
      winningTile: game.drawnTile,
    });
  }, [game]);
  const canTsumo = Boolean(tsumoEvaluation?.legalWin);

  const ronEvaluation = useMemo(() => {
    if (!game || game.lastDiscard === null) return null;
    return evaluateGameWin({
      state: game,
      winner: 0,
      isTsumo: false,
      winningTile: game.lastDiscard,
      afterKan: game.lastClaimWasKakan ?? false,
    });
  }, [game]);

  const canRon =
    game &&
    (() => {
      if (game.lastDiscard === null || !ronEvaluation) return false;
      const furitenBlocked = isSeatFuriten(0, game);
      return canOfferRon({
        phase: game.phase,
        lastDiscard: game.lastDiscard,
        lastDiscardFrom: game.lastDiscardFrom,
        currentClaimToken,
        declinedRonToken,
        isWinShape: ronEvaluation.structuralAgari,
        hasYaku: ronEvaluation.legalWin && !furitenBlocked,
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
    return settleWin({
      scores: game.scores,
      winner: winResult.winner,
      isTsumo: winResult.isTsumo,
      baseTen,
      dealer: game.dealer,
      honba: game.honba,
      riichiPot: game.riichiPot,
      ronFrom: game.lastDiscardFrom,
      tsumoPayments: winResult.tsumoPayments,
    });
  }, [game, winResult]);

  const drawSettlementPreview = useMemo(() => {
    if (!game?.ryuukyoku) return null;
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
