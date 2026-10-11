import type { RiichiDailyEvent, TaskRewardSummary } from '@/lib/dailyTasks';
import { addGrowthPoints } from '@/lib/growth';
import { addArcadeCoins, addCoins } from '@/lib/wallet';
import {
  advanceTask,
  isArcadeTask,
  type TaskEvent,
  type TaskTrigger,
} from './taskEvents';

export const WEEKLY_TASK_STORAGE_KEY = 'game-hub-weekly-tasks';

export interface WeeklyTask {
  id: string;
  titleKey: string;
  descKey: string;
  eventType: RiichiDailyEvent | TaskTrigger;
  target: number;
  rewardPoints: number;
}

export interface WeeklyTaskProgress extends WeeklyTask {
  progress: number;
  completed: boolean;
  claimed: boolean;
  distinctGames?: string[];
}

export interface WeeklyTaskState {
  weekKey: string;
  items: WeeklyTaskProgress[];
}

export interface RecordWeeklyTaskEventResult {
  state: WeeklyTaskState;
  autoClaimedRewards: Array<
    Omit<TaskRewardSummary, 'scope'> & { scope: 'weekly' }
  >;
}

const WEEKLY_TEMPLATES: WeeklyTask[] = [
  {
    id: 'weekly-finish-round',
    titleKey: 'weekly.riichi.finishRound.title',
    descKey: 'weekly.riichi.finishRound.desc',
    eventType: 'finish-round',
    target: 5,
    rewardPoints: 80,
  },
  {
    id: 'weekly-win-hand',
    titleKey: 'weekly.riichi.winHand.title',
    descKey: 'weekly.riichi.winHand.desc',
    eventType: 'win-hand',
    target: 3,
    rewardPoints: 100,
  },
  {
    id: 'weekly-declare-riichi',
    titleKey: 'weekly.riichi.declareRiichi.title',
    descKey: 'weekly.riichi.declareRiichi.desc',
    eventType: 'declare-riichi',
    target: 2,
    rewardPoints: 90,
  },
];

const ARCADE_WEEKLY_TEMPLATES: WeeklyTask[] = [
  {
    id: 'weekly-arcade-board',
    titleKey: 'weekly.arcade.board.title',
    descKey: 'weekly.arcade.board.desc',
    eventType: {
      scope: 'arcade',
      category: 'board',
      type: 'win',
    },
    target: 5,
    rewardPoints: 100,
  },
  {
    id: 'weekly-arcade-best',
    titleKey: 'weekly.arcade.best.title',
    descKey: 'weekly.arcade.best.desc',
    eventType: {
      scope: 'arcade',
      category: 'mini',
      type: 'best',
      distinct: true,
    },
    target: 3,
    rewardPoints: 100,
  },
];
const weeklyArcade = (week: string) =>
  ARCADE_WEEKLY_TEMPLATES[
    Array.from(week).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2
  ];

function getDatePartsInShanghai(timestamp: number): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const year = Number(
    parts.find((part) => part.type === 'year')?.value ?? '1970',
  );
  const month = Number(
    parts.find((part) => part.type === 'month')?.value ?? '01',
  );
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');
  return { year, month, day };
}

function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getBeijingWeekKey(timestamp = Date.now()): string {
  const { year, month, day } = getDatePartsInShanghai(timestamp);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diffToMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return formatDateKey(date);
}

function createDefaultItems(weekKey: string): WeeklyTaskProgress[] {
  return [...WEEKLY_TEMPLATES, weeklyArcade(weekKey)].map((task) => ({
    ...task,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

function createWeeklyTaskState(now = Date.now()): WeeklyTaskState {
  return {
    weekKey: getBeijingWeekKey(now),
    items: createDefaultItems(getBeijingWeekKey(now)),
  };
}

function normalizeState(raw: unknown): WeeklyTaskState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<WeeklyTaskState>;
  if (typeof parsed.weekKey !== 'string' || !Array.isArray(parsed.items)) {
    return null;
  }
  const items: WeeklyTaskProgress[] = [];
  for (const item of parsed.items) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<WeeklyTaskProgress>;
    if (typeof candidate.id !== 'string') continue;
    const template = [...WEEKLY_TEMPLATES, ...ARCADE_WEEKLY_TEMPLATES].find(
      (task) => task.id === candidate.id,
    );
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
      distinctGames: Array.isArray(candidate.distinctGames)
        ? [
            ...new Set(
              candidate.distinctGames.filter((id) => typeof id === 'string'),
            ),
          ]
        : [],
    });
  }
  if (items.length === 0) return null;
  if (!items.some((item) => isArcadeTask(item.eventType)))
    items.push({
      ...weeklyArcade(parsed.weekKey),
      progress: 0,
      completed: false,
      claimed: false,
    });
  return { weekKey: parsed.weekKey, items };
}

export function getWeeklyTaskState(now = Date.now()): WeeklyTaskState {
  const weekKey = getBeijingWeekKey(now);
  if (typeof localStorage === 'undefined') return createWeeklyTaskState(now);
  try {
    const raw = localStorage.getItem(WEEKLY_TASK_STORAGE_KEY);
    if (!raw) return createWeeklyTaskState(now);
    const parsed = normalizeState(JSON.parse(raw));
    if (!parsed || parsed.weekKey !== weekKey)
      return createWeeklyTaskState(now);
    return parsed;
  } catch {
    return createWeeklyTaskState(now);
  }
}

export function saveWeeklyTaskState(state: WeeklyTaskState): WeeklyTaskState {
  if (typeof localStorage === 'undefined') return state;
  localStorage.setItem(WEEKLY_TASK_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function ensureWeeklyTaskState(now = Date.now()): WeeklyTaskState {
  const state = getWeeklyTaskState(now);
  return saveWeeklyTaskState(state);
}

export function recordWeeklyTaskEvent(
  event: TaskEvent,
  now = Date.now(),
): RecordWeeklyTaskEventResult {
  const state = ensureWeeklyTaskState(now);
  const autoClaimedRewards: Array<
    Omit<TaskRewardSummary, 'scope'> & { scope: 'weekly' }
  > = [];
  const next: WeeklyTaskState = {
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
          scope: 'weekly',
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
  const savedState = saveWeeklyTaskState(next);
  const awardedPoints = autoClaimedRewards.reduce(
    (total, reward) => total + reward.rewardPoints,
    0,
  );
  if (awardedPoints > 0) {
    addGrowthPoints(awardedPoints);
    addCoins(150 * autoClaimedRewards.length, 'wallet.reason.weekly', now);
  }
  return {
    state: savedState,
    autoClaimedRewards,
  };
}

export function claimWeeklyTask(
  taskId: string,
  now = Date.now(),
): {
  ok: boolean;
  awardedPoints: number;
  state: WeeklyTaskState;
} {
  const state = ensureWeeklyTaskState(now);
  let awardedPoints = 0;
  const next: WeeklyTaskState = {
    ...state,
    items: state.items.map((item) => {
      if (item.id !== taskId) return item;
      if (!item.completed || item.claimed) return item;
      awardedPoints = item.rewardPoints;
      return { ...item, claimed: true };
    }),
  };
  saveWeeklyTaskState(next);
  if (awardedPoints > 0) {
    addGrowthPoints(awardedPoints);
    const task = next.items.find((item) => item.id === taskId);
    (task && isArcadeTask(task.eventType) ? addArcadeCoins : addCoins)(
      150,
      'wallet.reason.weekly',
      now,
    );
  }
  return {
    ok: awardedPoints > 0,
    awardedPoints,
    state: next,
  };
}
