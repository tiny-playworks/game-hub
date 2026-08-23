import { evaluateRiichiWin, type RiichiWinEvaluation } from '@/lib/riichiRules';
import type { RiichiWinResult } from '../store/riichiGameStore';
import type { RiichiGameState } from '../types';

export type EvaluateGameWinParams = {
  state: RiichiGameState;
  winner: number;
  isTsumo: boolean;
  winningTile: number;
  afterKan?: boolean;
};

/**
 * 页面状态到规则门面的唯一转换点。
 * 人类与 AI 的和牌判定、符番与点数必须复用这个入口。
 */
export function evaluateGameWin(
  params: EvaluateGameWinParams,
): RiichiWinEvaluation {
  const { state, winner, isTsumo, winningTile, afterKan } = params;
  return evaluateRiichiWin({
    state: {
      hand: state.hands[winner],
      melds: state.melds[winner],
      doraIndicators: state.doraIndicators,
      roundWind: state.roundWind,
      dealer: state.dealer,
      riichiDeclared: state.riichiDeclared,
      wallLength: state.wall.length,
      lastDiscard: state.lastDiscard,
      ippatsu:
        state.riichiDeclared[winner] &&
        (state.ippatsuPossible?.[winner] ?? false),
      afterKan: afterKan ?? (isTsumo && Boolean(state.lastDrawWasRinshan)),
      winnerSeat: winner,
    },
    isTsumo,
    winningTile,
    uraDoraIndicators: state.uraDoraIndicators,
  });
}

/** 将规则门面的权威结果转换为 UI/结算使用的局内结果。 */
export function createRiichiWinResult(
  state: RiichiGameState,
  winner: number,
  isTsumo: boolean,
  evaluation: RiichiWinEvaluation,
): RiichiWinResult {
  if (!evaluation.legalWin || evaluation.totalPoints <= 0) {
    throw new Error('Cannot create a win result from an illegal evaluation');
  }
  return {
    winner,
    isTsumo,
    yaku: evaluation.yaku,
    fu: evaluation.fu,
    han: evaluation.han,
    yakuman: evaluation.yakuman,
    ten: evaluation.totalPoints,
    tsumoPayments: evaluation.tsumoPayments,
    uraHan: evaluation.uraDoraHan,
    uraDoraIndicators: state.riichiDeclared[winner]
      ? state.uraDoraIndicators
      : [],
  };
}

/** 局内中文日志使用；役满不应显示成 riichi-rs 的 0 符 0 番。 */
export function formatRiichiWinValue(
  evaluation: Pick<
    RiichiWinEvaluation,
    'fu' | 'han' | 'yakuman' | 'totalPoints'
  >,
): string {
  if (evaluation.yakuman > 0) {
    const multiple = evaluation.yakuman > 1 ? `${evaluation.yakuman}倍` : '';
    return `${multiple}役满 ${evaluation.totalPoints}点`;
  }
  return `${evaluation.fu}符 ${evaluation.han}番 ${evaluation.totalPoints}点`;
}

export type WinResultForBaseTen = Pick<RiichiWinResult, 'ten'>;

/** 生产和牌结果必须携带规则引擎给出的权威点数，不再以简化公式兜底。 */
export function resolveWinBaseTen(
  result: WinResultForBaseTen,
  _state: RiichiGameState,
): number {
  if (result.ten == null || result.ten <= 0) {
    throw new Error('Win result is missing an authoritative score');
  }
  return result.ten;
}
