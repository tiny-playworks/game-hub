import {
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  useMemo,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { getGrowthOverview } from '@/lib/growth';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type {
  RiichiAchievementRewardSummary,
  RiichiRoundProgressSummary,
} from '@/lib/riichiProgress';
import {
  getHighestUnlockedTitle,
  getNextLockedTitle,
  getUnlockedTitles,
} from '@/lib/titles';
import type { CharacterMoment } from '../characterMoments';
import type { RiichiReplayFile } from '../engine';
import {
  formatPoints,
  getMatchEndReasonText,
  getRyuukyokuDescription,
  getRyuukyokuReasonText,
} from '../helpers';
import type { RiichiGameState, RiichiWinResult, RoundResult } from '../types';
import {
  useRiichiDialogContainer,
  useRiichiDialogFocus,
} from '../useRiichiDialogFocus';
import { MatchReviewButton } from './MatchReview';
import { MeldTiles } from './MeldTiles';
import { CharacterQuotes } from './SpeechBubble';
import { RiichiTile } from './Tile';

export type WinResultState = RiichiWinResult;

export function ResultDialog({
  children,
  onClose,
  className = '',
  onClick,
  onKeyDown,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}) {
  const restoreFocus = useRiichiDialogFocus();
  const container = useRiichiDialogContainer();
  if (!container) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        onCloseAutoFocus={restoreFocus}
        className={`riichi-result-modal !w-[min(840px,calc(100vw-40px))] !max-w-none animate-riichi-modal-in ${className}`}
        showCloseButton={false}
        aria-describedby={undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type MatchEndState = {
  reason: MatchEndReason;
  finalScores: number[];
  ranking: number[];
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

export function RoundGrowthSummary({
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
            {t(getCharacterById(characterProgress.characterId).nameKey)}{' '}
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

type RyuukyokuModalProps = {
  moments?: CharacterMoment[];
  game: RiichiGameState;
  result: Extract<RoundResult, { type: 'draw' }>;
  roundProgressSummary: RiichiRoundProgressSummary;
  timeoutEvents: string[];
  onNext: () => void;
};

export function RyuukyokuModal({
  moments = [],
  game,
  result,
  roundProgressSummary,
  timeoutEvents,
  onNext,
}: RyuukyokuModalProps) {
  const { t, locale } = useLocale();
  const ryuukyokuReason = result.reason;
  const drawSettlementPreview = result;
  const isExhaustiveDraw = result.reason === 'exhaustive';
  const isNagashi = result.nagashiSeats.length > 0;
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
    <ResultDialog onClose={onNext}>
      <header className="riichi-result-heading">
        <div>
          <p>ROUND RESULT</p>
          <DialogTitle asChild>
            <h3 id="riichi-ryuukyoku-title">
              {t('riichi.modal.draw.titlePrefix')}
            </h3>
          </DialogTitle>
        </div>
        <div className="riichi-result-score">
          <strong>
            {isNagashi ? t('riichi.modal.draw.nagashi') : reasonText}
          </strong>
          <span>
            {isNagashi
              ? t('riichi.modal.draw.nagashiDesc')
              : getRyuukyokuDescription(ryuukyokuReason, t)}
          </span>
        </div>
      </header>

      <CharacterQuotes
        moments={moments}
        kinds={['ryuukyoku-tenpai', 'chatter']}
      />
      <div className="riichi-result-grid">
        <section className="riichi-result-section">
          <p className="riichi-result-section-label">
            {t('riichi.modal.draw.roundOutcome')}
          </p>
          <div className="riichi-draw-summary">
            <strong>
              {isNagashi
                ? result.nagashiSeats
                    .map((seat) => t(`game.mahjong.seats.${seat}`))
                    .join(listSeparator)
                : isExhaustiveDraw
                  ? `${t('riichi.modal.draw.tenpaiCountPrefix')} ${drawSettlementPreview?.tenpaiSeats.length ?? 0} ${t('riichi.modal.draw.houseSuffix')}`
                  : t('riichi.modal.draw.abortive')}
            </strong>
            <p>
              {isNagashi
                ? t('riichi.modal.draw.nagashiDesc')
                : isExhaustiveDraw
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
          {isExhaustiveDraw && !isNagashi && (
            <div className="riichi-draw-hands">
              {[0, 1, 2, 3].map((seat) => (
                <article
                  key={seat}
                  data-tenpai={result.tenpaiSeats.includes(seat)}
                >
                  <header>
                    <strong>{t(`game.mahjong.seats.${seat}`)}</strong>
                    <span>
                      {t(
                        result.tenpaiSeats.includes(seat)
                          ? 'riichi.training.tenpai'
                          : 'riichi.presentation.noten',
                      )}
                    </span>
                  </header>
                  {result.tenpaiSeats.includes(seat) && (
                    <div className="riichi-draw-tiles">
                      {game.hands[seat].map((tile, index) => (
                        <RiichiTile
                          key={`${tile}-${index}`}
                          tile={tile}
                          variant="indicator"
                        />
                      ))}
                      {game.melds[seat].map((meld, index) => (
                        <span
                          className="riichi-win-melds"
                          key={`${meld.type}-${index}`}
                        >
                          <MeldTiles meld={meld} seat={seat} />
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
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
    </ResultDialog>
  );
}
type MatchEndModalProps = {
  moments?: CharacterMoment[];
  matchEnd: MatchEndState;
  roundProgressSummary: RiichiRoundProgressSummary;
  onRestart: () => void;
  homeLabel: string;
  replayFile: RiichiReplayFile;
};

export function MatchEndModal({
  moments = [],
  matchEnd,
  roundProgressSummary,
  onRestart,
  homeLabel,
  replayFile,
}: MatchEndModalProps) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();

  return (
    <ResultDialog onClose={() => navigate('/')}>
      <header className="riichi-result-heading">
        <div>
          <p>MATCH COMPLETE</p>
          <DialogTitle asChild>
            <h3 id="riichi-match-end-title">
              {t('riichi.modal.matchEnd.title')}
            </h3>
          </DialogTitle>
        </div>
        <div className="riichi-result-score">
          <strong>{getMatchEndReasonText(matchEnd.reason, t)}</strong>
          <span>{t('riichi.modal.matchEnd.summary')}</span>
        </div>
      </header>
      <CharacterQuotes moments={moments} kinds={['match-top', 'match-last']} />

      <div className="riichi-result-grid">
        <section className="riichi-result-section">
          <p className="riichi-result-section-label">
            {t('riichi.modal.matchEnd.ranking')}
          </p>
          <div className="riichi-final-ranking">
            {matchEnd.ranking.map((seat, index) => (
              <div key={seat} className={index === 0 ? 'is-first' : ''}>
                <strong>
                  {index + 1}
                  {t('riichi.modal.matchEnd.rankSuffix')}
                </strong>
                <span>{t(`game.mahjong.seats.${seat}`)}</span>
                <em>{formatPoints(matchEnd.finalScores[seat], locale)}</em>
              </div>
            ))}
          </div>
        </section>
        <section className="riichi-result-section">
          <p className="riichi-result-section-label">
            {t('riichi.modal.matchEnd.growth')}
          </p>
          <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
        </section>
      </div>

      <div className="riichi-result-actions">
        <MatchReviewButton file={replayFile} />
        <Button className="riichi-result-primary" onClick={onRestart}>
          {t('riichi.modal.matchEnd.playAgain')}
        </Button>
        <Button asChild className="riichi-result-secondary" variant="outline">
          <Link to="/">{homeLabel}</Link>
        </Button>
      </div>
    </ResultDialog>
  );
}
