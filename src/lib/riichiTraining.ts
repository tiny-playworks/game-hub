import type {
  TrainingCategory,
  TrainingProblem,
  TrainingWeaknessSummary,
} from '../../shared/contracts/replay';
import type { MatchReview } from './riichiMatchReview';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine/match';

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  'shanten',
  'ukeire',
  'dealIn',
  'riichi',
  'dama',
];

export function isTrainingCategory(value: unknown): value is TrainingCategory {
  return TRAINING_CATEGORIES.includes(value as TrainingCategory);
}

export function trainingPracticePath(
  matchId: string,
  category?: TrainingCategory,
): string {
  const params = new URLSearchParams({ matchId });
  if (category) params.set('category', category);
  return `/replays/training?${params}`;
}

type TrainingTrend = TrainingWeaknessSummary['trend'];
export interface TrainingComparison {
  recentMatches: number;
  olderMatches: number;
  recentPerMatch: number;
  olderPerMatch: number;
  categories: Record<
    TrainingCategory,
    {
      recentPerMatch: number;
      olderPerMatch: number;
      trend: TrainingTrend;
    }
  >;
}

export interface TrainingOverviewSummary extends TrainingWeaknessSummary {
  comparison: TrainingComparison | null;
}

function compareRates(recent: number, older: number): TrainingTrend {
  if (recent < older * 0.8) return 'improving';
  if (recent > older * 1.25) return 'needsAttention';
  return 'stable';
}

export function extractTrainingProblems(
  review: MatchReview,
  file: RiichiReplayFile,
): TrainingProblem[] {
  const matchId = file.ranked?.id ?? `match:${file.seed}`;
  const problems: TrainingProblem[] = [];

  for (const decision of review.decisions) {
    const category: TrainingCategory = decision.reason;
    const id = `${matchId}:${decision.frameIndex}:${category}`;

    problems.push({
      id,
      matchId,
      frameIndex: decision.frameIndex,
      category,
      viewerSeat: review.viewerSeat,
      wind: decision.wind,
      roundNumber: decision.roundNumber,
      honba: decision.honba,
      turn: decision.turn,
      hand: [...decision.hand],
      melds: [...decision.melds],
      playedTile: decision.played,
      recommendedTile: decision.recommended,
      playerRiichi: decision.playerRiichi,
      recommendedRiichi: decision.aiRiichi,
      reasonTextKey: `riichi.review.reason.${category}`,
      explanation: {
        shantenDiff: decision.shantenDifference,
        ukeireDiff: decision.ukeireDifference,
        dangerLoss: decision.loss,
        safer: decision.safer,
      },
    });
  }

  return problems;
}

export function evaluateTrainingChoice(
  problem: TrainingProblem,
  selectedTile: number,
  declareRiichi: boolean,
): {
  isRecommended: boolean;
  explanationKey: string;
  adviceNotes: {
    shantenDiff: number;
    ukeireDiff: number;
    dangerLoss: number;
  };
} {
  const isDiscardMatch = selectedTile === problem.recommendedTile;
  const isRiichiMatch = declareRiichi === problem.recommendedRiichi;
  const isRecommended = isDiscardMatch && isRiichiMatch;

  let explanationKey = `riichi.training.eval.${problem.category}`;
  if (problem.category === 'dealIn' && !problem.explanation.safer) {
    explanationKey = 'riichi.training.eval.dealInUncertain';
  }
  if (isRecommended) {
    explanationKey = 'riichi.training.eval.correct';
  }

  return {
    isRecommended,
    explanationKey,
    adviceNotes: {
      shantenDiff: problem.explanation.shantenDiff,
      ukeireDiff: problem.explanation.ukeireDiff,
      dangerLoss: problem.explanation.dangerLoss,
    },
  };
}

export function computeWeaknessSummary(
  recentReviews: Array<{ decisions: Array<{ reason: TrainingCategory }> }>,
): TrainingOverviewSummary {
  const total = recentReviews.length;
  const counts: Record<TrainingCategory, number> = {
    shanten: 0,
    ukeire: 0,
    dealIn: 0,
    riichi: 0,
    dama: 0,
  };

  for (const r of recentReviews) {
    for (const d of r.decisions) {
      if (counts[d.reason] !== undefined) {
        counts[d.reason]++;
      }
    }
  }

  const hasEnoughSamples = total >= 5;

  // 列表按时间倒序；按每场均值比较，避免奇数样本两段场数不等造成假趋势。
  let trend: TrainingTrend = 'stable';
  let comparison: TrainingComparison | null = null;
  if (total >= 6) {
    const half = Math.floor(total / 2);
    const recentHalf = recentReviews.slice(0, half);
    const olderHalf = recentReviews.slice(half);

    const recentCount = recentHalf.reduce(
      (acc, cur) => acc + cur.decisions.length,
      0,
    );
    const olderCount = olderHalf.reduce(
      (acc, cur) => acc + cur.decisions.length,
      0,
    );

    const recentPerMatch = recentCount / recentHalf.length;
    const olderPerMatch = olderCount / olderHalf.length;
    trend = compareRates(recentPerMatch, olderPerMatch);
    const categories = Object.fromEntries(
      TRAINING_CATEGORIES.map((category) => {
        const rate = (reviews: typeof recentReviews) =>
          reviews.reduce(
            (sum, review) =>
              sum +
              review.decisions.filter((d) => d.reason === category).length,
            0,
          ) / reviews.length;
        const recent = rate(recentHalf);
        const older = rate(olderHalf);
        return [
          category,
          {
            recentPerMatch: recent,
            olderPerMatch: older,
            trend: compareRates(recent, older),
          },
        ];
      }),
    ) as TrainingComparison['categories'];
    comparison = {
      recentMatches: recentHalf.length,
      olderMatches: olderHalf.length,
      recentPerMatch,
      olderPerMatch,
      categories,
    };
  }

  return {
    totalMatchesAnalyzed: total,
    hasEnoughSamples,
    countsByCategory: counts,
    trend,
    comparison,
  };
}
