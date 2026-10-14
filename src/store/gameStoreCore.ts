import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import { games } from '@/data/games';
import { type ArcadeDifficulty, arcadeStatsKey } from '@/lib/arcade';
import {
  DEFAULT_GAME_STATS,
  getBestValue,
  type GameStats,
  normalizeGameState,
} from '@/lib/arcadeStats';
import { gameStorage } from '@/lib/storage';

export {
  DEFAULT_GAME_STATS,
  getBestValue,
  normalizeGameState,
} from '@/lib/arcadeStats';
export type { GameStats } from '@/lib/arcadeStats';
export interface ArcadeRecord {
  isNewBest: boolean;
  previousBest: number | null;
  currentBest: number | null;
}
export interface GameState {
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
const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
export const gameStore = createStore<GameState>()(
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
