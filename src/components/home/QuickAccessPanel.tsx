import { CalendarCheck, Trophy, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { getAllAchievementProgresses } from '@/lib/achievements';
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
import { cn } from '@/lib/utils';

type QuickPanel = 'achievements' | 'checkin' | 'profile' | null;

type Props = {
  withLocaleSwitcher?: boolean;
  compact?: boolean;
  className?: string;
};

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

function getCurrentMonthCalendar(now = Date.now()): {
  days: string[];
  year: number;
  month: number;
  leadingBlanks: number;
} {
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
  const days = Array.from({ length: maxDay }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${monthPrefix}-${day}`;
  });
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  return { days, year, month, leadingBlanks };
}

export function QuickAccessPanel({
  withLocaleSwitcher = false,
  compact = false,
  className,
}: Props) {
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
  const [checkinButtonFlashText, setCheckinButtonFlashText] = useState('');
  const quickPanelRef = useRef<HTMLDivElement | null>(null);
  const checkinFlashTimerRef = useRef<number | null>(null);

  const monthCalendar = useMemo(() => getCurrentMonthCalendar(), []);
  const signedDaySet = useMemo(
    () => new Set(checkinState.signedDateKeys),
    [checkinState.signedDateKeys],
  );
  const recentMahjong = getRecentMahjongEntry();
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
  const recentPlayedLabel = t('home.quick.recentPlayed');
  const noRecentPlayedText = t('home.quick.noRecentPlayed');
  const weekHeaders = [
    t('home.quick.weekday.mon'),
    t('home.quick.weekday.tue'),
    t('home.quick.weekday.wed'),
    t('home.quick.weekday.thu'),
    t('home.quick.weekday.fri'),
    t('home.quick.weekday.sat'),
    t('home.quick.weekday.sun'),
  ];
  const monthLabel = useMemo(
    () =>
      locale === 'zh'
        ? `${monthCalendar.year}年${monthCalendar.month}月`
        : new Intl.DateTimeFormat('en-US', {
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Shanghai',
          }).format(
            new Date(Date.UTC(monthCalendar.year, monthCalendar.month - 1, 1)),
          ),
    [locale, monthCalendar.month, monthCalendar.year],
  );
  const achievementQuickProgress = getAllAchievementProgresses()
    .filter((achievement) => !achievement.unlocked)
    .sort(
      (a, b) =>
        b.progressPercent - a.progressPercent ||
        b.current - a.current ||
        a.target - b.target,
    )
    .slice(0, 3);
  const allAchievementsUnlockedText = t('home.quick.achievements.allUnlocked');
  const inProgressLabel = t('home.quick.achievements.inProgress');
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

  useEffect(
    () => () => {
      if (checkinFlashTimerRef.current) {
        window.clearTimeout(checkinFlashTimerRef.current);
      }
    },
    [],
  );

  const syncGrowthAndTitle = () => {
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
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
  };

  const checkinTodayAction = () => {
    const result = checkinToday();
    setCheckinState(result.state);
    syncGrowthAndTitle();
    if (result.ok) {
      setCheckinButtonFlashText(`+${result.awardedPoints}`);
      if (checkinFlashTimerRef.current) {
        window.clearTimeout(checkinFlashTimerRef.current);
      }
      checkinFlashTimerRef.current = window.setTimeout(() => {
        setCheckinButtonFlashText('');
      }, 1200);
    }
    setCheckinFeedback(
      result.ok
        ? `${t('home.quick.checkin.feedback.daily')}${result.awardedPoints}`
        : t('home.quick.checkin.feedback.already'),
    );
  };

  const claimWeekRewardAction = () => {
    const result = claimWeekMilestone(weekMilestone);
    if (!result.ok) return;
    setCheckinState(result.state);
    syncGrowthAndTitle();
    setCheckinFeedback(
      `${t('home.quick.checkin.feedback.week')}${result.awardedPoints}`,
    );
  };

  const claimMonthRewardAction = () => {
    const result = claimMonthMilestone(monthMilestone);
    if (!result.ok) return;
    setCheckinState(result.state);
    syncGrowthAndTitle();
    setCheckinFeedback(
      `${t('home.quick.checkin.feedback.month')}${result.awardedPoints}`,
    );
  };

  const buttonClass = compact
    ? 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition'
    : 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition';
  const iconClass = compact ? 'size-3.5' : 'size-4';
  const panelClass =
    'absolute right-0 top-full z-40 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl';

  return (
    <div
      className={cn('relative flex items-center gap-3', className)}
      ref={quickPanelRef}
    >
      <button
        type="button"
        className={`${buttonClass} ${
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
        <Trophy className={iconClass} />
        {t('home.quick.achievements')}
      </button>
      <button
        type="button"
        className={`${buttonClass} ${
          quickPanel === 'checkin'
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        onClick={() =>
          setQuickPanel((current) => (current === 'checkin' ? null : 'checkin'))
        }
      >
        <CalendarCheck className={iconClass} />
        {t('home.quick.checkin')}
      </button>
      <button
        type="button"
        className={`${buttonClass} ${
          quickPanel === 'profile'
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        onClick={() =>
          setQuickPanel((current) => (current === 'profile' ? null : 'profile'))
        }
      >
        <UserCircle2 className={iconClass} />
        {t('home.quick.profile')}
      </button>
      {withLocaleSwitcher ? <LocaleSwitcher /> : null}

      {quickPanel === 'profile' && (
        <div className={`${panelClass} w-72`}>
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={profile} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profile.nickname}
              </p>
              <div className="mt-1 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                <span className="mr-1 text-emerald-600">✦</span>
                <span className="truncate">
                  {activeTitle
                    ? t(activeTitle.nameKey)
                    : t('home.player.noTitle')}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('home.growth.totalPoints')}：{growthOverview.totalPoints}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">{recentPlayedLabel}</p>
            <p className="mt-0.5 text-xs text-slate-700">
              {recentPlayedText || noRecentPlayedText}
            </p>
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
        <div className={`${panelClass} w-72`}>
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
              <p className="text-slate-500">{t('achievements.totalPoints')}</p>
              <p className="mt-1 font-semibold text-slate-900">
                {growthOverview.achievementPoints}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('achievements.taskPoints')}：{growthOverview.taskPoints}
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-medium text-slate-600">
              {inProgressLabel}
            </p>
            {achievementQuickProgress.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                {allAchievementsUnlockedText}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {achievementQuickProgress.map((achievement) => (
                  <div key={achievement.id}>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span className="truncate">{t(achievement.nameKey)}</span>
                      <span className="shrink-0">
                        {achievement.current}/{achievement.target}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                      <div
                        className="h-1.5 rounded-full bg-emerald-600"
                        style={{ width: `${achievement.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-3 w-full border-slate-200"
          >
            <Link to="/achievements">{t('home.quick.achievementsDetail')}</Link>
          </Button>
        </div>
      )}

      {quickPanel === 'checkin' && (
        <div className={`${panelClass} w-[320px]`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {t('profile.checkin.title')}
            </p>
            <span className="text-xs text-slate-500">{monthLabel}</span>
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
            {weekHeaders.map((weekday) => (
              <div
                key={weekday}
                className="flex h-6 items-center justify-center text-[11px] font-medium text-slate-500"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {Array.from({ length: monthCalendar.leadingBlanks }).map(
              (_, index) => (
                <div key={`blank-${index}`} className="h-8 rounded" />
              ),
            )}
            {monthCalendar.days.map((dateKey) => {
              const dayLabel = dateKey.slice(-2);
              const signed = signedDaySet.has(dateKey);
              const isToday = dateKey === getBeijingDateKey();
              const todayHighlightClass = isToday
                ? 'ring-2 ring-emerald-400'
                : '';
              return (
                <div
                  key={dateKey}
                  className={`flex h-8 items-center justify-center rounded text-xs ${todayHighlightClass} ${
                    signed
                      ? 'bg-emerald-600 text-white'
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
            {checkinButtonFlashText ||
              (checkedInToday
                ? t('profile.checkin.checkedIn')
                : t('profile.checkin.action'))}
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

          {checkinFeedback ? (
            <p className="mt-2 text-xs text-emerald-700">{checkinFeedback}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
