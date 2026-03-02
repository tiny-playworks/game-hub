import { Button } from '@/components/ui/button';
import type { YakuResult } from '@/lib/mahjongRiichi';
import { getTileLabel } from '@/lib/mahjongRiichi';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { PaymentDetail, SettlementResult } from '@/lib/riichiSettlement';
import { SEAT_NAMES } from '../constants';
import {
  formatPoints,
  getMatchEndReasonText,
  getRyuukyokuDescription,
  getRyuukyokuReasonText,
} from '../helpers';
import type { RiichiGameState } from '../types';

export type WinResultState = {
  winner: number;
  isTsumo: boolean;
  yaku: YakuResult[];
  fu?: number;
  han?: number;
  ten?: number;
  uraHan?: number;
  uraDoraIndicators?: number[];
};

export type MatchEndState = {
  reason: MatchEndReason;
  finalScores: number[];
  ranking: number[];
};

type WinSettlementPreview = SettlementResult;
type WinnerPaymentSummary = { base: number; honba: number; riichi: number };
type DrawSettlementPreview = {
  tenpaiSeats: number[];
  settlement: {
    deltas: number[];
    newScores: number[];
    payments: PaymentDetail[];
  };
};

type WinModalProps = {
  winResult: WinResultState;
  winSettlementPreview: WinSettlementPreview | null;
  winnerPaymentSummary: WinnerPaymentSummary | null;
  timeoutEvents: string[];
  onNext: () => void;
};

export function WinModal({
  winResult,
  winSettlementPreview,
  winnerPaymentSummary,
  timeoutEvents,
  onNext,
}: WinModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-win-title"
      >
        <h3
          id="riichi-win-title"
          className="text-xl font-bold text-[#ffc107] text-center mb-3"
        >
          {winResult.isTsumo ? '自摸！' : '荣和！'}
        </h3>
        {winResult.ten != null && (
          <p className="text-center text-[#ffc107] font-semibold mb-2">
            {winResult.fu != null && winResult.han != null
              ? `${winResult.fu} 符 ${winResult.han} 番 · `
              : ''}
            {winResult.ten} 点
          </p>
        )}
        <p className="text-sm text-[#f1faee]/90 mb-2">役种：</p>
        <ul className="list-disc list-inside text-sm text-[#f1faee] space-y-1 mb-4">
          {winResult.yaku.map((y, i) => (
            <li key={i}>
              {y.name} {y.han}番
            </li>
          ))}
        </ul>
        {winResult.uraDoraIndicators &&
          winResult.uraDoraIndicators.length > 0 && (
            <p className="mb-2 text-xs text-[#a8dadc]">
              里宝牌表示：{' '}
              {winResult.uraDoraIndicators
                .map((t) => getTileLabel(t))
                .join(' · ')}
              {winResult.uraHan != null
                ? `（里宝牌 ${winResult.uraHan} 番）`
                : ''}
            </p>
          )}
        {winSettlementPreview && (
          <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
            {winnerPaymentSummary && (
              <p>
                本局收入： 和牌基础 +{winnerPaymentSummary.base}
                {' / '}
                本场棒 +{winnerPaymentSummary.honba}
                {' / '}
                立直棒 +{winnerPaymentSummary.riichi}
              </p>
            )}
            <p>
              分差：{' '}
              {winSettlementPreview.deltas
                .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
                .join(' · ')}
            </p>
            <p>
              总分：{' '}
              {winSettlementPreview.newScores
                .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                .join(' · ')}
            </p>
            {winSettlementPreview.payments.length > 0 && (
              <ul className="list-disc list-inside text-[11px] text-[#f1faee]/80">
                {winSettlementPreview.payments.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    {p.from >= 0 ? SEAT_NAMES[p.from] : '立直棒池'} →{' '}
                    {SEAT_NAMES[p.to]} {p.amount}点
                    {p.reason === 'honba'
                      ? '（本场棒）'
                      : p.reason === 'riichi'
                        ? '（立直棒）'
                        : p.reason === 'ron'
                          ? '（荣和）'
                          : p.reason === 'tsumo'
                            ? '（自摸）'
                            : ''}
                  </li>
                ))}
              </ul>
            )}
            {timeoutEvents.length > 0 && (
              <p className="text-[11px] text-[#f1faee]/80">
                超时：{timeoutEvents.join('；')}
              </p>
            )}
          </div>
        )}
        <Button
          className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
          onClick={onNext}
        >
          下一局
        </Button>
      </div>
    </div>
  );
}

type RyuukyokuModalProps = {
  ryuukyokuReason: RiichiGameState['ryuukyokuReason'];
  drawSettlementPreview: DrawSettlementPreview | null;
  timeoutEvents: string[];
  onNext: () => void;
};

export function RyuukyokuModal({
  ryuukyokuReason,
  drawSettlementPreview,
  timeoutEvents,
  onNext,
}: RyuukyokuModalProps) {
  const reasonText = ryuukyokuReason ?? '荒牌';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-ryuukyoku-title"
      >
        <h3
          id="riichi-ryuukyoku-title"
          className="text-xl font-bold text-amber-200 text-center mb-3"
        >
          流局（{getRyuukyokuReasonText(ryuukyokuReason)}）
        </h3>
        <p className="text-sm text-[#f1faee]/90 mb-2 text-center">
          {getRyuukyokuDescription(ryuukyokuReason)}
        </p>
        {drawSettlementPreview && (
          <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
            {reasonText === '荒牌' ? (
              <p>
                听牌：
                {drawSettlementPreview.tenpaiSeats.length === 0
                  ? ' 无'
                  : ` ${drawSettlementPreview.tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`}
              </p>
            ) : (
              <p>途中流局：不执行不听罚符，立直棒保留到下一局</p>
            )}
            <p>
              分差：{' '}
              {drawSettlementPreview.settlement.deltas
                .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
                .join(' · ')}
            </p>
            <p>
              总分：{' '}
              {drawSettlementPreview.settlement.newScores
                .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                .join(' · ')}
            </p>
            {timeoutEvents.length > 0 && (
              <p className="text-[11px] text-[#f1faee]/80">
                超时：{timeoutEvents.join('；')}
              </p>
            )}
          </div>
        )}
        <Button
          className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
          onClick={onNext}
        >
          下一局
        </Button>
      </div>
    </div>
  );
}

type MatchEndModalProps = {
  matchEnd: MatchEndState;
  onRestart: () => void;
};

export function MatchEndModal({ matchEnd, onRestart }: MatchEndModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-match-end-title"
      >
        <h3
          id="riichi-match-end-title"
          className="text-xl font-bold text-amber-200 text-center mb-2"
        >
          对局结束
        </h3>
        <p className="text-sm text-[#f1faee]/90 mb-3 text-center">
          {getMatchEndReasonText(matchEnd.reason)}
        </p>
        <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
          {matchEnd.ranking.map((seat, i) => (
            <p key={seat}>
              {i + 1}位：{SEAT_NAMES[seat]}{' '}
              {formatPoints(matchEnd.finalScores[seat])}
            </p>
          ))}
        </div>
        <Button
          className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
          onClick={onRestart}
        >
          再来一局
        </Button>
      </div>
    </div>
  );
}
