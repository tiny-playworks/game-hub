import { addGrowthPoints } from '@/lib/growth';

export const CHECKIN_STORAGE_KEY = 'game-hub-checkin-state';
export const CHECKIN_DAILY_REWARD_POINTS = 10;
export const CHECKIN_WEEK_MILESTONES = [7] as const;
export const CHECKIN_MONTH_MILESTONES = [30] as const;
export const CHECKIN_WEEK_REWARD_POINTS: Record<number, number> = {
  7: 70,
};
export const CHECKIN_MONTH_REWARD_POINTS: Record<number, number> = {
  30: 300,
};

export interface CheckinState {
  dateKey: string;
  streakDays: number;
  totalDays: number;
  signedDateKeys: string[];
  weekClaimedAt: number[];
  monthClaimedAt: number[];
  updatedAt: number;
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

function dateKeyToDayIndex(dateKey: string): number {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return 0;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isYesterdayDateKey(
  previousDateKey: string,
  currentDateKey: string,
): boolean {
  return (
    dateKeyToDayIndex(currentDateKey) - dateKeyToDayIndex(previousDateKey) === 1
  );
}

export function createDefaultCheckinState(now = Date.now()): CheckinState {
  return {
    dateKey: '',
    streakDays: 0,
    totalDays: 0,
    signedDateKeys: [],
    weekClaimedAt: [],
    monthClaimedAt: [],
    updatedAt: now,
  };
}

function normalizeCheckinState(raw: unknown): CheckinState {
  const defaults = createDefaultCheckinState();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<CheckinState>;
  return {
    dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : '',
    streakDays:
      typeof parsed.streakDays === 'number' &&
      Number.isFinite(parsed.streakDays) &&
      parsed.streakDays > 0
        ? Math.floor(parsed.streakDays)
        : 0,
    totalDays:
      typeof parsed.totalDays === 'number' &&
      Number.isFinite(parsed.totalDays) &&
      parsed.totalDays > 0
        ? Math.floor(parsed.totalDays)
        : 0,
    signedDateKeys: Array.isArray(parsed.signedDateKeys)
      ? parsed.signedDateKeys.filter(
          (value): value is string =>
            typeof value === 'string' && value.length >= 8,
        )
      : [],
    weekClaimedAt: Array.isArray(parsed.weekClaimedAt)
      ? parsed.weekClaimedAt.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        )
      : [],
    monthClaimedAt: Array.isArray(parsed.monthClaimedAt)
      ? parsed.monthClaimedAt.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        )
      : [],
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}

export function getCheckinState(): CheckinState {
  if (typeof localStorage === 'undefined') return createDefaultCheckinState();
  try {
    const raw = localStorage.getItem(CHECKIN_STORAGE_KEY);
    if (!raw) return createDefaultCheckinState();
    return normalizeCheckinState(JSON.parse(raw));
  } catch {
    return createDefaultCheckinState();
  }
}

export function saveCheckinState(state: CheckinState): CheckinState {
  const normalized = normalizeCheckinState({
    ...state,
    updatedAt: Date.now(),
  });
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function ensureCheckinState(): CheckinState {
  return saveCheckinState(getCheckinState());
}

export function hasCheckedInToday(now = Date.now()): boolean {
  const today = getBeijingDateKey(now);
  return getCheckinState().dateKey === today;
}

export function checkinToday(now = Date.now()): {
  ok: boolean;
  awardedPoints: number;
  state: CheckinState;
} {
  const today = getBeijingDateKey(now);
  const current = ensureCheckinState();
  if (current.dateKey === today) {
    return { ok: false, awardedPoints: 0, state: current };
  }

  const streakDays = isYesterdayDateKey(current.dateKey, today)
    ? current.streakDays + 1
    : 1;
  const signedDateKeys = [...current.signedDateKeys, today]
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort()
    .slice(-120);
  const next = saveCheckinState({
    ...current,
    dateKey: today,
    streakDays,
    totalDays: current.totalDays + 1,
    signedDateKeys,
  });
  addGrowthPoints(CHECKIN_DAILY_REWARD_POINTS);
  return { ok: true, awardedPoints: CHECKIN_DAILY_REWARD_POINTS, state: next };
}

export function claimWeekMilestone(
  milestoneDays: (typeof CHECKIN_WEEK_MILESTONES)[number],
): {
  ok: boolean;
  awardedPoints: number;
  state: CheckinState;
} {
  const current = ensureCheckinState();
  if (current.streakDays < milestoneDays) {
    return { ok: false, awardedPoints: 0, state: current };
  }
  if (current.weekClaimedAt.includes(milestoneDays)) {
    return { ok: false, awardedPoints: 0, state: current };
  }
  const awardedPoints = CHECKIN_WEEK_REWARD_POINTS[milestoneDays] ?? 0;
  const next = saveCheckinState({
    ...current,
    weekClaimedAt: [...current.weekClaimedAt, milestoneDays],
  });
  if (awardedPoints > 0) addGrowthPoints(awardedPoints);
  return { ok: awardedPoints > 0, awardedPoints, state: next };
}

export function claimMonthMilestone(
  milestoneDays: (typeof CHECKIN_MONTH_MILESTONES)[number],
): {
  ok: boolean;
  awardedPoints: number;
  state: CheckinState;
} {
  const current = ensureCheckinState();
  if (current.totalDays < milestoneDays) {
    return { ok: false, awardedPoints: 0, state: current };
  }
  if (current.monthClaimedAt.includes(milestoneDays)) {
    return { ok: false, awardedPoints: 0, state: current };
  }
  const awardedPoints = CHECKIN_MONTH_REWARD_POINTS[milestoneDays] ?? 0;
  const next = saveCheckinState({
    ...current,
    monthClaimedAt: [...current.monthClaimedAt, milestoneDays],
  });
  if (awardedPoints > 0) addGrowthPoints(awardedPoints);
  return { ok: awardedPoints > 0, awardedPoints, state: next };
}
