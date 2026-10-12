import { useEffect, useState, useSyncExternalStore } from 'react';
import { getMessage, getStoredLocale, subscribeStoredLocale } from '@/lib/i18n';
import { downloadSaveFile } from '@/lib/saveTransfer';
import {
  getStorageStatus,
  retryPendingStorage,
  subscribeStorageStatus,
} from '@/lib/storage';
import './recovery.css';

export function StorageNotice() {
  const locale = useSyncExternalStore(
    subscribeStoredLocale,
    getStoredLocale,
    getStoredLocale,
  );
  const status = useSyncExternalStore(
    subscribeStorageStatus,
    getStorageStatus,
    getStorageStatus,
  );
  const [message, setMessage] = useState('');
  const t = (key: string) => getMessage(locale, key);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!getStorageStatus().pendingCount) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
  if (!status.failed && !status.pendingCount) return null;
  return (
    <aside
      className="storage-notice"
      role="alert"
      aria-label={t('storage.title')}
    >
      <div>
        <strong>{t('storage.title')}</strong>
        <p>
          {t(
            status.conflicted
              ? 'storage.conflicted'
              : status.readFailed
                ? 'storage.readFailed'
                : 'storage.description',
          )}
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="recovery-actions">
        <button
          type="button"
          onClick={() => {
            try {
              downloadSaveFile();
              setMessage(t('recovery.exported'));
            } catch {
              setMessage(t('save.failed'));
            }
          }}
        >
          {t('save.export')}
        </button>
        <button
          type="button"
          onClick={() => {
            const saved = retryPendingStorage();
            setMessage(
              saved || getStorageStatus().conflicted
                ? ''
                : t('storage.retryFailed'),
            );
          }}
        >
          {t('storage.retry')}
        </button>
      </div>
    </aside>
  );
}
