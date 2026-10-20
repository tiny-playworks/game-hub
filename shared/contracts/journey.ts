import type { RiichiReplayFile } from '../../src/pages/mahjong/japanese/engine/match';

export const JOURNEY_CONTENT_VERSION = 1 as const;
export const JOURNEY_STAGE_IDS = [
  'aoi-balance',
  'rin-tempo',
  'mio-defense',
  'koharu-call',
  'chitose-closed',
  'sora-value',
  'aya-riichi',
  'mahiru-flush',
  'yoru-reading',
  'tsubaki-finale',
] as const;
export const JOURNEY_RECENT_ATTEMPT_LIMIT = 500;

export type JourneyStageId = typeof JOURNEY_STAGE_IDS[number];
export type JourneyVariation = '1' | '2';
export function isJourneyVariation(value: unknown): value is JourneyVariation {
  return value === '1' || value === '2';
}

export interface JourneyEvaluation {
  completed: boolean;
  pointsDelta: number;
  playerDiscards: number;
  openMelds: number;
  reachedTenpai: boolean;
  survivedThreat: boolean;
  declaredRiichi?: boolean;
  suitFocusCount?: number;
  failureReasonKey?: string | null;
}

export interface JourneyAttemptInput {
  attemptId: string;
  stageId: JourneyStageId;
  contentVersion: typeof JOURNEY_CONTENT_VERSION;
  replay: RiichiReplayFile;
  variation?: JourneyVariation;
}

export interface JourneyStageProgress {
  attempts: number;
  completed: boolean;
  bestPointsDelta: number | null;
  lastAttemptId: string | null;
  completedAt: number | null;
  updatedAt: number;
}

export interface JourneyProgressState {
  schema: 1;
  contentVersion: typeof JOURNEY_CONTENT_VERSION;
  stages: Record<JourneyStageId, JourneyStageProgress>;
  variations?: Record<string, JourneyStageProgress>;
  /** Bounded local retry protection. The member ledger retains every attempt id. */
  creditedAttemptIds: string[];
  updatedAt: number;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function timestamp(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value : 0;
}

export function isJourneyStageId(value: unknown): value is JourneyStageId {
  return typeof value === 'string' &&
    (JOURNEY_STAGE_IDS as readonly string[]).includes(value);
}

export function isJourneyAttemptId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

export function normalizeJourneyProgress(raw: unknown): JourneyProgressState {
  const input = object(raw);
  const compatible = input?.schema === 1 &&
    input.contentVersion === JOURNEY_CONTENT_VERSION ? input : null;
  const rawStages = object(compatible?.stages);
  const stages = {} as JourneyProgressState['stages'];
  for (const id of JOURNEY_STAGE_IDS) {
    const stage = object(rawStages?.[id]);
    const completed = stage?.completed === true;
    stages[id] = {
      attempts: typeof stage?.attempts === 'number' &&
        Number.isSafeInteger(stage.attempts) && stage.attempts > 0
        ? stage.attempts : 0,
      completed,
      bestPointsDelta: typeof stage?.bestPointsDelta === 'number' &&
        Number.isSafeInteger(stage.bestPointsDelta) ? stage.bestPointsDelta : null,
      lastAttemptId: isJourneyAttemptId(stage?.lastAttemptId) ? stage.lastAttemptId : null,
      completedAt: completed && timestamp(stage?.completedAt) > 0
        ? timestamp(stage?.completedAt) : null,
      updatedAt: timestamp(stage?.updatedAt),
    };
  }
  return {
    schema: 1,
    contentVersion: JOURNEY_CONTENT_VERSION,
    stages,
    variations: Object.fromEntries(JOURNEY_STAGE_IDS.flatMap((id) =>
      (['1', '2'] as const).map((variation) => {
        const key = `${id}:${variation}`;
        const raw = object(object(compatible?.variations)?.[key]);
        const normalized = normalizeJourneyStage(raw);
        return [key, normalized];
      }))),
    creditedAttemptIds: Array.isArray(compatible?.creditedAttemptIds)
      ? [...new Set(compatible.creditedAttemptIds.filter(isJourneyAttemptId))]
          .slice(-JOURNEY_RECENT_ATTEMPT_LIMIT)
      : [],
    updatedAt: Math.max(timestamp(compatible?.updatedAt),
      ...JOURNEY_STAGE_IDS.map((id) => stages[id].updatedAt)),
  };
}

function normalizeJourneyStage(raw: Record<string, unknown> | null): JourneyStageProgress {
  return {
    attempts: typeof raw?.attempts === 'number' && Number.isSafeInteger(raw.attempts) && raw.attempts > 0 ? raw.attempts : 0,
    completed: raw?.completed === true,
    bestPointsDelta: typeof raw?.bestPointsDelta === 'number' && Number.isSafeInteger(raw.bestPointsDelta) ? raw.bestPointsDelta : null,
    lastAttemptId: isJourneyAttemptId(raw?.lastAttemptId) ? raw.lastAttemptId : null,
    completedAt: raw?.completed === true ? timestamp(raw.completedAt) || null : null,
    updatedAt: timestamp(raw?.updatedAt),
  };
}

/** Record a verified round without awarding currency, growth or competitive progress. */
export function recordJourneyEvaluation(
  state: JourneyProgressState,
  attemptId: string,
  stageId: JourneyStageId,
  evaluation: JourneyEvaluation,
  now: number,
  variation?: JourneyVariation,
): JourneyProgressState {
  if (!isJourneyAttemptId(attemptId) || !isJourneyStageId(stageId) ||
    !Number.isSafeInteger(now) || now < 0 ||
    typeof evaluation.completed !== 'boolean' ||
    !Number.isSafeInteger(evaluation.pointsDelta))
    throw new Error('Invalid journey result');
  const current = normalizeJourneyProgress(state);
  if (current.creditedAttemptIds.includes(attemptId)) return current;
  if (variation !== undefined && (!isJourneyVariation(variation) || !current.stages[stageId].completed))
    throw new Error('Complete the main stage before its variations');
  const key = variation ? `${stageId}:${variation}` : stageId;
  const previous = variation ? current.variations![key] : current.stages[stageId];
  const updatedAt = Math.max(now, current.updatedAt, previous.updatedAt);
  return {
    ...current,
    [variation ? 'variations' : 'stages']: {
      ...(variation ? current.variations : current.stages),
      [key]: {
        attempts: Math.min(Number.MAX_SAFE_INTEGER, previous.attempts + 1),
        completed: previous.completed || evaluation.completed,
        bestPointsDelta: previous.bestPointsDelta === null
          ? evaluation.pointsDelta : Math.max(previous.bestPointsDelta, evaluation.pointsDelta),
        lastAttemptId: attemptId,
        completedAt: previous.completedAt ?? (evaluation.completed ? updatedAt : null),
        updatedAt,
      },
    },
    creditedAttemptIds: [...current.creditedAttemptIds, attemptId]
      .slice(-JOURNEY_RECENT_ATTEMPT_LIMIT),
    updatedAt,
  };
}
