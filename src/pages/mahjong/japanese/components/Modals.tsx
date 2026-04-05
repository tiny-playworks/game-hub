import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { getGrowthOverview } from '@/lib/growth';
import { formatMessage } from '@/lib/i18n';
import type { YakuResult } from '@/lib/mahjongRiichi';
import { getTileLabel } from '@/lib/mahjongRiichi';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type {
  RiichiAchievementRewardSummary,
  RiichiRoundProgressSummary,
} from '@/lib/riichiProgress';
import type { PaymentDetail, SettlementResult } from '@/lib/riichiSettlement';
import {
  getHighestUnlockedTitle,
  getNextLockedTitle,
  getUnlockedTitles,
} from '@/lib/titles';
import { SEAT_NAMES } from '../constants';
import {
  formatPoints,
  getMatchEndReasonText,
  getRyuukyokuDescription,
  getRyuukyokuReasonText,
  isExhaustiveRyuukyoku,
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

function getMaxGainSeat(deltas: number[]): number {
  let bestSeat = 0;
  let bestDelta = Number.NEGATIVE_INFINITY;
  deltas.forEach((delta, seat) => {
    if (delta > bestDelta) {
      bestDelta = delta;
      bestSeat = seat;
    }
  });
  return bestSeat;
}

function getMaxLossSeat(deltas: number[]): number {
  let worstSeat = 0;
  let worstDelta = Number.POSITIVE_INFINITY;
  deltas.forEach((delta, seat) => {
    if (delta < worstDelta) {
      worstDelta = delta;
      worstSeat = seat;
    }
  });
  return worstSeat;
}

type WinModalProps = {
  winResult: WinResultState;
  winSettlementPreview: WinSettlementPreview | null;
  winnerPaymentSummary: WinnerPaymentSummary | null;
  roundProgressSummary: RiichiRoundProgressSummary;
  timeoutEvents: string[];
  onNext: () => void;
};

function RoundGrowthSummary({
  roundProgressSummary,
}: {
  roundProgressSummary: RiichiRoundProgressSummary;
}) {
  const { t, locale } = useLocale();
  const {
    autoClaimedTaskRewards,
    rewardPoints,
    unlockedAchievements,
    recordedGrowthItems,
    characterProgress,
    growthPointsBeforeMatch,
  } = roundProgressSummary;

  const growthUi = useMemo(() => {
    const afterTotal = getGrowthOverview().totalPoints;
    const mergedMap = new Map<string, RiichiAchievementRewardSummary>();
    for (const a of unlockedAchievements) {
      const prev = mergedMap.get(a.id);
      if (prev) {
        mergedMap.set(a.id, { ...prev, points: prev.points + a.points });
      } else {
        mergedMap.set(a.id, { ...a });
      }
    }
    const mergedAchievements = Array.from(mergedMap.values());
    const achievementPointsSum = mergedAchievements.reduce(
      (s, x) => s + x.points,
      0,
    );
    const totalSessionGrowth = rewardPoints + achievementPointsSum;
    const beforeTotal =
      typeof growthPointsBeforeMatch === 'number'
        ? growthPointsBeforeMatch
        : Math.max(0, afterTotal - totalSessionGrowth);
    const beforeIds = new Set(getUnlockedTitles(beforeTotal).map((x) => x.id));
    const newlyUnlockedTitles = getUnlockedTitles(afterTotal).filter(
      (x) => !beforeIds.has(x.id),
    );
    const nextTitle = getNextLockedTitle(afterTotal);
    const highestTitle = getHighestUnlockedTitle(afterTotal);
    let nextTitleProgressPct = 0;
    if (nextTitle) {
      const floor = highestTitle?.minPoints ?? 0;
      const ceiling = nextTitle.minPoints;
      const span = ceiling - floor;
      nextTitleProgressPct =
        span > 0
          ? Math.min(100, Math.max(0, ((afterTotal - floor) / span) * 100))
          : 100;
    }
    return {
      afterTotal,
      beforeTotal,
      mergedAchievements,
      totalSessionGrowth,
      achievementPointsSum,
      newlyUnlockedTitles,
      nextTitle,
      nextTitleProgressPct,
    };
  }, [growthPointsBeforeMatch, rewardPoints, unlockedAchievements]);

  const {
    afterTotal,
    beforeTotal,
    mergedAchievements,
    totalSessionGrowth,
    achievementPointsSum,
    newlyUnlockedTitles,
    nextTitle,
    nextTitleProgressPct,
  } = growthUi;

  const pointDelta = afterTotal - beforeTotal;
  const hasContent =
    totalSessionGrowth > 0 ||
    newlyUnlockedTitles.length > 0 ||
    autoClaimedTaskRewards.length > 0 ||
    mergedAchievements.length > 0 ||
    recordedGrowthItems.length > 0 ||
    characterProgress !== null;

  if (!hasContent) return null;

  return (
    <div
      className="mb-4 rounded-lg border p-3 text-xs space-y-2"
      style={{
        borderColor:
          'color-mix(in srgb, var(--riichi-border) 40%, transparent)',
        backgroundColor:
          'color-mix(in srgb, var(--riichi-table-inner) 70%, transparent)',
        color: 'var(--riichi-text)',
      }}
    >
      <p className="text-[11px] font-semibold text-[#ffe082]">
        {t('riichi.modal.growth.title')}
      </p>
      <p className="text-[11px] text-[#f1faee]/90">
        {formatMessage(locale, 'riichi.modal.growth.beforeAfterPoints', {
          before: beforeTotal,
          after: afterTotal,
          delta: pointDelta,
        })}
      </p>
      <p className="text-[11px] text-[#f1faee]/85">
        {formatMessage(locale, 'riichi.modal.growth.sessionBreakdown', {
          total: totalSessionGrowth,
          task: rewardPoints,
          ach: achievementPointsSum,
        })}
      </p>
      {autoClaimedTaskRewards.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-[#a8dadc]">
            {t('riichi.modal.growth.autoTask')}
          </p>
          <ul className="list-disc list-inside text-[11px] text-[#f1faee]/85">
            {autoClaimedTaskRewards.map((reward) => (
              <li key={`${reward.scope}-${reward.taskId}`}>
                {t(reward.titleKey)} +{reward.rewardPoints}
              </li>
            ))}
          </ul>
        </div>
      )}
      {mergedAchievements.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-[#a8dadc]">
            {t('riichi.modal.growth.newAchievement')}
          </p>
          <ul className="list-disc list-inside text-[11px] text-[#f1faee]/85">
            {mergedAchievements.map((achievement) => (
              <li key={achievement.id}>
                {t(achievement.nameKey)} +{achievement.points}
              </li>
            ))}
          </ul>
        </div>
      )}
      {characterProgress && (
        <div className="space-y-1 text-[11px] text-[#f1faee]/85">
          <p className="text-[#a8dadc]">{t('riichi.modal.growth.companion')}</p>
          <p>
            {characterProgress.characterName}{' '}
            {t('riichi.modal.growth.affinityLabel')}{' '}
            {characterProgress.previousAffinity} →{' '}
            {characterProgress.currentAffinity}
          </p>
          <p>
            {t('riichi.modal.growth.currentStage')}{' '}
            {characterProgress.currentStage}
            {characterProgress.stageIncreased
              ? ` · ${t('riichi.modal.growth.stageUp')}`
              : ''}
          </p>
        </div>
      )}
      {newlyUnlockedTitles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-[#a8dadc]">
            {t('riichi.modal.growth.newTitles')}
          </p>
          <ul className="list-disc list-inside text-[11px] text-[#f1faee]/85">
            {newlyUnlockedTitles.map((title) => (
              <li key={title.id}>{t(title.nameKey)}</li>
            ))}
          </ul>
        </div>
      )}
      {nextTitle && (
        <div className="space-y-1">
          <p className="text-[11px] text-[#a8dadc]">
            {formatMessage(locale, 'riichi.modal.growth.nextTitle', {
              name: t(nextTitle.nameKey),
            })}
          </p>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--riichi-border) 50%, transparent)',
            }}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${nextTitleProgressPct}%`,
                backgroundColor: 'var(--riichi-accent)',
              }}
            />
          </div>
          <p className="text-[10px] text-[#f1faee]/70">
            {formatMessage(locale, 'riichi.modal.growth.nextTitlePoints', {
              current: afterTotal,
              target: nextTitle.minPoints,
            })}
          </p>
        </div>
      )}
      {recordedGrowthItems.length > 0 && (
        <p className="text-[11px] text-[#f1faee]/70">
          {t('riichi.modal.growth.recordedPrefix')} {recordedGrowthItems.length}{' '}
          {t('riichi.modal.growth.recordedSuffix')}
        </p>
      )}
    </div>
  );
}

export function WinModal({
  winResult,
  winSettlementPreview,
  winnerPaymentSummary,
  roundProgressSummary,
  timeoutEvents,
  onNext,
}: WinModalProps) {
  const { t } = useLocale();
  const winnerDelta = winSettlementPreview?.deltas[winResult.winner] ?? 0;
  const maxLossSeat = winSettlementPreview
    ? getMaxLossSeat(winSettlementPreview.deltas)
    : null;
  const maxLossDelta =
    maxLossSeat != null && winSettlementPreview
      ? winSettlementPreview.deltas[maxLossSeat]
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl border-2 p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        style={{
          backgroundColor: 'var(--riichi-table)',
          borderColor: 'var(--riichi-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-win-title"
      >
        <h3
          id="riichi-win-title"
          className="text-xl font-bold text-center mb-3"
          style={{ color: 'var(--riichi-accent)' }}
        >
          {winResult.isTsumo
            ? t('riichi.modal.win.tsumo')
            : t('riichi.modal.win.ron')}
        </h3>
        {winResult.ten != null && (
          <p
            className="text-center font-semibold mb-2"
            style={{ color: 'var(--riichi-accent)' }}
          >
            {winResult.fu != null && winResult.han != null
              ? `${winResult.fu} ${t('riichi.modal.unit.fu')} ${winResult.han} ${t('riichi.modal.unit.han')} · `
              : ''}
            {winResult.ten} {t('riichi.modal.unit.point')}
          </p>
        )}
        <p
          className="text-sm mb-2 opacity-90"
          style={{ color: 'var(--riichi-text)' }}
        >
          {t('riichi.modal.win.yakuTitle')}
        </p>
        <ul
          className="list-disc list-inside text-sm space-y-1 mb-4"
          style={{ color: 'var(--riichi-text)' }}
        >
          {winResult.yaku.map((y, i) => (
            <li key={i}>
              {y.name} {y.han}
              {t('riichi.modal.unit.han')}
            </li>
          ))}
        </ul>
        {winResult.uraDoraIndicators &&
          winResult.uraDoraIndicators.length > 0 && (
            <p className="mb-2 text-xs text-[#a8dadc]">
              {t('riichi.modal.win.uraIndicator')}{' '}
              {winResult.uraDoraIndicators
                .map((t) => getTileLabel(t))
                .join(' · ')}
              {winResult.uraHan != null
                ? `（${t('riichi.modal.win.uraHan')} ${winResult.uraHan} ${t('riichi.modal.unit.han')}）`
                : ''}
            </p>
          )}
        <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
        {winSettlementPreview && (
          <div
            className="mb-4 rounded-lg border p-3 text-xs space-y-1 opacity-90"
            style={{
              borderColor:
                'color-mix(in srgb, var(--riichi-border) 40%, transparent)',
              backgroundColor:
                'color-mix(in srgb, var(--riichi-table-inner) 70%, transparent)',
              color: 'var(--riichi-text)',
            }}
          >
            <p className="text-[11px] font-semibold text-[#ffe082]">
              {t('riichi.modal.summary.title')}
              {SEAT_NAMES[winResult.winner]} {winnerDelta >= 0 ? '+' : ''}
              {winnerDelta}
              {maxLossSeat != null &&
                ` · ${SEAT_NAMES[maxLossSeat]} ${maxLossDelta >= 0 ? '+' : ''}${maxLossDelta}`}
            </p>
            {winnerPaymentSummary && (
              <p>
                {t('riichi.modal.summary.winnerIncome')}{' '}
                {t('riichi.modal.summary.base')} +{winnerPaymentSummary.base}
                {' / '}
                {t('riichi.modal.summary.honba')} +{winnerPaymentSummary.honba}
                {' / '}
                {t('riichi.modal.summary.riichi')} +
                {winnerPaymentSummary.riichi}
              </p>
            )}
            <p>
              {t('riichi.modal.summary.delta')}{' '}
              {winSettlementPreview.deltas
                .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
                .join(' · ')}
            </p>
            <p>
              {t('riichi.modal.summary.total')}{' '}
              {winSettlementPreview.newScores
                .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                .join(' · ')}
            </p>
            {winSettlementPreview.payments.length > 0 && (
              <ul className="list-disc list-inside text-[11px] text-[#f1faee]/80">
                {winSettlementPreview.payments.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    {p.from >= 0
                      ? SEAT_NAMES[p.from]
                      : t('riichi.modal.summary.riichiPool')}{' '}
                    → {SEAT_NAMES[p.to]} {p.amount}
                    {t('riichi.modal.unit.point')}
                    {p.reason === 'honba'
                      ? `（${t('riichi.modal.summary.reason.honba')}）`
                      : p.reason === 'riichi'
                        ? `（${t('riichi.modal.summary.reason.riichi')}）`
                        : p.reason === 'ron'
                          ? `（${t('riichi.modal.summary.reason.ron')}）`
                          : p.reason === 'tsumo'
                            ? `（${t('riichi.modal.summary.reason.tsumo')}）`
                            : ''}
                  </li>
                ))}
              </ul>
            )}
            {timeoutEvents.length > 0 && (
              <p className="text-[11px] text-[#f1faee]/80">
                {t('riichi.modal.summary.timeout')}
                {timeoutEvents.join('；')}
              </p>
            )}
          </div>
        )}
        <Button
          className="w-full font-semibold"
          style={{
            backgroundColor: 'var(--riichi-btn-primary)',
            color: 'var(--riichi-btn-primary-text)',
          }}
          onClick={onNext}
        >
          {t('riichi.modal.nextRound')}
        </Button>
      </div>
    </div>
  );
}

type RyuukyokuModalProps = {
  ryuukyokuReason: RiichiGameState['ryuukyokuReason'];
  drawSettlementPreview: DrawSettlementPreview | null;
  roundProgressSummary: RiichiRoundProgressSummary;
  timeoutEvents: string[];
  onNext: () => void;
};

export function RyuukyokuModal({
  ryuukyokuReason,
  drawSettlementPreview,
  roundProgressSummary,
  timeoutEvents,
  onNext,
}: RyuukyokuModalProps) {
  const { t } = useLocale();
  const isExhaustiveDraw = isExhaustiveRyuukyoku(ryuukyokuReason);
  const reasonText = getRyuukyokuReasonText(ryuukyokuReason, t);
  const maxGainSeat = drawSettlementPreview
    ? getMaxGainSeat(drawSettlementPreview.settlement.deltas)
    : null;
  const maxGainDelta =
    maxGainSeat != null && drawSettlementPreview
      ? drawSettlementPreview.settlement.deltas[maxGainSeat]
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl border-2 p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        style={{
          backgroundColor: 'var(--riichi-table)',
          borderColor: 'var(--riichi-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-ryuukyoku-title"
      >
        <h3
          id="riichi-ryuukyoku-title"
          className="text-xl font-bold text-center mb-3"
          style={{ color: 'var(--riichi-accent)' }}
        >
          {t('riichi.modal.draw.titlePrefix')}（{reasonText}）
        </h3>
        <p
          className="text-sm mb-2 text-center opacity-90"
          style={{ color: 'var(--riichi-text)' }}
        >
          {getRyuukyokuDescription(ryuukyokuReason, t)}
        </p>
        <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
        {drawSettlementPreview && (
          <div
            className="mb-4 rounded-lg border p-3 text-xs space-y-1 opacity-90"
            style={{
              borderColor:
                'color-mix(in srgb, var(--riichi-border) 40%, transparent)',
              backgroundColor:
                'color-mix(in srgb, var(--riichi-table-inner) 70%, transparent)',
              color: 'var(--riichi-text)',
            }}
          >
            <p className="text-[11px] font-semibold text-[#ffe082]">
              {t('riichi.modal.summary.title')}
              {isExhaustiveDraw
                ? ` ${t('riichi.modal.draw.tenpaiCountPrefix')} ${drawSettlementPreview.tenpaiSeats.length} ${t('riichi.modal.draw.houseSuffix')}`
                : ` ${t('riichi.modal.draw.abortive')}`}
              {maxGainSeat != null &&
                ` · ${SEAT_NAMES[maxGainSeat]} ${maxGainDelta >= 0 ? '+' : ''}${maxGainDelta}`}
            </p>
            {isExhaustiveDraw ? (
              <p>
                {t('riichi.modal.draw.tenpaiLabel')}
                {drawSettlementPreview.tenpaiSeats.length === 0
                  ? ` ${t('riichi.modal.none')}`
                  : ` ${drawSettlementPreview.tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`}
              </p>
            ) : (
              <p>{t('riichi.modal.draw.abortiveNote')}</p>
            )}
            <p>
              {t('riichi.modal.summary.delta')}{' '}
              {drawSettlementPreview.settlement.deltas
                .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
                .join(' · ')}
            </p>
            <p>
              {t('riichi.modal.summary.total')}{' '}
              {drawSettlementPreview.settlement.newScores
                .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                .join(' · ')}
            </p>
            {timeoutEvents.length > 0 && (
              <p className="text-[11px] text-[#f1faee]/80">
                {t('riichi.modal.summary.timeout')}
                {timeoutEvents.join('；')}
              </p>
            )}
          </div>
        )}
        <Button
          className="w-full font-semibold"
          style={{
            backgroundColor: 'var(--riichi-btn-primary)',
            color: 'var(--riichi-btn-primary-text)',
          }}
          onClick={onNext}
        >
          {t('riichi.modal.nextRound')}
        </Button>
      </div>
    </div>
  );
}

type MatchEndModalProps = {
  matchEnd: MatchEndState;
  roundProgressSummary: RiichiRoundProgressSummary;
  onRestart: () => void;
  homeLabel: string;
};

export function MatchEndModal({
  matchEnd,
  roundProgressSummary,
  onRestart,
  homeLabel,
}: MatchEndModalProps) {
  const { t } = useLocale();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="rounded-2xl border-2 p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in"
        style={{
          backgroundColor: 'var(--riichi-table)',
          borderColor: 'var(--riichi-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-match-end-title"
      >
        <h3
          id="riichi-match-end-title"
          className="text-xl font-bold text-center mb-2"
          style={{ color: 'var(--riichi-accent)' }}
        >
          {t('riichi.modal.matchEnd.title')}
        </h3>
        <p
          className="text-sm mb-3 text-center opacity-90"
          style={{ color: 'var(--riichi-text)' }}
        >
          {getMatchEndReasonText(matchEnd.reason, t)}
        </p>
        <div
          className="mb-4 rounded-lg border p-3 text-xs space-y-1 opacity-90"
          style={{
            borderColor:
              'color-mix(in srgb, var(--riichi-border) 40%, transparent)',
            backgroundColor:
              'color-mix(in srgb, var(--riichi-table-inner) 70%, transparent)',
            color: 'var(--riichi-text)',
          }}
        >
          {matchEnd.ranking.map((seat, i) => (
            <p key={seat}>
              {i + 1}
              {t('riichi.modal.matchEnd.rankSuffix')}
              {SEAT_NAMES[seat]} {formatPoints(matchEnd.finalScores[seat])}
            </p>
          ))}
        </div>
        <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
        <div className="space-y-2">
          <Button
            className="w-full font-semibold"
            style={{
              backgroundColor: 'var(--riichi-btn-primary)',
              color: 'var(--riichi-btn-primary-text)',
            }}
            onClick={onRestart}
          >
            {t('riichi.modal.matchEnd.playAgain')}
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link to="/">{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
