import { preloadRiichiRules } from '@/lib/riichiRules';
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

export function nextServerAiEvent(match: RiichiMatchState): RiichiEvent | null {
  if (match.status !== 'playing') return null;
  const round = match.round;
  const seat = getPendingSeats(round)[0];
  if (seat === undefined) return null;
  const level = match.seatAiLevels[seat];
  if (round.phase === 'discard') return decideAiTurn(round, seat, level);
  return {
    type: 'claim',
    seat,
    response: decideAiClaim(round, seat, level),
  };
}

export { applyEvent, createMatch };
