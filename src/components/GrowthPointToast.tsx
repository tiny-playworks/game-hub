import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { GROWTH_POINTS_GAINED_EVENT } from '@/lib/growth';

const DISPLAY_MS = 1500;

export default function GrowthPointToast() {
  const { t } = useLocale();
  const [points, setPoints] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onPointsGained = (event: Event) => {
      const customEvent = event as CustomEvent<{ points?: number }>;
      const earned = Number(customEvent.detail?.points ?? 0);
      if (!Number.isFinite(earned) || earned <= 0) return;

      setPoints((current) => current + Math.floor(earned));
      setVisible(true);
      clearHideTimer();
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        setPoints(0);
      }, DISPLAY_MS);
    };

    window.addEventListener(GROWTH_POINTS_GAINED_EVENT, onPointsGained);
    return () => {
      window.removeEventListener(GROWTH_POINTS_GAINED_EVENT, onPointsGained);
      clearHideTimer();
    };
  }, []);

  if (!visible || points <= 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <div className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
        {t('growth.toast.gain')}
        {points}
      </div>
    </div>
  );
}
