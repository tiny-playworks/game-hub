import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GameStats {
  highScore: number;
  playCount: number;
  maxCombo: number;
}

interface GameState {
  stats: Record<string, GameStats>;
  updateHighScore: (gameId: string, score: number) => void;
  incrementPlayCount: (gameId: string) => void;
  updateMaxCombo: (gameId: string, combo: number) => void;
}

const defaultStats: GameStats = {
  highScore: 0,
  playCount: 0,
  maxCombo: 0,
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      stats: {},
      updateHighScore: (gameId, score) =>
        set((state) => {
          const currentStats = state.stats[gameId] || { ...defaultStats };
          if (score > currentStats.highScore) {
            return {
              stats: {
                ...state.stats,
                [gameId]: { ...currentStats, highScore: score },
              },
            };
          }
          return state;
        }),
      incrementPlayCount: (gameId) =>
        set((state) => {
          const currentStats = state.stats[gameId] || { ...defaultStats };
          return {
            stats: {
              ...state.stats,
              [gameId]: {
                ...currentStats,
                playCount: currentStats.playCount + 1,
              },
            },
          };
        }),
      updateMaxCombo: (gameId, combo) =>
        set((state) => {
          const currentStats = state.stats[gameId] || { ...defaultStats };
          if (combo > currentStats.maxCombo) {
            return {
              stats: {
                ...state.stats,
                [gameId]: { ...currentStats, maxCombo: combo },
              },
            };
          }
          return state;
        }),
    }),
    {
      name: 'game-hub-storage', // localStorage key
    },
  ),
);
