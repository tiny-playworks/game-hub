import type { ReplayArchiveSummary, TrainingProblem } from '../../shared/contracts/replay';
import type { MatchReview } from './riichiMatchReview';
import { copyPracticeMatch } from './riichiPractice';
import {
  applyEvent,
  RIICHI_MATCH_VERSION,
  type RiichiEvent,
  type RiichiMatchState,
  type RiichiReplayFile,
} from '@/pages/mahjong/japanese/engine/match';

export type ReplayBranchChoice = { tile: number; riichi: boolean };

export interface ReplayBranchNode {
  sourceMatchId: string;
  sourceFrameIndex: number;
  viewerSeat: number;
  before: RiichiMatchState;
  originalEnd: RiichiMatchState;
  originalChoice: ReplayBranchChoice;
  problem: TrainingProblem;
}

export interface ReplayBranchRun {
  node: ReplayBranchNode;
  choice: ReplayBranchChoice;
  initialMatch: RiichiMatchState;
  /** Session-only provenance; never archived as a formal match. */
  provenance: {
    version: 1;
    sourceMatchId: string;
    frameIndex: number;
    viewerSeat: number;
    choice: ReplayBranchChoice;
  };
}

export type ReplayBranchAvailability =
  | { available: true; node: ReplayBranchNode }
  | { available: false; reasonKey: string };

/** Review frame k is the state BEFORE source event k. Only own discard turns qualify. */
export function getReplayBranchAvailability(
  file: RiichiReplayFile,
  review: MatchReview,
  summary: Pick<ReplayArchiveSummary, 'source' | 'matchId' | 'viewerSeat'>,
  problem: TrainingProblem,
  practiceRound = false,
): ReplayBranchAvailability {
  const unavailable = (reason: string): ReplayBranchAvailability => ({
    available: false,
    reasonKey: `riichi.branch.unavailable.${reason}`,
  });
  if (summary.source === 'family') return unavailable('family');
  if (summary.source !== 'free' && summary.source !== 'ai-ranked')
    return unavailable('source');
  const seat = summary.viewerSeat;
  const index = problem.frameIndex;
  if (
    file.version !== RIICHI_MATCH_VERSION ||
    !Number.isInteger(seat) || seat < 0 || seat > 3 ||
    seat !== review.viewerSeat || seat !== problem.viewerSeat ||
    !Number.isInteger(index) || index < 0 || index >= file.events.length ||
    review.frames.length !== file.events.length + 1 ||
    (review.frames[review.frames.length - 1]?.status !== 'matchEnd' &&
      !(practiceRound && review.frames[review.frames.length - 1]?.status === 'roundEnd'))
  ) return unavailable('incomplete');

  const event = file.events[index];
  // P15 deal-in questions can originate from kakan/ankan; these are not discard branches.
  if (
    (event.type !== 'discard' && event.type !== 'riichi') ||
    event.seat !== seat
  ) return unavailable('action');

  const before = review.frames[index];
  if (
    !before || before.seed !== file.seed || before.events.length !== index ||
    before.status !== 'playing' || before.round.phase !== 'discard' ||
    before.round.currentPlayer !== seat || before.round.turnOptions?.seat !== seat ||
    event.tile !== problem.playedTile ||
    (event.type === 'riichi') !== problem.playerRiichi
  ) return unavailable('incomplete');

  let originalEnd: RiichiMatchState | undefined;
  for (let next = index + 1; next < review.frames.length; next++) {
    const frame = review.frames[next];
    if (frame.round.roundId !== before.round.roundId) break;
    if (frame.round.phase === 'end' && frame.round.result) {
      originalEnd = frame;
      break;
    }
  }
  if (!originalEnd) return unavailable('incomplete');

  return {
    available: true,
    node: {
      sourceMatchId: summary.matchId,
      sourceFrameIndex: index,
      viewerSeat: seat,
      before,
      originalEnd,
      originalChoice: { tile: event.tile, riichi: event.type === 'riichi' },
      problem,
    },
  };
}

export function isReplayBranchChoiceLegal(
  node: ReplayBranchNode,
  choice: ReplayBranchChoice,
): boolean {
  const options = node.before.round.turnOptions;
  if (!options || options.seat !== node.viewerSeat) return false;
  return (choice.riichi ? options.riichiDiscards : options.discardable).includes(choice.tile);
}

/** Applies a legal alternative to a deep, unranked practice copy and ignores every effect. */
export function createReplayBranch(
  node: ReplayBranchNode,
  choice: ReplayBranchChoice,
): ReplayBranchRun | null {
  if (!isReplayBranchChoiceLegal(node, choice)) return null;
  const practice = copyPracticeMatch(node.before);
  const event: RiichiEvent = {
    type: choice.riichi ? 'riichi' : 'discard',
    seat: node.viewerSeat,
    tile: choice.tile,
  };
  const step = applyEvent(practice, event);
  if (!step) return null;
  return {
    node,
    choice: { ...choice },
    initialMatch: step.match,
    provenance: {
      version: 1,
      sourceMatchId: node.sourceMatchId,
      frameIndex: node.sourceFrameIndex,
      viewerSeat: node.viewerSeat,
      choice: { ...choice },
    },
  };
}

/** Decision-to-settlement delta includes any riichi deposit paid after branching. */
export function replayBranchScoreDelta(
  node: ReplayBranchNode,
  end: RiichiMatchState,
): number | null {
  if (end.round.roundId !== node.before.round.roundId || !end.round.result)
    return null;
  return end.round.result.settlement.newScores[node.viewerSeat] -
    node.before.round.scores[node.viewerSeat];
}

export function replayBranchOutcomeKey(end: RiichiMatchState, viewerSeat: number): string {
  const result = end.round.result;
  if (!result) return 'riichi.branch.outcome.unavailable';
  if (result.type === 'draw') return 'riichi.branch.outcome.draw';
  if (result.wins.some((win) => win.winner === viewerSeat)) return 'riichi.branch.outcome.win';
  if (result.wins.some((win) => win.ronFrom === viewerSeat)) return 'riichi.branch.outcome.dealIn';
  return 'riichi.branch.outcome.otherWin';
}
