import { performance } from 'node:perf_hooks';
import {
  applyEvent,
  createMatch,
  decideAiClaim,
  decideAiTurn,
  getPendingSeats,
  type RiichiAiLevel,
  type RiichiEvent,
  type RiichiMatchState,
} from '../src/pages/mahjong/japanese/engine';

export interface AiComparisonMetrics {
  level: RiichiAiLevel;
  matchesPlayed: number;
  avgPlacement: number;
  avgFinalScore: number;
  wins: number;
  winRate: number;
  dealIns: number;
  dealInRate: number;
  avgDecisionMs: number;
  totalDecisions: number;
}

export interface SimulationResult {
  matchEnd: NonNullable<RiichiMatchState['matchEnd']>;
  decisionCount: number;
  decisionTotalMs: number;
  dealInsBySeat: number[];
  winsBySeat: number[];
  events: RiichiEvent[];
}

export function simulateDetailedMatch(
  seed: number,
  levels: [RiichiAiLevel, RiichiAiLevel, RiichiAiLevel, RiichiAiLevel],
  matchLength: 'east' | 'south' = 'east',
): SimulationResult {
  let match = createMatch({
    seed,
    matchLength,
  }).match;

  let decisionCount = 0;
  let decisionTotalMs = 0;
  const dealInsBySeat = [0, 0, 0, 0];
  const winsBySeat = [0, 0, 0, 0];
  const events: RiichiEvent[] = [];

  const maxSteps = 10000;
  for (let i = 0; i < maxSteps; i++) {
    if (match.status === 'matchEnd') break;
    if (match.status === 'roundEnd') {
      const nextEvt: RiichiEvent = { type: 'nextRound' };
      events.push(nextEvt);
      const step = applyEvent(match, nextEvt);
      if (!step) break;
      match = step.match;
      continue;
    }

    const round = match.round;
    const seat = getPendingSeats(round)[0];
    if (seat === undefined) break;

    const t0 = performance.now();
    let event: RiichiEvent | null = null;
    if (round.phase === 'discard') {
      event = decideAiTurn(round, seat, levels[seat]);
    } else {
      event = {
        type: 'claim',
        seat,
        response: decideAiClaim(round, seat, levels[seat]),
      };
    }
    const dt = performance.now() - t0;
    if (seat === 0) {
      decisionCount++;
      decisionTotalMs += dt;
    }

    if (!event) break;
    events.push(event);

    // 统计放铳与和牌
    if (event.type === 'claim' && event.response.type === 'ron') {
      const from = round.claim?.from ?? round.lastDiscardFrom;
      if (from !== null && from !== undefined) {
        dealInsBySeat[from]++;
      }
      winsBySeat[seat]++;
    } else if (event.type === 'tsumo') {
      winsBySeat[seat]++;
    }

    const step = applyEvent(match, event);
    if (!step) break;
    match = step.match;
  }

  const matchEnd = match.matchEnd ?? {
    reason: 'east4_end',
    ranking: [0, 1, 2, 3],
    finalScores: match.round.scores,
  };

  return {
    matchEnd,
    decisionCount,
    decisionTotalMs,
    dealInsBySeat,
    winsBySeat,
    events,
  };
}

export function runAiComparison(
  seeds: number[] = [1001, 1002, 1003, 1004, 1005],
  testLevels: RiichiAiLevel[] = ['beginner', 'standard', 'strong', 'expert'],
): Record<RiichiAiLevel, AiComparisonMetrics> {
  const results = {} as Record<RiichiAiLevel, AiComparisonMetrics>;

  for (const lvl of testLevels) {
    let totalPlacement = 0;
    let totalScore = 0;
    let totalWins = 0;
    let totalDealIns = 0;
    let totalDecisions = 0;
    let totalDecisionMs = 0;

    for (const seed of seeds) {
      // 席位 0 使用被测档位，席位 1..3 使用基线 standard 档位
      const sim = simulateDetailedMatch(seed, [lvl, 'standard', 'standard', 'standard']);
      const rank = sim.matchEnd.ranking.indexOf(0) + 1;
      const score = sim.matchEnd.finalScores[0];

      totalPlacement += rank;
      totalScore += score;
      totalWins += sim.winsBySeat[0];
      totalDealIns += sim.dealInsBySeat[0];
      totalDecisions += sim.decisionCount;
      totalDecisionMs += sim.decisionTotalMs;
    }

    const count = seeds.length;
    results[lvl] = {
      level: lvl,
      matchesPlayed: count,
      avgPlacement: Number((totalPlacement / count).toFixed(2)),
      avgFinalScore: Math.round(totalScore / count),
      wins: totalWins,
      winRate: Number((totalWins / Math.max(1, totalDecisions / 10)).toFixed(3)),
      dealIns: totalDealIns,
      dealInRate: Number((totalDealIns / Math.max(1, totalDecisions / 10)).toFixed(3)),
      avgDecisionMs: Number((totalDecisionMs / Math.max(1, totalDecisions)).toFixed(3)),
      totalDecisions,
    };
  }

  return results;
}
