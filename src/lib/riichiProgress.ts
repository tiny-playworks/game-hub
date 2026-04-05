import {
  ACHIEVEMENTS,
  checkAndUnlockFromStats,
  getAchievementMeta,
  getUnlockedIds,
  type AchievementRarity,
} from '@/lib/achievements';
import {
  type RecordDailyTaskEventResult,
  type RiichiDailyEvent,
  recordDailyTaskEvent,
} from '@/lib/dailyTasks';
import {
  appendGrowthFeedItem,
  type GrowthFeedItem,
} from '@/lib/growthFeed';
import {
  addActiveCharacterAffinity,
  type CharacterAffinityProgress,
} from '@/lib/playerCharacters';
import { recordGameStart, recordRiichiStatEvent } from '@/lib/playerStats';
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
    RecordDailyTaskEventResult['autoClaimedRewards'][number] | {
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

function getStatDeltaForEvent(event: RiichiProgressEvent): RiichiProgressStatDelta {
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
    .filter(
      (item): item is RiichiAchievementRewardSummary => item !== null,
    );
}

function buildCharacterProgressSummary(
  progress: CharacterAffinityProgress,
): RiichiCharacterProgressSummary {
  return {
    characterId: progress.character.id,
    characterName: progress.character.name,
    previousAffinity: progress.previousAffinity,
    currentAffinity: progress.currentAffinity,
    previousStage: progress.previousStage,
    currentStage: progress.currentStage,
    stageIncreased: progress.currentStage > progress.previousStage,
  };
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
  if (!progress || !progress.stageIncreased) return [];
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
    resetCurrentRiichiRoundProgressSummary();
  }

  const dailyResult = recordDailyTaskEvent(event);
  const weeklyResult = recordWeeklyTaskEvent(event);
  recordRiichiStatEvent(event);
  if (event === 'enter-game') {
    recordGameStart('mahjong-japanese');
  }

  const unlockedAchievements = getNewlyUnlockedAchievements();
  const autoClaimedTaskRewards = [
    ...dailyResult.autoClaimedRewards,
    ...weeklyResult.autoClaimedRewards,
  ];
  const rewardPoints = autoClaimedTaskRewards.reduce(
    (total, reward) => total + reward.rewardPoints,
    0,
  );
  const statDelta = getStatDeltaForEvent(event);
  const characterProgress =
    event === 'finish-round'
      ? buildCharacterProgressSummary(addActiveCharacterAffinity(1))
      : null;

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
    characterProgress: characterProgress ?? currentRoundSummary.characterProgress,
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
