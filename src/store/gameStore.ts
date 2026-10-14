import { useStore, type UseBoundStore } from 'zustand';
import { gameStore, type GameState } from './gameStoreCore';

export {
  DEFAULT_GAME_STATS,
  getBestValue,
  normalizeGameState,
} from './gameStoreCore';
export type { ArcadeRecord, GameStats } from './gameStoreCore';

export const useGameStore = Object.assign(
  (selector: (state: GameState) => unknown = (state) => state) =>
    useStore(gameStore, selector),
  gameStore,
) as UseBoundStore<typeof gameStore>;
