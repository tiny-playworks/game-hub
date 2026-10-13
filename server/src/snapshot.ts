import { normalizeGameState } from '@/lib/arcadeStats';
import { createDefaultCheckinState, normalizeCheckinState } from '@/lib/checkin';
import { normalizeCosmetics } from '@/lib/cosmetics';
import {
  createDailyTaskState,
  normalizeDailyTaskState,
} from '@/lib/dailyTasks';
import { createDefaultGrowthState, normalizeGrowthState } from '@/lib/growth';
import {
  createDefaultPlayerCharacterState,
  normalizePlayerCharacterState,
} from '@/lib/playerCharacters';
import {
  createDefaultPlayerProfile,
  normalizePlayerProfile,
} from '@/lib/playerProfile';
import { createDefaultPlayerStats, normalizePlayerStats } from '@/lib/playerStats';
import { normalizeRankedState } from '@/lib/ranked';
import { normalizeWalletState } from '@/lib/wallet';
import {
  createWeeklyTaskState,
  normalizeWeeklyTaskState,
} from '@/lib/weeklyTasks';
import type { MemberSnapshot } from '../../shared/contracts/member';

const KNOWN_KEYS = new Set([
  'game-hub-player-profile',
  'game-hub-growth-state',
  'game-hub-player-characters',
  'game-hub-wallet-v1',
  'game-hub-cosmetics-v1',
  'game-hub-unlocked-achievements',
  'game-hub-storage',
  'game-hub-player-stats',
  'game-hub-daily-tasks',
  'game-hub-weekly-tasks',
  'game-hub-checkin-state',
  'game-hub-ranked-v1',
  'game-hub-locale',
  'game-hub-riichi-theme',
  'game-hub-theme-v1',
  'game-hub-arcade-prefs-v1',
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object in save data');
  }
  return value as Record<string, unknown>;
}

function parsed(data: Record<string, string>, key: string): unknown {
  const value = data[key];
  if (value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON in ${key}`);
  }
}

function optionalObject(data: Record<string, string>, key: string): unknown {
  const value = parsed(data, key);
  return value === null ? null : record(value);
}

export function createEmptySnapshot(memberId: string, nickname: string): MemberSnapshot {
  const profile = createDefaultPlayerProfile();
  profile.nickname = nickname;
  return {
    schema: 1,
    memberId,
    revision: 0,
    updatedAt: new Date().toISOString(),
    profile,
    growth: createDefaultGrowthState(),
    characters: createDefaultPlayerCharacterState(),
    wallet: normalizeWalletState(null),
    cosmetics: normalizeCosmetics(null),
    achievements: [],
    arcade: normalizeGameState(null),
    stats: createDefaultPlayerStats(),
    dailyTasks: createDailyTaskState(),
    weeklyTasks: createWeeklyTaskState(),
    checkin: createDefaultCheckinState(),
    ranked: normalizeRankedState(null),
    preferences: {
      locale: 'zh',
      riichiTheme: null,
      venueTheme: null,
      arcadePrefs: {},
    },
    legacyData: {},
  };
}

export function parseLegacyImport(
  value: unknown,
  memberId: string,
  fallbackNickname: string,
): MemberSnapshot {
  const save = record(value);
  if (
    save.app !== 'game-hub' ||
    save.schema !== 1 ||
    typeof save.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(save.exportedAt)) ||
    (save.recovery && record(save.recovery).partial === true)
  ) {
    throw new Error('Invalid or partial save file');
  }
  const input = record(save.data);
  const data: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!key.startsWith('game-hub-') || typeof raw !== 'string') {
      throw new Error(`Invalid save entry: ${key}`);
    }
    data[key] = raw;
  }
  if (Object.keys(data).length === 0) throw new Error('Save has no data');

  const profileRaw = optionalObject(data, 'game-hub-player-profile');
  const walletRaw = optionalObject(data, 'game-hub-wallet-v1');
  const rankedRaw = optionalObject(data, 'game-hub-ranked-v1');
  if (walletRaw && (!Number.isSafeInteger((walletRaw as Record<string, unknown>).coins) ||
    Number((walletRaw as Record<string, unknown>).coins) < 0)) {
    throw new Error('Invalid wallet balance');
  }
  if (rankedRaw && typeof (rankedRaw as Record<string, unknown>).pt !== 'number') {
    throw new Error('Invalid ranked points');
  }

  const snapshot = createEmptySnapshot(memberId, fallbackNickname);
  if (profileRaw) snapshot.profile = normalizePlayerProfile(profileRaw);
  snapshot.growth = normalizeGrowthState(optionalObject(data, 'game-hub-growth-state'));
  snapshot.characters = normalizePlayerCharacterState(
    optionalObject(data, 'game-hub-player-characters'),
  );
  snapshot.wallet = normalizeWalletState(walletRaw);
  snapshot.cosmetics = normalizeCosmetics(optionalObject(data, 'game-hub-cosmetics-v1'));
  const achievementsRaw = parsed(data, 'game-hub-unlocked-achievements');
  if (achievementsRaw !== null && !Array.isArray(achievementsRaw)) {
    throw new Error('Invalid achievement list');
  }
  snapshot.achievements = Array.isArray(achievementsRaw)
    ? [...new Set(achievementsRaw.filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
      ))]
    : [];
  const arcadeRaw = optionalObject(data, 'game-hub-storage');
  snapshot.arcade = normalizeGameState(arcadeRaw ? record(arcadeRaw).state : null);
  snapshot.stats = normalizePlayerStats(optionalObject(data, 'game-hub-player-stats'));
  const dailyRaw = optionalObject(data, 'game-hub-daily-tasks');
  const weeklyRaw = optionalObject(data, 'game-hub-weekly-tasks');
  if (dailyRaw) {
    const normalized = normalizeDailyTaskState(dailyRaw);
    if (!normalized) throw new Error('Invalid daily tasks');
    snapshot.dailyTasks = normalized;
  }
  if (weeklyRaw) {
    const normalized = normalizeWeeklyTaskState(weeklyRaw);
    if (!normalized) throw new Error('Invalid weekly tasks');
    snapshot.weeklyTasks = normalized;
  }
  snapshot.checkin = normalizeCheckinState(optionalObject(data, 'game-hub-checkin-state'));
  snapshot.ranked = normalizeRankedState(rankedRaw);
  snapshot.preferences.locale = data['game-hub-locale'] === 'en' ? 'en' : 'zh';
  snapshot.preferences.riichiTheme = data['game-hub-riichi-theme'] ?? null;
  snapshot.preferences.venueTheme = data['game-hub-theme-v1'] ?? null;
  snapshot.preferences.arcadePrefs =
    (optionalObject(data, 'game-hub-arcade-prefs-v1') as Record<string, unknown> | null) ?? {};
  snapshot.legacyData = Object.fromEntries(
    Object.entries(data).filter(([key]) => !KNOWN_KEYS.has(key)),
  );
  return snapshot;
}
