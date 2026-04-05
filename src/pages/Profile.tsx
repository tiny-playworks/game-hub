import { Upload } from 'lucide-react';
import {
  type ChangeEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
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
import { type DailyTaskState, ensureDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import { type GrowthFeedItem, getFullGrowthFeed } from '@/lib/growthFeed';
import {
  CHARACTER_DEFS,
  type CharacterDef,
  getCharacterAffinityStage,
  getCharacterById,
  type PlayerCharacterState,
  setActiveCharacter,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import {
  cropImageFileToSquareDataUrl,
  getAvatarPresetById,
  getPlayerProfile,
  PLAYER_AVATAR_PRESETS,
  type PlayerProfile,
  sanitizeNickname,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import { getPlayerStats, type PlayerStatsState } from '@/lib/playerStats';
import {
  getNextLockedTitle,
  getTitleById,
  getUnlockedTitles,
  resolveActiveTitle,
} from '@/lib/titles';
import { ensureWeeklyTaskState, type WeeklyTaskState } from '@/lib/weeklyTasks';

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
        Zh
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

function getCharacterUnlockText(
  character: CharacterDef,
  stats: PlayerStatsState,
  t: (key: string) => string,
): string {
  if (character.unlockRule.type === 'default') {
    return t('profile.companion.unlock.default');
  }
  if (character.unlockRule.type === 'riichi-rounds') {
    return `${t('profile.companion.unlock.riichiRoundsPrefix')} ${stats.riichiRounds}/${character.unlockRule.target}`;
  }
  return `${t('profile.companion.unlock.winsPrefix')} ${stats.riichiWins}/${character.unlockRule.target}`;
}

const Profile = () => {
  const { t } = useLocale();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    getPlayerProfile(),
  );
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);
  const [dailyTaskState, setDailyTaskState] = useState<DailyTaskState>(() =>
    ensureDailyTaskState(),
  );
  const [weeklyTaskState, setWeeklyTaskState] = useState<WeeklyTaskState>(() =>
    ensureWeeklyTaskState(),
  );
  const [checkinState, setCheckinState] = useState<CheckinState>(() =>
    ensureCheckinState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const [playerStats, setPlayerStats] = useState<PlayerStatsState>(() =>
    getPlayerStats(),
  );
  const [characterState, setCharacterState] = useState<PlayerCharacterState>(
    () => syncPlayerCharacterUnlocks().state,
  );
  const [recentFeed, setRecentFeed] = useState(() => getFullGrowthFeed());
  const growthHistoryMeta = useMemo(
    () =>
      t('profile.growthHistory.meta').replace(
        '{{count}}',
        String(recentFeed.length),
      ),
    [recentFeed.length, t],
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [checkinFeedback, setCheckinFeedback] = useState('');

  const refreshDashboard = useCallback(() => {
    const nextDaily = ensureDailyTaskState();
    const nextWeekly = ensureWeeklyTaskState();
    const nextCheckin = ensureCheckinState();
    const nextGrowth = getGrowthOverview();
    const nextStats = getPlayerStats();
    const nextCharacterState = syncPlayerCharacterUnlocks().state;
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
    setWeeklyTaskState(nextWeekly);
    setCheckinState(nextCheckin);
    setGrowthOverview(nextGrowth);
    setPlayerStats(nextStats);
    setCharacterState(nextCharacterState);
    setRecentFeed(getFullGrowthFeed());
    setProfile(syncedProfile);
    setNicknameDraft(syncedProfile.nickname);
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

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
    const next = updatePlayerProfile({ activeTitle: titleId });
    setProfile(next);
  };

  const switchCharacter = (characterId: string) => {
    const next = setActiveCharacter(characterId);
    setCharacterState(next);
  };

  const checkinTodayAction = () => {
    const result = checkinToday();
    refreshDashboard();
    setCheckinFeedback(
      result.ok
        ? `${t('profile.checkin.feedback.daily')}${result.awardedPoints}`
        : t('profile.checkin.feedback.already'),
    );
  };

  const claimWeekRewardAction = () => {
    const milestone = CHECKIN_WEEK_MILESTONES[0];
    const result = claimWeekMilestone(milestone);
    refreshDashboard();
    if (result.ok) {
      setCheckinFeedback(
        `${t('profile.checkin.feedback.week')}${result.awardedPoints}`,
      );
    }
  };

  const claimMonthRewardAction = () => {
    const milestone = CHECKIN_MONTH_MILESTONES[0];
    const result = claimMonthMilestone(milestone);
    refreshDashboard();
    if (result.ok) {
      setCheckinFeedback(
        `${t('profile.checkin.feedback.month')}${result.awardedPoints}`,
      );
    }
  };

  const completedTaskCount = useMemo(
    () => dailyTaskState.items.filter((task) => task.completed).length,
    [dailyTaskState.items],
  );
  const completedWeeklyTaskCount = useMemo(
    () => weeklyTaskState.items.filter((task) => task.completed).length,
    [weeklyTaskState.items],
  );
  const sortedGamePlayCounts = useMemo(
    () =>
      Object.entries(playerStats.gamePlayCounts).sort((a, b) => b[1] - a[1]),
    [playerStats.gamePlayCounts],
  );
  const riichiRatioStats = useMemo(() => {
    const r = playerStats.riichiRounds;
    const w = playerStats.riichiWins;
    const rc = playerStats.riichiRiichiCount;
    const tc = playerStats.riichiTsumoCount;
    return {
      winRate: r > 0 ? (w / r) * 100 : 0,
      riichiRate: r > 0 ? (rc / r) * 100 : 0,
      tsumoShare: w > 0 ? (tc / w) * 100 : 0,
    };
  }, [
    playerStats.riichiRounds,
    playerStats.riichiWins,
    playerStats.riichiRiichiCount,
    playerStats.riichiTsumoCount,
  ]);
  const checkedInToday = checkinState.dateKey === getBeijingDateKey();
  const unlockedTitles = useMemo(
    () => getUnlockedTitles(growthOverview.totalPoints),
    [growthOverview.totalPoints],
  );
  const nextLockedTitle = useMemo(
    () => getNextLockedTitle(growthOverview.totalPoints),
    [growthOverview.totalPoints],
  );
  const activeTitle = getTitleById(profile.activeTitle);
  const activeCharacter = getCharacterById(characterState.activeCharacterId);
  const activeAffinity =
    characterState.affinityByCharacter[activeCharacter.id] ?? 0;
  const activeStage = getCharacterAffinityStage(activeAffinity);
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
              {t('profile.heroSubtitle')}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-[0.92fr_1.08fr] md:py-10">
        <div className="space-y-4">
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
                <p className="text-xs text-slate-500">
                  {t('home.player.currentTitle')}：
                  <span className="ml-1 font-medium text-slate-900">
                    {activeTitle
                      ? t(activeTitle.nameKey)
                      : t('profile.titles.none')}
                  </span>
                </p>
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

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-900">
                {t('profile.titles.section')}
              </p>
              {nextLockedTitle && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('profile.nextTitlePrefix')}
                  {t(nextLockedTitle.nameKey)} · {t('profile.nextTitleNeed')}{' '}
                  {nextLockedTitle.minPoints}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
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
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-emerald-700/70 uppercase">
              {t('profile.companion.section')}
            </p>
            <div className="mt-4 rounded-[24px] bg-[linear-gradient(135deg,#13243b,#173226_58%,#234036)] p-4 text-white">
              <div className="flex items-start gap-4">
                <CharacterPortraitSlot
                  character={activeCharacter}
                  size="lg"
                  label={`${activeCharacter.name} · ${t('character.portrait.placeholder')}`}
                  className="border-white/20 text-white"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold">
                        {activeCharacter.name}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {activeCharacter.tagline}
                      </p>
                      {activeCharacter.bioKey ? (
                        <p className="mt-2 text-xs leading-5 text-slate-300/95">
                          {t(activeCharacter.bioKey)}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">
                      {t('profile.companion.currentBadge')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {t('profile.companion.stageLabel')}
                  </p>
                  <p className="mt-1 font-semibold">{activeStage}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {t('profile.companion.affinityLabel')}
                  </p>
                  <p className="mt-1 font-semibold">{activeAffinity}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {CHARACTER_DEFS.map((character) => {
                const unlocked = characterState.unlockedCharacterIds.includes(
                  character.id,
                );
                const affinity =
                  characterState.affinityByCharacter[character.id] ?? 0;
                const stage = getCharacterAffinityStage(affinity);
                const isActive =
                  character.id === characterState.activeCharacterId;
                return (
                  <div
                    key={character.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <CharacterPortraitSlot
                          character={character}
                          size="md"
                          label={`${character.name} · ${t('character.portrait.placeholder')}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {character.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {character.tagline}
                          </p>
                          {character.bioKey ? (
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {t(character.bioKey)}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-slate-600">
                            {unlocked
                              ? `${t('profile.companion.stageLabel')} ${stage} · ${t('profile.companion.affinityLabel')} ${affinity}`
                              : getCharacterUnlockText(
                                  character,
                                  playerStats,
                                  t,
                                )}
                          </p>
                          {unlocked ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                              {t('profile.companion.mountsPlaceholder')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {unlocked ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={isActive ? 'default' : 'outline'}
                          className={
                            isActive
                              ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                              : 'border-slate-200'
                          }
                          onClick={() => switchCharacter(character.id)}
                        >
                          {isActive
                            ? t('profile.companion.active')
                            : t('profile.companion.setActive')}
                        </Button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                          {t('profile.companion.locked')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-emerald-700/70 uppercase">
              {t('profile.checkin.title')}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {t('profile.checkin.date')} {checkinState.dateKey || '-'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.checkin.streak')}
                </p>
                <p className="mt-1 font-semibold">{checkinState.streakDays}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.checkin.total')}
                </p>
                <p className="mt-1 font-semibold">{checkinState.totalDays}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-200"
                onClick={claimWeekRewardAction}
                disabled={!canClaimWeek || weekClaimed}
              >
                {weekClaimed
                  ? `${t('profile.checkin.weekMilestone')} ${t('profile.checkin.claimed')}`
                  : `${t('profile.checkin.weekMilestone')} ${weekMilestone}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-200"
                onClick={claimMonthRewardAction}
                disabled={!canClaimMonth || monthClaimed}
              >
                {monthClaimed
                  ? `${t('profile.checkin.monthMilestone')} ${t('profile.checkin.claimed')}`
                  : `${t('profile.checkin.monthMilestone')} ${monthMilestone}`}
              </Button>
            </div>
            {checkinFeedback && (
              <p className="mt-2 text-xs text-emerald-700" role="status">
                {checkinFeedback}
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {t('profile.growthHistory.title')}
                </p>
                <span className="text-xs text-slate-500">
                  {growthHistoryMeta}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {recentFeed.length > 0 ? (
                  recentFeed.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                    >
                      <p className="text-sm text-slate-900">
                        {formatGrowthFeedLine(item, t)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    {t('profile.recentGrowth.empty')}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                {t('home.daily.title')}
              </p>
              <span className="text-xs text-slate-500">
                {dailyTaskState.dateKey}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {t('profile.task.completedPrefix')} {completedTaskCount}/
              {dailyTaskState.items.length}
            </p>
            <ul className="mt-3 space-y-2">
              {dailyTaskState.items.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {t(task.titleKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(task.descKey)}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        {t('profile.task.progressPrefix')} {task.progress}/
                        {task.target} · {t('profile.task.rewardPrefix')}{' '}
                        {task.rewardPoints}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        task.completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {task.completed
                        ? t('profile.task.status.settled')
                        : t('profile.task.status.pending')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                {t('profile.weekly.title')}
              </p>
              <span className="text-xs text-slate-500">
                {weeklyTaskState.weekKey}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {t('profile.task.completedPrefix')} {completedWeeklyTaskCount}/
              {weeklyTaskState.items.length}
            </p>
            <ul className="mt-3 space-y-2">
              {weeklyTaskState.items.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {t(task.titleKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(task.descKey)}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        {t('profile.task.progressPrefix')} {task.progress}/
                        {task.target} · {t('profile.task.rewardPrefix')}{' '}
                        {task.rewardPoints}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        task.completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {task.completed
                        ? t('profile.task.status.settled')
                        : t('profile.task.status.pending')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-medium text-slate-900">
              {t('profile.stats.title')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.stats.totalPlayCount')}
                </p>
                <p className="mt-1 font-semibold">
                  {playerStats.totalPlayCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.stats.riichiRounds')}
                </p>
                <p className="mt-1 font-semibold">{playerStats.riichiRounds}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.stats.riichiWins')}
                </p>
                <p className="mt-1 font-semibold">{playerStats.riichiWins}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {t('profile.stats.riichiRiichiCount')}
                </p>
                <p className="mt-1 font-semibold">
                  {playerStats.riichiRiichiCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 md:col-span-2">
                <p className="text-xs text-slate-500">
                  {t('profile.stats.riichiTsumoCount')}
                </p>
                <p className="mt-1 font-semibold">
                  {playerStats.riichiTsumoCount}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {(
                [
                  {
                    labelKey: 'profile.stats.winRate',
                    pct: riichiRatioStats.winRate,
                  },
                  {
                    labelKey: 'profile.stats.riichiRate',
                    pct: riichiRatioStats.riichiRate,
                  },
                  {
                    labelKey: 'profile.stats.tsumoShareOfWins',
                    pct: riichiRatioStats.tsumoShare,
                  },
                ] as const
              ).map(({ labelKey, pct }) => (
                <div
                  key={labelKey}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-xs text-slate-500">{t(labelKey)}</p>
                  <p className="mt-1 font-semibold">{pct.toFixed(1)}%</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600/90"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">
                {t('profile.stats.gamePlayCounts')}
              </p>
              {sortedGamePlayCounts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {sortedGamePlayCounts.map(([gameId, count]) => (
                    <li
                      key={gameId}
                      className="flex items-center justify-between"
                    >
                      <span>{t(`game.${gameId}.name`)}</span>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {t('profile.stats.noGameData')}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Profile;
