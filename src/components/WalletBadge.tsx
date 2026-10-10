import { Coins } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import {
  getWalletState,
  WALLET_CHANGED_EVENT,
  WALLET_STORAGE_KEY,
} from '@/lib/wallet';

export function useWallet() {
  const [wallet, setWallet] = useState(getWalletState);
  useEffect(() => {
    const refresh = () => setWallet(getWalletState());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === WALLET_STORAGE_KEY) refresh();
    };
    window.addEventListener(WALLET_CHANGED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return wallet;
}

export function WalletBadge() {
  const { t, locale } = useLocale();
  const { coins } = useWallet();
  const [displayed, setDisplayed] = useState(coins);
  const previous = useRef(coins);
  useEffect(() => {
    const from = previous.current;
    previous.current = coins;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(coins);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - started) / 500);
      setDisplayed(
        Math.round(from + (coins - from) * (1 - (1 - fraction) ** 3)),
      );
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [coins]);
  return (
    <span
      data-wallet-badge
      className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-semibold tabular-nums text-foreground"
      title={t('wallet.title')}
    >
      <Coins className="size-4 text-gold" />
      <span className="hidden sm:inline">{t('wallet.coins')}</span>
      <span aria-live="polite">
        {displayed.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
      </span>
    </span>
  );
}
