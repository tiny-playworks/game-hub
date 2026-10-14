import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { HouseholdApiError } from '@/lib/household/api';

export function HouseholdNotice() {
  const { error, clearError } = useHousehold();
  const { t } = useLocale();
  if (!error) return null;

  const expired = error instanceof HouseholdApiError && error.status === 401;
  const message =
    error instanceof HouseholdApiError
      ? t(error.messageKey)
      : error instanceof TypeError
        ? t('household.error.NETWORK')
        : t('household.error.UNKNOWN');

  return (
    <aside
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground sm:px-6"
    >
      <div>
        <strong>{t('household.error.title')}</strong>
        <p>
          {message}
          {expired ? ` ${t('household.error.sessionHint')}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={clearError}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
      >
        {t('household.notice.dismiss')}
      </button>
    </aside>
  );
}
