import { games } from '@/data/games';
import { gameStorage } from '@/lib/storage';

export type ArcadeDifficulty = 'easy' | 'normal' | 'hard';
export const ARCADE_PREFS_KEY = 'game-hub-arcade-prefs-v1';
export const ARCADE_DIFFICULTY_EVENT = 'game-hub:arcade-difficulty';
export const ARCADE_REALTIME = new Set([
  'guess-number',
  'memory',
  'snake',
  'breakout',
  'shooter',
  'tank',
  'tetris',
  'rubiks',
]);
export function arcadeDifficulties(gameId: string): ArcadeDifficulty[] {
  return gameId === 'doudizhu' || gameId === 'shengji'
    ? ['normal', 'hard']
    : ['easy', 'normal', 'hard'];
}
export function normalizeArcadeDifficulty(
  gameId: string,
  value: unknown,
): ArcadeDifficulty {
  return (
    arcadeDifficulties(gameId).find((difficulty) => difficulty === value) ??
    'normal'
  );
}
export function getArcadeDifficulty(gameId: string): ArcadeDifficulty {
  try {
    const raw = JSON.parse(gameStorage.getItem(ARCADE_PREFS_KEY) ?? 'null');
    return normalizeArcadeDifficulty(gameId, raw?.difficulties?.[gameId]);
  } catch {
    return 'normal';
  }
}
export function setArcadeDifficulty(
  gameId: string,
  difficulty: ArcadeDifficulty,
): void {
  let difficulties: Record<string, ArcadeDifficulty> = {};
  try {
    const raw = JSON.parse(gameStorage.getItem(ARCADE_PREFS_KEY) ?? 'null');
    difficulties = Object.fromEntries(
      games
        .filter((game) => game.categoryId !== 'mahjong')
        .map((game) => [
          game.id,
          normalizeArcadeDifficulty(game.id, raw?.difficulties?.[game.id]),
        ]),
    );
  } catch {
    /* Older or malformed preferences use the normal difficulty. */
  }
  gameStorage.setItem(
    ARCADE_PREFS_KEY,
    JSON.stringify({
      version: 1,
      difficulties: {
        ...difficulties,
        [gameId]: normalizeArcadeDifficulty(gameId, difficulty),
      },
    }),
  );
  window.dispatchEvent(new Event(ARCADE_DIFFICULTY_EVENT));
}
export function difficultyLabelKey(
  gameId: string,
  difficulty: ArcadeDifficulty,
): string {
  return `arcade.difficulty.${gameId}.${difficulty}`;
}
export function arcadeStatsKey(
  gameId: string,
  difficulty: ArcadeDifficulty = 'normal',
): string {
  return `${gameId}:${difficulty}`;
}
