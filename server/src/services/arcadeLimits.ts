/**
 * Generous per-game score ceilings shared by the online and offline arcade
 * validators. Anything above is physically implausible and is rejected so it can
 * never reach a family leaderboard.
 */
const ARCADE_SCORE_CAPS: Record<string, number> = {
  '2048': 5_000_000,
  snake: 10_000,
  breakout: 1_000_000,
  shooter: 1_000_000,
  tank: 1_000_000,
  tetris: 3_000_000,
  'guess-number': 1000,
  memory: 10_000,
  rubiks: 86_400,
};

export function exceedsArcadeScoreCap(gameId: string, score: number): boolean {
  const cap = ARCADE_SCORE_CAPS[gameId];
  return cap !== undefined && score > cap;
}
