import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle, ChevronRight, Eye, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/contexts/LocaleContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import type { TrainingProblem } from '../../shared/contracts/replay';
import { fetchReplayDetail, fetchReplayList } from '@/lib/riichiReplayArchive';
import { buildMatchReview, type MatchReview } from '@/lib/riichiMatchReview';
import { evaluateTrainingChoice, extractTrainingProblems } from '@/lib/riichiTraining';
import { ReplayViewer } from '@/pages/mahjong/japanese/components/ReplayViewer';
import { RiichiTile } from '@/pages/mahjong/japanese/components/Tile';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine/match';
import '@/pages/mahjong/japanese/presentation.css';

export default function RiichiTraining() {
  const { t, locale } = useLocale();
  const { mode } = useHousehold();
  const isMember = mode === 'member-online';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayFile, setReplayFile] = useState<RiichiReplayFile | null>(null);
  const [review, setReview] = useState<MatchReview | null>(null);
  const [problems, setProblems] = useState<TrainingProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 答题状态
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [declaredRiichi, setDeclaredRiichi] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeReplayFrame, setActiveReplayFrame] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        let matchId = matchIdParam;
        if (!matchId) {
          const list = await fetchReplayList({ limit: 1 }, isMember);
          if (list.items.length === 0) {
            if (!cancelled) {
              setError('riichi.archive.empty');
              setLoading(false);
            }
            return;
          }
          matchId = list.items[0].matchId;
        }

        const detail = await fetchReplayDetail(matchId, isMember);
        if (!detail) {
          if (!cancelled) {
            setError('riichi.archive.empty');
            setLoading(false);
          }
          return;
        }

        const r = await buildMatchReview(detail.file, {
          viewerSeat: detail.summary.viewerSeat,
        });

        if (cancelled) return;
        setReplayFile(detail.file);
        setReview(r);

        const extracted = extractTrainingProblems(r, detail.file);
        setProblems(extracted);
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
    };
  }, [matchIdParam, isMember]);

  if (loading) {
    return (
      <div className="container max-w-4xl py-12 px-4 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">{t('riichi.review.computing')}</p>
      </div>
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
      <div className="container max-w-3xl py-12 px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/replays')} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('riichi.archive.title')}
        </Button>
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
            <h2 className="text-lg font-semibold">{t('riichi.training.title')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {error ? t(error) : t('riichi.training.empty')}
            </p>
            <Button asChild className="mt-4">
              <Link to="/replays">{t('riichi.archive.title')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const problem = problems[currentIndex];
  const evalResult = submitted && selectedTile !== null
    ? evaluateTrainingChoice(problem, selectedTile, declaredRiichi)
    : null;

  const roundLabel = formatMessage(locale, 'riichi.review.roundTurn', {
    wind: t(`game.mahjong.winds.${problem.wind}`),
    round: problem.roundNumber,
    honba: problem.honba,
    turn: problem.turn,
  });

  const handleTileSelect = (tile: number) => {
    if (submitted) return;
    setSelectedTile(tile);
  };

  const handleSubmit = () => {
    if (selectedTile === null) return;
    setSubmitted(true);
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedTile(null);
      setDeclaredRiichi(false);
      setSubmitted(false);
    } else {
      navigate('/replays');
    }
  };

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/replays')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('riichi.archive.title')}
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

      {/* 练习卡片 */}
      <Card className="riichi-training-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                {t('riichi.training.eyebrow')}
              </p>
              <CardTitle className="text-lg font-bold mt-0.5">{roundLabel}</CardTitle>
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
                    {evalResult.isRecommended ? '回答契合建议' : '有更优选择'}
                  </p>
                  <p className="text-xs leading-relaxed">{t(evalResult.explanationKey)}</p>
                </div>
              </div>

              {/* 决策对比 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
                  <span className="text-muted-foreground">{t('riichi.review.recommended')}:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <RiichiTile tile={problem.recommendedTile} variant="river" />
                    <span className="font-semibold text-sm">
                      {getTileLabel(problem.recommendedTile)}
                    </span>
                    {problem.recommendedRiichi && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">立直</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
                  <span className="text-muted-foreground">实战打牌:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <RiichiTile tile={problem.playedTile} variant="river" />
                    <span className="font-semibold text-sm">
                      {getTileLabel(problem.playedTile)}
                    </span>
                    {problem.playerRiichi && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">立直</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
              <Button size="sm" onClick={handleNext}>
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
