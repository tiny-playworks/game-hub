export const GROWTH_FEED_STORAGE_KEY = 'game-hub-growth-feed';
export const GROWTH_FEED_MAX_ITEMS = 20;

export type GrowthFeedItemType =
  | 'task-reward'
  | 'achievement-unlock'
  | 'check-in'
  | 'check-in-milestone'
  | 'character-stage';

export interface GrowthFeedItem {
  id: string;
  type: GrowthFeedItemType;
  titleKey: string;
  detailKey?: string;
  points?: number;
  scope?: 'daily' | 'weekly' | 'week' | 'month';
  taskId?: string;
  achievementId?: string;
  characterId?: string;
  stage?: number;
  value?: number;
  createdAt: number;
}

function normalizeGrowthFeedItem(raw: unknown): GrowthFeedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<GrowthFeedItem>;
  if (
    typeof parsed.id !== 'string' ||
    typeof parsed.type !== 'string' ||
    typeof parsed.titleKey !== 'string' ||
    typeof parsed.createdAt !== 'number' ||
    !Number.isFinite(parsed.createdAt)
  ) {
    return null;
  }
  return {
    id: parsed.id,
    type: parsed.type as GrowthFeedItemType,
    titleKey: parsed.titleKey,
    detailKey:
      typeof parsed.detailKey === 'string' ? parsed.detailKey : undefined,
    points:
      typeof parsed.points === 'number' && Number.isFinite(parsed.points)
        ? Math.max(0, Math.floor(parsed.points))
        : undefined,
    scope:
      parsed.scope === 'daily' ||
      parsed.scope === 'weekly' ||
      parsed.scope === 'week' ||
      parsed.scope === 'month'
        ? parsed.scope
        : undefined,
    taskId: typeof parsed.taskId === 'string' ? parsed.taskId : undefined,
    achievementId:
      typeof parsed.achievementId === 'string'
        ? parsed.achievementId
        : undefined,
    characterId:
      typeof parsed.characterId === 'string' ? parsed.characterId : undefined,
    stage:
      typeof parsed.stage === 'number' && Number.isFinite(parsed.stage)
        ? Math.max(0, Math.floor(parsed.stage))
        : undefined,
    value:
      typeof parsed.value === 'number' && Number.isFinite(parsed.value)
        ? Math.max(0, Math.floor(parsed.value))
        : undefined,
    createdAt: parsed.createdAt,
  };
}

function getStoredGrowthFeed(): GrowthFeedItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GROWTH_FEED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeGrowthFeedItem(item))
      .filter((item): item is GrowthFeedItem => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, GROWTH_FEED_MAX_ITEMS);
  } catch {
    return [];
  }
}

function saveGrowthFeed(items: GrowthFeedItem[]): GrowthFeedItem[] {
  const normalized = [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, GROWTH_FEED_MAX_ITEMS);
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(GROWTH_FEED_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function appendGrowthFeedItem(
  item: Omit<GrowthFeedItem, 'id' | 'createdAt'> &
    Partial<Pick<GrowthFeedItem, 'id' | 'createdAt'>>,
): GrowthFeedItem {
  const nextItem: GrowthFeedItem = {
    ...item,
    id:
      item.id ??
      `${item.type}-${item.scope ?? 'base'}-${item.characterId ?? item.taskId ?? item.achievementId ?? 'item'}-${Date.now()}`,
    createdAt: item.createdAt ?? Date.now(),
  };
  const current = getStoredGrowthFeed();
  saveGrowthFeed([nextItem, ...current]);
  return nextItem;
}

export function getRecentGrowthFeed(
  limit = GROWTH_FEED_MAX_ITEMS,
): GrowthFeedItem[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(GROWTH_FEED_MAX_ITEMS, Math.floor(limit)))
    : GROWTH_FEED_MAX_ITEMS;
  return getStoredGrowthFeed().slice(0, safeLimit);
}
