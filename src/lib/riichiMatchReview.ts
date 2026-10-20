import { getBaseTile } from '@/lib/mahjongRiichi';
import { analyzeRiichiHand, preloadRiichiRules } from '@/lib/riichiRules';
import {
  applyEvent,
  createMatch,
  type RiichiMatchState,
  type RiichiReplayFile,
} from '@/pages/mahjong/japanese/engine';
import {
  dangerFor,
  decideAiTurn,
  visibleCountsFor,
} from '@/pages/mahjong/japanese/engine/ai';
import {
  getDiscardAdvice,
  type ReviewReason,
} from '@/pages/mahjong/japanese/trainingAdvice';
import type { RiichiMeld } from '@/pages/mahjong/japanese/types';

export interface ReviewOpponent {
  seat: number;
  riichi: boolean;
  calls: number;
  turn: number;
}

export interface ReviewDecision {
  /** Snapshot immediately BEFORE the event: the player's complete decision hand. */
  frameIndex: number;
  roundId: number;
  wind: number;
  roundNumber: number;
  honba: number;
  turn: number;
  hand: number[];
  melds: RiichiMeld[];
  played: number;
  recommended: number;
  playerRiichi: boolean;
  aiRiichi: boolean;
  reason: ReviewReason;
  impact: number;
  shantenDifference: number;
  ukeireDifference: number;
  loss: number;
  safer: boolean;
  opponents: ReviewOpponent[];
}

export interface MatchReview {
  viewerSeat: number;
  frames: RiichiMatchState[];
  decisions: ReviewDecision[];
  stats: {
    rounds: number;
    wins: number;
    dealIns: number;
    riichi: number;
    calls: number;
    averageWin: number;
  };
}

type DecisionCandidate = ReviewDecision & {
  comparable: boolean;
  tenpai: boolean;
};

function decisionAt(
  match: RiichiMatchState,
  frameIndex: number,
  tile: number,
  riichi: boolean,
  viewerSeat = 0,
): DecisionCandidate {
  const state = match.round;
  const ai = decideAiTurn(state, viewerSeat, 'expert', undefined, match.rules);
  const recommended =
    ai?.type === 'discard' || ai?.type === 'riichi' ? ai.tile : tile;
  const analysis = analyzeRiichiHand({
    hand: state.hands[viewerSeat],
    melds: state.melds[viewerSeat],
  });
  const actual = getDiscardAdvice(state, tile, analysis, viewerSeat);
  const preferred = getDiscardAdvice(state, recommended, analysis, viewerSeat);
  const shantenDifference = (actual?.shanten ?? 0) - (preferred?.shanten ?? 0);
  const ukeireDifference = (preferred?.ukeire ?? 0) - (actual?.ukeire ?? 0);
  return {
    frameIndex,
    roundId: state.roundId,
    wind: state.roundWind,
    roundNumber: state.roundNumber,
    honba: state.honba,
    turn: state.discardPiles[viewerSeat].length + 1,
    hand: [...state.hands[viewerSeat]],
    melds: state.melds[viewerSeat],
    played: tile,
    recommended,
    playerRiichi: riichi,
    aiRiichi: ai?.type === 'riichi',
    reason: shantenDifference > 0 ? 'shanten' : 'ukeire',
    impact:
      shantenDifference > 0
        ? 10000 + shantenDifference * 1000
        : Math.max(0, ukeireDifference) * 100,
    shantenDifference,
    ukeireDifference,
    loss: 0,
    safer: false,
    opponents: [],
    comparable: ai?.type === 'discard' || ai?.type === 'riichi',
    tenpai: actual?.shanten === 0,
  };
}

/** One short task per slice; cancellation also prevents stale progress after closing. */
function nextSlice() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function buildMatchReview(
  file: RiichiReplayFile,
  options: {
    viewerSeat?: number;
    practiceRound?: boolean;
    decisionStartIndex?: number;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<MatchReview> {
  const viewerSeat = options.viewerSeat ?? 0;
  options.onProgress?.(0);
  await preloadRiichiRules();
  if (options.signal?.aborted)
    throw new DOMException('Review cancelled', 'AbortError');
  let match = createMatch(file).match;
  const frames = [match];
  const candidates = new Map<number, ReviewDecision>();
  let lastDiscard: DecisionCandidate | null = null;
  let declarationChoices: DecisionCandidate[] = [];
  const stats = {
    rounds: 0,
    wins: 0,
    dealIns: 0,
    riichi: 0,
    calls: 0,
    averageWin: 0,
  };
  let totalWin = 0;
  let sliceStart = performance.now();
  await nextSlice();
  for (let index = 0; index < file.events.length; index++) {
    if (options.signal?.aborted)
      throw new DOMException('Review cancelled', 'AbortError');
    const event = file.events[index];
    if (
      (event.type === 'discard' || event.type === 'riichi') &&
      event.seat === viewerSeat
    ) {
      const decision = decisionAt(
        match,
        index,
        event.tile,
        event.type === 'riichi',
        viewerSeat,
      );
      lastDiscard = decision;
      if (
        decision.comparable &&
        getBaseTile(decision.played) !== getBaseTile(decision.recommended) &&
        (decision.shantenDifference > 0 || decision.ukeireDifference >= 4)
      )
        candidates.set(index, decision);
      if (
        decision.comparable &&
        !match.round.riichiDeclared[viewerSeat] &&
        decision.tenpai &&
        decision.playerRiichi !== decision.aiRiichi
      )
        declarationChoices.push(decision);
    }
    // A robbed added kan also has a concrete tile and must appear among deal-ins.
    if (event.type === 'kakan' && event.seat === viewerSeat) {
      lastDiscard = decisionAt(match, index, event.tile, false, viewerSeat);
    }
    if (event.type === 'ankan' && event.seat === viewerSeat) {
      lastDiscard = decisionAt(match, index, event.tiles[0], false, viewerSeat);
    }
    const step = applyEvent(match, event);
    if (!step) throw new Error(`Invalid replay event at step ${index + 1}`);
    const next = step.match;
    frames.push(next);
    const result = next.round.result;
    if (match.round.phase !== 'end' && next.round.phase === 'end' && result) {
      stats.rounds++;
      if (next.round.riichiDeclared[viewerSeat]) stats.riichi++;
      if (next.round.melds[viewerSeat].some((meld) => meld.type !== 'angang'))
        stats.calls++;
      const ownWin =
        result.type === 'win'
          ? result.wins.find((win) => win.winner === viewerSeat)
          : undefined;
      if (ownWin) {
        stats.wins++;
        totalWin += ownWin.ten;
      }
      const ronWinners =
        result.type === 'win'
          ? result.wins.filter((win) => win.ronFrom === viewerSeat)
          : [];
      if (ronWinners.length > 0) {
        stats.dealIns++;
        if (lastDiscard) {
          const state = frames[lastDiscard.frameIndex].round;
          const visible = visibleCountsFor(state, viewerSeat);
          const legal = [
            ...(state.turnOptions?.discardable ?? state.hands[viewerSeat]),
          ];
          const safest =
            legal.sort(
              (a, b) =>
                dangerFor(state, viewerSeat, a, visible, 'expert') -
                  dangerFor(state, viewerSeat, b, visible, 'expert') || a - b,
            )[0] ?? lastDiscard.recommended;
          const loss = Math.max(0, -result.settlement.deltas[viewerSeat]);
          const safer =
            dangerFor(state, viewerSeat, safest, visible, 'expert') <
            dangerFor(state, viewerSeat, lastDiscard.played, visible, 'expert');
          candidates.set(lastDiscard.frameIndex, {
            ...lastDiscard,
            recommended: safer ? safest : lastDiscard.recommended,
            aiRiichi: safer ? false : lastDiscard.aiRiichi,
            reason: 'dealIn',
            loss,
            safer,
            impact: 1000000 + loss,
            opponents: ronWinners.map((win) => ({
              seat: win.winner,
              riichi: state.riichiDeclared[win.winner],
              calls: state.melds[win.winner].filter(
                (meld) => meld.type !== 'angang',
              ).length,
              turn: state.discardPiles[win.winner].length + 1,
            })),
          });
        }
      }
      // These are observations of the actual outcome, never a claim about an alternate win.
      for (const choice of declarationChoices) {
        const lostStick =
          choice.playerRiichi &&
          !ownWin &&
          next.round.riichiDeclared[viewerSeat];
        const valueDifference = ownWin && ownWin.ten >= 3900;
        const exposedLoss =
          choice.playerRiichi && result.settlement.deltas[viewerSeat] <= -4000;
        if (
          !(lostStick || valueDifference || exposedLoss) ||
          candidates.get(choice.frameIndex)?.reason === 'dealIn'
        )
          continue;
        candidates.set(choice.frameIndex, {
          ...choice,
          reason: choice.aiRiichi ? 'riichi' : 'dama',
          impact:
            5000 + (exposedLoss ? -result.settlement.deltas[viewerSeat] : 0),
          loss: lostStick ? 1000 : 0,
        });
      }
      lastDiscard = null;
      declarationChoices = [];
    }
    match = next;
    if (performance.now() - sliceStart >= 8 || index % 64 === 63) {
      options.onProgress?.((index + 1) / Math.max(1, file.events.length));
      await nextSlice();
      sliceStart = performance.now();
    }
  }
  if (options.signal?.aborted)
    throw new DOMException('Review cancelled', 'AbortError');
  if (
    match.status !== 'matchEnd' &&
    !(options.practiceRound && match.status === 'roundEnd')
  )
    throw new Error('Match is not complete');
  stats.averageWin = stats.wins ? Math.round(totalWin / stats.wins) : 0;
  options.onProgress?.(1);
  return {
    viewerSeat,
    frames,
    stats,
    decisions: [...candidates.values()]
      .filter(
        (decision) => decision.frameIndex >= (options.decisionStartIndex ?? 0),
      )
      .sort((a, b) => b.impact - a.impact || a.frameIndex - b.frameIndex)
      .slice(0, 8),
  };
}
