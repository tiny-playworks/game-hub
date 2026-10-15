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
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const selected =
    COSMETIC_DEFS.find(({ id }) => id === selectedId) ?? COSMETIC_DEFS[0];
  const owned = cosmetics.owned.includes(selected.id);
  const equipped = cosmetics.equipped[selected.category] === selected.id;
  const price = selected.price;
  const equip = async (itemId: string) => {
    try {
      if (mode !== 'guest-local') await onlineEquipCosmetic(itemId);
      else equipCosmetic(itemId);
      setError('');
    } catch (err) {
      setError(err instanceof HouseholdApiError ? t(err.messageKey) : t('shop.failed'));
    }
  };
  return (
    <div className="venue-shop lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-360 px-4 py-7 sm:px-8">
        <div className="venue-page-heading">
          <h1 className="mt-2 text-3xl font-semibold">{t('shop.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('shop.subtitle')}
          </p>
        </div>
        <div className="shop-layout">
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
                <Button className="w-full" disabled={equipped} onClick={() => void equip(selected.id)}>
                  {equipped ? (
                    <Check className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {t(equipped ? 'shop.equipped' : 'shop.equip')}
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
                    disabled={coins < price}
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
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="shop-dialog paper-texture rounded-3xl">
          <DialogTitle>{t('shop.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {formatMessage(locale, 'shop.confirmDescription', {
              item: t(selected.nameKey),
              price: price ?? 0,
              balance: coins - (price ?? 0),
            })}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('save.cancel')}
            </Button>
            <Button
              onClick={async () => {
                setConfirm(false);
                if (mode !== 'guest-local') {
                  try {
                    await onlinePurchaseCosmetic(selected.id);
                    setAcquired(selected.id);
                    setError('');
                  } catch (err) {
                    if (err instanceof HouseholdApiError) {
                      setError(t(err.messageKey));
                    } else {
                      setError(t('shop.failed'));
                    }
                  }
                } else {
                  const result = purchaseCosmetic(selected.id);
                  if (result === 'purchased') setAcquired(selected.id);
                  else if (result !== 'owned')
                    setError(
                      t(`shop.${result === 'locked' ? 'failed' : result}`),
                    );
                }
              }}
            >
              {t('shop.confirmBuy')}
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
