import {
  Check,
  Coins,
  Frame,
  Layers,
  LockKeyhole,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GPT_BANNER_ASSETS } from '@/assets/gptAssets';
import { CosmeticPreview } from '@/components/cosmetics/CosmeticPreview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWallet } from '@/components/WalletBadge';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import { HouseholdApiError } from '@/lib/household/api';
import {
  COSMETIC_CATEGORIES,
  COSMETIC_DEFS,
  type CosmeticCategory,
  type CosmeticDef,
  equipCosmetic,
  getCosmetic,
  purchaseCosmetic,
} from '@/lib/cosmetics';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

export function useCosmeticUnlockText() {
  const { t, locale } = useLocale();
  return (item: CosmeticDef) => {
    const unlock = item.unlock;
    if (!unlock) return '';
    if (unlock.type === 'rank')
      return formatMessage(locale, 'shop.unlock.rank', {
        rank: t(`character.rank.${unlock.band}`),
      });
    if (unlock.type === 'affinity')
      return formatMessage(locale, 'shop.unlock.affinity', {
        character: t(getCharacterById(unlock.characterId).nameKey),
        stage: unlock.stage,
      });
    return formatMessage(locale, 'shop.unlock.achievement', {
      achievement: t(`achievement.${unlock.achievementId}.name`),
    });
  };
}

export default function Shop() {
  const { t, locale } = useLocale();
  const cosmetics = useCosmetics();
  const { coins } = useWallet();
  const {
    mode,
    purchaseCosmetic: onlinePurchaseCosmetic,
    equipCosmetic: onlineEquipCosmetic,
  } = useHousehold();
  const unlockText = useCosmeticUnlockText();
  const [searchParams] = useSearchParams();
  const requestedItem = getCosmetic(searchParams.get('item') ?? '');
  const [category, setCategory] = useState<CosmeticCategory>(
    requestedItem?.category ?? 'tile-back',
  );
  const [selectedId, setSelectedId] = useState(
    requestedItem?.id ?? cosmetics.equipped['tile-back'],
  );
  const [confirm, setConfirm] = useState(false);
  const [acquired, setAcquired] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'equip' | 'purchase' | null>(null);
  const mutationPending = useRef(false);
  const selected =
    COSMETIC_DEFS.find(({ id }) => id === selectedId) ?? COSMETIC_DEFS[0];
  const owned = cosmetics.owned.includes(selected.id);
  const equipped = cosmetics.equipped[selected.category] === selected.id;
  const price = selected.price;
  const equip = async (itemId: string) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy('equip');
    try {
      if (mode !== 'guest-local') await onlineEquipCosmetic(itemId);
      else equipCosmetic(itemId);
      setError('');
    } catch (err) {
      setError(err instanceof HouseholdApiError ? t(err.messageKey) : t('shop.failed'));
    } finally { mutationPending.current = false; setBusy(null); }
  };
  return (
    <div className="venue-shop lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-360 space-y-6 px-4 py-7 sm:px-8">
        <section className="salon-page-banner salon-page-banner--shop">
          {GPT_BANNER_ASSETS.home ? (
            <img
              src={GPT_BANNER_ASSETS.home}
              alt=""
              aria-hidden="true"
              className="salon-banner-art"
              fetchPriority="high"
              decoding="async"
            />
          ) : null}
          <div className="salon-banner-inner flex flex-wrap items-end justify-between gap-4">
            <div className="salon-banner-copy">
              <p className="play-eyebrow flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                SALON CURIO ATELIER · 雀庄器物博古架
              </p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
                {t('shop.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e8e3d5]">
                {t('shop.subtitle')}
              </p>
            </div>
            <div className="salon-banner-actions flex items-center gap-2">
              <span className="salon-banner-pill">
                {cosmetics.owned.length} / {COSMETIC_DEFS.length}{' '}
                {t('shop.owned')}
              </span>
            </div>
          </div>
        </section>
        <div className="shop-layout salon-shop-layout">
          <nav className="shop-categories" aria-label={t('shop.categories')}>
            {COSMETIC_CATEGORIES.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={category === value}
                className={cn(
                  'shop-category',
                  category === value && 'is-active',
                )}
                onClick={() => {
                  setCategory(value);
                  setSelectedId(cosmetics.equipped[value]);
                  setError('');
                }}
              >
                <span className="venue-shop-category-label">
                  {value === 'tile-back' ? (
                    <Layers />
                  ) : value === 'table-felt' ? (
                    <Square />
                  ) : value === 'avatar-frame' ? (
                    <Frame />
                  ) : (
                    <Zap />
                  )}{' '}
                  {t(`shop.category.${value}`)}
                </span>
                <span className="text-xs opacity-60">
                  {
                    COSMETIC_DEFS.filter(
                      (item) =>
                        item.category === value &&
                        cosmetics.owned.includes(item.id),
                    ).length
                  }
                  /
                  {
                    COSMETIC_DEFS.filter((item) => item.category === value)
                      .length
                  }
                </span>
              </button>
            ))}
          </nav>
          <section
            aria-label={t(`shop.category.${category}`)}
            className="shop-items"
          >
            {COSMETIC_DEFS.filter((item) => item.category === category).map(
              (item) => {
                const isOwned = cosmetics.owned.includes(item.id);
                const isEquipped = cosmetics.equipped[category] === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cosmetic-id={item.id}
                    data-rarity={item.rarity}
                    className={cn(
                      'shop-item',
                      selected.id === item.id && 'is-selected',
                    )}
                    aria-pressed={selected.id === item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setError('');
                    }}
                  >
                    <CosmeticPreview item={item} compact />
                    <div className="shop-item-copy">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{t(item.nameKey)}</strong>
                        <span className="shop-rarity">
                          {t(`shop.rarity.${item.rarity}`)}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        {isEquipped ? (
                          <>
                            <Check className="size-3" />
                            {t('shop.equipped')}
                          </>
                        ) : isOwned ? (
                          t('shop.owned')
                        ) : item.price === null ? (
                          <>
                            <LockKeyhole className="size-3 shrink-0" />
                            {unlockText(item)}
                          </>
                        ) : (
                          <>
                            <Coins className="size-3 text-gold" />
                            {item.price?.toLocaleString(
                              locale === 'zh' ? 'zh-CN' : 'en-US',
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                );
              },
            )}
          </section>
          <aside
            className="shop-detail paper-texture rounded-3xl border bg-card p-5"
            aria-label={t('shop.preview')}
          >
            <p className="text-xs tracking-widest text-muted-foreground">
              {t('shop.preview')}
            </p>
            <div className="mt-4">
              <CosmeticPreview item={selected} />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <h2 className="text-xl font-semibold">{t(selected.nameKey)}</h2>
              <span className="shop-rarity" data-rarity={selected.rarity}>
                {t(`shop.rarity.${selected.rarity}`)}
              </span>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
              {t(selected.descKey)}
            </p>
            <div className="mt-5 border-t pt-4">
              {owned ? (
                <Button className="w-full" disabled={equipped || !!busy} aria-busy={busy === 'equip'} onClick={() => void equip(selected.id)}>
                  {equipped ? (
                    <Check className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {t(busy === 'equip' ? 'play.saving' : equipped ? 'shop.equipped' : 'shop.equip')}
                </Button>
              ) : price === null ? (
                <p className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm">
                  <LockKeyhole className="size-4 shrink-0 text-gold" />
                  {unlockText(selected)}
                </p>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={coins < price || !!busy}
                    onClick={() => {
                      setConfirm(true);
                      setError('');
                    }}
                  >
                    <Coins className="size-4" />
                    {formatMessage(locale, 'shop.buy', { price })}
                  </Button>
                  {coins < price && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {t('shop.insufficient')}
                    </p>
                  )}
                </>
              )}
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </aside>
        </div>
      </main>
      <Dialog open={confirm} onOpenChange={(open) => { if (!busy) setConfirm(open); }}>
        <DialogContent className="shop-dialog paper-texture rounded-3xl">
          <DialogTitle>{t('shop.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {formatMessage(locale, 'shop.confirmDescription', {
              item: t(selected.nameKey),
              price: price ?? 0,
              balance: coins - (price ?? 0),
            })}
          </DialogDescription>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setConfirm(false)}>
              {t('save.cancel')}
            </Button>
            <Button disabled={!!busy} aria-busy={busy === 'purchase'} onClick={async () => {
              if (mutationPending.current) return;
              mutationPending.current = true;
              setBusy('purchase');
              setError('');
              const itemId = selected.id;
              try {
                if (mode !== 'guest-local') await onlinePurchaseCosmetic(itemId);
                else {
                  const result = purchaseCosmetic(itemId);
                  if (result !== 'purchased' && result !== 'owned') {
                    setError(t(`shop.${result === 'locked' ? 'failed' : result}`));
                    return;
                  }
                }
                setConfirm(false);
                setAcquired(itemId);
              } catch (err) {
                setError(err instanceof HouseholdApiError ? t(err.messageKey) : t('shop.failed'));
              } finally { mutationPending.current = false; setBusy(null); }
            }}>
              {t(busy === 'purchase' ? 'play.saving' : 'shop.confirmBuy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={acquired !== null}
        onOpenChange={(open) => {
          if (!open) setAcquired(null);
        }}
      >
        <DialogContent className="shop-dialog paper-texture rounded-3xl text-center">
          <DialogTitle className="flex items-center justify-center gap-2">
            <Sparkles className="size-5 text-gold" />
            {t('shop.acquired')}
          </DialogTitle>
          <DialogDescription>
            {t(
              COSMETIC_DEFS.find((item) => item.id === acquired)?.nameKey ??
                selected.nameKey,
            )}
          </DialogDescription>
          <div className="cosmetic-acquired">
            <CosmeticPreview
              item={
                COSMETIC_DEFS.find((item) => item.id === acquired) ?? selected
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcquired(null)}>
              {t('shop.later')}
            </Button>
            <Button
              onClick={async () => {
                if (acquired) await equip(acquired);
                setAcquired(null);
              }}
            >
              {t('shop.equip')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
