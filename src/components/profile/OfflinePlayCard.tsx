import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';

interface OfflineBuild {
  version: string;
  bytes: number;
  assets: string[];
}
interface SavedBuild {
  version: string;
  savedAt: number;
}
type WorkerReply =
  | { type: 'done'; completed: SavedBuild[] }
  | { type: 'progress'; done: number; total: number }
  | { type: 'error' };
function communicate(
  worker: ServiceWorker,
  type: string,
  progress: (value: string) => void,
): Promise<SavedBuild[]> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('timeout'));
    }, 180000);
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type === 'progress') {
        progress(`${event.data.done} / ${event.data.total}`);
        return;
      }
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data.type === 'error') reject(new Error('cache failed'));
      else resolve(event.data.completed);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
export function OfflinePlayCard() {
  const { t, locale } = useLocale();
  const [build, setBuild] = useState<OfflineBuild | null>(null);
  const [saved, setSaved] = useState<SavedBuild[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(false);
  const supported = 'serviceWorker' in navigator && window.isSecureContext;
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/offline-manifest.json', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (
          value?.schema === 1 &&
          typeof value.version === 'string' &&
          typeof value.bytes === 'number' &&
          Array.isArray(value.assets)
        )
          setBuild(value);
      })
      .catch(() => {});
    if (supported)
      void navigator.serviceWorker
        .getRegistration('/')
        .then(async (registration) => {
          if (
            registration?.active &&
            new URL(registration.active.scriptURL).pathname ===
              '/offline-worker.js'
          ) {
            const completed = await communicate(
              registration.active,
              'status',
              () => {},
            );
            if (!controller.signal.aborted) setSaved(completed);
          }
        })
        .catch(() => {});
    return () => controller.abort();
  }, [supported]);
  const action = async (type: 'download' | 'clear') => {
    setBusy(true);
    setError(false);
    setProgress('');
    try {
      const registration =
        type === 'download'
          ? await navigator.serviceWorker.register('/offline-worker.js', {
              scope: '/',
              updateViaCache: 'none',
            })
          : await navigator.serviceWorker.getRegistration('/');
      if (!registration) throw new Error('unavailable');
      if (type === 'download') await registration.update();
      const worker =
        registration.installing ?? registration.waiting ?? registration.active;
      if (!worker) throw new Error('unavailable');
      if (worker.state !== 'activated')
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            worker.removeEventListener('statechange', changed);
            reject(new Error('activation timeout'));
          }, 20000);
          const changed = () => {
            if (worker.state === 'activated' || worker.state === 'redundant') {
              clearTimeout(timer);
              worker.removeEventListener('statechange', changed);
              if (worker.state === 'activated') resolve();
              else reject(new Error('redundant'));
            }
          };
          worker.addEventListener('statechange', changed);
          changed();
        });
      setSaved(await communicate(worker, type, setProgress));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-4 rounded-3xl border bg-card p-5"
      id="offline-play"
    >
      <h2 className="text-lg font-semibold">{t('offline.title')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('offline.description')}
      </p>
      <p className="text-xs text-muted-foreground">
        {build
          ? formatMessage(locale, 'offline.build', {
              version: build.version,
              size: (build.bytes / 1048576).toFixed(1),
            })
          : t('offline.development')}
      </p>
      <p className="text-sm" role="status">
        {busy
          ? `${t('offline.working')} ${progress}`
          : saved.length
            ? formatMessage(locale, 'offline.saved', {
                version: saved[0].version,
                date: new Date(saved[0].savedAt).toLocaleString(
                  locale === 'zh' ? 'zh-CN' : 'en-US',
                ),
              })
            : t('offline.empty')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!supported || !build || busy}
          onClick={() => void action('download')}
        >
          {t('offline.download')}
        </Button>
        <Button
          variant="outline"
          disabled={!supported || !saved.length || busy}
          onClick={() => void action('clear')}
        >
          {t('offline.clear')}
        </Button>
        <Button variant="outline" asChild>
          <a href="#data-management">{t('offline.backup')}</a>
        </Button>
      </div>
      {!supported && (
        <p className="text-sm text-muted-foreground">{t('offline.secure')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('offline.failed')}
        </p>
      )}
    </section>
  );
}
