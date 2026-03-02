import { useCallback, useEffect, useState } from 'react';
import type { RiichiThemeId } from './constants';
import { RIICHI_THEME_STORAGE_KEY } from './constants';

function getStoredTheme(): RiichiThemeId {
  if (typeof localStorage === 'undefined') return 'green';
  const v = localStorage.getItem(RIICHI_THEME_STORAGE_KEY);
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
    localStorage?.setItem(RIICHI_THEME_STORAGE_KEY, next);
  }, []);

  return { theme, setTheme };
}
