import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { extractTrainingProblems } from '@/lib/riichiTraining';
import {
  createReplayBranch,
  getReplayBranchAvailability,
  type ReplayBranchNode,
  type ReplayBranchRun,
} from '@/lib/riichiReplayBranch';
import { ReplayBranchPractice } from '@/components/riichi/ReplayBranchPractice';
import type { ReplaySource } from '../../../../../shared/contracts/replay';
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
  onPractice,
}: {
  decision: ReviewDecision;
  onReplay: () => void;
  onPractice?: () => void;
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
      {onPractice ? (
        <Button size="sm" className="ml-2" onClick={onPractice}>
          {t('play.reviewPractice')}
        </Button>
      ) : null}
    </article>
  );
}

export function MatchReviewDialog({
  file,
  viewerSeat,
  onClose,
  source,
  practiceRound = false,
  practiceStartIndex = 0,
}: {
  file: RiichiReplayFile;
  viewerSeat?: number;
  source?: ReplaySource;
  practiceRound?: boolean;
  practiceStartIndex?: number;
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
  const [practiceNode, setPracticeNode] = useState<ReplayBranchNode | null>(
    null,
  );
  const [choice, setChoice] = useState<number | null>(null);
  const [riichi, setRiichi] = useState(false);
  const [branch, setBranch] = useState<ReplayBranchRun | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setReview(null);
    setProgress(0);
    setError(false);
    setPracticeNode(null);
    setBranch(null);
    void buildMatchReview(file, {
      viewerSeat,
      practiceRound,
      decisionStartIndex: practiceStartIndex,
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
  }, [file, viewerSeat, practiceRound, practiceStartIndex]);
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
  const practiceFor = (decision: ReviewDecision) => {
    if (!review || decision.frameIndex < practiceStartIndex) return null;
    const problem = extractTrainingProblems(review, file).find(
      (item) => item.frameIndex === decision.frameIndex,
    );
    if (!problem) return null;
    const available = getReplayBranchAvailability(
      file,
      review,
      {
        source: source ?? (file.ranked ? 'ai-ranked' : 'free'),
        matchId: file.ranked?.id ?? `practice:${file.seed}`,
        viewerSeat: review.viewerSeat,
      },
      problem,
      practiceRound,
    );
    return available.available ? available.node : null;
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        data-riichi-theme={theme}
        onCloseAutoFocus={restoreFocus}
        className={
          branch
            ? 'riichi-review-dialog riichi-review-practice'
            : 'riichi-review-dialog'
        }
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
        {branch ? (
          <ReplayBranchPractice
            run={branch}
            onExit={() => setBranch(null)}
            onViewOriginal={() => {
              setReplayIndex(branch.node.sourceFrameIndex);
              setBranch(null);
            }}
          />
        ) : null}
        {!branch && practiceNode ? (
          <section className="review-choice-panel">
            <h3>{t('play.reviewPractice')}</h3>
            <p>{t('play.reviewPick')}</p>
            <div className="review-choice-hand">
              {toTileKeyedItems(
                practiceNode.before.round.hands[practiceNode.viewerSeat],
                'practice-choice',
              ).map(({ tile, key }) => (
                <RiichiTile
                  key={key}
                  tile={tile}
                  variant="hand"
                  selected={choice === tile}
                  state={
                    practiceNode.before.round.turnOptions?.discardable.includes(
                      tile,
                    )
                      ? 'normal'
                      : 'disabled'
                  }
                  onClick={() => {
                    setChoice(tile);
                    setRiichi(false);
                  }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={riichi}
                disabled={
                  choice === null ||
                  !practiceNode.before.round.turnOptions?.riichiDiscards.includes(
                    choice,
                  )
                }
                onChange={(event) => setRiichi(event.target.checked)}
              />
              {t('riichi.state.riichi')}
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={choice === null}
                onClick={() => {
                  if (choice !== null)
                    setBranch(
                      createReplayBranch(practiceNode, {
                        tile: choice,
                        riichi,
                      }),
                    );
                }}
              >
                {t('play.reviewStart')}
              </Button>
              <Button variant="ghost" onClick={() => setPracticeNode(null)}>
                {t('play.reviewReturn')}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('play.practiceOnly')}
            </p>
          </section>
        ) : null}
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
        {review && !branch && !practiceNode && (
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
                  onPractice={
                    practiceFor(decision)
                      ? () => {
                          setPracticeNode(practiceFor(decision));
                          setChoice(null);
                          setRiichi(false);
                        }
                      : undefined
                  }
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
