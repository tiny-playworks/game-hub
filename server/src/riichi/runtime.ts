import { preloadRiichiRules } from '@/lib/riichiRules';
import { getCharacterById } from '@/lib/playerCharacters';
import {
  applyEvent,
  createMatch,
  decideAiClaim,
  decideAiTurn,
  getPendingSeats,
  type RiichiEvent,
  type RiichiMatchState,
} from '@/pages/mahjong/japanese/engine';

export async function prepareRiichiRuntime(): Promise<void> {
  await preloadRiichiRules();
}

export function nextServerAiEvent(
  match: RiichiMatchState,
  isAiSeat: ((seat: number) => boolean) | boolean = false,
): RiichiEvent | null {
  if (match.status !== 'playing') return null;
  const round = match.round;
  const predicate =
    typeof isAiSeat === 'function'
      ? isAiSeat
      : (pending: number) => isAiSeat || pending !== 0;

  const seat = getPendingSeats(round).find((pending) => predicate(pending));
  if (seat === undefined) return null;
  const level = match.seatAiLevels[seat];
  const characterId = match.seatCharacters[seat];
  const style = characterId ? getCharacterById(characterId).style : undefined;
  if (round.phase === 'discard')
    return decideAiTurn(round, seat, level, style, match.rules);
  return {
    type: 'claim',
    seat,
    response: decideAiClaim(round, seat, level, style, match.rules),
  };
}

export { applyEvent, createMatch };
