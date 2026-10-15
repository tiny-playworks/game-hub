import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, BookOpen, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { formatMessage } from '@/lib/i18n';
import type { ReplayArchiveSummary, TrainingCategory, TrainingWeaknessSummary } from '../../../shared/contracts/replay';
import { fetchReplayDetail, fetchReplayList } from '@/lib/riichiReplayArchive';
import { buildMatchReview } from '@/lib/riichiMatchReview';
import { computeWeaknessSummary } from '@/lib/riichiTraining';

const CACHE_PREFIX = 'game-hub-weakness-v1';
const CATEGORIES = new Set<TrainingCategory>(['shanten', 'ukeire', 'dealIn', 'riichi', 'dama']);

function cacheKey(owner: string, item: ReplayArchiveSummary): string {
  return `${CACHE_PREFIX}:${owner}:${item.matchId}:${item.createdAt}:${item.viewerSeat}`;
}

function readCachedReasons(key: string): TrainingCategory[] | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return Array.isArray(value) && value.every((reason) => CATEGORIES.has(reason))
      ? value as TrainingCategory[]
      : null;
  } catch {
    return null;
  }
}

function saveCachedReasons(key: string, reasons: TrainingCategory[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(reasons));
  } catch {
    // Private browsing or quota limits should not block the analysis.
  }
}

export function TrainingSummary({
  onNavigateToReplays,
}: {
  onNavigateToReplays?: () => void;
}) {
  const { t, locale } = useLocale();
  const { mode, currentMember } = useHousehold();
  const isMember = mode !== 'guest-local';
  const owner = isMember ? currentMember?.id ?? 'loading' : 'guest';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TrainingWeaknessSummary | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setSummary(null);
        setProgress({ done: 0, total: 0 });
        const list = await fetchReplayList({ limit: 20 }, isMember);
        if (cancelled) return;

        const items = list.items.slice(0, 20);
        setProgress({ done: 0, total: items.length });
        const reviews: Array<{ decisions: Array<{ reason: TrainingCategory }> }> = [];
        for (const item of items) {
          if (cancelled) break;
          const key = cacheKey(owner, item);
          let reasons = readCachedReasons(key);
          if (!reasons) {
            const detail = await fetchReplayDetail(item.matchId, isMember);
            if (detail) {
              try {
                const review = await buildMatchReview(detail.file, {
                  viewerSeat: detail.summary.viewerSeat,
                  signal: controller.signal,
                });
                reasons = review.decisions.map((decision) => decision.reason);
                saveCachedReasons(key, reasons);
              } catch {
                if (controller.signal.aborted) return;
                // An incomplete replay should not hide valid older matches.
              }
            }
          }
          if (reasons) reviews.push({ decisions: reasons.map((reason) => ({ reason })) });
          if (!cancelled) setProgress({ done: reviews.length, total: items.length });
        }

        if (!cancelled) {
          setSummary(computeWeaknessSummary(reviews));
        }
      } catch {
        // ignore load error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isMember, owner]);

  if (loading) {
    return (
      <Card className="riichi-training-summary-card">
        <CardContent className="pt-6 text-sm text-muted-foreground flex items-center justify-center py-8">
          <BookOpen className="mr-2 h-4 w-4 animate-spin" />
          {progress.total > 0
            ? formatMessage(locale, 'riichi.training.weakness.progress', progress)
            : t('riichi.review.computing')}
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const categories = [
    { key: 'shanten', label: t('riichi.review.kind.shanten'), count: summary.countsByCategory.shanten },
    { key: 'ukeire', label: t('riichi.review.kind.ukeire'), count: summary.countsByCategory.ukeire },
    { key: 'dealIn', label: t('riichi.review.kind.dealIn'), count: summary.countsByCategory.dealIn },
    { key: 'riichi', label: t('riichi.review.kind.riichi'), count: summary.countsByCategory.riichi },
    { key: 'dama', label: t('riichi.review.kind.dama'), count: summary.countsByCategory.dama },
  ];

  return (
    <Card className="riichi-training-summary-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {t('riichi.training.weakness.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('riichi.archive.eyebrow')} · {formatMessage(locale, 'riichi.training.weakness.analyzed', { count: summary.totalMatchesAnalyzed })}
          </p>
        </div>
        {onNavigateToReplays ? (
          <Button variant="ghost" size="sm" onClick={onNavigateToReplays} className="text-xs">
            {t('riichi.archive.title')}
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link to="/replays">
              {t('riichi.archive.title')}
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.totalMatchesAnalyzed === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {t('riichi.training.weakness.noMatches')}
          </div>
        ) : (
          <>
        {!summary.hasEnoughSamples && (
          <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t('riichi.training.weakness.sampleWarning')}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="rounded-lg border bg-card p-2.5 text-center flex flex-col justify-between"
            >
              <span className="text-xs text-muted-foreground truncate">{cat.label}</span>
              <span className="text-lg font-bold mt-1">{cat.count}</span>
            </div>
          ))}
        </div>

        {summary.hasEnoughSamples && (
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              {t(`riichi.training.weakness.trend.${summary.trend}`)}
            </span>
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {summary.trend === 'improving' ? '提升中' : summary.trend === 'stable' ? '平稳' : '需重点复盘'}
            </span>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
