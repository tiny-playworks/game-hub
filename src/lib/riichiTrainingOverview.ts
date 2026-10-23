import type {
  ReplayArchiveSummary,
  TrainingCategory,
} from '../../shared/contracts/replay';
import { buildMatchReview } from './riichiMatchReview';
import { fetchReplayDetail, fetchReplayList } from './riichiReplayArchive';
import {
  computeWeaknessSummary,
  isTrainingCategory,
  type TrainingOverviewSummary,
} from './riichiTraining';

const CACHE_PREFIX = 'game-hub-training-overview-v2:';
interface AnalyzedReplay {
  summary: ReplayArchiveSummary;
  reasons: TrainingCategory[];
}
export interface TrainingOverview {
  summary: TrainingOverviewSummary;
  replays: AnalyzedReplay[];
  skipped: number;
}

function cacheKey(owner: string, item: ReplayArchiveSummary): string {
  return `${CACHE_PREFIX}${owner}:${item.matchId}:${item.createdAt}:${item.viewerSeat}`;
}

function readCachedReasons(key: string): TrainingCategory[] | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return Array.isArray(value) &&
      value.length <= 8 &&
      value.every(isTrainingCategory)
      ? value
      : null;
  } catch {
    return null;
  }
}

function saveCachedReasons(key: string, reasons: TrainingCategory[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(reasons));
  } catch {
    // Caching is optional; blocked storage must not prevent training.
  }
}

/** Cache only reason labels, never replay frames or hidden hands. */
export async function loadTrainingOverview(options: {
  owner: string;
  isMember: boolean;
  signal: AbortSignal;
  onProgress: (progress: { done: number; total: number }) => void;
}): Promise<TrainingOverview> {
  const { owner, isMember, signal, onProgress } = options;
  const list = await fetchReplayList({ limit: 20 }, isMember, signal);
  signal.throwIfAborted();
  const items = [...list.items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
  const replays: AnalyzedReplay[] = [];
  let skipped = 0;
  onProgress({ done: 0, total: items.length });
  for (const [index, item] of items.entries()) {
    signal.throwIfAborted();
    const key = cacheKey(owner, item);
    let reasons = readCachedReasons(key);
    if (!reasons) {
      // Network/auth failures need an explicit retry, not a misleading empty summary.
      const detail = await fetchReplayDetail(item.matchId, isMember, signal);
      signal.throwIfAborted();
      if (detail) {
        try {
          const review = await buildMatchReview(detail.file, {
            viewerSeat: detail.summary.viewerSeat,
            signal,
          });
          reasons = review.decisions.map((decision) => decision.reason);
          saveCachedReasons(key, reasons);
        } catch {
          signal.throwIfAborted();
          // An old or incomplete replay must not hide other valid matches.
        }
      }
    }
    if (reasons) replays.push({ summary: item, reasons });
    else skipped++;
    onProgress({ done: index + 1, total: items.length });
  }
  return {
    summary: computeWeaknessSummary(
      replays.map((item) => ({
        decisions: item.reasons.map((reason) => ({ reason })),
      })),
    ),
    replays,
    skipped,
  };
}
