import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import {
  buildMatchReview,
  type MatchReview,
  type ReviewDecision,
} from '@/lib/riichiMatchReview';
import type { RiichiReplayFile } from '../engine';
import { formatPoints, toTileKeyedItems } from '../helpers';
import { loadLastReplay } from '../store/persistence';
import { reviewReasonMessage } from '../trainingAdvice';
import {
  useRiichiDialogContainer,
  useRiichiDialogFocus,
} from '../useRiichiDialogFocus';
import { useRiichiTheme } from '../useRiichiTheme';
import { MeldTiles } from './MeldTiles';
import { ReplayViewer } from './ReplayViewer';
import { RiichiTile } from './Tile';
import '../presentation.css';

export function MatchReviewButton({
  file,
  matchId,
}: {
  file?: RiichiReplayFile;
  matchId?: string;
}) {
  const { t } = useLocale();
  const [review, setReview] = useState<RiichiReplayFile | null>(null);
  const latest = file ?? loadLastReplay();
  if (!latest || (matchId && latest.ranked?.id !== matchId)) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setReview(latest)}>
        {t('riichi.review.open')}
      </Button>
      {review && (
        <MatchReviewDialog file={review} onClose={() => setReview(null)} />
      )}
    </>
  );
}

function DecisionCard({
  decision,
  onReplay,
}: {
  decision: ReviewDecision;
  onReplay: () => void;
}) {
  const { t, locale } = useLocale();
  const label = formatMessage(locale, 'riichi.review.roundTurn', {
    wind: t(`game.mahjong.winds.${decision.wind}`),
    round: decision.roundNumber,
    honba: decision.honba,
    turn: decision.turn,
  });
  return (
    <article
      className="riichi-review-decision"
      data-reason={decision.reason}
      data-step={decision.frameIndex}
    >
      <header>
        <div>
          <span>{label}</span>
          <h3>{t(`riichi.review.kind.${decision.reason}`)}</h3>
        </div>
        {decision.loss > 0 && (
          <strong className="riichi-review-loss">
            −{decision.loss.toLocaleString()}
          </strong>
        )}
      </header>
      <section
        className="riichi-review-hand"
        aria-label={t('riichi.review.hand')}
      >
        {toTileKeyedItems(decision.hand, `review-${decision.frameIndex}`).map(
          ({ tile, key }) => (
            <RiichiTile
              key={key}
              tile={tile}
              variant="indicator"
              highlighted={tile === decision.played}
            />
          ),
        )}
        {decision.melds.map((meld, index) => (
          <span className="riichi-win-melds" key={`${meld.type}-${index}`}>
            <MeldTiles meld={meld} seat={0} />
          </span>
        ))}
      </section>
      <div className="riichi-review-comparison">
        <div data-choice="player">
          <small>{t('riichi.review.played')}</small>
          <RiichiTile tile={decision.played} variant="hand" highlighted />
          <span>
            {t(
              decision.playerRiichi
                ? 'riichi.state.riichi'
                : 'riichi.action.discard',
            )}
          </span>
        </div>
        <span aria-hidden="true">→</span>
        <div data-choice="ai">
          <small>{t('riichi.review.recommended')}</small>
          <RiichiTile tile={decision.recommended} variant="hand" highlighted />
          <span>
            {t(
              decision.aiRiichi
                ? 'riichi.state.riichi'
                : 'riichi.action.discard',
            )}
          </span>
        </div>
        <p>
          {formatMessage(locale, reviewReasonMessage(decision.reason), {
            tile: getTileLabel(decision.recommended, locale),
            shanten: decision.shantenDifference,
            count: decision.ukeireDifference,
          })}
        </p>
      </div>
      {decision.reason === 'dealIn' && (
        <div className="riichi-review-opponents">
          {decision.opponents.map((opponent) => (
            <p key={opponent.seat}>
              {formatMessage(locale, 'riichi.review.opponent', {
                seat: t(`game.mahjong.seats.${opponent.seat}`),
                status: t(
                  opponent.riichi
                    ? 'riichi.state.riichi'
                    : 'riichi.review.notRiichi',
                ),
                calls: opponent.calls,
                turn: opponent.turn,
              })}
            </p>
          ))}
          <small>
            {t(
              decision.safer
                ? 'riichi.review.lowerRisk'
                : 'riichi.review.noSafeTile',
            )}
          </small>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={onReplay}>
        {t('riichi.review.viewReplay')}
      </Button>
    </article>
  );
}

export function MatchReviewDialog({
  file,
  viewerSeat,
  onClose,
}: {
  file: RiichiReplayFile;
  viewerSeat?: number;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useRiichiTheme();
  const container = useRiichiDialogContainer();
  const restoreFocus = useRiichiDialogFocus();
  const [progress, setProgress] = useState(0);
  const [review, setReview] = useState<MatchReview | null>(null);
  const [error, setError] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setReview(null);
    setProgress(0);
    setError(false);
    void buildMatchReview(file, {
      viewerSeat,
      signal: controller.signal,
      onProgress: (value) => {
        if (!controller.signal.aborted) setProgress(value);
      },
    })
      .then((result) => {
        if (!controller.signal.aborted) setReview(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [file, viewerSeat]);
  if (!container) return null;
  if (review && replayIndex !== null)
    return (
      <ReplayViewer
        key={replayIndex}
        file={file}
        frames={review.frames}
        initialIndex={replayIndex}
        onClose={() => setReplayIndex(null)}
      />
    );
  const rate = (value: number) =>
    `${review?.stats.rounds ? ((value / review.stats.rounds) * 100).toFixed(1) : '0.0'}%`;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        data-riichi-theme={theme}
        onCloseAutoFocus={restoreFocus}
        className="riichi-review-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <header className="riichi-review-header">
          <div>
            <span>{t('riichi.review.eyebrow')}</span>
            <DialogTitle>{t('riichi.review.title')}</DialogTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('game.mahjong.close')}
          </Button>
        </header>
        {!review && !error && (
          <div className="riichi-review-loading" role="status">
            <p>{t('riichi.review.computing')}</p>
            <progress
              max={1}
              value={progress}
              aria-label={t('riichi.review.computing')}
            />
            <span>{Math.round(progress * 100)}%</span>
          </div>
        )}
        {error && <p role="alert">{t('riichi.review.error')}</p>}
        {review && (
          <>
            <div className="riichi-review-stats">
              {[
                ['winRate', rate(review.stats.wins)],
                ['dealInRate', rate(review.stats.dealIns)],
                ['riichiRate', rate(review.stats.riichi)],
                ['callRate', rate(review.stats.calls)],
                ['averageWin', formatPoints(review.stats.averageWin, locale)],
              ].map(([key, value]) => (
                <div key={key}>
                  <small>{t(`riichi.review.stat.${key}`)}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="riichi-review-note">
              {formatMessage(locale, 'riichi.review.note', {
                count: review.stats.rounds,
              })}
            </p>
            <div className="riichi-review-list">
              {review.decisions.map((decision) => (
                <DecisionCard
                  key={decision.frameIndex}
                  decision={decision}
                  onReplay={() => setReplayIndex(decision.frameIndex)}
                />
              ))}
            </div>
            {review.decisions.length === 0 && (
              <div className="riichi-review-empty">
                <h3>{t('riichi.review.empty')}</h3>
                <p>{t('riichi.review.emptyDescription')}</p>
                <Button variant="outline" onClick={() => setReplayIndex(0)}>
                  {t('riichi.review.viewReplay')}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
