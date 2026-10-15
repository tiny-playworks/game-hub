import { getCharacterById } from '@/lib/playerCharacters';
import {
  decideAiClaim,
  decideAiTurn,
} from '@/pages/mahjong/japanese/engine/ai';
import {
  applyEvent,
  type RiichiEvent,
  type RiichiMatchState,
} from '@/pages/mahjong/japanese/engine/match';
import { getPendingSeats } from '@/pages/mahjong/japanese/engine/selectors';

/** Practice owns its full snapshot; the source match and ranked ticket stay untouched. */
export function copyPracticeMatch(match: RiichiMatchState): RiichiMatchState {
  const copied = structuredClone(match);
  delete copied.ranked;
  return copied;
}

/** One deterministic AI decision. A null human seat lets callers simulate every seat. */
export function getPracticeAiEvent(
  match: RiichiMatchState,
  humanSeat: number | null = 0,
): RiichiEvent | null {
  if (match.status !== 'playing') return null;
  const seat = getPendingSeats(match.round).find((item) => item !== humanSeat);
  if (seat === undefined) return null;
  const characterId = match.seatCharacters[seat];
  const style = characterId ? getCharacterById(characterId).style : undefined;
  const level = match.seatAiLevels[seat] ?? match.rules.aiLevel;
  if (match.round.phase === 'claim') {
    return {
      type: 'claim',
      seat,
      response: decideAiClaim(match.round, seat, level, style, match.rules),
      elapsed: 0,
    };
  }
  const event = decideAiTurn(match.round, seat, level, style, match.rules);
  return event ? { ...event, elapsed: 0 } : null;
}

/** No effect consumer, persistence, reward settlement, or advance to a second round. */
export function applyPracticeEvent(
  match: RiichiMatchState,
  event: RiichiEvent,
): RiichiMatchState | null {
  if (event.type === 'nextRound') return null;
  const practice = match.ranked ? copyPracticeMatch(match) : match;
  return applyEvent(practice, event)?.match ?? null;
}
