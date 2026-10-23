import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { formatMessage } from '@/lib/i18n';
import {
  GUEST_REPLAY_ARCHIVE_STORAGE_KEY,
  REPLAY_ARCHIVE_CHANGED_EVENT,
} from '@/lib/riichiReplayArchive';
import {
  TRAINING_CATEGORIES,
  trainingPracticePath,
} from '@/lib/riichiTraining';
import {
  loadTrainingOverview,
  type TrainingOverview,
} from '@/lib/riichiTrainingOverview';

interface TrainingSummaryProps {
  onNavigateToReplays?: () => void;
  expanded?: boolean;
}

export function TrainingSummary(props: TrainingSummaryProps) {
  const { t } = useLocale();
  const { mode, currentMember, isLoading } = useHousehold();
  if (isLoading || mode === 'member-offline') {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t(
            isLoading
              ? 'riichi.review.computing'
              : 'riichi.training.center.offline',
          )}
        </CardContent>
      </Card>
    );
  }
  return (
    <TrainingSummaryContent
      key={`${mode}:${currentMember?.id ?? 'guest'}`}
      {...props}
    />
  );
}

function TrainingSummaryContent({
  onNavigateToReplays,
  expanded = false,
}: TrainingSummaryProps) {
  const { t, locale } = useLocale();
  const { mode, currentMember, snapshot } = useHousehold();
  const isMember = mode !== 'guest-local';
  const owner = isMember ? (currentMember?.id ?? 'loading') : 'guest';
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error' | 'cancelled'
  >('loading');
  const [data, setData] = useState<TrainingOverview | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [refresh, setRefresh] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const changed = () => setRefresh((value) => value + 1);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === GUEST_REPLAY_ARCHIVE_STORAGE_KEY)
        changed();
    };
    window.addEventListener(REPLAY_ARCHIVE_CHANGED_EVENT, changed);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener(REPLAY_ARCHIVE_CHANGED_EVENT, changed);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setData(null);
    setProgress({ done: 0, total: 0 });
    void loadTrainingOverview({
      owner,
      isMember,
      signal: controller.signal,
      onProgress: (value) => {
        if (!controller.signal.aborted) setProgress(value);
      },
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [owner, isMember, refresh, snapshot?.revision]);

  const summary = data?.summary;
  const categories = TRAINING_CATEGORIES.map((key) => ({
    key,
    count: summary?.countsByCategory[key] ?? 0,
    target: data?.replays.find((replay) => replay.reasons.includes(key)),
    comparison: summary?.comparison?.categories[key],
  })).sort((a, b) => b.count - a.count);
  const recommended = categories.find((category) => category.target);
  const rate = (value: number) =>
    value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      maximumFractionDigits: 1,
    });

  return (
    <Card className="riichi-training-summary-card">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {t('riichi.training.weakness.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('riichi.training.center.scope')}
          </p>
        </div>
        {onNavigateToReplays ? (
          <Button variant="ghost" size="sm" onClick={onNavigateToReplays}>
            {t('riichi.archive.title')}
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to={expanded ? '/replays' : '/replays/training'}>
              {t(
                expanded
                  ? 'riichi.archive.title'
                  : 'riichi.training.center.title',
              )}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'loading' && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2" role="status">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {progress.total > 0
                ? formatMessage(
                    locale,
                    'riichi.training.weakness.progress',
                    progress,
                  )
                : t('riichi.review.computing')}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                controllerRef.current?.abort();
                setStatus('cancelled');
              }}
            >
              {t('riichi.training.center.cancel')}
            </Button>
          </div>
        )}
        {(status === 'error' || status === 'cancelled') && (
          <div className="space-y-3 py-2">
            <p
              role={status === 'error' ? 'alert' : 'status'}
              className="text-sm text-muted-foreground"
            >
              {t(`riichi.training.center.${status}`)}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRefresh((value) => value + 1)}
            >
              {t('recovery.retry')}
            </Button>
          </div>
        )}
        {status === 'ready' && summary && data && (
          <>
            {data.skipped > 0 && (
              <p role="status" className="text-xs text-muted-foreground">
                {formatMessage(locale, 'riichi.training.center.skipped', {
                  count: data.skipped,
                })}
              </p>
            )}
            {summary.totalMatchesAnalyzed === 0 ? (
              <div className="space-y-4 rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('riichi.training.weakness.noMatches')}
                </p>
                <Button asChild>
                  <Link to="/game/mahjong-japanese">
                    {t('challenge.startMatch')}
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatMessage(
                      locale,
                      'riichi.training.weakness.analyzed',
                      { count: summary.totalMatchesAnalyzed },
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    {t('riichi.training.center.refresh')}
                  </Button>
                </div>
                {!summary.hasEnoughSamples && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {t('riichi.training.weakness.sampleWarning')}
                  </p>
                )}
                {recommended?.target ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {t('riichi.training.center.recommended')}
                      </p>
                      <h3 className="font-semibold">
                        {t(`riichi.review.kind.${recommended.key}`)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatMessage(
                          locale,
                          'riichi.training.center.reason',
                          { count: recommended.count },
                        )}
                      </p>
                    </div>
                    <Button asChild>
                      <Link
                        to={trainingPracticePath(
                          recommended.target.summary.matchId,
                          recommended.key,
                        )}
                      >
                        {t('riichi.training.center.practice')}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/40 p-4 text-sm">
                    {t('riichi.training.empty')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {categories.map((category) => {
                    const content = (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {t(`riichi.review.kind.${category.key}`)}
                        </span>
                        <strong className="text-2xl tabular-nums">
                          {category.count}
                        </strong>
                        {category.comparison && (
                          <span className="text-xs text-muted-foreground">
                            {t(
                              `riichi.training.center.trend.${category.comparison.trend}`,
                            )}
                          </span>
                        )}
                        <span
                          className={`text-xs ${category.target ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                          {t(
                            category.target
                              ? 'riichi.training.center.practice'
                              : 'riichi.training.center.noQuestions',
                          )}
                        </span>
                      </>
                    );
                    const className =
                      'flex min-w-0 flex-col gap-1 rounded-xl border p-3';
                    return category.target ? (
                      <Link
                        key={category.key}
                        className={`${className} transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary`}
                        aria-label={`${t(`riichi.review.kind.${category.key}`)} · ${t('riichi.training.center.practice')}`}
                        to={trainingPracticePath(
                          category.target.summary.matchId,
                          category.key,
                        )}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={category.key}
                        className={`${className} bg-muted/20`}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
                {summary.comparison ? (
                  <section className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
                    <h3 className="font-medium">
                      {t('riichi.training.center.comparison')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage(
                            locale,
                            'riichi.training.center.older',
                            { count: summary.comparison.olderMatches },
                          )}
                        </p>
                        <p className="mt-1 font-semibold">
                          {formatMessage(
                            locale,
                            'riichi.training.center.rate',
                            { count: rate(summary.comparison.olderPerMatch) },
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage(
                            locale,
                            'riichi.training.center.recent',
                            { count: summary.comparison.recentMatches },
                          )}
                        </p>
                        <p className="mt-1 font-semibold">
                          {formatMessage(
                            locale,
                            'riichi.training.center.rate',
                            { count: rate(summary.comparison.recentPerMatch) },
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(`riichi.training.weakness.trend.${summary.trend}`)}
                    </p>
                  </section>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('riichi.training.center.moreSamples')}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('riichi.training.center.method')}
                </p>
                {expanded &&
                  data.replays.some((item) => item.reasons.length > 0) && (
                    <section className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold">
                        {t('riichi.training.center.recentReplays')}
                      </h3>
                      {data.replays
                        .filter((item) => item.reasons.length > 0)
                        .slice(0, 5)
                        .map(({ summary: item, reasons }) => (
                          <Link
                            key={item.matchId}
                            to={trainingPracticePath(item.matchId)}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <div className="min-w-0 space-y-1">
                              <p>
                                {t(`riichi.archive.source.${item.source}`)} ·{' '}
                                {new Date(item.createdAt).toLocaleDateString(
                                  locale === 'zh' ? 'zh-CN' : 'en-US',
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatMessage(
                                  locale,
                                  'riichi.training.center.questions',
                                  { count: reasons.length },
                                )}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </Link>
                        ))}
                    </section>
                  )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
