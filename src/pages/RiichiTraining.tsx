import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Eye,
  GitBranch,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocale } from '@/contexts/LocaleContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import type {
  ReplayArchiveSummary,
  TrainingCategory,
  TrainingProblem,
} from '../../shared/contracts/replay';
import { fetchReplayDetail } from '@/lib/riichiReplayArchive';
import { buildMatchReview, type MatchReview } from '@/lib/riichiMatchReview';
import {
  evaluateTrainingChoice,
  extractTrainingProblems,
  isTrainingCategory,
  trainingPracticePath,
} from '@/lib/riichiTraining';
import {
  TrainingNotebook,
  StarterPractice,
} from '@/components/profile/TrainingNotebook';
import {
  readTrainingNotebook,
  updatePracticeNote,
  type PracticeQuestion,
} from '@/lib/trainingNotebook';
import { resumeOwner } from '@/lib/localResume';
import { createUuid } from '@/lib/uuid';
import { TrainingSummary } from '@/components/profile/TrainingSummary';
import {
  createReplayBranch,
  getReplayBranchAvailability,
  isReplayBranchChoiceLegal,
  type ReplayBranchRun,
} from '@/lib/riichiReplayBranch';
import { ReplayBranchPractice } from '@/components/riichi/ReplayBranchPractice';
import { ReplayViewer } from '@/pages/mahjong/japanese/components/ReplayViewer';
import { RiichiTile } from '@/pages/mahjong/japanese/components/Tile';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine/match';
import '@/pages/mahjong/japanese/presentation.css';

export default function RiichiTraining() {
  const { t } = useLocale();
  const { mode, currentMember, isLoading } = useHousehold();
  const [params] = useSearchParams();
  const matchId = params.get('matchId');
  const rawCategory = params.get('category');
  const category = isTrainingCategory(rawCategory) ? rawCategory : undefined;
  if (isLoading)
    return (
      <div className="container mx-auto p-8 text-sm text-muted-foreground">
        {t('riichi.review.computing')}
      </div>
    );
  const owner = resumeOwner(currentMember?.id);
  if (params.get('practice') === 'starter')
    return (
      <StarterPractice
        key={`${owner}:${params.get('lesson')}`}
        owner={owner}
        lessonId={params.get('lesson')}
      />
    );
  if (!matchId || mode === 'member-offline') {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {t('riichi.training.center.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('riichi.training.center.intro')}
          </p>
        </div>
        <TrainingNotebook key={owner} owner={owner} />
        <TrainingSummary expanded />
      </div>
    );
  }
  return (
    <RiichiTrainingSession
      key={`${mode}:${currentMember?.id ?? 'guest'}:${matchId}:${category ?? 'all'}:${params.get('question') ?? ''}`}
      matchId={matchId}
      category={category}
      questionId={params.get('question')}
    />
  );
}

function RiichiTrainingSession({
  matchId,
  category,
  questionId,
}: {
  matchId: string;
  category?: TrainingCategory;
  questionId: string | null;
}) {
  const { t, locale } = useLocale();
  const { mode, currentMember } = useHousehold();
  const owner = resumeOwner(currentMember?.id);
  const [attemptId, setAttemptId] = useState(createUuid);
  const [saveFailed, setSaveFailed] = useState(false);
  const [notebook, setNotebook] = useState(() => readTrainingNotebook(owner));
  const isMember = mode !== 'guest-local';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayFile, setReplayFile] = useState<RiichiReplayFile | null>(null);
  const [replaySummary, setReplaySummary] =
    useState<ReplayArchiveSummary | null>(null);
  const [review, setReview] = useState<MatchReview | null>(null);
  const [problems, setProblems] = useState<TrainingProblem[]>([]);
  const [allProblems, setAllProblems] = useState<TrainingProblem[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 答题状态
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [declaredRiichi, setDeclaredRiichi] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeReplayFrame, setActiveReplayFrame] = useState<number | null>(
    null,
  );
  const [activeBranch, setActiveBranch] = useState<ReplayBranchRun | null>(
    null,
  );
  const [branchError, setBranchError] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function init() {
      try {
        setLoading(true);
        setError(null);
        setReplayFile(null);
        setReplaySummary(null);
        setReview(null);
        setProblems([]);
        setCurrentIndex(0);
        setSelectedTile(null);
        setDeclaredRiichi(false);
        setSubmitted(false);
        setActiveBranch(null);
        setActiveReplayFrame(null);
        setBranchError(false);
        setReviewProgress(0);

        const detail = await fetchReplayDetail(
          matchId,
          isMember,
          controller.signal,
        );
        if (cancelled) return;
        if (!detail) {
          if (!cancelled) {
            setError('riichi.archive.empty');
            setLoading(false);
          }
          return;
        }

        const r = await buildMatchReview(detail.file, {
          viewerSeat: detail.summary.viewerSeat,
          signal: controller.signal,
          onProgress: (progress) => {
            if (!cancelled) setReviewProgress(progress);
          },
        });

        if (cancelled) return;
        setReplayFile(detail.file);
        setReplaySummary(detail.summary);
        setReview(r);

        const extracted = extractTrainingProblems(r, detail.file).filter(
          (problem) =>
            (!category || problem.category === category) &&
            (!questionId || problem.id === questionId),
        );
        setProblems(extracted);
        setAllProblems(extracted);
        setAnswers({});
        setCompleted(false);
      } catch {
        if (!cancelled) {
          setError('riichi.review.error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [matchId, category, questionId, isMember, loadAttempt]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">{t('riichi.review.computing')}</p>
        <p className="text-xs tabular-nums" aria-live="polite">
          {Math.round(reviewProgress * 100)}%
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/replays/training')}
        >
          {t('riichi.training.center.cancelBack')}
        </Button>
      </div>
    );
  }

  if (activeBranch) {
    return (
      <ReplayBranchPractice
        run={activeBranch}
        onExit={() => {
          setActiveBranch(null);
          setSelectedTile(null);
          setDeclaredRiichi(false);
          setSubmitted(false);
        }}
        onViewOriginal={() => {
          setActiveReplayFrame(activeBranch.node.sourceFrameIndex);
          setActiveBranch(null);
        }}
      />
    );
  }

  if (activeReplayFrame !== null && replayFile && review) {
    return (
      <ReplayViewer
        file={replayFile}
        frames={review.frames}
        initialIndex={activeReplayFrame}
        onClose={() => setActiveReplayFrame(null)}
      />
    );
  }

  if (error || problems.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/replays/training')}
          className="mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('riichi.training.center.title')}
        </Button>
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
            <h2 className="text-lg font-semibold">
              {t('riichi.training.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {error
                ? t(error)
                : t(
                    category
                      ? 'riichi.training.center.categoryEmpty'
                      : 'riichi.training.empty',
                  )}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {error && (
                <Button
                  variant="outline"
                  onClick={() => setLoadAttempt((value) => value + 1)}
                >
                  {t('recovery.retry')}
                </Button>
              )}
              {category && !error && (
                <Button asChild variant="outline">
                  <Link to={trainingPracticePath(matchId)}>
                    {t('riichi.training.center.allQuestions')}
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link to="/replays/training">
                  {t('riichi.training.center.title')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const restartQuestions = (questions: TrainingProblem[]) => {
    setProblems(questions);
    setAttemptId(createUuid());
    setSaveFailed(false);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedTile(null);
    setDeclaredRiichi(false);
    setSubmitted(false);
    setBranchError(false);
    setCompleted(false);
  };

  if (completed) {
    const matched = Object.values(answers).filter(Boolean).length;
    const retry = problems.filter((problem) => answers[problem.id] === false);
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold text-primary">
              {t('riichi.training.center.title')}
            </p>
            <CardTitle>{t('riichi.training.session.complete')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('riichi.training.session.answered')}
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {Object.keys(answers).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('riichi.training.session.matched')}
                </p>
                <p className="mt-1 text-3xl font-bold">{matched}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('riichi.training.session.reference')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('notebook.scope')}
            </p>
            <div className="flex flex-wrap gap-2">
              {retry.length > 0 && (
                <Button onClick={() => restartQuestions(retry)}>
                  {formatMessage(locale, 'riichi.training.session.retry', {
                    count: retry.length,
                  })}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => restartQuestions(allProblems)}
              >
                {t('riichi.training.session.again')}
              </Button>
              <Button asChild variant="outline">
                <Link to="/replays/training">
                  {t('riichi.training.center.title')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const problem = problems[currentIndex];
  const noteQuestion: PracticeQuestion = {
    id: `replay:${matchId}:${problem.id}`,
    source: 'replay',
    sourceId: matchId,
    problemId: problem.id,
    category: problem.category,
  };
  const favorite =
    notebook.notes.find((n) => n.id === noteQuestion.id)?.favorite ?? false;
  const saveAnswer = () => {
    if (selectedTile === null) return;
    setSaveFailed(
      !updatePracticeNote(owner, noteQuestion, {
        attemptId: `${attemptId}:${problem.id}`,
        matched: evaluateTrainingChoice(problem, selectedTile, declaredRiichi)
          .isRecommended,
      }),
    );
  };
  const evalResult =
    submitted && selectedTile !== null
      ? evaluateTrainingChoice(problem, selectedTile, declaredRiichi)
      : null;
  const branchAvailability =
    replayFile && review && replaySummary
      ? getReplayBranchAvailability(replayFile, review, replaySummary, problem)
      : null;
  const branchChoiceLegal =
    branchAvailability?.available && selectedTile !== null
      ? isReplayBranchChoiceLegal(branchAvailability.node, {
          tile: selectedTile,
          riichi: declaredRiichi,
        })
      : false;

  const roundLabel = formatMessage(locale, 'riichi.review.roundTurn', {
    wind: t(`game.mahjong.winds.${problem.wind}`),
    round: problem.roundNumber,
    honba: problem.honba,
    turn: problem.turn,
  });

  const handleTileSelect = (tile: number) => {
    if (submitted) return;
    setSelectedTile(tile);
    setBranchError(false);
  };

  const handleSubmit = () => {
    if (selectedTile === null || submitted) return;
    const result = evaluateTrainingChoice(
      problem,
      selectedTile,
      declaredRiichi,
    );
    setAnswers((previous) =>
      Object.hasOwn(previous, problem.id)
        ? previous
        : { ...previous, [problem.id]: result.isRecommended },
    );
    saveAnswer();
    setSubmitted(true);
  };

  const handleStartBranch = () => {
    if (!branchAvailability?.available || selectedTile === null) return;
    try {
      const run = createReplayBranch(branchAvailability.node, {
        tile: selectedTile,
        riichi: declaredRiichi,
      });
      if (!run) {
        setBranchError(true);
        return;
      }
      setBranchError(false);
      setActiveBranch(run);
    } catch {
      setBranchError(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedTile(null);
      setDeclaredRiichi(false);
      setSubmitted(false);
      setBranchError(false);
    } else {
      setCompleted(true);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
      {/* 顶部导航 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/replays/training')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('riichi.training.center.title')}
        </Button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {currentIndex + 1} / {problems.length}
          </span>
          <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {t(`riichi.review.kind.${problem.category}`)}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('riichi.training.session.reference')}
      </p>

      <Button
        variant="outline"
        onClick={() => {
          const ok = updatePracticeNote(owner, noteQuestion, {
            favorite: !favorite,
          });
          setSaveFailed(!ok);
          if (ok) setNotebook(readTrainingNotebook(owner));
        }}
      >
        {t(favorite ? 'notebook.unfavorite' : 'notebook.save')}
      </Button>
      {saveFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('notebook.failed')}{' '}
          <button className="underline" onClick={saveAnswer}>
            {t('recovery.retry')}
          </button>
        </p>
      )}
      {/* 练习卡片 */}
      <Card className="riichi-training-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                {t('riichi.training.eyebrow')}
              </p>
              <CardTitle className="text-lg font-bold mt-0.5">
                {roundLabel}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
              {t('riichi.training.noRewardNotice')}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 牌面提问 */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('riichi.training.prompt')}</p>
            {/* 玩家手牌 */}
            <div className="flex flex-wrap gap-1 p-3 rounded-xl bg-slate-950/20 border justify-center sm:justify-start">
              {problem.hand.map((tile, idx) => (
                <RiichiTile
                  key={`${tile}-${idx}`}
                  tile={tile}
                  variant="hand"
                  selected={selectedTile === tile}
                  onClick={() => handleTileSelect(tile)}
                />
              ))}
            </div>
          </div>

          {/* 立直选项 */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="riichi-check"
              checked={declaredRiichi}
              disabled={submitted}
              onChange={(e) => setDeclaredRiichi(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label
              htmlFor="riichi-check"
              className="text-sm font-medium leading-none cursor-pointer select-none"
            >
              {t('riichi.training.checkRiichi')}
            </label>
          </div>

          {/* 提交后反馈与解析 */}
          {submitted && evalResult && (
            <div className="space-y-4 pt-2 border-t">
              <div
                className={`p-3.5 rounded-lg flex items-start gap-3 text-sm ${
                  evalResult.isRecommended
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                {evalResult.isRecommended ? (
                  <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {t(
                      evalResult.isRecommended
                        ? 'riichi.branch.eval.recommended'
                        : 'riichi.branch.eval.alternative',
                    )}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {t(evalResult.explanationKey)}
                  </p>
                </div>
              </div>

              {/* 决策对比 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
                  <span className="text-muted-foreground">
                    {t('riichi.review.recommended')}:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <RiichiTile
                      tile={problem.recommendedTile}
                      variant="river"
                    />
                    <span className="font-semibold text-sm">
                      {getTileLabel(problem.recommendedTile)}
                    </span>
                    {problem.recommendedRiichi && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t('riichi.branch.riichi')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
                  <span className="text-muted-foreground">
                    {t('riichi.branch.actualAction')}:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <RiichiTile tile={problem.playedTile} variant="river" />
                    <span className="font-semibold text-sm">
                      {getTileLabel(problem.playedTile)}
                    </span>
                    {problem.playerRiichi && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t('riichi.branch.riichi')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <GitBranch className="h-4 w-4 text-primary" />
              <h3>{t('riichi.branch.title')}</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('riichi.branch.intro')}
            </p>
            <p className="text-xs font-medium text-primary">
              {t('riichi.branch.noReward')}
            </p>
            {branchAvailability?.available ? (
              <>
                <Button
                  onClick={handleStartBranch}
                  disabled={!branchChoiceLegal}
                >
                  <GitBranch className="mr-1.5 h-4 w-4" />
                  {t('riichi.branch.start')}
                </Button>
                {!branchChoiceLegal && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      selectedTile === null
                        ? 'riichi.branch.chooseTile'
                        : 'riichi.branch.legalChoice',
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  branchAvailability?.reasonKey ??
                    'riichi.branch.unavailable.incomplete',
                )}
              </p>
            )}
            {branchError && (
              <p role="alert" className="text-sm text-destructive">
                {t('riichi.branch.startError')}
              </p>
            )}
          </section>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveReplayFrame(problem.frameIndex)}
            className="text-xs"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            {t('riichi.training.backToReplay')}
          </Button>

          <div className="flex items-center gap-2">
            {!submitted ? (
              <Button
                size="sm"
                disabled={selectedTile === null}
                onClick={handleSubmit}
              >
                {t('riichi.training.submit')}
              </Button>
            ) : (
              <Button size="sm" disabled={saveFailed} onClick={handleNext}>
                {currentIndex < problems.length - 1 ? (
                  <>
                    {t('riichi.training.next')}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  t('riichi.training.finish')
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
