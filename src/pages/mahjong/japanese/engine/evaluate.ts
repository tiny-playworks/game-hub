import { evaluateRiichiWin, type RiichiWinEvaluation } from '@/lib/riichiRules';
import type { RiichiGameState, RiichiWinResult } from '../types';
import type { RiichiRuleConfig } from './rules';

export interface EvaluateSeatWinParams {
  state: RiichiGameState;
  seat: number;
  isTsumo: boolean;
  winningTile: number;
  /** 抢杠（加杠 / 暗杠国士） */
  chankan?: boolean;
  rules?: Pick<RiichiRuleConfig, 'doubleYakuman'>;
  /** 预览模式：不计一发、岭上、海底、天地和，也不看里宝牌 */
  preview?: boolean;
}

/**
 * 局面到 riichi-rs 规则门面的唯一转换点；人类与 AI 的和牌判定、符番与点数都经由这里。
 * 荣和时 state.hands[seat] 为和了前的门前牌；自摸时已包含摸到的牌。
 */
export function evaluateSeatWin(
  params: EvaluateSeatWinParams,
): RiichiWinEvaluation {
  const { state, seat, isTsumo, winningTile, chankan = false } = params;
  const preview = params.preview ?? false;
  const riichi = state.riichiDeclared[seat];
  const afterKan = preview
    ? false
    : isTsumo
      ? state.lastDrawWasRinshan
      : chankan;
  const lastTile =
    !preview &&
    state.wall.length === 0 &&
    (isTsumo ? !state.lastDrawWasRinshan : !chankan);
  return evaluateRiichiWin({
    state: {
      hand: state.hands[seat],
      melds: state.melds[seat],
      doraIndicators: state.doraIndicators,
      roundWind: state.roundWind,
      dealer: state.dealer,
      riichiDeclared: state.riichiDeclared,
      wallLength: state.wall.length,
      lastDiscard: isTsumo ? null : winningTile,
      ippatsu: !preview && riichi && state.ippatsuPossible[seat],
      afterKan,
      lastTile,
      winnerSeat: seat,
      doubleRiichi: riichi && state.doubleRiichi[seat],
      firstTake: !preview && isTsumo && state.firstTurn[seat],
      allowDoubleYakuman: params.rules?.doubleYakuman ?? true,
    },
    isTsumo,
    winningTile,
    uraDoraIndicators: preview ? [] : state.uraDoraIndicators,
  });
}

const KOKUSHI_YAKU_IDS = new Set(['0', '1']);

export function isKokushiEvaluation(evaluation: RiichiWinEvaluation): boolean {
  return evaluation.yaku.some((y) => KOKUSHI_YAKU_IDS.has(y.id));
}

/** 大三元 / 大四喜的役满倍数，用于计算包牌承担比例 */
export function paoYakumanCount(evaluation: RiichiWinEvaluation): {
  daisangen: number;
  daisuushi: number;
} {
  let daisangen = 0;
  let daisuushi = 0;
  for (const y of evaluation.yaku) {
    if (y.id === '8') daisangen = Math.max(1, Math.round(y.han / 13));
    if (y.id === '6') daisuushi = Math.max(1, Math.round(y.han / 13));
  }
  return { daisangen, daisuushi };
}

export function toWinResult(
  state: RiichiGameState,
  seat: number,
  isTsumo: boolean,
  winningTile: number,
  ronFrom: number | null,
  evaluation: RiichiWinEvaluation,
  paoSeat: number | null,
): RiichiWinResult {
  if (!evaluation.legalWin || evaluation.totalPoints <= 0) {
    throw new Error('Cannot create a win result from an illegal evaluation');
  }
  return {
    winner: seat,
    isTsumo,
    ronFrom,
    winningTile,
    yaku: evaluation.yaku,
    fu: evaluation.fu,
    han: evaluation.han,
    yakuman: evaluation.yakuman,
    ten: evaluation.totalPoints,
    tsumoPayments: evaluation.tsumoPayments,
    uraHan: evaluation.uraDoraHan,
    uraDoraIndicators: state.riichiDeclared[seat]
      ? [...state.uraDoraIndicators]
      : [],
    hand: isTsumo
      ? [...state.hands[seat]]
      : [...state.hands[seat], winningTile],
    melds: state.melds[seat].map((m) => ({ ...m, tiles: [...m.tiles] })),
    paoSeat,
  };
}
