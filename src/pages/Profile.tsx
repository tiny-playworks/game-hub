import { Check, LockKeyhole, Upload } from 'lucide-react';
import {
  type ChangeEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { CharacterOutfitPicker } from '@/components/characters/CharacterOutfitPicker';
import { PlayerAvatar } from '@/components/home/PlayerAvatar';
import { DataManagementCard } from '@/components/profile/DataManagementCard';
import { WalletCard } from '@/components/profile/WalletCard';
import { RankedProfilePanel } from '@/components/ranked/RankedProfilePanel';
import { TaskClaimButton } from '@/components/TaskClaimButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import {
  CHECKIN_MONTH_MILESTONES,
  CHECKIN_WEEK_MILESTONES,
  type CheckinState,
  checkinToday,
  claimMonthMilestone,
  claimWeekMilestone,
  getCheckinState,
  getBeijingDateKey,
} from '@/lib/checkin';
import { type DailyTaskState, getDailyTaskState } from '@/lib/dailyTasks';
import { getGrowthOverview } from '@/lib/growth';
import { type GrowthFeedItem, getFullGrowthFeed } from '@/lib/growthFeed';
import {
  CHARACTER_DEFS,
  type CharacterDef,
  getCharacterAffinityStage,
  getCharacterById,
  getPlayerCharacterState,
  type PlayerCharacterState,
  setActiveCharacter,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import {
  cropImageFileToSquareDataUrl,
  getPlayerProfile,
  PLAYER_AVATAR_PRESETS,
  sanitizeNickname,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import { getPlayerStats, type PlayerStatsState } from '@/lib/playerStats';
import { getRankedState } from '@/lib/ranked';
import {
  getNextLockedTitle,
  getTitleById,
  getUnlockedTitles,
  resolveActiveTitle,
} from '@/lib/titles';
import { cn } from '@/lib/utils';
import { getWeeklyTaskState, type WeeklyTaskState } from '@/lib/weeklyTasks';

function formatGrowthFeedLine(
  item: GrowthFeedItem,
  t: (key: string) => string,
): string {
  if (item.type === 'character-stage') {
    const character = item.characterId
      ? getCharacterById(item.characterId)
      : null;
    return `${character ? t(character.nameKey) : t('growth.feed.characterFallback')} ${t('growth.feed.characterStageVerb')} ${item.stage ?? 0}`;
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
  const rankBand =
    character.unlockRule.type === 'rank-band'
      ? character.unlockRule.target
      : character.unlockRule.rankBand;
  const rankText = `${t('profile.companion.unlock.rankPrefix')} ${t(`character.rank.${rankBand}`)}`;
  if (character.unlockRule.type === 'rank-band') {
    return `${rankText} · ${t('profile.companion.unlock.rankPending')}`;
  }
  if (character.unlockRule.type === 'riichi-rounds') {
    return `${t('profile.companion.unlock.riichiRoundsPrefix')} ${stats.riichiRounds}/${character.unlockRule.target} · ${t('profile.companion.unlock.or')} ${rankText}`;
  }
  return `${t('profile.companion.unlock.winsPrefix')} ${stats.riichiWins}/${character.unlockRule.target} · ${t('profile.companion.unlock.or')} ${rankText}`;
}

const Profile = () => {
  const { t } = useLocale();
  const household = useOptionalHousehold();
  const memberMode = household?.mode === 'member-online';
  const profile = usePlayerProfile();
  const [nicknameDraft, setNicknameDraft] = useState(
    () => getPlayerProfile().nickname,
  );
  const [dailyTaskState, setDailyTaskState] = useState<DailyTaskState>(() =>
    getDailyTaskState(),
  );
  const [weeklyTaskState, setWeeklyTaskState] = useState<WeeklyTaskState>(() =>
    getWeeklyTaskState(),
  );
  const [checkinState, setCheckinState] = useState<CheckinState>(() =>
    getCheckinState(),
  );
  const [growthOverview, setGrowthOverview] = useState(() =>
    getGrowthOverview(),
  );
  const [playerStats, setPlayerStats] = useState<PlayerStatsState>(() =>
    getPlayerStats(),
  );
  const [characterState, setCharacterState] = useState<PlayerCharacterState>(
    getPlayerCharacterState,
  );
  const [recentFeed, setRecentFeed] = useState(() => getFullGrowthFeed());
  const growthHistoryMeta = useMemo(
    () =>
      t(memberMode ? 'profile.growthHistory.memberMeta' : 'profile.growthHistory.meta').replace(
        '{{count}}',
        String(recentFeed.length),
      ),
    [memberMode, recentFeed.length, t],
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [checkinFeedback, setCheckinFeedback] = useState('');
  const [characterError, setCharacterError] = useState('');
  const [checkinBusy, setCheckinBusy] = useState(false);

  const refreshDashboard = useCallback(() => {
    const nextDaily = getDailyTaskState();
    const nextWeekly = getWeeklyTaskState();
    const nextCheckin = getCheckinState();
    const nextGrowth = getGrowthOverview();
    const nextStats = getPlayerStats();
    const nextCharacterState = memberMode
      ? getPlayerCharacterState()
      : syncPlayerCharacterUnlocks(getRankedState().peak.band).state;
    const currentProfile = getPlayerProfile();
    const resolvedTitleId = resolveActiveTitle(
      currentProfile.activeTitle,
      nextGrowth.totalPoints,
    );
    if (resolvedTitleId !== currentProfile.activeTitle) {
      updatePlayerProfile({ activeTitle: resolvedTitleId });
    }

    setDailyTaskState(nextDaily);
    setWeeklyTaskState(nextWeekly);
    setCheckinState(nextCheckin);
    setGrowthOverview(nextGrowth);
    setPlayerStats(nextStats);
    setCharacterState(nextCharacterState);
    setRecentFeed(getFullGrowthFeed());
    setNicknameDraft(getPlayerProfile().nickname);
  }, [memberMode]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard, household?.snapshot?.revision]);

  const saveNickname = () => {
    const next = updatePlayerProfile({
      nickname: sanitizeNickname(nicknameDraft),
    });
    setNicknameDraft(next.nickname);
  };

  const applyPresetAvatar = (presetId: string) => {
    updatePlayerProfile({
      avatarMode: 'preset',
      avatarPresetId: presetId,
    });
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
      updatePlayerProfile({
        avatarMode: 'upload',
        avatarUploadDataUrl: dataUrl,
      });
    } catch {
      setAvatarError(t('home.player.avatarUploadFailed'));
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const switchTitle = (titleId: string) => {
    updatePlayerProfile({ activeTitle: titleId });
  };

  const switchCharacter = async (characterId: string) => {
    try {
      if (memberMode) {
        await household!.selectCharacter(characterId);
        setCharacterState(getPlayerCharacterState());
      } else {
        setCharacterState(setActiveCharacter(characterId));
      }
      setCharacterError('');
    } catch {
      setCharacterError(t('save.failed'));
    }
  };

  const checkinTodayAction = async () => {
    setCheckinBusy(true);
    try {
      const result = memberMode
        ? await household!.performProgressAction({ type: 'checkin' })
        : checkinToday();
      refreshDashboard();
      setCheckinFeedback(
        result.ok
          ? `${t('profile.checkin.feedback.daily')}${result.awardedPoints} · +${result.awardedCoins} ${t('wallet.coins')}`
          : t('profile.checkin.feedback.already'),
      );
    } catch {
      setCheckinFeedback(t('save.failed'));
    } finally {
      setCheckinBusy(false);
    }
  };

  const claimWeekRewardAction = async () => {
    setCheckinBusy(true);
    try {
      const result = memberMode
        ? await household!.performProgressAction({ type: 'checkin-week' })
        : claimWeekMilestone(CHECKIN_WEEK_MILESTONES[0]);
      refreshDashboard();
      if (result.ok)
        setCheckinFeedback(`${t('profile.checkin.feedback.week')}${result.awardedPoints}`);
    } catch {
      setCheckinFeedback(t('save.failed'));
    } finally {
      setCheckinBusy(false);
    }
  };

  const claimMonthRewardAction = async () => {
    setCheckinBusy(true);
    try {
      const result = memberMode
        ? await household!.performProgressAction({ type: 'checkin-month' })
        : claimMonthMilestone(CHECKIN_MONTH_MILESTONES[0]);
      refreshDashboard();
      if (result.ok)
        setCheckinFeedback(`${t('profile.checkin.feedback.month')}${result.awardedPoints}`);
    } catch {
      setCheckinFeedback(t('save.failed'));
    } finally {
      setCheckinBusy(false);
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
    <div className="venue-profile min-h-screen bg-background text-foreground">
      <div className="venue-page-heading venue-heading-contained">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.heroSubtitle')}</p>
      </div>

      <main className="venue-profile-grid mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-[0.92fr_1.08fr] md:py-10">
        <div className="venue-profile-sections space-y-4">
          <section className="venue-identity rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-primary/80 uppercase">
              {t('venue.profile.settings')}
            </p>
            <div className="mt-3 flex items-start gap-4">
              <PlayerAvatar profile={profile} />
              <div className="min-w-0 flex-1 space-y-2">
                <label
                  className="text-xs text-muted-foreground"
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
                    className="h-10 border-border bg-card"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border"
                    onClick={saveNickname}
                  >
                    {t('home.player.save')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('home.player.currentTitle')}：
                  <span className="ml-1 font-medium text-foreground">
                    {activeTitle
                      ? t(activeTitle.nameKey)
                      : t('profile.titles.none')}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
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
                        ? 'ring-2 ring-primary'
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
              <p className="text-xs text-muted-foreground">
                {t('home.player.avatarUpload')}
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
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

            <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">
                {t('profile.audio.section')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('profile.audio.hint')}
              </p>
              {(
                [
                  { key: 'bgm' as const, labelKey: 'profile.audio.bgm' },
                  { key: 'sfx' as const, labelKey: 'profile.audio.sfx' },
                  { key: 'voice' as const, labelKey: 'profile.audio.voice' },
                ] as const
              ).map(({ key, labelKey }) => (
                <div
                  key={key}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                >
                  <label
                    className="shrink-0 text-xs text-muted-foreground sm:w-28"
                    htmlFor={`audio-${key}`}
                  >
                    {t(labelKey)}
                  </label>
                  <input
                    id={`audio-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(profile.audioVolumes[key] * 100)}
                    onChange={(event) => {
                      const v = Number(event.target.value) / 100;
                      updatePlayerProfile({
                        audioVolumes: { ...profile.audioVolumes, [key]: v },
                      });
                    }}
                    className="h-2 w-full flex-1 cursor-pointer accent-emerald-600"
                  />
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:w-10">
                    {Math.round(profile.audioVolumes[key] * 100)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">
                {t('profile.titles.section')}
              </p>
              {nextLockedTitle && (
                <p className="mt-1 text-xs text-muted-foreground">
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
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {t(title.nameKey)}
                      </button>
                    );
                  })
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {t('profile.titles.none')}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="venue-companion-settings rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-primary/80 uppercase">
              {t('profile.companion.section')}
            </p>
            <Link
              to="/characters"
              className="mt-2 inline-flex text-xs text-primary"
            >
              {t('characters.title')} →
            </Link>
            <div className="venue-active-companion">
              <CharacterPortraitSlot
                character={activeCharacter}
                size="lg"
                label={t(activeCharacter.nameKey)}
              />
              <div>
                <h2>{t(activeCharacter.nameKey)}</h2>
                <p>{t(activeCharacter.taglineKey)}</p>
                <span>
                  {t('profile.companion.stageLabel')} {activeStage} ·{' '}
                  {t('profile.companion.affinityLabel')} {activeAffinity}
                </span>
              </div>
            </div>
            <CharacterOutfitPicker character={activeCharacter} />
            <div className="venue-character-picker">
              {CHARACTER_DEFS.map((character) => {
                const unlocked = characterState.unlockedCharacterIds.includes(
                  character.id,
                );
                const active =
                  character.id === characterState.activeCharacterId;
                return (
                  <button
                    key={character.id}
                    type="button"
                    data-character-id={character.id}
                    aria-pressed={active}
                    disabled={!unlocked}
                    onClick={() => switchCharacter(character.id)}
                    title={
                      unlocked
                        ? t('profile.companion.setActive')
                        : getCharacterUnlockText(character, playerStats, t)
                    }
                  >
                    <CharacterPortraitSlot
                      character={character}
                      size="md"
                      label={t(character.nameKey)}
                    />
                    {!unlocked && (
                      <LockKeyhole
                        className="venue-character-lock"
                        aria-hidden="true"
                      />
                    )}
                    <strong>{t(character.nameKey)}</strong>
                    <small>
                      {t(
                        active
                          ? 'profile.companion.active'
                          : unlocked
                            ? 'profile.companion.setActive'
                            : 'profile.companion.locked',
                      )}
                    </small>
                  </button>
                );
              })}
            </div>
            {characterError && <p role="alert" className="mt-2 text-sm text-destructive">{characterError}</p>}
          </section>

          <section className="rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-primary/80 uppercase">
              {t('profile.checkin.title')}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('profile.checkin.date')} {checkinState.dateKey || '-'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.checkin.streak')}
                </p>
                <p className="mt-1 font-semibold">{checkinState.streakDays}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.checkin.total')}
                </p>
                <p className="mt-1 font-semibold">{checkinState.totalDays}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={checkinTodayAction}
                disabled={checkedInToday || checkinBusy}
              >
                {checkedInToday
                  ? t('profile.checkin.checkedIn')
                  : t('profile.checkin.action')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border"
                onClick={claimWeekRewardAction}
                disabled={!canClaimWeek || weekClaimed || checkinBusy}
              >
                {weekClaimed
                  ? `${t('profile.checkin.weekMilestone')} ${t('profile.checkin.claimed')}`
                  : `${t('profile.checkin.weekMilestone')} ${weekMilestone}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border"
                onClick={claimMonthRewardAction}
                disabled={!canClaimMonth || monthClaimed || checkinBusy}
              >
                {monthClaimed
                  ? `${t('profile.checkin.monthMilestone')} ${t('profile.checkin.claimed')}`
                  : `${t('profile.checkin.monthMilestone')} ${monthMilestone}`}
              </Button>
            </div>
            {checkinFeedback && (
              <p className="mt-2 text-xs text-primary" role="status">
                {checkinFeedback}
              </p>
            )}
          </section>
        </div>

        <div className="venue-profile-sections space-y-4">
          <section className="rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-medium tracking-[0.2em] text-primary/80 uppercase">
              {t('home.growth.title')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('home.growth.totalPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {growthOverview.totalPoints}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('home.growth.achievementPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {growthOverview.achievementPoints}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('home.growth.taskPoints')}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {growthOverview.taskPoints}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('home.growth.achievementProgress')}
              {growthOverview.unlockedAchievements}/
              {growthOverview.totalAchievements}
            </p>

            <div className="mt-4 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {t('profile.growthHistory.title')}
                </p>
                <span className="text-xs text-muted-foreground">
                  {growthHistoryMeta}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {recentFeed.length > 0 ? (
                  recentFeed.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-muted/40/80 p-3"
                    >
                      <p className="text-sm text-foreground">
                        {formatGrowthFeedLine(item, t)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('profile.recentGrowth.empty')}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {t('home.daily.title')}
              </p>
              <span className="text-xs text-muted-foreground">
                {dailyTaskState.dateKey}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('profile.task.completedPrefix')} {completedTaskCount}/
              {dailyTaskState.items.length}
            </p>
            <ul className="mt-3 space-y-3">
              {dailyTaskState.items.map((task) => (
                <li
                  key={task.id}
                  className={cn(
                    'rounded-2xl border p-3 transition-colors',
                    task.completed
                      ? 'border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'
                      : 'border-border bg-muted/40/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {task.completed ? (
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
                            title={
                              task.claimed
                                ? t('home.daily.claimed')
                                : t('arcade.claim')
                            }
                          >
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </span>
                        ) : null}
                        <p
                          className={cn(
                            'text-sm font-medium',
                            task.completed
                              ? 'text-foreground'
                              : 'text-foreground',
                          )}
                        >
                          {t(task.titleKey)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          task.completed
                            ? 'text-primary/80'
                            : 'text-muted-foreground',
                        )}
                      >
                        {t(task.descKey)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-1 text-xs tabular-nums',
                        task.completed
                          ? 'bg-card/90 text-primary ring-1 ring-primary/30'
                          : 'bg-card text-muted-foreground',
                      )}
                    >
                      {task.progress}/{task.target}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xs',
                      task.completed
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {task.claimed
                      ? `${t('home.daily.settledPrefix')}${task.rewardPoints} · +40 ${t('wallet.coins')}`
                      : `${t('home.daily.pendingRewardPrefix')}${task.rewardPoints} · 40 ${t('wallet.coins')}`}
                  </p>
                  <TaskClaimButton
                    task={task}
                    scope="daily"
                    onClaim={refreshDashboard}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {t('profile.weekly.title')}
              </p>
              <span className="text-xs text-muted-foreground">
                {weeklyTaskState.weekKey}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('profile.task.completedPrefix')} {completedWeeklyTaskCount}/
              {weeklyTaskState.items.length}
            </p>
            <ul className="mt-3 space-y-2">
              {weeklyTaskState.items.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {t(task.titleKey)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(task.descKey)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('profile.task.progressPrefix')} {task.progress}/
                        {task.target} · {t('profile.task.rewardPrefix')}{' '}
                        {task.rewardPoints} · 150 {t('wallet.coins')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        task.completed
                          ? 'bg-primary/15 text-primary'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {task.claimed
                        ? t('profile.task.status.settled')
                        : t('profile.task.status.pending')}
                    </span>
                  </div>
                  <TaskClaimButton
                    task={task}
                    scope="weekly"
                    onClaim={refreshDashboard}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-border paper-texture bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-medium text-foreground">
              {t('profile.stats.title')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.stats.totalPlayCount')}
                </p>
                <p className="mt-1 font-semibold">
                  {playerStats.totalPlayCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.stats.riichiRounds')}
                </p>
                <p className="mt-1 font-semibold">{playerStats.riichiRounds}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.stats.riichiWins')}
                </p>
                <p className="mt-1 font-semibold">{playerStats.riichiWins}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.stats.riichiRiichiCount')}
                </p>
                <p className="mt-1 font-semibold">
                  {playerStats.riichiRiichiCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">
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
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
                  <p className="mt-1 font-semibold">{pct.toFixed(1)}%</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600/90"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t('profile.stats.gamePlayCounts')}
              </p>
              {sortedGamePlayCounts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
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
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('profile.stats.noGameData')}
                </p>
              )}
            </div>
          </section>
        </div>
        <div className="venue-profile-summary">
          <WalletCard />
          <RankedProfilePanel />
          <DataManagementCard />
        </div>
      </main>
    </div>
  );
};

export default Profile;
