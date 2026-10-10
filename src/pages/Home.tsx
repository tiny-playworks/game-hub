import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Coins,
  Crown,
  Gamepad2,
  Leaf,
  Play,
  ScrollText,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { PlayerAvatar } from '@/components/home/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { WalletBadge } from '@/components/WalletBadge';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import {
  checkinToday,
  ensureCheckinState,
  getBeijingDateKey,
} from '@/lib/checkin';
import { ensureDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import { getRecentGrowthFeed } from '@/lib/growthFeed';
import {
  getCharacterAffinityStage,
  getCharacterById,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import { getPlayerProfile, updatePlayerProfile } from '@/lib/playerProfile';
import { getTitleById, resolveActiveTitle } from '@/lib/titles';
import { cn } from '@/lib/utils';
import { ensureWeeklyTaskState } from '@/lib/weeklyTasks';
import {
  hasResumableMatch,
  useRiichiStore,
} from '@/pages/mahjong/japanese/store/riichiMatchStore';

const Home = () => {
  const { t } = useLocale();
  const isActive = useRiichiStore(
    (state) =>
      state.view === 'game' &&
      state.match !== null &&
      state.match.status !== 'matchEnd',
  );
  const [profile, setProfile] = useState(getPlayerProfile);
  const [daily, setDaily] = useState(ensureDailyTaskState);
  const [weekly, setWeekly] = useState(ensureWeeklyTaskState);
  const [checkin, setCheckin] = useState(ensureCheckinState);
  const [growth, setGrowth] = useState(getGrowthOverview);
  const [characters, setCharacters] = useState(
    () => syncPlayerCharacterUnlocks().state,
  );
  const [feed, setFeed] = useState(() => getRecentGrowthFeed(3));
  const [categoryId, setCategoryId] = useState('mini');
  const character = getCharacterById(characters.activeCharacterId);
  const title = getTitleById(
    resolveActiveTitle(profile.activeTitle, growth.totalPoints),
  );
  const signedToday = checkin.dateKey === getBeijingDateKey();
  const canResume = isActive || hasResumableMatch();
  const refresh = useCallback(() => {
    setDaily(ensureDailyTaskState());
    setWeekly(ensureWeeklyTaskState());
    setCheckin(ensureCheckinState());
    const nextGrowth = getGrowthOverview();
    setGrowth(nextGrowth);
    const current = getPlayerProfile();
    const nextTitle = resolveActiveTitle(
      current.activeTitle,
      nextGrowth.totalPoints,
    );
    setProfile(
      nextTitle === current.activeTitle
        ? current
        : updatePlayerProfile({ activeTitle: nextTitle }),
    );
    setCharacters(syncPlayerCharacterUnlocks().state);
    setFeed(getRecentGrowthFeed(3));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="lobby-page min-h-screen bg-background text-foreground">
      <header className="border-b border-wood/20 bg-card/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <Link
            to="/profile"
            className="flex min-w-0 items-center gap-3"
            aria-label={t('home.quick.profile')}
          >
            <PlayerAvatar profile={profile} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {profile.nickname}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {title ? t(title.nameKey) : t('profile.titles.none')}
              </p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <WalletBadge />
            <Button
              variant="outline"
              disabled={signedToday}
              onClick={() => {
                checkinToday();
                refresh();
              }}
            >
              <CalendarCheck className="size-4" />
              {t(
                signedToday
                  ? 'profile.checkin.checkedIn'
                  : 'home.quick.checkin',
              )}
            </Button>
            <Link
              to="/achievements"
              className="flex size-9 items-center justify-center rounded-full border bg-card text-primary"
              aria-label={t('home.quick.achievements')}
              title={t('home.quick.achievements')}
            >
              <Trophy className="size-4" />
            </Link>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-primary">
              <Leaf className="size-3.5" />
              {t('lobby.brand')}
            </p>
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
          <article className="felt-surface relative flex min-h-[400px] flex-col overflow-hidden rounded-[28px] border border-gold/40 p-6 text-paper">
            <div className="flex items-center justify-between text-xs text-paper/70">
              <span>{t('lobby.companion')}</span>
              <span className="rounded-full border border-gold/40 px-2.5 py-1 text-gold">
                {t('home.characters.currentStage')}{' '}
                {getCharacterAffinityStage(
                  characters.affinityByCharacter[character.id] ?? 0,
                )}
              </span>
            </div>
            <div className="relative my-7 flex flex-1 items-center justify-center">
              <span
                className="lobby-portrait-ring absolute size-56 rounded-full border border-gold/20"
                aria-hidden="true"
              />
              <CharacterPortraitSlot
                character={character}
                size="lg"
                label={`${t(`lobby.character.${character.id}.name`)} · ${t('character.portrait.placeholder')}`}
                className="h-64 w-44 rounded-t-[80px] rounded-b-3xl border-gold/30 text-6xl shadow-xl"
              />
            </div>
            <div className="relative">
              <p className="text-xs tracking-[0.2em] text-gold">
                {t('lobby.yourCompanion')}
              </p>
              <h2 className="mt-2 text-3xl">
                {t(`lobby.character.${character.id}.name`)}
              </h2>
              <p className="mt-3 border-l-2 border-gold/60 pl-3 text-sm leading-7 text-paper/85">
                {t(`lobby.character.${character.id}.line`)}
              </p>
              <Link
                to="/profile"
                className="mt-5 inline-flex items-center gap-2 text-xs text-paper/70 hover:text-gold"
              >
                {t('home.characters.viewProfile')}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </article>
          <div className="flex min-w-0 flex-col gap-4">
            <article className="paper-texture flex flex-1 flex-col rounded-[28px] border border-wood/25 bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-[0.16em] text-muted-foreground">
                  {t('lobby.rankedLabel')}
                </span>
                <Crown className="size-5 text-wood" />
              </div>
              <div className="my-6 flex flex-1 flex-col items-center justify-center text-center">
                <div className="lobby-rank-emblem flex size-24 items-center justify-center rounded-[28px] border border-gold/50 bg-gold/10">
                  <Crown className="size-11 text-wood" strokeWidth={1.25} />
                </div>
                <h2 className="mt-5 text-2xl font-semibold">
                  {t('lobby.rankedSoon')}
                </h2>
                <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
                  {t('lobby.rankedDescription')}
                </p>
              </div>
              <Button disabled size="lg" className="w-full rounded-xl">
                <Crown className="size-4" />
                {t('lobby.startRanked')}
              </Button>
            </article>
            <article className="felt-surface rounded-[24px] border border-gold/30 p-5 text-paper">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-paper/10">
                  <Play className="size-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('lobby.freePlay')}
                  </h2>
                  <p className="mt-1 text-xs text-paper/65">
                    {t('lobby.freeDescription')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
          </div>
          <aside className="paper-texture rounded-[28px] border border-wood/25 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ScrollText className="size-4 text-primary" />
                {t('home.daily.title')}
              </h2>
              <span className="text-xs text-muted-foreground">
                {daily.items.filter((task) => task.completed).length}/3
              </span>
            </div>
            <ul className="mt-3 divide-y">
              {daily.items.map((task) => (
                <li key={task.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t(task.titleKey)}</p>
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
                    {task.completed ? ` · ${t('home.daily.claimed')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <h3 className="mt-3 border-t pt-4 text-sm font-semibold">
              {t('lobby.weekly')}
            </h3>
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
                </div>
              ))}
            </div>
            <div className="mt-5 border-t pt-4">
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
            </div>
          </aside>
        </section>
        <section className="mt-8" aria-labelledby="arcade-heading">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Gamepad2 className="size-5 text-wood" />
              <h2 id="arcade-heading" className="text-xl font-semibold">
                {t('lobby.arcade')}
              </h2>
              <span className="text-xs text-muted-foreground">
                16 {t('lobby.games')}
              </span>
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
                  className="paper-texture group flex w-[230px] shrink-0 flex-col rounded-[22px] border border-wood/20 bg-card p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <Gamepad2 className="size-5 text-primary" />
                    <span
                      role="img"
                      aria-label={`${t('lobby.difficulty')} ${game.difficulty}`}
                      className="text-xs tracking-widest text-wood"
                    >
                      {'★'.repeat(game.difficulty)}
                      {'☆'.repeat(4 - game.difficulty)}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">
                    {t(`game.${game.id}.name`)}
                  </h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {t(`game.${game.id}.description`)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground"
                      >
                        {t(`game.tag.${tag}`)}
                      </span>
                    ))}
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
