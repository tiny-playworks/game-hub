import { Check, Compass, ScrollText, Sparkles, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { ContinuePlaySection } from '@/components/home/ContinuePlaySection';
import { MainPlayerCard } from '@/components/home/MainPlayerCard';
import { QuickAccessPanel } from '@/components/home/QuickAccessPanel';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import { type DailyTaskState, ensureDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import { type GrowthFeedItem, getRecentGrowthFeed } from '@/lib/growthFeed';
import {
  getCharacterAffinityStage,
  getCharacterById,
  type PlayerCharacterState,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import {
  getPlayerProfile,
  type PlayerProfile,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import { getRecentMahjongEntry } from '@/lib/recentMahjong';
import { getTitleById, resolveActiveTitle } from '@/lib/titles';
import { cn } from '@/lib/utils';
import { useRiichiGameStore } from '@/pages/mahjong/japanese/store/riichiGameStore';

function formatGrowthFeedLine(
  item: GrowthFeedItem,
  t: (key: string) => string,
): string {
  if (item.type === 'character-stage') {
    const character = item.characterId
      ? getCharacterById(item.characterId)
      : null;
    return `${character?.name ?? t('growth.feed.characterFallback')} ${t('growth.feed.characterStageVerb')} ${item.stage ?? 0}`;
  }
  const title = t(item.titleKey);
  if (item.points && item.points > 0) {
    return `${title} +${item.points}`;
  }
  return title;
}

const categoryIconMap = {
  mini: Compass,
  board: ScrollText,
  poker: Sparkles,
} as const;

const Home = () => {
  const { t, locale } = useLocale();
  const view = useRiichiGameStore((state) => state.view);
  const game = useRiichiGameStore((state) => state.game);
  const matchEnd = useRiichiGameStore((state) => state.matchEnd);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() =>
    getPlayerProfile(),
  );
  const [dailyTaskState, setDailyTaskState] = useState<DailyTaskState>(() =>
    ensureDailyTaskState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const [recentFeed, setRecentFeed] = useState(() => getRecentGrowthFeed(4));
  const [characterState, setCharacterState] = useState<PlayerCharacterState>(
    () => syncPlayerCharacterUnlocks().state,
  );

  const recentMahjong = getRecentMahjongEntry();
  const isRiichiActive = Boolean(view === 'game' && game && !matchEnd);
  const riichiGame = games.find((item) => item.id === 'mahjong-japanese');
  const activeCharacter = getCharacterById(characterState.activeCharacterId);
  const activeAffinity =
    characterState.affinityByCharacter[activeCharacter.id] ?? 0;
  const activeStage = getCharacterAffinityStage(activeAffinity);

  const titleLabel = useMemo(() => {
    const resolvedId = resolveActiveTitle(
      playerProfile.activeTitle,
      growthOverview.totalPoints,
    );
    const def = getTitleById(resolvedId);
    return def ? t(def.nameKey) : t('profile.titles.none');
  }, [growthOverview.totalPoints, playerProfile.activeTitle, t]);

  const dailyTasksDisplay = useMemo(() => {
    const items = [...dailyTaskState.items];
    items.sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
    return items.slice(0, 3);
  }, [dailyTaskState.items]);

  const recentGrowthListPoints = useMemo(
    () => recentFeed.reduce((sum, item) => sum + (item.points ?? 0), 0),
    [recentFeed],
  );

  const recentGrowthCardMeta = useMemo(
    () =>
      t('home.recentGrowth.cardMeta')
        .replace('{{count}}', String(recentFeed.length))
        .replace('{{points}}', String(recentGrowthListPoints)),
    [recentFeed.length, recentGrowthListPoints, t],
  );

  const refreshHallState = useCallback(() => {
    setDailyTaskState(ensureDailyTaskState());
    const nextGrowth = getGrowthOverview();
    setGrowthOverview(nextGrowth);
    setRecentFeed(getRecentGrowthFeed(4));
    setCharacterState(syncPlayerCharacterUnlocks().state);

    const currentProfile = getPlayerProfile();
    const nextTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      nextTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: nextTitleId });
    setPlayerProfile(syncedProfile);
  }, []);

  useEffect(() => {
    refreshHallState();
  }, [refreshHallState]);

  const recentPlayedText = useMemo(() => {
    if (!recentMahjong) return '';
    return new Date(recentMahjong.playedAt).toLocaleString(
      locale === 'zh' ? 'zh-CN' : 'en-US',
      {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }, [locale, recentMahjong]);

  if (!riichiGame) return null;

  return (
    <div className="min-h-screen bg-home-ambient font-['Avenir_Next','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] text-slate-900 transition-colors duration-500 dark:text-slate-100">
      <header className="relative z-50 border-b border-emerald-100/30 bg-white/40 px-4 py-4 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/40">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.24em] text-emerald-700/80 uppercase dark:text-emerald-400/80">
              Game Hub
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {t('home.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              {t('home.subtitle')}
            </p>
          </div>
          <QuickAccessPanel
            withLocaleSwitcher
            onHallRefresh={refreshHallState}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:py-10">
        <section className="grid gap-4 md:grid-cols-2">
          <MainPlayerCard
            className="order-2 md:order-1"
            profile={playerProfile}
            titleLabel={titleLabel}
            totalPoints={growthOverview.totalPoints}
            unlockedAchievements={growthOverview.unlockedAchievements}
            unlockedCharacterCount={characterState.unlockedCharacterIds.length}
          />
          <ContinuePlaySection
            className="order-1 md:order-2"
            isRiichiActive={isRiichiActive}
            hasRecentMahjong={Boolean(recentMahjong)}
            recentPlayedText={recentPlayedText}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            className="home-glass-panel home-hover-lift rounded-[26px] p-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
            style={{ animationDelay: '150ms' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('home.daily.title')}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {dailyTaskState.dateKey}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {dailyTasksDisplay.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'rounded-2xl border p-3 transition-colors',
                    task.completed
                      ? 'border-emerald-200/90 bg-emerald-50/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'
                      : 'border-slate-100 bg-slate-50/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {task.completed ? (
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
                            title={t('home.daily.claimed')}
                          >
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </span>
                        ) : null}
                        <p
                          className={cn(
                            'text-sm font-medium',
                            task.completed
                              ? 'text-emerald-950'
                              : 'text-slate-900',
                          )}
                        >
                          {t(task.titleKey)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          task.completed
                            ? 'text-emerald-800/80'
                            : 'text-slate-500',
                        )}
                      >
                        {t(task.descKey)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-1 text-xs tabular-nums',
                        task.completed
                          ? 'bg-white/90 text-emerald-800 ring-1 ring-emerald-200/80'
                          : 'bg-white text-slate-600',
                      )}
                    >
                      {task.progress}/{task.target}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xs',
                      task.completed
                        ? 'font-medium text-emerald-800'
                        : 'text-slate-600',
                    )}
                  >
                    {task.completed
                      ? `${t('home.daily.settledPrefix')}${task.rewardPoints}`
                      : `${t('home.daily.pendingRewardPrefix')}${task.rewardPoints}`}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article
            className="home-glass-panel home-hover-lift rounded-[26px] p-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('home.recentGrowth.title')}
              </p>
              <span
                className="text-xs text-slate-500 dark:text-slate-400"
                title={t('home.recentGrowth.cardMetaHint')}
              >
                {recentGrowthCardMeta}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {recentFeed.length > 0 ? (
                recentFeed.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <p className="text-sm text-slate-900">
                      {formatGrowthFeedLine(item, t)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-500">
                  {t('home.recentGrowth.empty')}
                </div>
              )}
            </div>
          </article>

          <article
            className="home-glass-panel home-hover-lift rounded-[26px] p-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both md:col-span-2 xl:col-span-1"
            style={{ animationDelay: '250ms' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('home.characters.title')}
              </p>
              <UserRound className="size-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="mt-4 rounded-[24px] bg-[linear-gradient(135deg,#13243b,#173226_58%,#234036)] p-4 text-white">
              <div className="flex items-start gap-3">
                <CharacterPortraitSlot
                  character={activeCharacter}
                  size="sm"
                  label={`${activeCharacter.name} · ${t('character.portrait.placeholder')}`}
                  className="border-white/25"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-semibold">
                    {activeCharacter.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {activeCharacter.tagline}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {t('home.characters.currentStage')}
                  </p>
                  <p className="mt-1 font-semibold">{activeStage}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {t('home.characters.affinity')}
                  </p>
                  <p className="mt-1 font-semibold">{activeAffinity}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {t('home.characters.unlockedPrefix')}
              {characterState.unlockedCharacterIds.length}
              {t('home.characters.unlockedSuffix')}
            </p>
            <Button asChild variant="outline" className="mt-4 border-slate-200">
              <Link to="/profile">{t('home.characters.viewProfile')}</Link>
            </Button>
          </article>
        </section>

        <section
          className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-[0.26em] text-emerald-700/80 uppercase dark:text-emerald-400/80">
                {t('home.other.shelfLabel')}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl dark:text-white">
                {t('home.other.title')}
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-right dark:text-slate-400">
              {t('home.other.subtitle')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((category, index) => {
              const Icon =
                categoryIconMap[category.id as keyof typeof categoryIconMap];
              return (
                <Link
                  key={category.id}
                  to={category.path}
                  className="group home-glass-panel home-hover-lift rounded-[24px] p-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
                  style={{ animationDelay: `${350 + index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs tracking-[0.2em] text-emerald-700/80 uppercase dark:text-emerald-400/80">
                      {t('home.other.sideLabel')}
                    </p>
                    {Icon && (
                      <span className="inline-flex size-8 items-center justify-center rounded-full border border-emerald-200/50 bg-emerald-50/80 text-emerald-700 shadow-sm transition-colors group-hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-400 dark:group-hover:bg-emerald-900/60">
                        <Icon className="size-4" />
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-400">
                    {t(`category.${category.id}.name`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {t(`category.${category.id}.description`)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
