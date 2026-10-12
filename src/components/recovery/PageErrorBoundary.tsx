import { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import { getMessage, getStoredLocale } from '@/lib/i18n';
import { resetPageImports } from '@/lib/lazyPage';
import { downloadSaveFile } from '@/lib/saveTransfer';
import { StorageNotice } from './StorageNotice';
import './recovery.css';

async function copyError(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 普通 HTTP 继续使用选择复制。 */
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
}

function RecoveryPage({
  error,
  retry,
  home,
  showStorageNotice,
}: {
  error: Error;
  retry: () => void;
  home: () => void;
  showStorageNotice: boolean;
}) {
  const t = (key: string) => getMessage(getStoredLocale(), key);
  const [message, setMessage] = useState('');
  return (
    <>
      {showStorageNotice && <StorageNotice />}
      <main className="recovery-page">
        <section className="recovery-card" aria-labelledby="recovery-title">
          <h1 id="recovery-title">{t('recovery.title')}</h1>
          <p role="alert">{t('recovery.description')}</p>
          <div className="recovery-actions">
            <button type="button" onClick={retry}>
              {t('recovery.retry')}
            </button>
            <button type="button" onClick={home}>
              {t('recovery.home')}
            </button>
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
                void copyError(
                  `${error.name}: ${error.message}\n${location.pathname}\n${error.stack ?? ''}`,
                )
                  .then((copied) =>
                    setMessage(
                      t(copied ? 'recovery.copied' : 'recovery.copyFailed'),
                    ),
                  )
                  .catch(() => setMessage(t('recovery.copyFailed')));
              }}
            >
              {t('recovery.copy')}
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          <details>
            <summary>{t('recovery.details')}</summary>
            <pre>{error.message}</pre>
          </details>
        </section>
      </main>
    </>
  );
}

export class PageErrorBoundary extends Component<
  { children: ReactNode; showStorageNotice?: boolean },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Game Hub] Page failed', error, info.componentStack);
  }
  private retry = () => {
    resetPageImports();
    this.setState({ error: null });
  };
  private home = () => {
    // 不刷新整页，保留尚未写入浏览器的会话进度。
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    this.retry();
  };
  render() {
    return this.state.error ? (
      <RecoveryPage
        error={this.state.error}
        retry={this.retry}
        home={this.home}
        showStorageNotice={this.props.showStorageNotice !== false}
      />
    ) : (
      this.props.children
    );
  }
}
