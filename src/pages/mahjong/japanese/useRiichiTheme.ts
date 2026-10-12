import { useCallback, useEffect, useState } from 'react';
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
  const [theme, setThemeState] = useState<RiichiThemeId>(getStoredTheme);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: RiichiThemeId) => {
    setThemeState(next);
    gameStorage?.setItem(RIICHI_THEME_STORAGE_KEY, next);
  }, []);

  return { theme, setTheme };
}
