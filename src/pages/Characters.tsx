import { Check, ChevronRight, Heart, LockKeyhole, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GPT_BANNER_ASSETS } from '@/assets/gptAssets';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { useLocale } from '@/contexts/LocaleContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { CHARACTER_DEFS } from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

export default function Characters() {
  const { t } = useLocale();
  const state = useCharacters();
  const unlockedCount = CHARACTER_DEFS.filter((c) =>
    state.unlockedCharacterIds.includes(c.id),
  ).length;
  const encounteredCount = CHARACTER_DEFS.filter(
    (c) =>
      state.unlockedCharacterIds.includes(c.id) ||
      state.encounteredCharacterIds.includes(c.id),
  ).length;

  return (
    <div className="venue-characters lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-8">
        <section className="salon-page-banner salon-page-banner--characters">
          {GPT_BANNER_ASSETS.journey ? (
            <img
              src={GPT_BANNER_ASSETS.journey}
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
                MAHJONG SALON ROSTER · 雀庄十人众
              </p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
                {t('characters.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e8e3d5]">
                {t('characters.subtitle')}
              </p>
            </div>
            <div className="salon-banner-actions flex flex-wrap items-center gap-2">
              <span className="salon-banner-pill">
                {t('characters.unlocked') === 'characters.unlocked'
                  ? `已结识 ${encounteredCount}/${CHARACTER_DEFS.length} · 已解锁 ${unlockedCount}/${CHARACTER_DEFS.length}`
                  : `${unlockedCount} / ${CHARACTER_DEFS.length}`}
              </span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {CHARACTER_DEFS.map((character, index) => {
            const unlocked = state.unlockedCharacterIds.includes(character.id);
            const encountered =
              unlocked || state.encounteredCharacterIds.includes(character.id);
            const isActive = state.activeCharacterId === character.id;
            const affinity = state.affinityByCharacter[character.id] ?? 0;
            const content = (
              <>
                <div className="salon-character-stage felt-surface relative flex h-56 items-end justify-center overflow-hidden sm:h-68">
                  <span className="salon-character-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <CharacterPortraitSlot
                    character={character}
                    size="xl"
                    label={
                      encountered
                        ? t(character.nameKey)
                        : t('characters.unknown')
                    }
                    className={cn(
                      'h-full! w-full! transition-transform duration-300 group-hover:scale-[1.03]',
                      !encountered && 'character-silhouette',
                    )}
                  />
                  {isActive && unlocked ? (
                    <span className="salon-character-badge salon-character-badge--active">
                      <Check className="size-3" />
                      {t('profile.companion.active')}
                    </span>
                  ) : !unlocked ? (
                    <span className="salon-character-badge salon-character-badge--locked">
                      <LockKeyhole className="size-3" />
                      {t(
                        encountered ? 'characters.locked' : 'characters.unmet',
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="truncate text-lg font-semibold">
                          {encountered ? t(character.nameKey) : '???'}
                        </h2>
                        {encountered ? (
                          <span className="shrink-0 rounded-full border border-[#cbb391]/55 bg-[#172a3a]/8 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                            {t(`character.rank.${character.rankBand}`)}
                          </span>
                        ) : null}
                      </div>
                      {encountered && (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {encountered
                        ? t(character.taglineKey)
                        : t('characters.meetHint')}
                    </p>
                  </div>
                  {encountered && (
                    <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                      <p className="flex items-center justify-between text-xs text-primary">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Heart className="size-3 fill-current" />
                          {t('characters.affinity')}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {affinity} / 50
                        </span>
                      </p>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, affinity * 2)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
            return encountered ? (
              <Link
                key={character.id}
                to={`/characters/${character.id}`}
                data-character-id={character.id}
                data-character-status={unlocked ? 'unlocked' : 'encountered'}
                className="salon-character-card group paper-texture flex flex-col overflow-hidden rounded-3xl border bg-card transition-all"
              >
                {content}
              </Link>
            ) : (
              <article
                key={character.id}
                data-character-id={character.id}
                data-character-status="unmet"
                className="salon-character-card is-unmet paper-texture flex flex-col overflow-hidden rounded-3xl border bg-card"
              >
                {content}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
