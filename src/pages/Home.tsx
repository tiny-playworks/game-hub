import { ArrowRight, Castle, Club, Gamepad2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import { ensureDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import {
  getAvatarPresetById,
  getPlayerProfile,
  type PlayerProfile,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import { getRecentMahjongEntry } from '@/lib/recentMahjong';
import { getTitleById, resolveActiveTitle } from '@/lib/titles';
import { useRiichiGameStore } from '@/pages/mahjong/japanese/store/riichiGameStore';

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-1 text-sm">
      <button
        type="button"
        onClick={() => setLocale('zh')}
        className={
          locale === 'zh'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        中
      </button>
      <span className="text-muted-foreground">|</span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={
          locale === 'en'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        En
      </button>
    </div>
  );
}

const featuredMahjongIds = ['mahjong-japanese'] as const;

const mahjongTagKeys = [
  'home.mahjong.primaryTag',
  'home.mahjong.secondaryTag',
  'home.mahjong.tertiaryTag',
] as const;
const categoryIconMap = {
  mini: Gamepad2,
  board: Castle,
  poker: Club,
} as const;

function ProfileAvatar({ profile }: { profile: PlayerProfile }) {
  if (profile.avatarMode === 'upload' && profile.avatarUploadDataUrl) {
    return (
      <img
        src={profile.avatarUploadDataUrl}
        alt="avatar"
        className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
      />
    );
  }
  const preset = getAvatarPresetById(profile.avatarPresetId);
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 text-2xl font-semibold ${preset.bgClass} ${preset.fgClass}`}
      role="img"
      aria-label={preset.label}
    >
      {preset.glyph}
    </div>
  );
}

const Home = () => {
  const { t, locale } = useLocale();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    getPlayerProfile(),
  );
  const [dailyTaskState, setDailyTaskState] = useState(() =>
    ensureDailyTaskState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const view = useRiichiGameStore((state) => state.view);
  const game = useRiichiGameStore((state) => state.game);
  const matchEnd = useRiichiGameStore((state) => state.matchEnd);
  const featuredMahjongGames = featuredMahjongIds
    .map((id) => games.find((game) => game.id === id))
    .filter((game) => game !== undefined);
  const secondaryCategories = categories;
  const mahjongActions = [
    { label: t('common.quickStart'), to: '/game/mahjong-japanese?start=1' },
    { label: t('common.viewRules'), to: '/game/mahjong-japanese' },
    {
      label: t('common.beginnerGuide'),
      to: '/game/mahjong-japanese?start=1&guide=1',
    },
  ];
  const recentMahjong = getRecentMahjongEntry();
  const isRiichiActive = Boolean(view === 'game' && game && !matchEnd);
  const mainMahjongGame = featuredMahjongGames[0];
  const completedTaskCount = dailyTaskState.items.filter(
    (task) => task.completed,
  ).length;
  const resolvedTitleId = resolveActiveTitle(
    profile.activeTitle,
    growthOverview.totalPoints,
  );
  const activeTitle = getTitleById(resolvedTitleId);
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

  useEffect(() => {
    const nextDaily = ensureDailyTaskState();
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const nextTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      nextTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: nextTitleId });
    setDailyTaskState(nextDaily);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,#f7f2e4_0,#edf4e8_46%,#dce8dd_100%)] font-['Avenir_Next','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] text-slate-900">
      <header className="border-b border-emerald-100/80 bg-white/78 px-4 py-4 backdrop-blur">
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
          <div className="flex items-center gap-4">
            <Link
              to="/achievements"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              {t('achievements.title')}
            </Link>
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:py-10">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-emerald-700/70 uppercase">
              {t('home.player.title')}
            </p>
            <div className="mt-3 flex items-start gap-4">
              <ProfileAvatar profile={profile} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">
                  {profile.nickname}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t('home.player.currentTitle')}：
                  <span className="font-medium text-slate-700">
                    {activeTitle
                      ? t(activeTitle.nameKey)
                      : t('home.player.noTitle')}
                  </span>
                </p>
              </div>
            </div>
            <Button
              asChild
              className="mt-4 bg-emerald-800 text-white hover:bg-emerald-700"
            >
              <Link to="/profile">
                {t('home.player.title')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-emerald-700/70 uppercase">
              {t('home.growth.title')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('home.growth.totalPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {growthOverview.totalPoints}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('home.growth.achievementPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {growthOverview.achievementPoints}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('home.growth.taskPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {growthOverview.taskPoints}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('home.daily.completed')} {completedTaskCount}/
              {dailyTaskState.items.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {dailyTaskState.dateKey}
            </p>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[36px] border border-emerald-200/80 bg-[linear-gradient(135deg,#f7efda,#edf6ed_50%,#deeadf)] p-6 shadow-[0_24px_56px_rgba(15,23,42,0.12)] animate-in fade-in duration-500 md:p-8">
          <div className="pointer-events-none absolute -left-20 top-[-90px] size-64 rounded-full bg-amber-200/45 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-[-90px] size-72 rounded-full bg-emerald-300/32 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.24)_1px,transparent_1px)] bg-[size:28px_28px] opacity-20" />

          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/78 px-3 py-1 text-xs font-medium text-amber-700">
                <Sparkles className="size-3.5" />
                {t('home.hero.badge')}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {mahjongTagKeys.map((tagKey) => (
                    <span
                      key={tagKey}
                      className="rounded-full border border-slate-200 bg-white/76 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {t(tagKey)}
                    </span>
                  ))}
                </div>

                <h2 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl md:leading-[0.98]">
                  {t('home.mahjong.title')}
                </h2>

                <p className="max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
                  {t('home.hero.description')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-900 text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-800"
                >
                  <Link to="/game/mahjong-japanese?start=1">
                    {t('home.hero.primary')}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-emerald-300/80 bg-white/78 text-emerald-900 hover:bg-white"
                >
                  <Link to="/game/mahjong-japanese">
                    {t('home.hero.secondary')}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-slate-700 hover:bg-white/65 hover:text-slate-900"
                >
                  <Link to="/achievements">{t('home.hero.tertiary')}</Link>
                </Button>
              </div>

              {recentMahjong && (
                <div className="rounded-2xl border border-emerald-200/75 bg-white/82 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-700">
                      <span className="mr-2 text-xs font-medium tracking-[0.2em] text-emerald-700 uppercase">
                        {t('home.recent.title')}
                      </span>
                      {isRiichiActive
                        ? t('home.recent.active')
                        : `${t('home.recent.lastPlayed')} ${recentPlayedText}`}
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      <Link to="/game/mahjong-japanese">
                        {isRiichiActive
                          ? t('common.continueGame')
                          : t('common.startOrContinue')}
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {mainMahjongGame && (
              <div className="rounded-[30px] border border-emerald-800/28 bg-[radial-gradient(circle_at_78%_92%,rgba(34,197,94,0.28),transparent_42%),linear-gradient(155deg,#13243b,#173226_58%,#234036)] p-6 text-white shadow-[0_24px_50px_rgba(15,23,42,0.34)] animate-in slide-in-from-right-4 duration-700">
                <p className="text-xs tracking-[0.22em] text-emerald-200/90 uppercase">
                  {t('home.hero.tableLabel')}
                </p>
                <h3 className="mt-3 text-3xl font-semibold">
                  {t(`game.${mainMahjongGame.id}.name`) || mainMahjongGame.name}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-200">
                  {t(`game.${mainMahjongGame.id}.description`) ||
                    mainMahjongGame.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {mainMahjongGame.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {mahjongActions.map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/18"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>

                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="mt-8 bg-white text-slate-900 hover:bg-slate-100"
                >
                  <Link to="/game/mahjong-japanese?start=1">
                    {t('common.startGame')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
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
            {secondaryCategories.map((cat, index) => {
              const Icon =
                categoryIconMap[cat.id as keyof typeof categoryIconMap];
              return (
                <Link
                  key={cat.id}
                  to={cat.path}
                  style={{ animationDelay: `${index * 70}ms` }}
                  className="group rounded-[24px] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(244,250,246,0.88))] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:border-emerald-300/70 animate-in slide-in-from-bottom-2"
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
                    {t(`category.${cat.id}.name`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(`category.${cat.id}.description`)}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-900">
                    {t('home.other.cta')}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </div>
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
