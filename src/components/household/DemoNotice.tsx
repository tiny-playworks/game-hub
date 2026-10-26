import { useEffect, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';

export function DemoNotice() {
  const { t } = useLocale();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/healthz', { signal: controller.signal })
      .then((r) => r.json())
      .then((value) => {
        if (!controller.signal.aborted) setDemo(value.demo === true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return demo ? (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium"
      role="status"
    >
      {t('demo.banner')}
    </div>
  ) : null;
}
