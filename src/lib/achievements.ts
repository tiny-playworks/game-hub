export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  rarity?: AchievementRarity;
  points?: number;
  progressType?: AchievementProgressType;
  target?: number;
}

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementProgressType =
  | 'unlock'
  | 'best-2048'
  | 'best-snake'
  | 'best-tetris-lines';

export interface AchievementMeta {
  id: string;
  rarity: AchievementRarity;
  points: number;
  progressType: AchievementProgressType;
  target: number;
}

export interface AchievementProgress extends AchievementMeta {
  nameKey: string;
  descKey: string;
  unlocked: boolean;
  current: number;
  progressPercent: number;
}

export interface AchievementSummary {
  total: number;
  unlocked: number;
  unlockedPoints: number;
  rarityCounts: Record<AchievementRarity, number>;
}

export const ACHIEVEMENT_UNLOCKED_EVENT = 'game-hub:achievement-unlocked';

export interface AchievementUnlockedEventDetail {
  id: string;
  nameKey?: string;
  rarity?: AchievementRarity;
  points?: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: '2048-256',
    nameKey: 'achievement.2048-256.name',
    descKey: 'achievement.2048-256.desc',
    rarity: 'common',
    points: 50,
    progressType: 'best-2048',
    target: 256,
  },
  {
    id: '2048-512',
    nameKey: 'achievement.2048-512.name',
    descKey: 'achievement.2048-512.desc',
    rarity: 'rare',
    points: 80,
    progressType: 'best-2048',
    target: 512,
  },
  {
    id: '2048-2048',
    nameKey: 'achievement.2048-2048.name',
    descKey: 'achievement.2048-2048.desc',
    rarity: 'legendary',
    points: 300,
    progressType: 'best-2048',
    target: 2048,
  },
  {
    id: '2048-1024',
    nameKey: 'achievement.2048-1024.name',
    descKey: 'achievement.2048-1024.desc',
    rarity: 'epic',
    points: 150,
    progressType: 'best-2048',
    target: 1024,
  },
  {
    id: 'gomoku-first-win',
    nameKey: 'achievement.gomoku-first-win.name',
    descKey: 'achievement.gomoku-first-win.desc',
    rarity: 'common',
    points: 60,
    progressType: 'unlock',
    target: 1,
  },
  {
    id: 'xiangqi-first-win',
    nameKey: 'achievement.xiangqi-first-win.name',
    descKey: 'achievement.xiangqi-first-win.desc',
    rarity: 'rare',
    points: 90,
    progressType: 'unlock',
    target: 1,
  },
  {
    id: 'chess-first-win',
    nameKey: 'achievement.chess-first-win.name',
    descKey: 'achievement.chess-first-win.desc',
    rarity: 'rare',
    points: 90,
    progressType: 'unlock',
    target: 1,
  },
  {
    id: 'snake-25',
    nameKey: 'achievement.snake-25.name',
    descKey: 'achievement.snake-25.desc',
    rarity: 'common',
    points: 40,
    progressType: 'best-snake',
    target: 25,
  },
  {
    id: 'snake-50',
    nameKey: 'achievement.snake-50.name',
    descKey: 'achievement.snake-50.desc',
    rarity: 'rare',
    points: 70,
    progressType: 'best-snake',
    target: 50,
  },
  {
    id: 'snake-100',
    nameKey: 'achievement.snake-100.name',
    descKey: 'achievement.snake-100.desc',
    rarity: 'epic',
    points: 140,
    progressType: 'best-snake',
    target: 100,
  },
  {
    id: 'tetris-10',
    nameKey: 'achievement.tetris-10.name',
    descKey: 'achievement.tetris-10.desc',
    rarity: 'common',
    points: 50,
    progressType: 'best-tetris-lines',
    target: 10,
  },
  {
    id: 'tetris-50',
    nameKey: 'achievement.tetris-50.name',
    descKey: 'achievement.tetris-50.desc',
    rarity: 'rare',
    points: 100,
    progressType: 'best-tetris-lines',
    target: 50,
  },
  {
    id: 'tetris-100',
    nameKey: 'achievement.tetris-100.name',
    descKey: 'achievement.tetris-100.desc',
    rarity: 'epic',
    points: 180,
    progressType: 'best-tetris-lines',
    target: 100,
  },
  {
    id: 'breakout-first-win',
    nameKey: 'achievement.breakout-first-win.name',
    descKey: 'achievement.breakout-first-win.desc',
    rarity: 'common',
    points: 60,
    progressType: 'unlock',
    target: 1,
  },
];

const STORAGE_KEY = 'game-hub-unlocked-achievements';
const KEY_2048_BEST = 'game-2048-best';
const KEY_SNAKE_BEST = 'game-snake-best';
const KEY_TETRIS_BEST_LINES = 'game-tetris-best-lines';
const DEFAULT_POINTS = 50;
const DEFAULT_TARGET = 1;

export function getUnlockedIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function unlock(id: string): void {
  const ids = new Set(getUnlockedIds());
  if (ids.has(id)) return;
  ids.add(id);
  try {
    localStorage?.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    const def = ACHIEVEMENTS.find((item) => item.id === id);
    const meta = def ? getAchievementMeta(def) : null;
    window.dispatchEvent(
      new CustomEvent<AchievementUnlockedEventDetail>(
        ACHIEVEMENT_UNLOCKED_EVENT,
        {
          detail: {
            id,
            nameKey: def?.nameKey,
            rarity: meta?.rarity,
            points: meta?.points,
          },
        },
      ),
    );
  }
}

export function isUnlocked(id: string): boolean {
  return getUnlockedIds().includes(id);
}

function readNumberStat(key: string): number {
  if (typeof localStorage === 'undefined') return 0;
  const parsed = Number.parseInt(localStorage.getItem(key) ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getAchievementCurrentValue(def: AchievementDef): number {
  switch (def.progressType) {
    case 'best-2048':
      return readNumberStat(KEY_2048_BEST);
    case 'best-snake':
      return readNumberStat(KEY_SNAKE_BEST);
    case 'best-tetris-lines':
      return readNumberStat(KEY_TETRIS_BEST_LINES);
    default:
      return isUnlocked(def.id) ? 1 : 0;
  }
}

export function getAchievementMeta(def: AchievementDef): AchievementMeta {
  return {
    id: def.id,
    rarity: def.rarity ?? 'common',
    points: def.points ?? DEFAULT_POINTS,
    progressType: def.progressType ?? 'unlock',
    target: def.target ?? DEFAULT_TARGET,
  };
}

export function getAchievementProgress(
  def: AchievementDef,
): AchievementProgress {
  const meta = getAchievementMeta(def);
  const unlocked = isUnlocked(def.id);
  const current = Math.max(0, getAchievementCurrentValue(def));
  const progressCurrent = unlocked ? meta.target : current;
  const progressPercent =
    meta.target <= 0
      ? 0
      : Math.min(100, Math.floor((progressCurrent / meta.target) * 100));
  return {
    ...meta,
    nameKey: def.nameKey,
    descKey: def.descKey,
    unlocked,
    current: progressCurrent,
    progressPercent,
  };
}

export function getAllAchievementProgresses(): AchievementProgress[] {
  return ACHIEVEMENTS.map((def) => getAchievementProgress(def));
}

export function getAchievementSummary(): AchievementSummary {
  const progresses = getAllAchievementProgresses();
  const rarityCounts: Record<AchievementRarity, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  let unlocked = 0;
  let unlockedPoints = 0;
  for (const progress of progresses) {
    rarityCounts[progress.rarity] += 1;
    if (progress.unlocked) {
      unlocked += 1;
      unlockedPoints += progress.points;
    }
  }
  return {
    total: progresses.length,
    unlocked,
    unlockedPoints,
    rarityCounts,
  };
}

/** 根据当前 localStorage 中的最高分等统计，自动解锁符合条件的成就 */
export function checkAndUnlockFromStats(): void {
  try {
    const best2048 = readNumberStat(KEY_2048_BEST);
    const bestSnake = readNumberStat(KEY_SNAKE_BEST);
    const bestTetrisLines = readNumberStat(KEY_TETRIS_BEST_LINES);
    if (best2048 >= 256) unlock('2048-256');
    if (best2048 >= 512) unlock('2048-512');
    if (best2048 >= 1024) unlock('2048-1024');
    if (best2048 >= 2048) unlock('2048-2048');
    if (bestSnake >= 25) unlock('snake-25');
    if (bestSnake >= 50) unlock('snake-50');
    if (bestSnake >= 100) unlock('snake-100');
    if (bestTetrisLines >= 10) unlock('tetris-10');
    if (bestTetrisLines >= 50) unlock('tetris-50');
    if (bestTetrisLines >= 100) unlock('tetris-100');
  } catch {
    // ignore
  }
}
