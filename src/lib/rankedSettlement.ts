import { emitGameEvent } from './gameEvents';
import {
  recordCharacterMatchFinish,
  syncPlayerCharacterUnlocks,
} from './playerCharacters';
import {
  applyPtDelta,
  computePtDelta,
  getRankedState,
  type Placement,
  type RankedHistoryEntry,
  type RankedTicket,
  saveRankedState,
} from './ranked';
import { rankSeatsByScore } from './riichiGameEnd';
import { getRiichiMatchCoins } from './wallet';

/** 先持久化积分收据，再派发奖励；相同 matchId 重试不再改变积分或钱包。 */
export function settleRankedMatch(
  ticket: RankedTicket,
  scores: number[],
  forfeit = false,
): RankedHistoryEntry | null {
  const state = getRankedState();
  const previous = state.history.find((entry) => entry.id === ticket.id);
  if (previous) {
    award(previous);
    return previous;
  }
  if (state.activeMatchId !== ticket.id) return null;
  const ranking = rankSeatsByScore(scores);
  const placement = (forfeit ? 4 : ranking.indexOf(0) + 1) as Placement;
  // 弃赛按四位、至多原点结算，避免领先时反复退桌刷初心 pt。
  const finalScore = forfeit ? Math.min(25000, scores[0]) : scores[0];
  const ptDelta = computePtDelta({
    band: state.band,
    placement,
    finalScore,
    matchLength: ticket.matchLength,
  });
  const applied = applyPtDelta(state, ptDelta);
  const entry: RankedHistoryEntry = {
    id: ticket.id,
    at: Date.now(),
    matchLength: ticket.matchLength,
    placement,
    finalScore,
    ptDelta,
    opponents: ticket.opponents,
    before: { band: state.band, level: state.level, pt: state.pt },
    after: {
      band: applied.state.band,
      level: applied.state.level,
      pt: applied.state.pt,
    },
    change: applied.change,
    finalScores: [...scores],
    ranking: forfeit ? [...ranking.filter((seat) => seat !== 0), 0] : ranking,
    characterId: ticket.characterId,
    coins: forfeit
      ? 0
      : Math.round(getRiichiMatchCoins(placement, ticket.matchLength) * 1.2),
    affinityDelta: forfeit ? 0 : 2,
    affinityRule: 'match-v1',
    unlocked: [],
    forfeit,
  };
  saveRankedState({
    ...applied.state,
    activeMatchId: null,
    activeTicket: null,
    history: [...state.history, entry].slice(-50),
  });
  const unlocks = syncPlayerCharacterUnlocks(applied.state.peak.band);
  entry.unlocked = unlocks.newlyUnlockedCharacters.map(
    (character) => character.id,
  );
  saveRankedState({
    ...getRankedState(),
    history: [...state.history, entry].slice(-50),
  });
  award(entry);
  return entry;
}
function award(entry: RankedHistoryEntry): void {
  emitGameEvent({
    gameId: 'mahjong-japanese',
    type: 'finish',
    meta: {
      ranked: true,
      placement: entry.placement,
      matchLength: entry.matchLength,
      matchId: entry.id,
      forfeit: entry.forfeit,
    },
  });
  if (!entry.forfeit && entry.affinityRule === 'match-v1')
    recordCharacterMatchFinish({
      matchId: entry.id,
      characterId: entry.characterId,
      opponents: entry.opponents,
      ranking: entry.ranking,
    });
}
