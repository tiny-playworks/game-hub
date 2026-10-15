import {
  ArrowLeft,
  Check,
  Heart,
  LockKeyhole,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { CharacterOutfitPicker } from '@/components/characters/CharacterOutfitPicker';
import { CharacterStoryPlayer } from '@/components/characters/CharacterStoryPlayer';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { type CharacterStory, getCharacterStory } from '@/lib/characterStories';
import { COSMETIC_DEFS } from '@/lib/cosmetics';
import { formatMessage } from '@/lib/i18n';
import {
  getThemeChallengeState,
  THEME_CHALLENGES_CHANGED_EVENT,
} from '@/lib/themeChallenges';
import {
  CHARACTER_AFFINITY_THRESHOLDS,
  CHARACTER_DEFS,
  type CharacterExpression,
  setActiveCharacter,
} from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

export default function CharacterProfile() {
  const { id } = useParams();
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const state = useCharacters();
  const [challengeState, setChallengeState] = useState(getThemeChallengeState);
  const [expression, setExpression] = useState<CharacterExpression>('normal');
  const [story, setStory] = useState<CharacterStory | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => setChallengeState(getThemeChallengeState());
    window.addEventListener(THEME_CHALLENGES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(THEME_CHALLENGES_CHANGED_EVENT, refresh);
  }, [household?.snapshot?.revision]);
  const character = CHARACTER_DEFS.find((item) => item.id === id);
  const challengeStory = character ? getCharacterStory(character.id, 4) : undefined;
  const storySetUnlocked = challengeState.completedIds.length === 3;
  const known =
    character &&
    (state.unlockedCharacterIds.includes(character.id) ||
      state.encounteredCharacterIds.includes(character.id));
  if (!character || !known)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p>{t('characters.meetHint')}</p>
        <Link className="text-primary" to="/characters">
          {t('characters.back')}
        </Link>
      </main>
    );
  const journeyStageId = character.id === 'aoi'
    ? 'aoi-balance'
    : character.id === 'rin'
      ? 'rin-tempo'
      : character.id === 'mio'
        ? 'mio-defense'
        : null;
  const affinity = state.affinityByCharacter[character.id] ?? 0;
  const stage = state.rewardStageByCharacter[character.id] ?? 0;
  const encounters = state.encountersByCharacter[character.id] ?? {
    matches: 0,
    playerAbove: 0,
  };
  const unlocked = state.unlockedCharacterIds.includes(character.id);
  const active = state.activeCharacterId === character.id;
  return (
    <div className="venue-character-profile lobby-page min-h-screen bg-background text-foreground">
      <header className="venue-breadcrumb">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            to="/characters"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('characters.back')}
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[340px_1fr]">
        <section className="felt-surface rounded-3xl border border-gold/30 p-5 text-paper">
          <div className="flex justify-center">
            <CharacterPortraitSlot
              character={character}
              expression={expression}
              size="xl"
              label={t(character.nameKey)}
              className="h-96! w-full!"
            />
          </div>
          <fieldset
            className="mt-4 flex justify-center gap-2"
            aria-label={t('characters.expressions')}
          >
            {(['normal', 'happy', 'frustrated'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-full border border-paper/20 px-3 py-1.5 text-xs',
                  expression === value && 'bg-paper/15 text-gold',
                )}
                aria-pressed={expression === value}
                onClick={() => setExpression(value)}
              >
                {t(`characters.expression.${value}`)}
              </button>
            ))}
          </fieldset>
          <p className="mt-5 text-center text-sm text-paper/70">
            {t(character.taglineKey)}
          </p>
        </section>
        <div className="space-y-5">
          <CharacterOutfitPicker character={character} />
          <section className="paper-texture rounded-3xl border bg-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{t(character.nameKey)}</h1>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {t(`character.rank.${character.rankBand}`)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {character.styleTagKeys.map((key) => (
                <span
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
                  key={key}
                >
                  {t(key)}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {character.bioKey && t(character.bioKey)}
            </p>
            <Button
              className="mt-5"
              disabled={!unlocked || active}
              onClick={async () => {
                try {
                  if (household?.currentMember)
                    await household.selectCharacter(character.id);
                  else setActiveCharacter(character.id);
                  setError('');
                } catch {
                  setError(t('shop.failed'));
                }
              }}
            >
              {active ? (
                <Check className="size-4" />
              ) : !unlocked ? (
                <LockKeyhole className="size-4" />
              ) : null}
              {t(
                active
                  ? 'profile.companion.active'
                  : unlocked
                    ? 'profile.companion.setActive'
                    : 'profile.companion.locked',
              )}
            </Button>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {journeyStageId ? (
              <Button asChild variant="outline" className="mt-3">
                <Link to={`/journey?stage=${journeyStageId}`}>
                  <Sparkles className="mr-1.5 size-4" />{t('journey.characterEntry')}
                </Link>
              </Button>
            ) : null}
          </section>
          <section className="paper-texture rounded-3xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Heart className="size-4 text-rose-400" />
                {t('characters.affinity')}
              </h2>
              <span className="text-sm tabular-nums text-primary">
                {affinity} / 50
              </span>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t('characters.affinity')}
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={Math.min(50, affinity)}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, affinity * 2)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {t('affinity.rules')}
            </p>
            <div className="affinity-timeline mt-5">
              {CHARACTER_AFFINITY_THRESHOLDS.map((threshold, index) => {
                const rewardStage = index + 1;
                const reached = stage >= rewardStage;
                const reward = COSMETIC_DEFS.find(
                  (item) =>
                    item.unlock?.type === 'affinity' &&
                    item.unlock.characterId === character.id &&
                    item.unlock.stage === rewardStage,
                );
                const chapter = rewardStage <= 3
                  ? getCharacterStory(character.id, rewardStage)
                  : undefined;
                return (
                  <article
                    className={cn('affinity-node', reached && 'is-unlocked')}
                    key={threshold}
                    data-affinity-stage={rewardStage}
                  >
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {reached ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <LockKeyhole className="size-3" />
                      )}
                      {formatMessage(locale, 'affinity.threshold', {
                        value: threshold,
                      })}
                    </p>
                    <h3 className="mt-3 text-sm font-semibold">
                      {t(`affinity.reward.${rewardStage}`)}
                    </h3>
                    {chapter && (
                      <Button
                        className="mt-3 h-auto w-full whitespace-normal px-2 text-xs"
                        size="sm"
                        variant="outline"
                        disabled={!reached}
                        onClick={() => setStory(chapter)}
                      >
                        <ScrollText className="size-3 shrink-0" />
                        {t(chapter.titleKey)}
                      </Button>
                    )}
                    {rewardStage === 2 && (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {t('affinity.extraLines')}
                      </p>
                    )}
                    {reward && (
                      <Link
                        to={`/shop?item=${reward.id}`}
                        className="mt-3 flex items-center gap-1 text-xs text-primary"
                      >
                        <Sparkles className="size-3 shrink-0" />
                        {t(reward.nameKey)}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="paper-texture rounded-3xl border bg-card p-6">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-primary" />
              <h2 className="text-lg font-semibold">
                {t('challenge.storySetTitle')}
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('challenge.storySetDescription')}
            </p>
            {storySetUnlocked ? (
              unlocked ? (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => challengeStory && setStory(challengeStory)}
                  disabled={!challengeStory}
                >
                  <ScrollText className="size-4" />
                  {t(challengeStory?.titleKey ?? 'challenge.storySetTitle')}
                </Button>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyhole className="size-4" />
                  {t('challenge.characterUnlockRequired')}
                </p>
              )
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {formatMessage(locale, 'challenge.storyProgress', {
                    completed: challengeState.completedIds.length,
                    total: 3,
                  })}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/">{t('challenge.viewGoals')}</Link>
                </Button>
              </div>
            )}
          </section>
          <section className="paper-texture rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {t('characters.encounters')}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  {t('characters.matches')}
                </p>
                <strong className="mt-2 block text-2xl tabular-nums">
                  {encounters.matches}
                </strong>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  {t('characters.aboveRate')}
                </p>
                <strong className="mt-2 block text-2xl tabular-nums">
                  {encounters.matches
                    ? `${Math.round((encounters.playerAbove / encounters.matches) * 100)}%`
                    : '—'}
                </strong>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('characters.completedOnly')}
            </p>
          </section>
        </div>
      </main>
      {story && (
        <CharacterStoryPlayer
          key={story.id}
          story={story}
          onClose={() => setStory(null)}
        />
      )}
    </div>
  );
}
