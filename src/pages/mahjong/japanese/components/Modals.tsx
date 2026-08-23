import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { getGrowthOverview } from '@/lib/growth';
import { formatMessage } from '@/lib/i18n';
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
import {
  formatPoints,
  getMatchEndReasonText,
  getRyuukyokuDescription,
  getRyuukyokuReasonText,
  isExhaustiveRyuukyoku,
} from '../helpers';
import type { RiichiWinResult } from '../store/riichiGameStore';
import type { RiichiGameState } from '../types';

export type WinResultState = RiichiWinResult;

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
  const { t, locale } = useLocale();
  const winnerDelta = winSettlementPreview?.deltas[winResult.winner] ?? 0;
  const maxLossSeat = winSettlementPreview
    ? getMaxLossSeat(winSettlementPreview.deltas)
    : null;
  const maxLossDelta =
    maxLossSeat != null && winSettlementPreview
      ? winSettlementPreview.deltas[maxLossSeat]
      : 0;
  const scoreHeadline =
    winResult.yakuman && winResult.yakuman > 0
      ? winResult.yakuman > 1
        ? formatMessage(locale, 'game.mahjong.multipleYakuman', {
            count: winResult.yakuman,
          })
        : t('game.mahjong.yakuman')
      : winResult.fu != null && winResult.han != null
        ? `${winResult.fu} ${t('riichi.modal.unit.fu')} · ${winResult.han} ${t('riichi.modal.unit.han')}`
        : '';

  return (
    <div
      className="riichi-result-overlay animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="riichi-result-modal animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-win-title"
      >
        <header className="riichi-result-heading">
          <div>
            <p>ROUND RESULT</p>
            <h3 id="riichi-win-title">
              {winResult.isTsumo
                ? t('riichi.modal.win.tsumo')
                : t('riichi.modal.win.ron')}
            </h3>
          </div>
          <div className="riichi-result-score">
            <strong>{scoreHeadline}</strong>
            {winResult.ten != null && (
              <span>
                {winResult.ten} {t('riichi.modal.unit.point')}
              </span>
            )}
          </div>
        </header>

        <div className="riichi-result-grid">
          <section className="riichi-result-section">
            <p className="riichi-result-section-label">
              {t('riichi.modal.win.yakuTitle')}
            </p>
            <ul className="riichi-yaku-list">
              {winResult.yaku.map((yaku, index) => (
                <li key={`${yaku.name}-${index}`}>
                  <span>{yaku.name}</span>
                  {(!winResult.yakuman || winResult.yakuman <= 0) && (
                    <strong>
                      {yaku.han}
                      {t('riichi.modal.unit.han')}
                    </strong>
                  )}
                </li>
              ))}
            </ul>
            {winResult.uraDoraIndicators &&
              winResult.uraDoraIndicators.length > 0 && (
                <div className="riichi-result-note">
                  <strong>{t('riichi.modal.win.uraIndicator')}</strong>
                  <span>
                    {winResult.uraDoraIndicators
                      .map((tile) => getTileLabel(tile, locale))
                      .join(' · ')}
                    {winResult.uraHan != null
                      ? ` · ${t('riichi.modal.win.uraHan')} ${winResult.uraHan} ${t('riichi.modal.unit.han')}`
                      : ''}
                  </span>
                </div>
              )}
          </section>

          <section className="riichi-result-section">
            <p className="riichi-result-section-label">
              {t('riichi.modal.summary.title')}
            </p>
            {winSettlementPreview && (
              <div className="riichi-result-payments">
                <div className="riichi-result-delta">
                  <span>{t(`game.mahjong.seats.${winResult.winner}`)}</span>
                  <strong>
                    {winnerDelta >= 0 ? '+' : ''}
                    {winnerDelta}
                  </strong>
                  {maxLossSeat != null && (
                    <small>
                      {t(`game.mahjong.seats.${maxLossSeat}`)}{' '}
                      {maxLossDelta >= 0 ? '+' : ''}
                      {maxLossDelta}
                    </small>
                  )}
                </div>
                {winnerPaymentSummary && (
                  <p>
                    {t('riichi.modal.summary.base')} +
                    {winnerPaymentSummary.base}
                    {' · '}
                    {t('riichi.modal.summary.honba')} +
                    {winnerPaymentSummary.honba}
                    {' · '}
                    {t('riichi.modal.summary.riichi')} +
                    {winnerPaymentSummary.riichi}
                  </p>
                )}
                <div className="riichi-result-score-table">
                  {winSettlementPreview.newScores.map((score, seat) => (
                    <div key={seat}>
                      <span>{t(`game.mahjong.seats.${seat}`)}</span>
                      <strong>{score}</strong>
                      <em>
                        {winSettlementPreview.deltas[seat] >= 0 ? '+' : ''}
                        {winSettlementPreview.deltas[seat]}
                      </em>
                    </div>
                  ))}
                </div>
                {winSettlementPreview.payments.length > 0 && (
                  <ul className="riichi-result-payment-list">
                    {winSettlementPreview.payments
                      .slice(0, 8)
                      .map((payment, index) => (
                        <li key={`${payment.from}-${payment.to}-${index}`}>
                          <span>
                            {payment.from >= 0
                              ? t(`game.mahjong.seats.${payment.from}`)
                              : t('riichi.modal.summary.riichiPool')}{' '}
                            → {t(`game.mahjong.seats.${payment.to}`)}
                          </span>
                          <strong>{payment.amount}</strong>
                        </li>
                      ))}
                  </ul>
                )}
                {timeoutEvents.length > 0 && (
                  <p className="riichi-result-timeout">
                    {t('riichi.modal.summary.timeout')}
                    {timeoutEvents.join('；')}
                  </p>
                )}
              </div>
            )}
            <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
          </section>
        </div>

        <Button className="riichi-result-primary" onClick={onNext}>
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
  const { t, locale } = useLocale();
  const isExhaustiveDraw = isExhaustiveRyuukyoku(ryuukyokuReason);
  const reasonText = getRyuukyokuReasonText(ryuukyokuReason, t);
  const maxGainSeat = drawSettlementPreview
    ? getMaxGainSeat(drawSettlementPreview.settlement.deltas)
    : null;
  const maxGainDelta =
    maxGainSeat != null && drawSettlementPreview
      ? drawSettlementPreview.settlement.deltas[maxGainSeat]
      : 0;
  const listSeparator = locale === 'en' ? ', ' : '、';

  return (
    <div
      className="riichi-result-overlay animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="riichi-result-modal animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-ryuukyoku-title"
      >
        <header className="riichi-result-heading">
          <div>
            <p>ROUND RESULT</p>
            <h3 id="riichi-ryuukyoku-title">
              {t('riichi.modal.draw.titlePrefix')}
            </h3>
          </div>
          <div className="riichi-result-score">
            <strong>{reasonText}</strong>
            <span>{getRyuukyokuDescription(ryuukyokuReason, t)}</span>
          </div>
        </header>

        <div className="riichi-result-grid">
          <section className="riichi-result-section">
            <p className="riichi-result-section-label">局面结果</p>
            <div className="riichi-draw-summary">
              <strong>
                {isExhaustiveDraw
                  ? `${t('riichi.modal.draw.tenpaiCountPrefix')} ${drawSettlementPreview?.tenpaiSeats.length ?? 0} ${t('riichi.modal.draw.houseSuffix')}`
                  : t('riichi.modal.draw.abortive')}
              </strong>
              <p>
                {isExhaustiveDraw
                  ? `${t('riichi.modal.draw.tenpaiLabel')} ${
                      drawSettlementPreview?.tenpaiSeats.length
                        ? drawSettlementPreview.tenpaiSeats
                            .map((seat) => t(`game.mahjong.seats.${seat}`))
                            .join(listSeparator)
                        : t('riichi.modal.none')
                    }`
                  : t('riichi.modal.draw.abortiveNote')}
              </p>
              {maxGainSeat != null && (
                <div>
                  <span>{t(`game.mahjong.seats.${maxGainSeat}`)}</span>
                  <strong>
                    {maxGainDelta >= 0 ? '+' : ''}
                    {maxGainDelta}
                  </strong>
                </div>
              )}
            </div>
          </section>

          <section className="riichi-result-section">
            <p className="riichi-result-section-label">
              {t('riichi.modal.summary.title')}
            </p>
            {drawSettlementPreview && (
              <div className="riichi-result-payments">
                <div className="riichi-result-score-table">
                  {drawSettlementPreview.settlement.newScores.map(
                    (score, seat) => (
                      <div key={seat}>
                        <span>{t(`game.mahjong.seats.${seat}`)}</span>
                        <strong>{score}</strong>
                        <em>
                          {drawSettlementPreview.settlement.deltas[seat] >= 0
                            ? '+'
                            : ''}
                          {drawSettlementPreview.settlement.deltas[seat]}
                        </em>
                      </div>
                    ),
                  )}
                </div>
                {timeoutEvents.length > 0 && (
                  <p className="riichi-result-timeout">
                    {t('riichi.modal.summary.timeout')}
                    {timeoutEvents.join(locale === 'en' ? '; ' : '；')}
                  </p>
                )}
              </div>
            )}
            <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
          </section>
        </div>

        <Button className="riichi-result-primary" onClick={onNext}>
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
      className="riichi-result-overlay riichi-result-overlay--final animate-riichi-overlay-in"
      role="presentation"
    >
      <div
        className="riichi-result-modal animate-riichi-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riichi-match-end-title"
      >
        <header className="riichi-result-heading">
          <div>
            <p>MATCH COMPLETE</p>
            <h3 id="riichi-match-end-title">
              {t('riichi.modal.matchEnd.title')}
            </h3>
          </div>
          <div className="riichi-result-score">
            <strong>{getMatchEndReasonText(matchEnd.reason, t)}</strong>
            <span>最终排名与本场成长记录</span>
          </div>
        </header>

        <div className="riichi-result-grid">
          <section className="riichi-result-section">
            <p className="riichi-result-section-label">最终排名</p>
            <div className="riichi-final-ranking">
              {matchEnd.ranking.map((seat, index) => (
                <div key={seat} className={index === 0 ? 'is-first' : ''}>
                  <strong>
                    {index + 1}
                    {t('riichi.modal.matchEnd.rankSuffix')}
                  </strong>
                  <span>{t(`game.mahjong.seats.${seat}`)}</span>
                  <em>{formatPoints(matchEnd.finalScores[seat])}</em>
                </div>
              ))}
            </div>
          </section>
          <section className="riichi-result-section">
            <p className="riichi-result-section-label">成长结果</p>
            <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
          </section>
        </div>

        <div className="riichi-result-actions">
          <Button className="riichi-result-primary" onClick={onRestart}>
            {t('riichi.modal.matchEnd.playAgain')}
          </Button>
          <Button asChild className="riichi-result-secondary" variant="outline">
            <Link to="/">{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
