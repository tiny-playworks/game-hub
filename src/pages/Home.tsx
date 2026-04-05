import { Compass, ScrollText, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,#f7f2e4_0,#edf4e8_46%,#dce8dd_100%)] font-['Avenir_Next','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] text-slate-900">
      <header className="relative z-50 border-b border-emerald-100/80 bg-white/78 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.24em] text-emerald-700/70 uppercase">
              Game Hub
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {t('home.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t('home.subtitle')}
            </p>
          </div>
          <QuickAccessPanel withLocaleSwitcher />
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
          <article className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {t('home.daily.title')}
              </p>
              <span className="text-xs text-slate-500">
                {dailyTaskState.dateKey}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {dailyTasksDisplay.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {t(task.titleKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(task.descKey)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                      {task.progress}/{task.target}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {task.completed
                      ? `${t('home.daily.settledPrefix')}${task.rewardPoints}`
                      : `${t('home.daily.pendingRewardPrefix')}${task.rewardPoints}`}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {t('home.recentGrowth.title')}
              </p>
              <span className="text-xs text-slate-500">
                +{growthOverview.taskPoints}
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

          <article className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {t('home.characters.title')}
              </p>
              <UserRound className="size-4 text-emerald-700" />
            </div>
            <div className="mt-4 rounded-[24px] bg-[linear-gradient(135deg,#13243b,#173226_58%,#234036)] p-4 text-white">
              <div className="flex items-start gap-3">
                <CharacterPortraitSlot
                  character={activeCharacter}
                  size="sm"
                  label={`${activeCharacter.name} · ${t('character.portrait.placeholder')}`}
                  className="border-white/20 text-white"
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

        <section className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-[0.26em] text-emerald-700/70 uppercase">
                {t('home.other.shelfLabel')}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                {t('home.other.title')}
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-right">
              {t('home.other.subtitle')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((category) => {
              const Icon =
                categoryIconMap[category.id as keyof typeof categoryIconMap];
              return (
                <Link
                  key={category.id}
                  to={category.path}
                  className="group rounded-[24px] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(244,250,246,0.88))] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:border-emerald-300/70"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs tracking-[0.2em] text-emerald-700/70 uppercase">
                      {t('home.other.sideLabel')}
                    </p>
                    {Icon && (
                      <span className="inline-flex size-8 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
                        <Icon className="size-4" />
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 transition group-hover:text-emerald-900">
                    {t(`category.${category.id}.name`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
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
