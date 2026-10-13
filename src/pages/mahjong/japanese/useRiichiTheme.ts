import { useCallback, useEffect, useState } from 'react';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { gameStorage } from '@/lib/storage';
import type { RiichiThemeId } from './constants';
import { RIICHI_THEME_STORAGE_KEY } from './constants';

function getStoredTheme(): RiichiThemeId {
  if (typeof gameStorage === 'undefined') return 'green';
  const v = gameStorage.getItem(RIICHI_THEME_STORAGE_KEY);
  if (v === 'blue' || v === 'warm') return v;
  return 'green';
}

export function useRiichiTheme() {
  const household = useOptionalHousehold();
  const [theme, setThemeState] = useState<RiichiThemeId>(getStoredTheme);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
  }, [household?.mode, household?.snapshot?.preferences.riichiTheme]);

  const setTheme = useCallback((next: RiichiThemeId) => {
    if (household?.mode === 'member-online') {
      void household.updatePreferences({ riichiTheme: next }).catch(() => {});
      return;
    }
    setThemeState(next);
    gameStorage?.setItem(RIICHI_THEME_STORAGE_KEY, next);
  }, [household]);

  return { theme, setTheme };
}
