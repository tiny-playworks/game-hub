import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { gameStorage } from '@/lib/storage';
import { applyTheme, getStoredTheme, THEME_STORAGE_KEY } from '@/lib/theme';

export function ThemeSwitcher() {
  const { t } = useLocale();
  const household = useOptionalHousehold();
  const [theme, setTheme] = useState(getStoredTheme);
  useEffect(() => {
    const next = getStoredTheme();
    setTheme(next);
    applyTheme(next);
  }, [household?.mode, household?.snapshot?.preferences.venueTheme]);
  const label = t(theme === 'light' ? 'theme.dark' : 'theme.light');
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-accent"
      onClick={() => {
        const next = theme === 'light' ? 'dark' : 'light';
        if (household?.mode === 'member-online') {
          void household.updatePreferences({ venueTheme: next }).catch(() => {});
          return;
        }
        gameStorage.setItem(THEME_STORAGE_KEY, next);
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === 'light' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </button>
  );
}
