import {
  ACHIEVEMENTS,
  type AchievementRarity,
  checkAndUnlockFromStats,
  getAchievementMeta,
  getUnlockedIds,
} from '@/lib/achievements';
import {
  type RecordDailyTaskEventResult,
  type RiichiDailyEvent,
  recordDailyTaskEvent,
} from '@/lib/dailyTasks';
import { emitGameEvent } from '@/lib/gameEvents';
import { getGrowthOverview } from '@/lib/growth';
import { appendGrowthFeedItem, type GrowthFeedItem } from '@/lib/growthFeed';
import { syncPlayerCharacterUnlocks } from '@/lib/playerCharacters';
import { recordRiichiStatEvent } from '@/lib/playerStats';
import { recordWeeklyTaskEvent } from '@/lib/weeklyTasks';

export type RiichiProgressEvent = RiichiDailyEvent;

export interface RiichiAchievementRewardSummary {
  id: string;
  nameKey: string;
  rarity: AchievementRarity;
  points: number;
}

export interface RiichiProgressStatDelta {
  totalPlayCount: number;
  riichiRounds: number;
  riichiWins: number;
  riichiRiichiCount: number;
  riichiTsumoCount: number;
}

export interface RiichiCharacterProgressSummary {
  characterId: string;
  characterName: string;
  previousAffinity: number;
  currentAffinity: number;
  previousStage: number;
  currentStage: number;
  stageIncreased: boolean;
}

export interface RiichiProgressResult {
  event: RiichiProgressEvent;
  autoClaimedTaskRewards: Array<
    | RecordDailyTaskEventResult['autoClaimedRewards'][number]
    | {
        taskId: string;
        titleKey: string;
        descKey: string;
        rewardPoints: number;
        scope: 'weekly';
      }
  >;
  rewardPoints: number;
  statDelta: RiichiProgressStatDelta;
  unlockedAchievements: RiichiAchievementRewardSummary[];
  recordedGrowthItems: GrowthFeedItem[];
  characterProgress: RiichiCharacterProgressSummary | null;
}

export interface RiichiRoundProgressSummary {
  /** Snapshot of total growth points before `enter-game` reset (session baseline). */
  growthPointsBeforeMatch?: number;
  autoClaimedTaskRewards: RiichiProgressResult['autoClaimedTaskRewards'];
  rewardPoints: number;
  statDelta: RiichiProgressStatDelta;
  unlockedAchievements: RiichiAchievementRewardSummary[];
  recordedGrowthItems: GrowthFeedItem[];
  characterProgress: RiichiCharacterProgressSummary | null;
}

const EMPTY_STAT_DELTA: RiichiProgressStatDelta = {
  totalPlayCount: 0,
  riichiRounds: 0,
  riichiWins: 0,
  riichiRiichiCount: 0,
  riichiTsumoCount: 0,
};

let currentRoundSummary: RiichiRoundProgressSummary = createEmptyRoundSummary();

function createEmptyRoundSummary(): RiichiRoundProgressSummary {
  return {
    autoClaimedTaskRewards: [],
    rewardPoints: 0,
    statDelta: { ...EMPTY_STAT_DELTA },
    unlockedAchievements: [],
    recordedGrowthItems: [],
    characterProgress: null,
  };
}

function getStatDeltaForEvent(
  event: RiichiProgressEvent,
): RiichiProgressStatDelta {
  return {
    totalPlayCount: event === 'enter-game' ? 1 : 0,
    riichiRounds: event === 'finish-round' ? 1 : 0,
    riichiWins: event === 'win-hand' ? 1 : 0,
    riichiRiichiCount: event === 'declare-riichi' ? 1 : 0,
    riichiTsumoCount: event === 'tsumo-win' ? 1 : 0,
  };
}

function mergeStatDelta(
  current: RiichiProgressStatDelta,
  next: RiichiProgressStatDelta,
): RiichiProgressStatDelta {
  return {
    totalPlayCount: current.totalPlayCount + next.totalPlayCount,
    riichiRounds: current.riichiRounds + next.riichiRounds,
    riichiWins: current.riichiWins + next.riichiWins,
    riichiRiichiCount: current.riichiRiichiCount + next.riichiRiichiCount,
    riichiTsumoCount: current.riichiTsumoCount + next.riichiTsumoCount,
  };
}

function getNewlyUnlockedAchievements(): RiichiAchievementRewardSummary[] {
  const beforeIds = new Set(getUnlockedIds());
  checkAndUnlockFromStats();
  const afterIds = new Set(getUnlockedIds());
  const newlyUnlockedIds = [...afterIds].filter((id) => !beforeIds.has(id));
  return newlyUnlockedIds
    .map((id) => {
      const def = ACHIEVEMENTS.find((item) => item.id === id);
      if (!def) return null;
      const meta = getAchievementMeta(def);
      return {
        id,
        nameKey: def.nameKey,
        rarity: meta.rarity,
        points: meta.points,
      };
    })
    .filter((item): item is RiichiAchievementRewardSummary => item !== null);
}

function buildTaskRewardFeedItems(
  rewards: RiichiProgressResult['autoClaimedTaskRewards'],
): GrowthFeedItem[] {
  return rewards.map((reward) =>
    appendGrowthFeedItem({
      type: 'task-reward',
      titleKey: reward.titleKey,
      detailKey: reward.descKey,
      points: reward.rewardPoints,
      taskId: reward.taskId,
      scope: reward.scope,
    }),
  );
}

function buildAchievementFeedItems(
  rewards: RiichiAchievementRewardSummary[],
): GrowthFeedItem[] {
  return rewards.map((reward) =>
    appendGrowthFeedItem({
      type: 'achievement-unlock',
      titleKey: reward.nameKey,
      points: reward.points,
      achievementId: reward.id,
    }),
  );
}

function buildCharacterStageFeedItem(
  progress: RiichiCharacterProgressSummary | null,
): GrowthFeedItem[] {
  if (!progress?.stageIncreased) return [];
  return [
    appendGrowthFeedItem({
      type: 'character-stage',
      titleKey: 'growth.feed.character.stage.title',
      detailKey: 'growth.feed.character.stage.detail',
      characterId: progress.characterId,
      stage: progress.currentStage,
      value: progress.currentAffinity,
    }),
  ];
}

export function resetCurrentRiichiRoundProgressSummary(): void {
  currentRoundSummary = createEmptyRoundSummary();
}

export function getCurrentRiichiRoundProgressSummary(): RiichiRoundProgressSummary {
  return currentRoundSummary;
}

export function recordRiichiProgressEvent(
  event: RiichiProgressEvent,
): RiichiProgressResult {
  if (event === 'enter-game') {
    const growthPointsBeforeMatch = getGrowthOverview().totalPoints;
    resetCurrentRiichiRoundProgressSummary();
    currentRoundSummary = {
      ...currentRoundSummary,
      growthPointsBeforeMatch,
    };
  }

  const startResult =
    event === 'enter-game'
      ? emitGameEvent({ gameId: 'mahjong-japanese', type: 'start' })
      : null;
  recordRiichiStatEvent(event);
  if (event === 'finish-round') syncPlayerCharacterUnlocks();
  const autoClaimedTaskRewards = startResult?.taskRewards ?? [
    ...recordDailyTaskEvent(event).autoClaimedRewards,
    ...recordWeeklyTaskEvent(event).autoClaimedRewards,
  ];
  const unlockedAchievements = startResult
    ? startResult.unlockedAchievements.map((reward) => ({
        id: reward.id,
        nameKey: reward.nameKey ?? reward.id,
        rarity: reward.rarity ?? 'common',
        points: reward.points ?? 0,
      }))
    : getNewlyUnlockedAchievements();
  const rewardPoints = autoClaimedTaskRewards.reduce(
    (total, reward) => total + reward.rewardPoints,
    0,
  );
  const statDelta = getStatDeltaForEvent(event);
  const characterProgress = null;

  const recordedGrowthItems = [
    ...buildTaskRewardFeedItems(autoClaimedTaskRewards),
    ...buildAchievementFeedItems(unlockedAchievements),
    ...buildCharacterStageFeedItem(characterProgress),
  ];

  currentRoundSummary = {
    autoClaimedTaskRewards: [
      ...currentRoundSummary.autoClaimedTaskRewards,
      ...autoClaimedTaskRewards,
    ],
    rewardPoints: currentRoundSummary.rewardPoints + rewardPoints,
    statDelta: mergeStatDelta(currentRoundSummary.statDelta, statDelta),
    unlockedAchievements: [
      ...currentRoundSummary.unlockedAchievements,
      ...unlockedAchievements,
    ],
    recordedGrowthItems: [
      ...currentRoundSummary.recordedGrowthItems,
      ...recordedGrowthItems,
    ],
    characterProgress:
      characterProgress ?? currentRoundSummary.characterProgress,
    growthPointsBeforeMatch: currentRoundSummary.growthPointsBeforeMatch,
  };

  return {
    event,
    autoClaimedTaskRewards,
    rewardPoints,
    statDelta,
    unlockedAchievements,
    recordedGrowthItems,
    characterProgress,
  };
}

/** Whole-match settlement; the store guards this against undo/resume duplicates. */
export function recordRiichiMatchFinish(
  placement: number,
  matchLength: 'east' | 'south',
  matchId?: string,
) {
  return emitGameEvent({
    gameId: 'mahjong-japanese',
    type: 'finish',
    meta: { placement, matchLength, matchId },
  });
}
