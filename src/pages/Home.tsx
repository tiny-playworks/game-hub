import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Coins,
  Gamepad2,
  Play,
  ScrollText,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { PersonalBest } from '@/components/game/PersonalBest';
import { VenueGameGlyph } from '@/components/home/VenueGameGlyph';
import { CuratedRotationPanel } from '@/components/home/CuratedRotationPanel';
import { FamilyFeedLobbyPanel } from '@/components/home/FamilyFeedLobbyPanel';
import { ThemeChallengePanel } from '@/components/home/ThemeChallengePanel';
import { RankedLobbyCard } from '@/components/ranked/RankedLobbyCard';
import { TaskClaimButton } from '@/components/TaskClaimButton';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import { useCharacters } from '@/hooks/useCosmetics';
import {
  checkinToday,
  getCheckinState,
  getBeijingDateKey,
} from '@/lib/checkin';
import { getDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import { getRecentGrowthFeed } from '@/lib/growthFeed';
import {
  type CharacterExpression,
  getCharacterAffinityStage,
  getCharacterById,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import { getPlayerProfile, updatePlayerProfile } from '@/lib/playerProfile';
import { getRankedState } from '@/lib/ranked';
import { resolveActiveTitle } from '@/lib/titles';
import { cn } from '@/lib/utils';
import { getWeeklyTaskState } from '@/lib/weeklyTasks';
import {
  hasResumableMatch,
  useRiichiStore,
} from '@/pages/mahjong/japanese/store/riichiMatchStore';

const Home = () => {
  const { t } = useLocale();
  const household = useOptionalHousehold();
  const memberMode = Boolean(household?.currentMember);
  const isActive = useRiichiStore(
    (state) =>
      state.view === 'game' &&
      state.match !== null &&
      state.match.status !== 'matchEnd',
  );
  const memberMatchStatus = useRiichiStore((state) => state.match?.status);
  const [daily, setDaily] = useState(getDailyTaskState);
  const [weekly, setWeekly] = useState(getWeeklyTaskState);
  const [checkin, setCheckin] = useState(getCheckinState);
  const [checkinError, setCheckinError] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const characters = useCharacters();
  const [expression, setExpression] = useState<CharacterExpression>('normal');
  const [feed, setFeed] = useState(() => getRecentGrowthFeed(3));
  const [categoryId, setCategoryId] = useState('mini');
  const character = getCharacterById(characters.activeCharacterId);
  const signedToday = checkin.dateKey === getBeijingDateKey();
  const canResume =
    isActive ||
    (memberMode
      ? memberMatchStatus !== undefined && memberMatchStatus !== 'matchEnd'
      : hasResumableMatch());
  const refresh = useCallback(() => {
    setDaily(getDailyTaskState());
    setWeekly(getWeeklyTaskState());
    setCheckin(getCheckinState());
    const nextGrowth = getGrowthOverview();
    const current = getPlayerProfile();
    const nextTitle = resolveActiveTitle(
      current.activeTitle,
      nextGrowth.totalPoints,
    );
    if (nextTitle !== current.activeTitle)
      updatePlayerProfile({ activeTitle: nextTitle });
    if (!memberMode) syncPlayerCharacterUnlocks(getRankedState().peak.band);
    setFeed(getRecentGrowthFeed(3));
  }, [memberMode]);
  useEffect(() => {
    refresh();
  }, [refresh, household?.snapshot?.revision]);

  return (
    <div className="venue-home lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-360 px-4 py-6 sm:px-8 sm:py-8">
        <div className="venue-page-heading">
          <div>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              {t('lobby.title')}
            </h1>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {t('lobby.welcome')}
          </p>
        </div>
        <section
          className="lobby-main-grid grid gap-5"
          aria-label={t('lobby.title')}
        >
          <article className="venue-companion felt-surface relative flex min-h-100 flex-col overflow-hidden rounded-[28px] border border-gold/40 p-6 text-paper">
            <div className="flex items-center justify-between text-xs text-paper/70">
              <span>{t('lobby.companion')}</span>
              <span className="rounded-full border border-gold/40 px-2.5 py-1 text-gold">
                {t('home.characters.currentStage')}{' '}
                {getCharacterAffinityStage(
                  characters.affinityByCharacter[character.id] ?? 0,
                )}
              </span>
            </div>
            <Link
              to={`/characters/${character.id}`}
              aria-label={t('home.characters.viewProfile')}
              className="venue-companion-portrait relative my-7 flex flex-1 items-center justify-center"
            >
              <span
                className="lobby-portrait-ring absolute size-56 rounded-full border border-gold/20"
                aria-hidden="true"
              />
              <CharacterPortraitSlot
                character={character}
                size="xl"
                expression={expression}
                label={t(character.nameKey)}
                className="max-w-full"
              />
            </Link>
            {(characters.rewardStageByCharacter[character.id] ?? 0) >= 2 && (
              <button
                type="button"
                className="mx-auto -mt-4 mb-4 rounded-full border border-paper/20 px-3 py-1.5 text-xs text-paper/70"
                onClick={() => {
                  const values: CharacterExpression[] = [
                    'normal',
                    'happy',
                    'frustrated',
                  ];
                  setExpression(
                    values[(values.indexOf(expression) + 1) % values.length],
                  );
                }}
              >
                {t('characters.cycleExpression')}
              </button>
            )}
            <div className="venue-companion-copy relative">
              <p className="text-xs tracking-[0.2em] text-gold">
                {t('lobby.yourCompanion')}
              </p>
              <h2 className="mt-2 text-3xl">{t(character.nameKey)}</h2>
              <p className="mt-3 border-l-2 border-gold/60 pl-3 text-sm leading-7 text-paper/85">
                {t(character.taglineKey)}
              </p>
              <Link
                to={`/characters/${character.id}`}
                className="mt-5 inline-flex items-center gap-2 text-xs text-paper/70 hover:text-gold"
              >
                {t('home.characters.viewProfile')}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </article>
          <div className="venue-modes flex min-w-0 flex-col gap-4">
            <RankedLobbyCard />
            <article className="venue-free felt-surface rounded-3xl border border-gold/30 p-5 text-paper">
              <div className="flex items-center gap-3">
                <div className="venue-free-icon flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-paper/10">
                  <Play className="size-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('lobby.freePlay')}
                  </h2>
                </div>
              </div>
              <div className="venue-free-actions mt-4 flex flex-wrap gap-2">
                <p>{t('lobby.freeDescription')}</p>
                <Button
                  asChild
                  className="flex-1 rounded-xl bg-gold text-[#24362a] hover:bg-gold/90"
                >
                  <Link to="/game/mahjong-japanese">
                    {t('lobby.freePlay')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {canResume ? (
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 rounded-xl border-paper/25 bg-transparent text-paper hover:bg-paper/10 hover:text-paper"
                  >
                    <Link
                      to={
                        isActive
                          ? '/game/mahjong-japanese'
                          : '/game/mahjong-japanese?resume=1'
                      }
                    >
                      {t('lobby.resume')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </article>
            <article className="venue-free venue-journey felt-surface rounded-3xl border border-gold/30 p-5 text-paper">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="venue-free-icon flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-paper/10">
                    <ScrollText className="size-5 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {t('journey.title')}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-paper/70">
                      {t('journey.lobbyDescription')}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="shrink-0 rounded-xl border-paper/25 bg-transparent text-paper hover:bg-paper/10 hover:text-paper"
                >
                  <Link to="/journey">
                    {t('journey.enter')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </article>
          </div>
          <aside className="venue-task-stack">
            <ThemeChallengePanel />
            <section className="venue-task-panel venue-daily">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <ScrollText className="size-4 text-primary" />
                  {t('home.daily.title')}
                </h2>
                <div className="venue-task-actions">
                  <span className="text-xs text-muted-foreground">
                    {daily.items.filter((task) => task.completed).length}/3
                  </span>
                  <Button
                    variant="outline"
                    className="venue-checkin"
                    disabled={signedToday || checkinBusy}
                    onClick={async () => {
                      setCheckinBusy(true);
                      try {
                        if (memberMode)
                          await household!.performProgressAction({
                            type: 'checkin',
                          });
                        else checkinToday();
                        setCheckinError(false);
                        refresh();
                      } catch {
                        setCheckinError(true);
                      } finally {
                        setCheckinBusy(false);
                      }
                    }}
                  >
                    <CalendarCheck className="size-4" />
                    {t(
                      signedToday
                        ? 'profile.checkin.checkedIn'
                        : 'home.quick.checkin',
                    )}
                  </Button>
                  {checkinError && (
                    <span role="alert" className="text-xs text-destructive">
                      {t('save.failed')}
                    </span>
                  )}
                </div>
              </div>
              <ul className="mt-3 divide-y">
                {daily.items.map((task) => (
                  <li key={task.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{t(task.titleKey)}</p>
                      <div
                        className="venue-task-meter"
                        role="progressbar"
                        aria-label={t(task.titleKey)}
                        aria-valuemin={0}
                        aria-valuemax={task.target}
                        aria-valuenow={Math.min(task.progress, task.target)}
                      >
                        <i
                          style={{
                            width: `${Math.min(100, (task.progress / Math.max(1, task.target)) * 100)}%`,
                          }}
                        />
                      </div>
                      {task.completed ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {task.progress}/{task.target}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(task.descKey)}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                      <Coins className="size-3" />
                      40 {t('wallet.coins')} · {task.rewardPoints}{' '}
                      {t('lobby.growthPoints')}
                      {task.claimed ? ` · ${t('home.daily.claimed')}` : ''}
                    </p>
                    {!task.claimed && (
                      <TaskClaimButton
                        task={task}
                        scope="daily"
                        onClaim={refresh}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="venue-task-panel venue-weekly">
              <h3 className="text-sm font-semibold">{t('lobby.weekly')}</h3>
              <div className="mt-3 space-y-3">
                {weekly.items.map((task) => (
                  <div key={task.id}>
                    <div className="flex justify-between gap-2 text-xs">
                      <span>{t(task.titleKey)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {task.progress}/{task.target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted">
                      <div
                        className="h-1 rounded-full bg-primary"
                        style={{
                          width: `${(task.progress / task.target) * 100}%`,
                        }}
                      />
                    </div>
                    <TaskClaimButton
                      task={task}
                      scope="weekly"
                      onClaim={refresh}
                    />
                  </div>
                ))}
              </div>
            </section>
            <section className="venue-task-panel venue-growth">
              <h3 className="text-sm font-semibold">
                {t('home.recentGrowth.title')}
              </h3>
              {feed.length ? (
                <ul className="mt-2 space-y-2">
                  {feed.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span className="truncate">{t(item.titleKey)}</span>
                      {item.points ? (
                        <span className="shrink-0 text-primary">
                          +{item.points}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t('home.recentGrowth.empty')}
                </p>
              )}
            </section>
            <FamilyFeedLobbyPanel />
          </aside>
        </section>
        <CuratedRotationPanel />
        <section className="venue-arcade mt-8" aria-labelledby="arcade-heading">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Gamepad2 className="size-5 text-wood" />
              <h2 id="arcade-heading" className="text-xl font-semibold">
                {t('lobby.arcade')}
              </h2>
              <span className="text-xs text-muted-foreground">
                16 {t('lobby.games')}
              </span>
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-foreground hover:bg-gold/20"
              >
                {t('venue.nav.leaderboard')}
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div
              role="tablist"
              aria-label={t('lobby.arcade')}
              className="flex gap-1 rounded-full border bg-card p-1"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  id={`arcade-tab-${category.id}`}
                  type="button"
                  role="tab"
                  aria-controls="arcade-panel"
                  aria-selected={categoryId === category.id}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs transition',
                    categoryId === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  onClick={() => setCategoryId(category.id)}
                >
                  {t(`category.${category.id}.name`)}
                </button>
              ))}
            </div>
          </div>
          <div
            id="arcade-panel"
            role="tabpanel"
            aria-labelledby={`arcade-tab-${categoryId}`}
            className="mt-4 flex gap-4 overflow-x-auto pb-3"
          >
            {games
              .filter((game) => game.categoryId === categoryId)
              .map((game) => (
                <Link
                  key={game.id}
                  to={game.path}
                  className="venue-arcade-entry paper-texture group flex w-57.5 shrink-0 flex-col rounded-[22px] border border-wood/20 bg-card p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                >
                  <VenueGameGlyph gameId={game.id} />
                  <div className="venue-arcade-copy">
                    <div className="flex items-center justify-between gap-2">
                      <h3>{t(`game.${game.id}.name`)}</h3>
                      <span
                        role="img"
                        aria-label={`${t('lobby.difficulty')} ${game.difficulty}`}
                        className="venue-game-difficulty"
                      >
                        {'★'.repeat(game.difficulty)}
                      </span>
                    </div>
                    <p>{t(`game.${game.id}.description`)}</p>
                    <PersonalBest gameId={game.id} />
                    <span className="venue-game-link">
                      {t('common.startGame')}{' '}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
          </div>
          <Link
            to={`/category/${categoryId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
          >
            {t('lobby.viewCategory')}
            <ArrowRight className="size-3.5" />
          </Link>
        </section>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-wood/20 pt-5 text-xs text-muted-foreground">
          <span>{t('lobby.footer')}</span>
          <Link to="/profile">
            {t('save.title')}
            <ChevronRight className="ml-1 inline size-3" />
          </Link>
        </footer>
      </main>
    </div>
  );
};
export default Home;
