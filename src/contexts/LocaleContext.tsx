import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getMessage,
  getStoredLocale,
  type Locale,
  setStoredLocale,
} from '@/lib/i18n';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const household = useOptionalHousehold();
  const mode = household?.mode ?? 'guest-local';
  const snapshot = household?.snapshot;
  const updatePreferences = household?.updatePreferences;
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    setLocaleState(
      mode !== 'guest-local' && snapshot
        ? snapshot.preferences.locale
        : getStoredLocale(),
    );
  }, [mode, snapshot?.memberId, snapshot?.preferences.locale]);

  const setLocale = useCallback((next: Locale) => {
    if (mode !== 'guest-local') {
      void updatePreferences?.({ locale: next }).catch(() => {});
      return;
    }
    setLocaleState(next);
    setStoredLocale(next);
  }, [mode, updatePreferences]);

  const t = useCallback((key: string) => getMessage(locale, key), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
