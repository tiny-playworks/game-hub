import { ChevronRight, Heart, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { useLocale } from '@/contexts/LocaleContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { CHARACTER_DEFS } from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

export default function Characters() {
  const { t } = useLocale();
  const state = useCharacters();
  return (
    <div className="venue-characters lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <h1 className="mt-2 text-3xl font-semibold">{t('characters.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('characters.subtitle')}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CHARACTER_DEFS.map((character) => {
            const unlocked = state.unlockedCharacterIds.includes(character.id);
            const encountered =
              unlocked || state.encounteredCharacterIds.includes(character.id);
            const content = (
              <>
                <div className="felt-surface relative flex h-52 items-end justify-center overflow-hidden rounded-t-3xl sm:h-64">
                  <CharacterPortraitSlot
                    character={character}
                    size="xl"
                    label={
                      encountered
                        ? t(character.nameKey)
                        : t('characters.unknown')
                    }
                    className={cn(
                      '!h-full !w-full',
                      !encountered && 'character-silhouette',
                    )}
                  />
                  {!unlocked && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-paper/20 bg-black/30 px-2 py-1 text-xs text-paper">
                      <LockKeyhole className="size-3" />
                      {t(
                        encountered ? 'characters.locked' : 'characters.unmet',
                      )}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {encountered ? t(character.nameKey) : '???'}
                    </h2>
                    {encountered && (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {encountered
                      ? t(character.taglineKey)
                      : t('characters.meetHint')}
                  </p>
                  {encountered && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                      <Heart className="size-3" />
                      {t('characters.affinity')}{' '}
                      {state.affinityByCharacter[character.id] ?? 0} / 50
                    </p>
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
                className="paper-texture overflow-hidden rounded-3xl border bg-card transition-shadow hover:shadow-lg"
              >
                {content}
              </Link>
            ) : (
              <article
                key={character.id}
                data-character-id={character.id}
                data-character-status="unmet"
                className="paper-texture overflow-hidden rounded-3xl border bg-card"
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
