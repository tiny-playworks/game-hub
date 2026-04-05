import type { RiichiDailyEvent } from '@/lib/dailyTasks';

export const PLAYER_STATS_STORAGE_KEY = 'game-hub-player-stats';

export interface PlayerStatsState {
  totalPlayCount: number;
  gamePlayCounts: Record<string, number>;
  riichiRounds: number;
  riichiWins: number;
  riichiRiichiCount: number;
  riichiTsumoCount: number;
  updatedAt: number;
}

export function createDefaultPlayerStats(): PlayerStatsState {
  return {
    totalPlayCount: 0,
    gamePlayCounts: {},
    riichiRounds: 0,
    riichiWins: 0,
    riichiRiichiCount: 0,
    riichiTsumoCount: 0,
    updatedAt: Date.now(),
  };
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeStats(raw: unknown): PlayerStatsState {
  const defaults = createDefaultPlayerStats();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<PlayerStatsState>;
  const gamePlayCounts: Record<string, number> = {};
  if (parsed.gamePlayCounts && typeof parsed.gamePlayCounts === 'object') {
    for (const [key, value] of Object.entries(parsed.gamePlayCounts)) {
      const count = safeCount(value);
      if (count > 0) gamePlayCounts[key] = count;
    }
  }
  return {
    totalPlayCount: safeCount(parsed.totalPlayCount),
    gamePlayCounts,
    riichiRounds: safeCount(parsed.riichiRounds),
    riichiWins: safeCount(parsed.riichiWins),
    riichiRiichiCount: safeCount(parsed.riichiRiichiCount),
    riichiTsumoCount: safeCount(parsed.riichiTsumoCount),
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}

export function getPlayerStats(): PlayerStatsState {
  if (typeof localStorage === 'undefined') return createDefaultPlayerStats();
  try {
    const raw = localStorage.getItem(PLAYER_STATS_STORAGE_KEY);
    if (!raw) return createDefaultPlayerStats();
    return normalizeStats(JSON.parse(raw));
  } catch {
    return createDefaultPlayerStats();
  }
}

export function savePlayerStats(state: PlayerStatsState): PlayerStatsState {
  const normalized = normalizeStats({ ...state, updatedAt: Date.now() });
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(PLAYER_STATS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function recordGameStart(gameId: string): PlayerStatsState {
  const current = getPlayerStats();
  const nextCount = (current.gamePlayCounts[gameId] ?? 0) + 1;
  return savePlayerStats({
    ...current,
    totalPlayCount: current.totalPlayCount + 1,
    gamePlayCounts: {
      ...current.gamePlayCounts,
      [gameId]: nextCount,
    },
  });
}

export function recordRiichiStatEvent(
  event: RiichiDailyEvent,
): PlayerStatsState {
  const current = getPlayerStats();
  const next: PlayerStatsState = { ...current };
  if (event === 'finish-round') next.riichiRounds += 1;
  if (event === 'win-hand') next.riichiWins += 1;
  if (event === 'declare-riichi') next.riichiRiichiCount += 1;
  if (event === 'tsumo-win') next.riichiTsumoCount += 1;
  return savePlayerStats(next);
}
