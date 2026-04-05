export interface PlayerTitleDefinition {
  id: string;
  nameKey: string;
  minPoints: number;
}

export const PLAYER_TITLE_DEFINITIONS: PlayerTitleDefinition[] = [
  {
    id: 'que-shi',
    nameKey: 'playerTitle.queShi',
    minPoints: 200,
  },
  {
    id: 'que-jie',
    nameKey: 'playerTitle.queJie',
    minPoints: 600,
  },
  {
    id: 'que-hao',
    nameKey: 'playerTitle.queHao',
    minPoints: 1200,
  },
];

function normalizePoints(totalPoints: number): number {
  if (!Number.isFinite(totalPoints)) return 0;
  return Math.max(0, Math.floor(totalPoints));
}

export function getTitleById(
  titleId: string | null | undefined,
): PlayerTitleDefinition | null {
  if (!titleId) return null;
  return PLAYER_TITLE_DEFINITIONS.find((title) => title.id === titleId) ?? null;
}

export function getUnlockedTitles(
  totalPoints: number,
): PlayerTitleDefinition[] {
  const safePoints = normalizePoints(totalPoints);
  return PLAYER_TITLE_DEFINITIONS.filter(
    (title) => safePoints >= title.minPoints,
  );
}

export function getHighestUnlockedTitle(
  totalPoints: number,
): PlayerTitleDefinition | null {
  const unlocked = getUnlockedTitles(totalPoints);
  if (unlocked.length === 0) return null;
  return unlocked[unlocked.length - 1] ?? null;
}

export function getNextLockedTitle(
  totalPoints: number,
): PlayerTitleDefinition | null {
  const safePoints = normalizePoints(totalPoints);
  return (
    PLAYER_TITLE_DEFINITIONS.find((title) => safePoints < title.minPoints) ??
    null
  );
}

export function resolveActiveTitle(
  activeTitleId: string | null | undefined,
  totalPoints: number,
): string | null {
  const unlockedIds = new Set(getUnlockedTitles(totalPoints).map((t) => t.id));
  if (activeTitleId && unlockedIds.has(activeTitleId)) return activeTitleId;
  return getHighestUnlockedTitle(totalPoints)?.id ?? null;
}
