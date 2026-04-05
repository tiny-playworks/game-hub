import type { RiichiDailyEvent } from '@/lib/dailyTasks';
import { addGrowthPoints } from '@/lib/growth';

export const WEEKLY_TASK_STORAGE_KEY = 'game-hub-weekly-tasks';

export interface WeeklyTask {
  id: string;
  titleKey: string;
  descKey: string;
  eventType: RiichiDailyEvent;
  target: number;
  rewardPoints: number;
}

export interface WeeklyTaskProgress extends WeeklyTask {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface WeeklyTaskState {
  weekKey: string;
  items: WeeklyTaskProgress[];
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

function createDefaultItems(): WeeklyTaskProgress[] {
  return WEEKLY_TEMPLATES.map((task) => ({
    ...task,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

function createWeeklyTaskState(now = Date.now()): WeeklyTaskState {
  return {
    weekKey: getBeijingWeekKey(now),
    items: createDefaultItems(),
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
    const template = WEEKLY_TEMPLATES.find((task) => task.id === candidate.id);
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
      claimed: Boolean(candidate.claimed) && completed,
    });
  }
  if (items.length === 0) return null;
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
  event: RiichiDailyEvent,
  now = Date.now(),
): WeeklyTaskState {
  const state = ensureWeeklyTaskState(now);
  const next: WeeklyTaskState = {
    ...state,
    items: state.items.map((item) => {
      if (item.eventType !== event || item.completed) return item;
      const progress = Math.min(item.target, item.progress + 1);
      return {
        ...item,
        progress,
        completed: progress >= item.target,
      };
    }),
  };
  return saveWeeklyTaskState(next);
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
  }
  return {
    ok: awardedPoints > 0,
    awardedPoints,
    state: next,
  };
}
