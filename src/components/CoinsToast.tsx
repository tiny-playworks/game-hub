import { Coins } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { COINS_GAINED_EVENT } from '@/lib/wallet';

export default function CoinsToast() {
  const { t } = useLocale();
  const [coins, setCoins] = useState(0);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onGain = (event: Event) => {
      const earned = (event as CustomEvent<{ coins: number }>).detail?.coins;
      if (!Number.isFinite(earned) || earned <= 0) return;
      const badge = document
        .querySelector('[data-wallet-badge]')
        ?.getBoundingClientRect();
      setTarget({
        x: badge
          ? badge.left + badge.width / 2 - window.innerWidth / 2
          : window.innerWidth / 2 - 90,
        y: badge ? badge.top + badge.height / 2 - 120 : -80,
      });
      setCoins((current) => current + earned);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCoins(0), 2000);
    };
    window.addEventListener(COINS_GAINED_EVENT, onGain);
    return () => {
      window.removeEventListener(COINS_GAINED_EVENT, onGain);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!coins) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-28 z-[60] -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full border border-gold/60 bg-card px-4 py-2 font-semibold text-foreground shadow-lg">
        <Coins className="size-5 text-gold" />+{coins} {t('wallet.coins')}
      </div>
      <span
        key={coins}
        className="coin-flight absolute left-1/2 top-0 text-gold"
        style={
          {
            '--coin-x': `${target.x}px`,
            '--coin-y': `${target.y}px`,
          } as CSSProperties
        }
      >
        <Coins className="size-6" />
      </span>
    </div>
  );
}
