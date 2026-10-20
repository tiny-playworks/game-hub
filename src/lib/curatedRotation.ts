import {
  JOURNEY_STAGES,
  getJourneyStage,
  getJourneyStageForCharacter,
} from './riichiJourney';
import { gameStorage } from './storage';

export const CURATED_ROTATION_VERSION = 1;
export const CURATED_BADGES_STORAGE_KEY = 'game-hub-curated-badges-v1';

export interface CuratedJourneyItem {
  id: string;
  type: 'journey';
  stageId?: string;
}

export interface CuratedReplayBranchItem {
  id: string;
  type: 'replay_branch';
}

export interface CuratedFamilyCupItem {
  id: string;
  type: 'family_cup';
}

export type CuratedConfigItem =
  CuratedJourneyItem | CuratedReplayBranchItem | CuratedFamilyCupItem;

export interface CuratedRotationConfig {
  version: number;
  configId: string;
  items: CuratedConfigItem[];
}

export const CURATED_ROTATION_CONFIG_V1: CuratedRotationConfig = {
  version: 1,
  configId: 'curated-season1-kickoff',
  items: [
    { id: 'curated-journey-step', type: 'journey' },
    { id: 'curated-replay-review', type: 'replay_branch' },
    { id: 'curated-family-table', type: 'family_cup' },
  ],
};

export const CURATED_ROTATION_CONFIG_V2: CuratedRotationConfig = {
  version: 2,
  configId: 'curated-season1-midseason',
  items: [
    { id: 'curated-journey-yoru', type: 'journey', stageId: 'yoru-reading' },
    { id: 'curated-replay-review', type: 'replay_branch' },
    { id: 'curated-family-table', type: 'family_cup' },
  ],
};

export const CURATED_ROTATION_CONFIGS: Record<number, CuratedRotationConfig> = {
  1: CURATED_ROTATION_CONFIG_V1,
  2: CURATED_ROTATION_CONFIG_V2,
};

export function getActiveCuratedRotationConfig(
  version = CURATED_ROTATION_VERSION,
): CuratedRotationConfig {
  return CURATED_ROTATION_CONFIGS[version] ?? CURATED_ROTATION_CONFIG_V1;
}

export interface CuratedPlayerContext {
  memberMode: boolean;
  isServerAvailable: boolean;
  completedJourneyStageIds: string[];
  completedJourneyVariationIds?: string[];
  companionCharacterId?: string;
  hasEligibleReplay: boolean;
}

export interface ResolvedCuratedItem {
  id: string;
  type: 'journey' | 'replay_branch' | 'family_cup';
  titleKey: string;
  titleParams?: Record<string, string | number>;
  descKey: string;
  descParams?: Record<string, string | number>;
  tagKey: string;
  targetPath: string;
  stageId?: string;
  badge: 'recommend' | 'revisit' | 'practice' | 'cup';
}

export function resolveCuratedRecommendations(
  context: CuratedPlayerContext,
  config: CuratedRotationConfig = getActiveCuratedRotationConfig(),
): ResolvedCuratedItem[] {
  const result: ResolvedCuratedItem[] = [];

  for (const item of config.items) {
    if (item.type === 'journey') {
      let stage = item.stageId ? getJourneyStage(item.stageId) : undefined;
      if (!stage) {
        // 查找第一个未完成的巡礼关卡
        stage = JOURNEY_STAGES.find(
          (s) => !context.completedJourneyStageIds.includes(s.id),
        );
      }
      if (!stage) {
        // 如果全部 9 关均已完成，优先推荐当前伴侣的对应关卡或第一关重温
        stage =
          (context.companionCharacterId
            ? getJourneyStageForCharacter(context.companionCharacterId)
            : undefined) ?? JOURNEY_STAGES[0];
      }

      if (stage) {
        const isCompleted = context.completedJourneyStageIds.includes(stage.id);
        const stageIndex =
          JOURNEY_STAGES.findIndex((s) => s.id === stage!.id) + 1;
        result.push({
          id: item.id,
          type: 'journey',
          stageId: stage.id,
          titleKey: isCompleted
            ? 'play.curatedVariationTitle'
            : 'curated.journey.nextTitle',
          titleParams: { stage: stage.titleKey, index: stageIndex },
          descKey: isCompleted
            ? 'play.curatedVariationDesc'
            : 'curated.journey.nextDesc',
          descParams: {
            venue: stage.venueKey,
            index: stageIndex,
            stage: stage.titleKey,
          },
          tagKey: isCompleted ? 'curated.tag.revisit' : 'curated.tag.recommend',
          badge: isCompleted ? 'revisit' : 'recommend',
          targetPath: `/journey?stage=${stage.id}${isCompleted ? `&variation=${context.completedJourneyVariationIds?.includes(`${stage.id}:1`) && !context.completedJourneyVariationIds?.includes(`${stage.id}:2`) ? '2' : '1'}` : ''}`,
        });
      }
    } else if (item.type === 'replay_branch') {
      // 只有拥有本人有效实战牌谱时才展示练习推荐（P21 §21.1）
      if (context.hasEligibleReplay) {
        result.push({
          id: item.id,
          type: 'replay_branch',
          titleKey: 'curated.replay.title',
          descKey: 'curated.replay.desc',
          tagKey: 'curated.tag.practice',
          badge: 'practice',
          targetPath: '/replays/training',
        });
      }
    } else if (item.type === 'family_cup') {
      // 在当前成员模式有效或局域网服务可用时才展示家庭杯赛入口
      if (context.memberMode || context.isServerAvailable) {
        result.push({
          id: item.id,
          type: 'family_cup',
          titleKey: 'curated.cup.title',
          descKey: 'curated.cup.desc',
          tagKey: 'curated.tag.cup',
          badge: 'cup',
          targetPath: '/family',
        });
      }
    }
  }

  return result;
}

/** 独立且幂等的精选回访徽记记录（P21 §21.2：不额外重复发放雀币、成长或段位点数） */
export function getCuratedBadges(): string[] {
  try {
    const raw = gameStorage.getItem(CURATED_BADGES_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as string[]) : [];
  } catch {
    return [];
  }
}

export function recordCuratedBadge(badgeId: string): {
  newlyEarned: boolean;
  badges: string[];
} {
  const current = getCuratedBadges();
  if (current.includes(badgeId)) {
    return { newlyEarned: false, badges: current };
  }
  const next = [...current, badgeId];
  try {
    gameStorage.setItem(CURATED_BADGES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota error
  }
  return { newlyEarned: true, badges: next };
}
