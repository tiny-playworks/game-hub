import { useWallet, WalletBadge } from '@/components/WalletBadge';
import { useLocale } from '@/contexts/LocaleContext';

export function WalletCard() {
  const { t, locale } = useLocale();
  const wallet = useWallet();
  return (
    <section className="paper-texture rounded-3xl border bg-card p-5 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('wallet.title')}</h2>
        <WalletBadge />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('wallet.lifetime')} · {wallet.lifetimeEarned.toLocaleString()}{' '}
        {t('wallet.coins')}
      </p>
      <h3 className="mt-5 text-sm font-semibold">{t('wallet.ledger')}</h3>
      {wallet.ledger.length ? (
        <ul className="mt-2 divide-y">
          {wallet.ledger
            .slice(-8)
            .reverse()
            .map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p>{t(entry.reasonKey)}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(entry.at).toLocaleString(
                      locale === 'zh' ? 'zh-CN' : 'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                  </time>
                </div>
                <span className="font-semibold tabular-nums text-primary">
                  {entry.delta > 0 ? '+' : ''}
                  {entry.delta}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('wallet.empty')}
        </p>
      )}
    </section>
  );
}
