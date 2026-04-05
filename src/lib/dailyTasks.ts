import { addGrowthPoints } from '@/lib/growth';

export const DAILY_TASK_STORAGE_KEY = 'game-hub-daily-tasks';
export const DAILY_TASK_COUNT = 3;

export type RiichiDailyEvent =
  | 'enter-game'
  | 'finish-round'
  | 'declare-riichi'
  | 'win-hand'
  | 'tsumo-win';

export interface DailyTask {
  id: string;
  titleKey: string;
  descKey: string;
  eventType: RiichiDailyEvent;
  target: number;
  rewardPoints: number;
}

export interface DailyTaskProgress extends DailyTask {
  progress: number;
  completed: boolean;
  claimed: boolean;
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
  scope: 'daily';
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
  const pickCount = Math.max(1, Math.min(count, RIICHI_DAILY_TEMPLATES.length));
  const pool = [...RIICHI_DAILY_TEMPLATES];
  const selected: DailyTaskProgress[] = [];
  let seed = hashText(dateKey);
  while (selected.length < pickCount && pool.length > 0) {
    const index = seed % pool.length;
    const [picked] = pool.splice(index, 1);
    selected.push(toProgressItem(picked));
    seed = (seed * 1664525 + 1013904223) >>> 0;
  }
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
    const template = RIICHI_DAILY_TEMPLATES.find(
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
      claimed: completed || Boolean(candidate.claimed),
    });
  }
  if (items.length === 0) return null;
  return { dateKey: parsed.dateKey, items };
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
  if (typeof localStorage === 'undefined') return createDailyTaskState(now);
  try {
    const raw = localStorage.getItem(DAILY_TASK_STORAGE_KEY);
    if (!raw) return createDailyTaskState(now);
    const parsed = normalizeState(JSON.parse(raw));
    if (!parsed || parsed.dateKey !== dateKey) return createDailyTaskState(now);
    return parsed;
  } catch {
    return createDailyTaskState(now);
  }
}

export function saveDailyTaskState(state: DailyTaskState): DailyTaskState {
  if (typeof localStorage === 'undefined') return state;
  localStorage.setItem(DAILY_TASK_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function ensureDailyTaskState(now = Date.now()): DailyTaskState {
  const state = getDailyTaskState(now);
  return saveDailyTaskState(state);
}

export function recordDailyTaskEvent(
  event: RiichiDailyEvent,
  now = Date.now(),
): RecordDailyTaskEventResult {
  const state = ensureDailyTaskState(now);
  const autoClaimedRewards: TaskRewardSummary[] = [];
  const next: DailyTaskState = {
    ...state,
    items: state.items.map((item) => {
      if (item.eventType !== event || item.completed) return item;
      const progress = Math.min(item.target, item.progress + 1);
      const completed = progress >= item.target;
      if (completed) {
        autoClaimedRewards.push({
          taskId: item.id,
          titleKey: item.titleKey,
          descKey: item.descKey,
          rewardPoints: item.rewardPoints,
          scope: 'daily',
        });
      }
      return {
        ...item,
        progress,
        completed,
        claimed: completed ? true : item.claimed,
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
  }
  return {
    ok: awardedPoints > 0,
    awardedPoints,
    state: next,
  };
}
