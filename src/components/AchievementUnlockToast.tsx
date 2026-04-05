import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  type AchievementUnlockedEventDetail,
} from '@/lib/achievements';

const DISPLAY_MS = 2400;

type ToastItem = AchievementUnlockedEventDetail;

export default function AchievementUnlockToast() {
  const { t } = useLocale();
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const currentRef = useRef<ToastItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const showNext = () => {
      if (queueRef.current.length === 0) return;
      const next = queueRef.current.shift() ?? null;
      setCurrent(next);
    };

    const onUnlocked = (event: Event) => {
      const customEvent = event as CustomEvent<AchievementUnlockedEventDetail>;
      const detail = customEvent.detail;
      if (!detail?.id) return;

      queueRef.current.push(detail);
      if (!currentRef.current) {
        showNext();
      }
    };

    window.addEventListener(ACHIEVEMENT_UNLOCKED_EVENT, onUnlocked);
    return () => {
      window.removeEventListener(ACHIEVEMENT_UNLOCKED_EVENT, onUnlocked);
      clearTimer();
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCurrent(null);
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift() ?? null;
        setCurrent(next);
      }
    }, DISPLAY_MS);
  }, [current]);

  if (!current) return null;

  const rarityClassMap = {
    common: 'bg-slate-500/90',
    rare: 'bg-blue-600/90',
    epic: 'bg-violet-600/90',
    legendary: 'bg-amber-500/95 text-slate-900',
  } as const;

  const rarityClass = current.rarity
    ? rarityClassMap[current.rarity]
    : 'bg-emerald-500/90';

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[55] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="min-w-[260px] rounded-2xl border border-white/20 bg-slate-900/95 px-4 py-3 text-white shadow-2xl">
        <p className="text-xs tracking-[0.16em] text-emerald-200 uppercase">
          {t('achievement.toast.unlocked')}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {current.nameKey ? t(current.nameKey) : current.id}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {current.rarity && (
            <span className={`rounded-full px-2 py-0.5 ${rarityClass}`}>
              {t(`achievements.rarity.${current.rarity}`)}
            </span>
          )}
          {typeof current.points === 'number' && (
            <span className="rounded-full bg-emerald-600/90 px-2 py-0.5">
              {t('achievement.toast.points')}
              {current.points}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
