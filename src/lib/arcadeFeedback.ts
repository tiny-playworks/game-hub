import { getPlayerProfile } from './playerProfile';
import { playBeep } from './speech';

/** Observe score/turn changes, never animation frames or hidden opponent cards. */
export function arcadeFeedbackToken(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const outer = raw as Record<string, unknown>;
  const state = outer.state && typeof outer.state === 'object' ? outer.state as Record<string, unknown> : outer;
  const keys = ['score','moves','moveCount','turnCount','tricksPlayed','lines','maxTile','currentPlayer','matchedPairs','status'];
  const values = keys.map((key) => state[key] ?? outer[key] ?? null);
  // Board games already provide public boards in their snapshot.
  if (Array.isArray(state.board)) values.push(state.board);
  return JSON.stringify(values);
}

export function playArcadeFeedback(kind: 'move' | 'win' | 'lose' | 'record'): void {
  const volume = getPlayerProfile().audioVolumes.sfx;
  if (volume <= 0) return;
  playBeep(kind === 'move' ? 420 : kind === 'lose' ? 220 : kind === 'record' ? 1046 : 784,
    kind === 'move' ? 32 : 180, volume * (kind === 'move' ? 0.012 : 0.035));
}
