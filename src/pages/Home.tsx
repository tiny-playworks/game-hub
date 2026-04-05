import {
  ArrowRight,
  CalendarCheck,
  Castle,
  Club,
  Gamepad2,
  Sparkles,
  Trophy,
  UserCircle2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import {
  CHECKIN_MONTH_MILESTONES,
  CHECKIN_WEEK_MILESTONES,
  type CheckinState,
  checkinToday,
  claimMonthMilestone,
  claimWeekMilestone,
  ensureCheckinState,
  getBeijingDateKey,
} from '@/lib/checkin';
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

type QuickPanel = 'achievements' | 'checkin' | 'profile' | null;

function getCurrentMonthCalendarDays(now = Date.now()): string[] {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(now));
  const year = Number(
    parts.find((part) => part.type === 'year')?.value ?? '1970',
  );
  const month = Number(
    parts.find((part) => part.type === 'month')?.value ?? '01',
  );
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  return Array.from({ length: maxDay }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${monthPrefix}-${day}`;
  });
}

const Home = () => {
  const { t, locale } = useLocale();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    getPlayerProfile(),
  );
  const [checkinState, setCheckinState] = useState<CheckinState>(() =>
    ensureCheckinState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const [quickPanel, setQuickPanel] = useState<QuickPanel>(null);
  const [checkinFeedback, setCheckinFeedback] = useState('');
  const quickPanelRef = useRef<HTMLDivElement | null>(null);
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
  const resolvedTitleId = resolveActiveTitle(
    profile.activeTitle,
    growthOverview.totalPoints,
  );
  const activeTitle = getTitleById(resolvedTitleId);
  const checkedInToday = checkinState.dateKey === getBeijingDateKey();
  const weekMilestone = CHECKIN_WEEK_MILESTONES[0];
  const monthMilestone = CHECKIN_MONTH_MILESTONES[0];
  const weekClaimed = checkinState.weekClaimedAt.includes(weekMilestone);
  const monthClaimed = checkinState.monthClaimedAt.includes(monthMilestone);
  const canClaimWeek = checkinState.streakDays >= weekMilestone && !weekClaimed;
  const canClaimMonth =
    checkinState.totalDays >= monthMilestone && !monthClaimed;
  const monthDays = useMemo(() => getCurrentMonthCalendarDays(), []);
  const signedDaySet = useMemo(
    () => new Set(checkinState.signedDateKeys),
    [checkinState.signedDateKeys],
  );
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
    const nextCheckin = ensureCheckinState();
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
    setCheckinState(nextCheckin);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!quickPanelRef.current) return;
      if (quickPanelRef.current.contains(event.target as Node)) return;
      setQuickPanel(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const checkinTodayAction = () => {
    const result = checkinToday();
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
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setCheckinFeedback(
      result.ok
        ? `${t('home.quick.checkin.feedback.daily')}${result.awardedPoints}`
        : t('home.quick.checkin.feedback.already'),
    );
  };

  const claimWeekRewardAction = () => {
    const result = claimWeekMilestone(weekMilestone);
    if (!result.ok) return;
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
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setCheckinFeedback(
      `${t('home.quick.checkin.feedback.week')}${result.awardedPoints}`,
    );
  };

  const claimMonthRewardAction = () => {
    const result = claimMonthMilestone(monthMilestone);
    if (!result.ok) return;
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
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setCheckinFeedback(
      `${t('home.quick.checkin.feedback.month')}${result.awardedPoints}`,
    );
  };

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
          <div className="relative flex items-center gap-3" ref={quickPanelRef}>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                quickPanel === 'achievements'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() =>
                setQuickPanel((current) =>
                  current === 'achievements' ? null : 'achievements',
                )
              }
            >
              <Trophy className="size-3.5" />
              {t('home.quick.achievements')}
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                quickPanel === 'checkin'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() =>
                setQuickPanel((current) =>
                  current === 'checkin' ? null : 'checkin',
                )
              }
            >
              <CalendarCheck className="size-3.5" />
              {t('home.quick.checkin')}
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                quickPanel === 'profile'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() =>
                setQuickPanel((current) =>
                  current === 'profile' ? null : 'profile',
                )
              }
            >
              <UserCircle2 className="size-3.5" />
              {t('home.quick.profile')}
            </button>
            <LocaleSwitcher />

            {quickPanel === 'profile' && (
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <ProfileAvatar profile={profile} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {profile.nickname}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('home.player.currentTitle')}：
                      <span className="text-slate-700">
                        {activeTitle
                          ? t(activeTitle.nameKey)
                          : t('home.player.noTitle')}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('home.growth.totalPoints')}：
                      {growthOverview.totalPoints}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="mt-3 w-full bg-emerald-800 hover:bg-emerald-700"
                >
                  <Link to="/profile">{t('home.quick.profileDetail')}</Link>
                </Button>
              </div>
            )}

            {quickPanel === 'achievements' && (
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <p className="text-sm font-semibold text-slate-900">
                  {t('achievements.title')}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="text-slate-500">
                      {t('achievements.unlockedCount')}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {growthOverview.unlockedAchievements}/
                      {growthOverview.totalAchievements}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="text-slate-500">
                      {t('achievements.totalPoints')}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {growthOverview.achievementPoints}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {t('achievements.taskPoints')}：{growthOverview.taskPoints}
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full border-slate-200"
                >
                  <Link to="/achievements">
                    {t('home.quick.achievementsDetail')}
                  </Link>
                </Button>
              </div>
            )}

            {quickPanel === 'checkin' && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('profile.checkin.title')}
                  </p>
                  <span className="text-xs text-slate-500">
                    {checkinState.dateKey || '-'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <p>
                    {t('profile.checkin.streak')}：{checkinState.streakDays}
                  </p>
                  <p>
                    {t('profile.checkin.total')}：{checkinState.totalDays}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1">
                  {monthDays.map((dateKey) => {
                    const dayLabel = dateKey.slice(-2);
                    const signed = signedDaySet.has(dateKey);
                    const isToday = dateKey === getBeijingDateKey();
                    return (
                      <div
                        key={dateKey}
                        className={`flex h-8 items-center justify-center rounded text-xs ${
                          signed
                            ? 'bg-emerald-600 text-white'
                            : isToday
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                        title={dateKey}
                      >
                        {dayLabel}
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full bg-emerald-800 text-white hover:bg-emerald-700"
                  onClick={checkinTodayAction}
                  disabled={checkedInToday}
                >
                  {checkedInToday
                    ? t('profile.checkin.checkedIn')
                    : t('profile.checkin.action')}
                </Button>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-600">
                      {t('profile.checkin.weekMilestone')} {weekMilestone}
                    </p>
                    {weekClaimed ? (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                        {t('profile.checkin.claimed')}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-200 px-2 text-xs"
                        onClick={claimWeekRewardAction}
                        disabled={!canClaimWeek}
                      >
                        {t('profile.checkin.claim')}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-600">
                      {t('profile.checkin.monthMilestone')} {monthMilestone}
                    </p>
                    {monthClaimed ? (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                        {t('profile.checkin.claimed')}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-200 px-2 text-xs"
                        onClick={claimMonthRewardAction}
                        disabled={!canClaimMonth}
                      >
                        {t('profile.checkin.claim')}
                      </Button>
                    )}
                  </div>
                </div>

                {checkinFeedback && (
                  <p className="mt-2 text-xs text-emerald-700">
                    {checkinFeedback}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:py-10">
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
