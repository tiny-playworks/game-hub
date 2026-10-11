import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '@/lib/achievements';
import {
  COSMETICS_CHANGED_EVENT,
  type CosmeticsState,
  getCosmeticsState,
  syncCosmeticRewards,
} from '@/lib/cosmetics';
import {
  CHARACTERS_CHANGED_EVENT,
  getPlayerCharacterState,
  type PlayerCharacterState,
} from '@/lib/playerCharacters';
import { RANKED_CHANGED_EVENT } from '@/lib/ranked';

const CosmeticContext = createContext<{
  cosmetics: CosmeticsState;
  characters: PlayerCharacterState;
} | null>(null);
function readState() {
  return {
    cosmetics: getCosmeticsState(),
    characters: getPlayerCharacterState(),
  };
}

/** One subscription for the whole app; cards and individual tiles never read storage on every render. */
export function CosmeticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const refresh = () => setState(readState());
    const sync = () => {
      try {
        syncCosmeticRewards();
      } catch {
        /* Retry on the next update if storage is unavailable. */
      }
      refresh();
    };
    const events = [
      CHARACTERS_CHANGED_EVENT,
      RANKED_CHANGED_EVENT,
      ACHIEVEMENT_UNLOCKED_EVENT,
      'storage',
    ];
    window.addEventListener(COSMETICS_CHANGED_EVENT, refresh);
    for (const name of events) window.addEventListener(name, sync);
    sync();
    return () => {
      window.removeEventListener(COSMETICS_CHANGED_EVENT, refresh);
      for (const name of events) window.removeEventListener(name, sync);
    };
  }, []);
  return (
    <CosmeticContext.Provider value={state}>
      {children}
    </CosmeticContext.Provider>
  );
}
export function useCosmetics() {
  return useContext(CosmeticContext)?.cosmetics ?? getCosmeticsState();
}
export function useCharacters() {
  return useContext(CosmeticContext)?.characters ?? getPlayerCharacterState();
}
