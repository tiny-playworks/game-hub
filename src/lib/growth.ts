import {
  type AchievementRarity,
  getAchievementSummary,
} from '@/lib/achievements';

export const GROWTH_STORAGE_KEY = 'game-hub-growth-state';
export const GROWTH_POINTS_GAINED_EVENT = 'game-hub:growth-points-gained';

export interface GrowthState {
  taskPoints: number;
  reservedTitles: string[];
  updatedAt: number;
}

export interface GrowthOverview {
  totalPoints: number;
  achievementPoints: number;
  taskPoints: number;
  unlockedAchievements: number;
  totalAchievements: number;
  rarityCounts: Record<AchievementRarity, number>;
}

export function createDefaultGrowthState(): GrowthState {
  return {
    taskPoints: 0,
    reservedTitles: [],
    updatedAt: Date.now(),
  };
}

function normalizeGrowthState(raw: unknown): GrowthState {
  const defaults = createDefaultGrowthState();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<GrowthState>;
  return {
    taskPoints:
      typeof parsed.taskPoints === 'number' &&
      Number.isFinite(parsed.taskPoints) &&
      parsed.taskPoints > 0
        ? Math.floor(parsed.taskPoints)
        : 0,
    reservedTitles: Array.isArray(parsed.reservedTitles)
      ? parsed.reservedTitles.filter(
          (title): title is string => typeof title === 'string',
        )
      : [],
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}

export function getGrowthState(): GrowthState {
  if (typeof localStorage === 'undefined') return createDefaultGrowthState();
  try {
    const raw = localStorage.getItem(GROWTH_STORAGE_KEY);
    if (!raw) return createDefaultGrowthState();
    return normalizeGrowthState(JSON.parse(raw));
  } catch {
    return createDefaultGrowthState();
  }
}

export function saveGrowthState(state: GrowthState): GrowthState {
  const normalized = normalizeGrowthState({
    ...state,
    updatedAt: Date.now(),
  });
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function addGrowthPoints(points: number): GrowthState {
  const safePoints = Number.isFinite(points)
    ? Math.max(0, Math.floor(points))
    : 0;
  const current = getGrowthState();
  const nextState = saveGrowthState({
    ...current,
    taskPoints: current.taskPoints + safePoints,
  });
  if (safePoints > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ points: number }>(GROWTH_POINTS_GAINED_EVENT, {
        detail: { points: safePoints },
      }),
    );
  }
  return nextState;
}

export function getGrowthOverview(): GrowthOverview {
  const achievementSummary = getAchievementSummary();
  const growth = getGrowthState();
  return {
    achievementPoints: achievementSummary.unlockedPoints,
    taskPoints: growth.taskPoints,
    totalPoints: achievementSummary.unlockedPoints + growth.taskPoints,
    unlockedAchievements: achievementSummary.unlocked,
    totalAchievements: achievementSummary.total,
    rarityCounts: achievementSummary.rarityCounts,
  };
}
