export const THEME_CHALLENGE_SET_ID = 'venue-v1' as const;

export const THEME_CHALLENGE_TARGETS = {
  'menzen-win': 1,
  'safe-south': 1,
  'three-matches': 3,
} as const;

export type ThemeChallengeId = keyof typeof THEME_CHALLENGE_TARGETS;

export interface ThemeChallengeState {
  schema: 1;
  challengeSetId: typeof THEME_CHALLENGE_SET_ID;
  progress: Record<ThemeChallengeId, number>;
  completedIds: ThemeChallengeId[];
  /** Match ids prevent a restored or re-synced game from advancing progress twice. */
  creditedMatchIds: string[];
  updatedAt: number;
}

export function createDefaultThemeChallengeState(): ThemeChallengeState {
  return {
    schema: 1,
    challengeSetId: THEME_CHALLENGE_SET_ID,
    progress: {
      'menzen-win': 0,
      'safe-south': 0,
      'three-matches': 0,
    },
    completedIds: [],
    creditedMatchIds: [],
    updatedAt: Date.now(),
  };
}

export function normalizeThemeChallengeState(raw: unknown): ThemeChallengeState {
  const defaults = createDefaultThemeChallengeState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const input = raw as Partial<ThemeChallengeState>;
  if (input.schema !== 1 || input.challengeSetId !== THEME_CHALLENGE_SET_ID)
    return defaults;

  const progress = {} as ThemeChallengeState['progress'];
  for (const id of Object.keys(THEME_CHALLENGE_TARGETS) as ThemeChallengeId[]) {
    const value = input.progress?.[id];
    progress[id] = Math.min(
      THEME_CHALLENGE_TARGETS[id],
      typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        ? value
        : 0,
    );
  }

  const completed = new Set<ThemeChallengeId>(
    Array.isArray(input.completedIds)
      ? input.completedIds.filter(
          (id): id is ThemeChallengeId =>
            typeof id === 'string' &&
            Object.prototype.hasOwnProperty.call(THEME_CHALLENGE_TARGETS, id),
        )
      : [],
  );
  for (const id of Object.keys(THEME_CHALLENGE_TARGETS) as ThemeChallengeId[]) {
    if (progress[id] >= THEME_CHALLENGE_TARGETS[id]) completed.add(id);
    if (completed.has(id)) progress[id] = THEME_CHALLENGE_TARGETS[id];
  }

  return {
    schema: 1,
    challengeSetId: THEME_CHALLENGE_SET_ID,
    progress,
    completedIds: [...completed],
    creditedMatchIds: Array.isArray(input.creditedMatchIds)
      ? [...new Set(input.creditedMatchIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200,
        ))]
      : [],
    updatedAt:
      typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
        ? input.updatedAt
        : defaults.updatedAt,
  };
}
