import { Upload } from 'lucide-react';
import { type ChangeEventHandler, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/contexts/LocaleContext';
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
import { claimDailyTask, ensureDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import {
  cropImageFileToSquareDataUrl,
  getAvatarPresetById,
  getPlayerProfile,
  PLAYER_AVATAR_PRESETS,
  type PlayerProfile,
  sanitizeNickname,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import {
  getNextLockedTitle,
  getTitleById,
  getUnlockedTitles,
  resolveActiveTitle,
} from '@/lib/titles';

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

const Profile = () => {
  const { t } = useLocale();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    getPlayerProfile(),
  );
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);
  const [dailyTaskState, setDailyTaskState] = useState(() =>
    ensureDailyTaskState(),
  );
  const [checkinState, setCheckinState] = useState<CheckinState>(() =>
    ensureCheckinState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [claimFeedback, setClaimFeedback] = useState('');
  const [checkinFeedback, setCheckinFeedback] = useState('');

  const completedTaskCount = useMemo(
    () => dailyTaskState.items.filter((task) => task.completed).length,
    [dailyTaskState.items],
  );
  const checkedInToday = checkinState.dateKey === getBeijingDateKey();
  const unlockedTitles = useMemo(
    () => getUnlockedTitles(growthOverview.totalPoints),
    [growthOverview.totalPoints],
  );
  const nextLockedTitle = useMemo(
    () => getNextLockedTitle(growthOverview.totalPoints),
    [growthOverview.totalPoints],
  );

  useEffect(() => {
    const nextDaily = ensureDailyTaskState();
    const nextCheckin = ensureCheckinState();
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      resolvedTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: resolvedTitleId });
    setDailyTaskState(nextDaily);
    setCheckinState(nextCheckin);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setNicknameDraft(syncedProfile.nickname);
  }, []);

  useEffect(() => {
    const resolvedTitleId = resolveActiveTitle(
      profile.activeTitle,
      growthOverview.totalPoints,
    );
    if (resolvedTitleId === profile.activeTitle) return;
    const nextProfile = updatePlayerProfile({ activeTitle: resolvedTitleId });
    setProfile(nextProfile);
  }, [growthOverview.totalPoints, profile.activeTitle]);

  const saveNickname = () => {
    const next = updatePlayerProfile({
      nickname: sanitizeNickname(nicknameDraft),
    });
    setProfile(next);
    setNicknameDraft(next.nickname);
  };

  const applyPresetAvatar = (presetId: string) => {
    const next = updatePlayerProfile({
      avatarMode: 'preset',
      avatarPresetId: presetId,
    });
    setProfile(next);
    setAvatarError('');
  };

  const onUploadAvatar: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const dataUrl = await cropImageFileToSquareDataUrl(file);
      const next = updatePlayerProfile({
        avatarMode: 'upload',
        avatarUploadDataUrl: dataUrl,
      });
      setProfile(next);
    } catch {
      setAvatarError(t('home.player.avatarUploadFailed'));
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const switchTitle = (titleId: string) => {
    const unlockedIds = new Set(unlockedTitles.map((title) => title.id));
    if (!unlockedIds.has(titleId)) return;
    const next = updatePlayerProfile({ activeTitle: titleId });
    setProfile(next);
  };

  const claimTaskReward = (taskId: string) => {
    const result = claimDailyTask(taskId);
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      resolvedTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: resolvedTitleId });
    setDailyTaskState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setClaimFeedback(
      result.ok
        ? `${t('profile.daily.claimFeedback')}${result.awardedPoints}`
        : '',
    );
  };

  const checkinTodayAction = () => {
    const result = checkinToday();
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      resolvedTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: resolvedTitleId });
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    setCheckinFeedback(
      result.ok
        ? `${t('profile.checkin.feedback.daily')}${result.awardedPoints}`
        : t('profile.checkin.feedback.already'),
    );
  };

  const claimWeekRewardAction = () => {
    const milestone = CHECKIN_WEEK_MILESTONES[0];
    const result = claimWeekMilestone(milestone);
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      resolvedTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: resolvedTitleId });
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    if (result.ok) {
      setCheckinFeedback(
        `${t('profile.checkin.feedback.week')}${result.awardedPoints}`,
      );
    }
  };

  const claimMonthRewardAction = () => {
    const milestone = CHECKIN_MONTH_MILESTONES[0];
    const result = claimMonthMilestone(milestone);
    const nextGrowth = getGrowthOverview();
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    const syncedProfile =
      resolvedTitleId === currentProfile.activeTitle
        ? currentProfile
        : updatePlayerProfile({ activeTitle: resolvedTitleId });
    setCheckinState(result.state);
    setGrowthOverview(nextGrowth);
    setProfile(syncedProfile);
    if (result.ok) {
      setCheckinFeedback(
        `${t('profile.checkin.feedback.month')}${result.awardedPoints}`,
      );
    }
  };

  const activeTitle = getTitleById(profile.activeTitle);
  const weekMilestone = CHECKIN_WEEK_MILESTONES[0];
  const monthMilestone = CHECKIN_MONTH_MILESTONES[0];
  const weekClaimed = checkinState.weekClaimedAt.includes(weekMilestone);
  const monthClaimed = checkinState.monthClaimedAt.includes(monthMilestone);
  const canClaimWeek = checkinState.streakDays >= weekMilestone && !weekClaimed;
  const canClaimMonth =
    checkinState.totalDays >= monthMilestone && !monthClaimed;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,#f7f2e4_0,#edf4e8_46%,#dce8dd_100%)] font-['Avenir_Next','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] text-slate-900">
      <header className="border-b border-emerald-100/80 bg-white/78 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← {t('common.backHome')}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {t('profile.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t('profile.subtitle')}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-2 md:py-10">
        <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-medium tracking-[0.2em] text-emerald-700/70 uppercase">
            {t('home.player.title')}
          </p>
          <div className="mt-3 flex items-start gap-4">
            <ProfileAvatar profile={profile} />
            <div className="min-w-0 flex-1 space-y-2">
              <label
                className="text-xs text-slate-500"
                htmlFor="nickname-input"
              >
                {t('home.player.nickname')}
              </label>
              <div className="flex gap-2">
                <Input
                  id="nickname-input"
                  maxLength={16}
                  value={nicknameDraft}
                  onChange={(event) => setNicknameDraft(event.target.value)}
                  onBlur={saveNickname}
                  className="h-10 border-slate-200 bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200"
                  onClick={saveNickname}
                >
                  {t('home.player.save')}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-500">
              {t('home.player.avatarPreset')}
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAYER_AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPresetAvatar(preset.id)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    profile.avatarMode === 'preset' &&
                    profile.avatarPresetId === preset.id
                      ? 'ring-2 ring-emerald-500'
                      : 'ring-1 ring-slate-200'
                  } ${preset.bgClass} ${preset.fgClass}`}
                  aria-label={preset.label}
                >
                  {preset.glyph}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-500">
              {t('home.player.avatarUpload')}
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Upload className="size-4" />
              {avatarUploading
                ? t('home.player.avatarUploading')
                : t('home.player.avatarUploadAction')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUploadAvatar}
                disabled={avatarUploading}
              />
            </label>
            {avatarError && (
              <p className="text-xs text-rose-600" role="status">
                {avatarError}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
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
            {t('home.growth.achievementProgress')}
            {growthOverview.unlockedAchievements}/
            {growthOverview.totalAchievements}
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {t('profile.titles.section')}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {t('profile.titles.current')}：
              <span className="font-medium text-slate-900">
                {activeTitle
                  ? t(activeTitle.nameKey)
                  : t('profile.titles.none')}
              </span>
            </p>
            {nextLockedTitle && (
              <p className="mt-1 text-xs text-slate-500">
                {t('profile.titles.next')} {t(nextLockedTitle.nameKey)} ·{' '}
                {t('profile.titles.unlockAt')} {nextLockedTitle.minPoints}
              </p>
            )}
            <div className="mt-2">
              <p className="text-xs text-slate-500">
                {t('profile.titles.manualSwitch')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unlockedTitles.length > 0 ? (
                  unlockedTitles.map((title) => {
                    const selected = profile.activeTitle === title.id;
                    return (
                      <button
                        key={title.id}
                        type="button"
                        onClick={() => switchTitle(title.id)}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                          selected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t(title.nameKey)}
                      </button>
                    );
                  })
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    {t('profile.titles.none')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {t('profile.checkin.title')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('profile.checkin.date')} {checkinState.dateKey || '-'}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <p>
                {t('profile.checkin.streak')}：{checkinState.streakDays}
              </p>
              <p>
                {t('profile.checkin.total')}：{checkinState.totalDays}
              </p>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-600"
                onClick={checkinTodayAction}
                disabled={checkedInToday}
              >
                {checkedInToday
                  ? t('profile.checkin.checkedIn')
                  : t('profile.checkin.action')}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  {t('profile.checkin.weekMilestone')} {weekMilestone}
                </p>
                {weekClaimed ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  {t('profile.checkin.monthMilestone')} {monthMilestone}
                </p>
                {monthClaimed ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
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
              <p className="mt-2 text-xs text-emerald-700" role="status">
                {checkinFeedback}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">
                {t('home.daily.title')}
              </p>
              <span className="text-xs text-slate-500">
                {dailyTaskState.dateKey}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {t('profile.daily.completed')} {completedTaskCount}/
              {dailyTaskState.items.length}
            </p>
            {claimFeedback && (
              <p className="text-xs text-emerald-700" role="status">
                {claimFeedback}
              </p>
            )}
            <ul className="space-y-2">
              {dailyTaskState.items.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {t(task.titleKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(task.descKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {t('home.daily.progress')}
                        {task.progress}/{task.target}
                        {' · '}
                        {t('home.daily.reward')}
                        {task.rewardPoints}
                      </p>
                    </div>
                    {task.claimed ? (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {t('home.daily.claimed')}
                      </span>
                    ) : task.completed ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-700 text-white hover:bg-emerald-600"
                        onClick={() => claimTaskReward(task.id)}
                      >
                        {t('home.daily.claim')}
                      </Button>
                    ) : (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        {t('home.daily.pending')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
