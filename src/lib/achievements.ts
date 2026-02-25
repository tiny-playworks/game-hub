export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: '2048-256',
    nameKey: 'achievement.2048-256.name',
    descKey: 'achievement.2048-256.desc',
  },
  {
    id: '2048-512',
    nameKey: 'achievement.2048-512.name',
    descKey: 'achievement.2048-512.desc',
  },
  {
    id: '2048-2048',
    nameKey: 'achievement.2048-2048.name',
    descKey: 'achievement.2048-2048.desc',
  },
  {
    id: '2048-1024',
    nameKey: 'achievement.2048-1024.name',
    descKey: 'achievement.2048-1024.desc',
  },
  {
    id: 'gomoku-first-win',
    nameKey: 'achievement.gomoku-first-win.name',
    descKey: 'achievement.gomoku-first-win.desc',
  },
  {
    id: 'xiangqi-first-win',
    nameKey: 'achievement.xiangqi-first-win.name',
    descKey: 'achievement.xiangqi-first-win.desc',
  },
  {
    id: 'chess-first-win',
    nameKey: 'achievement.chess-first-win.name',
    descKey: 'achievement.chess-first-win.desc',
  },
  {
    id: 'snake-25',
    nameKey: 'achievement.snake-25.name',
    descKey: 'achievement.snake-25.desc',
  },
  {
    id: 'snake-50',
    nameKey: 'achievement.snake-50.name',
    descKey: 'achievement.snake-50.desc',
  },
  {
    id: 'snake-100',
    nameKey: 'achievement.snake-100.name',
    descKey: 'achievement.snake-100.desc',
  },
  {
    id: 'tetris-10',
    nameKey: 'achievement.tetris-10.name',
    descKey: 'achievement.tetris-10.desc',
  },
  {
    id: 'tetris-50',
    nameKey: 'achievement.tetris-50.name',
    descKey: 'achievement.tetris-50.desc',
  },
  {
    id: 'tetris-100',
    nameKey: 'achievement.tetris-100.name',
    descKey: 'achievement.tetris-100.desc',
  },
  {
    id: 'breakout-first-win',
    nameKey: 'achievement.breakout-first-win.name',
    descKey: 'achievement.breakout-first-win.desc',
  },
];

const STORAGE_KEY = 'game-hub-unlocked-achievements';
const KEY_2048_BEST = 'game-2048-best';
const KEY_SNAKE_BEST = 'game-snake-best';
const KEY_TETRIS_BEST_LINES = 'game-tetris-best-lines';

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
}

export function isUnlocked(id: string): boolean {
  return getUnlockedIds().includes(id);
}

/** 根据当前 localStorage 中的最高分等统计，自动解锁符合条件的成就 */
export function checkAndUnlockFromStats(): void {
  try {
    const best2048 = Number.parseInt(
      localStorage?.getItem(KEY_2048_BEST) ?? '0',
      10,
    );
    const bestSnake = Number.parseInt(
      localStorage?.getItem(KEY_SNAKE_BEST) ?? '0',
      10,
    );
    const bestTetrisLines = Number.parseInt(
      localStorage?.getItem(KEY_TETRIS_BEST_LINES) ?? '0',
      10,
    );
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
