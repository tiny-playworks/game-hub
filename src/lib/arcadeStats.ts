import { games } from '@/data/games';
import { arcadeStatsKey, normalizeArcadeDifficulty } from '@/lib/arcade';

export interface GameStats {
  highScore: number;
  playCount: number;
  maxCombo: number;
  minValue: number | null;
  wins: number;
  streak: number;
  bestStreak: number;
  drawStreak: number;
  landlordStreak: number;
  maxTile: number;
  maxLines: number;
}

export interface ArcadeStoredState {
  stats: Record<string, GameStats>;
  receipts: string[];
}

export const DEFAULT_GAME_STATS: GameStats = {
  highScore: 0,
  playCount: 0,
  maxCombo: 0,
  minValue: null,
  wins: 0,
  streak: 0,
  bestStreak: 0,
  drawStreak: 0,
  landlordStreak: 0,
  maxTile: 0,
  maxLines: 0,
};

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizedStats(raw: unknown): GameStats {
  const value =
    raw && typeof raw === 'object' ? (raw as Partial<GameStats>) : {};
  const result = { ...DEFAULT_GAME_STATS };
  for (const key of Object.keys(result) as (keyof GameStats)[])
    if (key !== 'minValue') result[key] = count(value[key]);
  result.minValue =
    typeof value.minValue === 'number' &&
    Number.isFinite(value.minValue) &&
    value.minValue > 0
      ? value.minValue
      : null;
  return result;
}

export function normalizeGameState(raw: unknown): ArcadeStoredState {
  const value =
    raw && typeof raw === 'object' ? (raw as Partial<ArcadeStoredState>) : {};
  const stats: Record<string, GameStats> = {};
  if (value.stats && typeof value.stats === 'object') {
    for (const [key, item] of Object.entries(value.stats)) {
      const [gameId, difficulty] = key.split(':');
      if (!games.some((game) => game.id === gameId)) continue;
      const destination = arcadeStatsKey(
        gameId,
        normalizeArcadeDifficulty(gameId, difficulty),
      );
      const next = normalizedStats(item);
      const previous = stats[destination];
      if (previous) {
        for (const field of Object.keys(
          DEFAULT_GAME_STATS,
        ) as (keyof GameStats)[])
          if (field !== 'minValue')
            next[field] = Math.max(previous[field], next[field]);
        const minimums = [previous.minValue, next.minValue].filter(
          (value): value is number => value !== null,
        );
        next.minValue = minimums.length ? Math.min(...minimums) : null;
      }
      if (!difficulty && gameId === 'tetris')
        next.maxLines = Math.max(next.maxLines, next.highScore);
      stats[destination] = next;
    }
  }
  return {
    stats,
    receipts: Array.isArray(value.receipts)
      ? [
          ...new Set(
            value.receipts.filter((id): id is string => typeof id === 'string'),
          ),
        ].slice(-1000)
      : [],
  };
}

export function getBestValue(gameId: string, stats: GameStats): number | null {
  const metric = games.find((game) => game.id === gameId)?.bestMetric;
  return metric === 'min'
    ? stats.minValue
    : metric === 'wins'
      ? stats.bestStreak || null
      : stats.highScore || null;
}
