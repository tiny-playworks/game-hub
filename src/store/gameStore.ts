import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { games } from '@/data/games';
import {
  type ArcadeDifficulty,
  arcadeStatsKey,
  normalizeArcadeDifficulty,
} from '@/lib/arcade';
import { gameStorage } from '@/lib/storage';

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
export interface ArcadeRecord {
  isNewBest: boolean;
  previousBest: number | null;
  currentBest: number | null;
}
interface GameState {
  stats: Record<string, GameStats>;
  receipts: string[];
  consumeEvent: (id: string) => boolean;
  recordResult: (
    gameId: string,
    difficulty: ArcadeDifficulty,
    score: number,
    outcome: 'win' | 'lose' | 'draw',
    meta?: Record<string, unknown>,
  ) => ArcadeRecord;
  updateHighScore: (
    gameId: string,
    score: number,
    difficulty?: ArcadeDifficulty,
  ) => void;
  incrementPlayCount: (gameId: string, difficulty?: ArcadeDifficulty) => void;
  updateMaxCombo: (
    gameId: string,
    combo: number,
    difficulty?: ArcadeDifficulty,
  ) => void;
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
const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
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
export function normalizeGameState(
  raw: unknown,
): Pick<GameState, 'stats' | 'receipts'> {
  const value =
    raw && typeof raw === 'object' ? (raw as Partial<GameState>) : {};
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
      // The old Tetris page stored cleared lines as its highScore, so retain those too.
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
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      stats: {},
      receipts: [],
      consumeEvent: (id) => {
        if (get().receipts.includes(id)) return false;
        set((state) => ({ receipts: [...state.receipts, id].slice(-1000) }));
        return true;
      },
      recordResult: (gameId, difficulty, score, outcome, meta = {}) => {
        const key = arcadeStatsKey(gameId, difficulty);
        const previous = get().stats[key] ?? { ...DEFAULT_GAME_STATS };
        const metric = games.find((game) => game.id === gameId)?.bestMetric;
        const next = { ...previous };
        if (metric === 'max')
          next.highScore = Math.max(next.highScore, count(score));
        if (
          metric === 'min' &&
          outcome === 'win' &&
          Number.isFinite(score) &&
          score > 0
        )
          next.minValue =
            next.minValue === null ? score : Math.min(next.minValue, score);
        next.wins += Number(outcome === 'win');
        next.streak = outcome === 'win' ? next.streak + 1 : 0;
        next.bestStreak = Math.max(next.bestStreak, next.streak);
        next.drawStreak = outcome === 'draw' ? next.drawStreak + 1 : 0;
        next.landlordStreak =
          outcome === 'win' && meta.landlord === true
            ? next.landlordStreak + 1
            : 0;
        next.maxCombo = Math.max(next.maxCombo, count(meta.maxCombo));
        next.maxTile = Math.max(next.maxTile, count(meta.maxTile));
        next.maxLines = Math.max(next.maxLines, count(meta.lines));
        const previousBest = getBestValue(gameId, previous),
          currentBest = getBestValue(gameId, next);
        set((state) => ({ stats: { ...state.stats, [key]: next } }));
        return {
          previousBest,
          currentBest,
          isNewBest:
            currentBest !== null &&
            (previousBest === null ||
              (metric === 'min'
                ? currentBest < previousBest
                : currentBest > previousBest)),
        };
      },
      updateHighScore: (gameId, score, difficulty = 'normal') =>
        set((state) => {
          const key = arcadeStatsKey(gameId, difficulty),
            current = state.stats[key] ?? { ...DEFAULT_GAME_STATS };
          return score > current.highScore
            ? {
                stats: {
                  ...state.stats,
                  [key]: { ...current, highScore: count(score) },
                },
              }
            : state;
        }),
      incrementPlayCount: (gameId, difficulty = 'normal') =>
        set((state) => {
          const key = arcadeStatsKey(gameId, difficulty),
            current = state.stats[key] ?? { ...DEFAULT_GAME_STATS };
          return {
            stats: {
              ...state.stats,
              [key]: { ...current, playCount: current.playCount + 1 },
            },
          };
        }),
      updateMaxCombo: (gameId, combo, difficulty = 'normal') =>
        set((state) => {
          const key = arcadeStatsKey(gameId, difficulty),
            current = state.stats[key] ?? { ...DEFAULT_GAME_STATS };
          return combo > current.maxCombo
            ? {
                stats: {
                  ...state.stats,
                  [key]: { ...current, maxCombo: count(combo) },
                },
              }
            : state;
        }),
    }),
    {
      name: 'game-hub-storage',
      storage: createJSONStorage(() => gameStorage),
      version: 1,
      migrate: (raw) => normalizeGameState(raw),
      merge: (persisted, current) => ({
        ...current,
        ...normalizeGameState(persisted),
      }),
    },
  ),
);
