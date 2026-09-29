import { useMemo } from 'react';
import { formatMessage, getMessage, type Locale } from '@/lib/i18n';
import { getBaseTile } from '@/lib/mahjongRiichi';
import { getFuritenReason } from '@/lib/riichiFuriten';
import { analyzeRiichiHand } from '@/lib/riichiRules';
import {
  evaluateSeatWin,
  getDecisionSeat,
  getSeatClaimOptions,
  getSeatTurnOptions,
} from './engine';
import { getWaits, removeTiles } from './engine/hand';
import { countVisibleTilesByBase } from './helpers';
import type { RiichiGameState } from './types';

type HintOption = { discardTile: number; waiting: number[]; line: string };
export type TenpaiHint = (
  | { kind: 'current'; waiting: number[]; line: string }
  | { kind: 'discard'; options: HintOption[] }
) & { remaining: (tile: number) => number };

function previewLine(
  state: RiichiGameState,
  hand: number[],
  waits: number[],
  locale: Locale,
): string {
  const hands = [...state.hands];
  hands[0] = hand;
  const values = waits
    .map((winningTile) =>
      evaluateSeatWin({
        state: { ...state, hands },
        seat: 0,
        isTsumo: false,
        winningTile,
        preview: true,
      }),
    )
    .filter((value) => value.legalWin);
  if (!values.length) return getMessage(locale, 'riichi.hint.noRonYaku');
  return formatMessage(locale, 'riichi.hint.ronPreview', {
    points: Math.max(...values.map((value) => value.totalPoints)),
  });
}

export function getTenpaiHint(
  state: RiichiGameState,
  locale: Locale,
): TenpaiHint | null {
  if (state.phase === 'end') return null;
  const hand = state.hands[0];
  const melds = state.melds[0];
  const visible = countVisibleTilesByBase(state);
  const remaining = (tile: number) =>
    Math.max(0, 4 - visible[getBaseTile(tile)]);
  const waits = getWaits(hand, melds);
  if (waits.length) {
    return {
      kind: 'current',
      waiting: waits,
      remaining,
      line: previewLine(state, hand, waits, locale),
    };
  }
  const turn = getSeatTurnOptions(state, 0);
  if (!turn) return null;
  const analysis = analyzeRiichiHand({ hand, melds });
  const options: HintOption[] = [];
  for (const option of analysis.discardOptions) {
    if (option.shanten !== 0) continue;
    const discardTile = turn.discardable.find(
      (tile) => getBaseTile(tile) === option.discard,
    );
    if (discardTile === undefined) continue;
    const after = removeTiles(hand, [discardTile]);
    if (!after) continue;
    options.push({
      discardTile,
      waiting: option.effectiveTiles,
      line: previewLine(state, after, option.effectiveTiles, locale),
    });
  }
  return options.length ? { kind: 'discard', options, remaining } : null;
}

/** 只派生展示信息；合法操作来自引擎，听牌预览仅在侧栏打开时计算。 */
export function useRiichiViewModel(
  game: RiichiGameState | null,
  hintsOpen: boolean,
  locale: Locale,
) {
  return useMemo(() => {
    const turn = game ? getSeatTurnOptions(game, 0) : null;
    const claim = game ? getSeatClaimOptions(game, 0) : null;
    const decisionSeat = game ? getDecisionSeat(game) : null;
    const hand =
      game && turn && game.drawnTile !== null
        ? (removeTiles(game.hands[0], [game.drawnTile]) ?? game.hands[0])
        : (game?.hands[0] ?? []);
    const reason = game
      ? getFuritenReason({
          waitingTiles: getWaits(hand, game.melds[0]),
          ownDiscards: game.discardPiles[0],
          state: game.furitenStates[0],
        })
      : null;
    return {
      turn,
      claim,
      decisionSeat,
      isClaimPhase: game?.phase === 'claim',
      isMyClaim: Boolean(claim),
      hasAnyClaimOption: Boolean(claim),
      claimPlayer: decisionSeat,
      isMyTurn: Boolean(turn),
      myFuritenReason: reason
        ? getMessage(locale, `riichi.furiten.${reason}`)
        : null,
      tenpaiHint: game && hintsOpen ? getTenpaiHint(game, locale) : null,
    };
  }, [game, hintsOpen, locale]);
}
