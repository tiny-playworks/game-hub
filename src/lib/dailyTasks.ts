import { addGrowthPoints } from '@/lib/growth';
import { gameStorage } from '@/lib/storage';
import { addArcadeCoins, addCoins } from '@/lib/wallet';
import {
  advanceTask,
  isArcadeTask,
  type TaskEvent,
  type TaskTrigger,
} from './taskEvents';

export const DAILY_TASK_STORAGE_KEY = 'game-hub-daily-tasks';
export const DAILY_TASK_COUNT = 3;

export type RiichiDailyEvent =
  'enter-game' | 'finish-round' | 'declare-riichi' | 'win-hand' | 'tsumo-win';

export interface DailyTask {
  id: string;
  titleKey: string;
  descKey: string;
  eventType: RiichiDailyEvent | TaskTrigger;
  target: number;
  rewardPoints: number;
}

export interface DailyTaskProgress extends DailyTask {
  progress: number;
  completed: boolean;
  claimed: boolean;
  distinctGames?: string[];
}

export interface DailyTaskState {
  dateKey: string;
  items: DailyTaskProgress[];
}

export interface TaskRewardSummary {
  taskId: string;
  titleKey: string;
  descKey: string;
  rewardPoints: number;
  scope: 'daily' | 'weekly';
}

export interface RecordDailyTaskEventResult {
  state: DailyTaskState;
  autoClaimedRewards: TaskRewardSummary[];
}

const RIICHI_DAILY_TEMPLATES: DailyTask[] = [
  {
    id: 'riichi-finish-round',
    titleKey: 'daily.riichi.finishRound.title',
    descKey: 'daily.riichi.finishRound.desc',
    eventType: 'finish-round',
    target: 1,
    rewardPoints: 20,
  },
  {
    id: 'riichi-declare-riichi',
    titleKey: 'daily.riichi.declareRiichi.title',
    descKey: 'daily.riichi.declareRiichi.desc',
    eventType: 'declare-riichi',
    target: 1,
    rewardPoints: 25,
  },
  {
    id: 'riichi-win-hand',
    titleKey: 'daily.riichi.winHand.title',
    descKey: 'daily.riichi.winHand.desc',
    eventType: 'win-hand',
    target: 1,
    rewardPoints: 30,
  },
  {
    id: 'riichi-tsumo',
    titleKey: 'daily.riichi.tsumo.title',
    descKey: 'daily.riichi.tsumo.desc',
    eventType: 'tsumo-win',
    target: 1,
    rewardPoints: 35,
  },
  {
    id: 'riichi-enter-game',
    titleKey: 'daily.riichi.enterGame.title',
    descKey: 'daily.riichi.enterGame.desc',
    eventType: 'enter-game',
    target: 1,
    rewardPoints: 15,
  },
];

const ARCADE_DAILY_TEMPLATES: DailyTask[] = [
  {
    id: 'arcade-best',
    titleKey: 'daily.arcade.best.title',
    descKey: 'daily.arcade.best.desc',
    eventType: {
      scope: 'arcade',
      type: 'best',
      category: 'mini',
    },
    target: 1,
    rewardPoints: 30,
  },
  {
    id: 'arcade-board',
    titleKey: 'daily.arcade.board.title',
    descKey: 'daily.arcade.board.desc',
    eventType: {
      scope: 'arcade',
      type: 'finish',
      category: 'board',
    },
    target: 3,
    rewardPoints: 30,
  },
  {
    id: 'arcade-poker',
    titleKey: 'daily.arcade.poker.title',
    descKey: 'daily.arcade.poker.desc',
    eventType: {
      scope: 'arcade',
      type: 'win',
      category: 'poker',
    },
    target: 1,
    rewardPoints: 30,
  },
  {
    id: 'arcade-2048',
    titleKey: 'daily.arcade.2048.title',
    descKey: 'daily.arcade.2048.desc',
    eventType: {
      scope: 'arcade',
      type: 'finish',
      gameId: '2048',
      metric: 'maxTile',
    },
    target: 512,
    rewardPoints: 30,
  },
  {
    id: 'arcade-tetris',
    titleKey: 'daily.arcade.tetris.title',
    descKey: 'daily.arcade.tetris.desc',
    eventType: {
      scope: 'arcade',
      type: 'finish',
      gameId: 'tetris',
      metric: 'lines',
    },
    target: 20,
    rewardPoints: 30,
  },
  {
    id: 'arcade-rubiks',
    titleKey: 'daily.arcade.rubiks.title',
    descKey: 'daily.arcade.rubiks.desc',
    eventType: {
      scope: 'arcade',
      type: 'win',
      gameId: 'rubiks',
      difficulty: 'normal',
    },
    target: 1,
    rewardPoints: 30,
  },
];

function toProgressItem(task: DailyTask): DailyTaskProgress {
  return {
    ...task,
    progress: 0,
    completed: false,
    claimed: false,
  };
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getDatePartsInShanghai(timestamp: number): {
  year: string;
  month: string;
  day: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return { year, month, day };
}

export function getBeijingDateKey(timestamp = Date.now()): string {
  const { year, month, day } = getDatePartsInShanghai(timestamp);
  return `${year}-${month}-${day}`;
}

export function buildDailyTaskSetForDate(
  dateKey: string,
  count = DAILY_TASK_COUNT,
): DailyTaskProgress[] {
  const pickCount = Math.max(
    1,
    Math.min(count - 1, RIICHI_DAILY_TEMPLATES.length),
  );
  const pool = [...RIICHI_DAILY_TEMPLATES];
  const selected: DailyTaskProgress[] = [];
  let seed = hashText(dateKey);
  while (selected.length < pickCount && pool.length > 0) {
    const index = seed % pool.length;
    const [picked] = pool.splice(index, 1);
    selected.push(toProgressItem(picked));
    seed = (seed * 1664525 + 1013904223) >>> 0;
  }
  selected.push(
    toProgressItem(
      ARCADE_DAILY_TEMPLATES[hashText(dateKey) % ARCADE_DAILY_TEMPLATES.length],
    ),
  );
  return selected;
}

function normalizeState(raw: unknown): DailyTaskState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<DailyTaskState>;
  if (typeof parsed.dateKey !== 'string' || !Array.isArray(parsed.items)) {
    return null;
  }
  const items: DailyTaskProgress[] = [];
  for (const item of parsed.items) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<DailyTaskProgress>;
    if (typeof candidate.id !== 'string') continue;
    const template = [
      ...RIICHI_DAILY_TEMPLATES,
      ...ARCADE_DAILY_TEMPLATES,
    ].find((task) => task.id === candidate.id);
    if (!template) continue;
    const progress =
      typeof candidate.progress === 'number' &&
      Number.isFinite(candidate.progress)
        ? Math.max(0, Math.floor(candidate.progress))
        : 0;
    const completed = progress >= template.target;
    items.push({
      ...template,
      progress: Math.min(progress, template.target),
      completed,
      claimed: isArcadeTask(template.eventType)
        ? completed && Boolean(candidate.claimed)
        : completed || Boolean(candidate.claimed),
    });
  }
  if (items.length === 0) return null;
  const riichi = items
    .filter((item) => !isArcadeTask(item.eventType))
    .slice(0, 2);
  const arcade =
    items.find((item) => isArcadeTask(item.eventType)) ??
    buildDailyTaskSetForDate(parsed.dateKey).find((item) =>
      isArcadeTask(item.eventType),
    );
  return {
    dateKey: parsed.dateKey,
    items: [...riichi, ...(arcade ? [arcade] : [])],
  };
}

export function createDailyTaskState(now = Date.now()): DailyTaskState {
  const dateKey = getBeijingDateKey(now);
  return {
    dateKey,
    items: buildDailyTaskSetForDate(dateKey),
  };
}

export function getDailyTaskState(now = Date.now()): DailyTaskState {
  const dateKey = getBeijingDateKey(now);
  if (typeof gameStorage === 'undefined') return createDailyTaskState(now);
  try {
    const raw = gameStorage.getItem(DAILY_TASK_STORAGE_KEY);
    if (!raw) return createDailyTaskState(now);
    const parsed = normalizeState(JSON.parse(raw));
    if (!parsed || parsed.dateKey !== dateKey) return createDailyTaskState(now);
    return parsed;
  } catch {
    return createDailyTaskState(now);
  }
}

export function saveDailyTaskState(state: DailyTaskState): DailyTaskState {
  if (typeof gameStorage === 'undefined') return state;
  gameStorage.setItem(DAILY_TASK_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function ensureDailyTaskState(now = Date.now()): DailyTaskState {
  const state = getDailyTaskState(now);
  return saveDailyTaskState(state);
}

export function recordDailyTaskEvent(
  event: TaskEvent,
  now = Date.now(),
): RecordDailyTaskEventResult {
  const state = ensureDailyTaskState(now);
  const autoClaimedRewards: TaskRewardSummary[] = [];
  const next: DailyTaskState = {
    ...state,
    items: state.items.map((item) => {
      const updated = advanceTask(item, event);
      if (updated === item) return item;
      const { progress, completed } = updated;
      if (completed && !isArcadeTask(item.eventType)) {
        autoClaimedRewards.push({
          taskId: item.id,
          titleKey: item.titleKey,
          descKey: item.descKey,
          rewardPoints: item.rewardPoints,
          scope: 'daily',
        });
      }
      return {
        ...updated,
        progress,
        completed,
        claimed:
          completed && !isArcadeTask(item.eventType) ? true : item.claimed,
      };
    }),
  };
  const savedState = saveDailyTaskState(next);
  const awardedPoints = autoClaimedRewards.reduce(
    (total, reward) => total + reward.rewardPoints,
    0,
  );
  if (awardedPoints > 0) {
    addGrowthPoints(awardedPoints);
    addCoins(40 * autoClaimedRewards.length, 'wallet.reason.daily', now);
  }
  return {
    state: savedState,
    autoClaimedRewards,
  };
}

export function claimDailyTask(
  taskId: string,
  now = Date.now(),
): {
  ok: boolean;
  awardedPoints: number;
  state: DailyTaskState;
} {
  const state = ensureDailyTaskState(now);
  let awardedPoints = 0;
  const next: DailyTaskState = {
    ...state,
    items: state.items.map((item) => {
      if (item.id !== taskId) return item;
      if (!item.completed || item.claimed) return item;
      awardedPoints = item.rewardPoints;
      return { ...item, claimed: true };
    }),
  };
  saveDailyTaskState(next);
  if (awardedPoints > 0) {
    addGrowthPoints(awardedPoints);
    const task = next.items.find((item) => item.id === taskId);
    (task && isArcadeTask(task.eventType) ? addArcadeCoins : addCoins)(
      40,
      'wallet.reason.daily',
      now,
    );
  }
  return {
    ok: awardedPoints > 0,
    awardedPoints,
    state: next,
  };
}
