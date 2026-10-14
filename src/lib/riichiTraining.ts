import type {
  TrainingCategory,
  TrainingProblem,
  TrainingWeaknessSummary,
} from '../../shared/contracts/replay';
import type { MatchReview } from './riichiMatchReview';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine/match';

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
): TrainingWeaknessSummary {
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

  // 列表按时间倒序：最近半段与更早半段比较。
  let trend: 'improving' | 'stable' | 'needsAttention' = 'stable';
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

    if (recentCount < olderCount) {
      trend = 'improving';
    } else if (recentCount > olderCount * 1.25) {
      trend = 'needsAttention';
    }
  }

  return {
    totalMatchesAnalyzed: total,
    hasEnoughSamples,
    countsByCategory: counts,
    trend,
  };
}
