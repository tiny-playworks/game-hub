export const ARCADE_CHALLENGE_ID = 'focus-v1' as const;
export const ARCADE_CHALLENGE_STORAGE_KEY = 'game-hub-arcade-challenges-v1';
export type ChallengeRecord = {
  attempts: number;
  clears: number;
  bestDurationMs: number | null;
  updatedAt: number;
};
export type ArcadeChallengeState = {
  schema: 1;
  records: Record<string, ChallengeRecord>;
  recentIds: string[];
};
export type ChallengeResult = ChallengeRecord & {
  cleared: boolean;
  durationMs: number;
};
export type ChallengeFinish = {
  gameId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  outcome: 'win' | 'lose' | 'draw';
  score: number;
  meta?: Record<string, unknown>;
};

export function arcadeChallengeGoal(
  gameId: string,
  difficulty: ChallengeFinish['difficulty'],
): { target: number; moves: number } {
  const index = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 2 : 1;
  const targets: Record<string, number[]> = {
    'guess-number': [7, 9, 10],
    memory: [3, 5, 8],
    rubiks: [90, 180, 300],
    '2048': [256, 512, 256],
    snake: [100, 200, 300],
    shooter: [200, 400, 600],
    tetris: [10, 20, 30],
    breakout: [2, 2, 1],
    tank: [1, 1, 1],
    tictactoe: [1, 1, 1],
    gomoku: [60, 80, 100],
    go: [1, 1, 1],
    chess: [100, 140, 180],
    xiangqi: [80, 120, 160],
    doudizhu: [50, 60, 70],
    shengji: [1, 2, 2],
  };
  return {
    target: targets[gameId]?.[index] ?? 1,
    moves: [90, 130, 100][index],
  };
}

function metric(
  meta: Record<string, unknown> | undefined,
  key: string,
): number {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : Infinity;
}

export function evaluateArcadeChallenge(input: ChallengeFinish): boolean {
  const { gameId, difficulty, score, outcome, meta } = input;
  const { target, moves } = arcadeChallengeGoal(gameId, difficulty);
  const win = outcome === 'win';
  switch (gameId) {
    case 'guess-number':
      return win && score > 0 && score <= target;
    case 'memory':
      return win && metric(meta, 'mistakes') <= target;
    case 'rubiks':
      return win && score > 0 && score <= target;
    case '2048':
      return (
        Number.isFinite(metric(meta, 'maxTile')) &&
        metric(meta, 'maxTile') >= target &&
        metric(meta, 'moves') <= moves
      );
    case 'snake':
    case 'shooter':
      return score >= target;
    case 'tetris':
      return (
        Number.isFinite(metric(meta, 'lines')) &&
        metric(meta, 'lines') >= target
      );
    case 'breakout':
      return (
        win &&
        Number.isFinite(metric(meta, 'lives')) &&
        metric(meta, 'lives') >= target
      );
    case 'tank':
      return win && meta?.baseDamaged === false;
    case 'tictactoe':
      return (
        (win || (difficulty === 'hard' && outcome === 'draw')) &&
        meta?.opponent === 'ai'
      );
    case 'go':
      return win && meta?.opponent === 'ai';
    case 'gomoku':
    case 'chess':
    case 'xiangqi':
      return (
        win &&
        meta?.opponent === 'ai' &&
        metric(meta, 'moves') > 0 &&
        metric(meta, 'moves') <= target
      );
    case 'doudizhu':
      return (
        win && metric(meta, 'moves') > 0 && metric(meta, 'moves') <= target
      );
    case 'shengji':
      return (
        win &&
        Number.isFinite(metric(meta, 'upgrade')) &&
        metric(meta, 'upgrade') >= target
      );
    default:
      return false;
  }
}

export function normalizeArcadeChallenges(raw: unknown): ArcadeChallengeState {
  const input =
    raw && typeof raw === 'object'
      ? (raw as Partial<ArcadeChallengeState>)
      : null;
  const records: Record<string, ChallengeRecord> = {};
  const validGames = [
    'guess-number',
    'memory',
    'rubiks',
    '2048',
    'snake',
    'shooter',
    'tetris',
    'breakout',
    'tank',
    'tictactoe',
    'gomoku',
    'go',
    'chess',
    'xiangqi',
    'doudizhu',
    'shengji',
  ];
  for (const game of validGames)
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const key = `${game}:${difficulty}`;
      const record = input?.schema === 1 ? input.records?.[key] : null;
      if (!record || typeof record !== 'object') continue;
      const attempts =
        Number.isSafeInteger(record.attempts) && record.attempts >= 0
          ? record.attempts
          : 0;
      records[key] = {
        attempts,
        clears:
          Number.isSafeInteger(record.clears) && record.clears >= 0
            ? Math.min(attempts, record.clears)
            : 0,
        bestDurationMs:
          Number.isSafeInteger(record.bestDurationMs) &&
          record.bestDurationMs! >= 0
            ? record.bestDurationMs
            : null,
        updatedAt:
          Number.isSafeInteger(record.updatedAt) && record.updatedAt >= 0
            ? record.updatedAt
            : 0,
      };
    }
  return {
    schema: 1,
    records,
    recentIds: Array.isArray(input?.recentIds)
      ? input.recentIds
          .filter(
            (id): id is string => typeof id === 'string' && id.length <= 128,
          )
          .slice(-500)
      : [],
  };
}

/** Separate practice ledger: no currency, tasks, achievements, streaks or classic rankings. */
export function recordArcadeChallenge(
  raw: unknown,
  roundId: string,
  input: ChallengeFinish,
  now: number,
): { state: ArcadeChallengeState; result: ChallengeResult } {
  const state = normalizeArcadeChallenges(raw);
  const key = `${input.gameId}:${input.difficulty}`;
  const previous = state.records[key] ?? {
    attempts: 0,
    clears: 0,
    bestDurationMs: null,
    updatedAt: 0,
  };
  const cleared = evaluateArcadeChallenge(input);
  const reportedDuration = metric(input.meta, 'durationMs');
  const durationMs = Number.isSafeInteger(reportedDuration)
    ? reportedDuration
    : 0;
  if (state.recentIds.includes(roundId))
    return { state, result: { ...previous, cleared, durationMs } };
  const record = {
    attempts: Math.min(Number.MAX_SAFE_INTEGER, previous.attempts + 1),
    clears: Math.min(
      Number.MAX_SAFE_INTEGER,
      previous.clears + (cleared ? 1 : 0),
    ),
    bestDurationMs:
      cleared && durationMs > 0
        ? Math.min(previous.bestDurationMs ?? Infinity, durationMs)
        : previous.bestDurationMs,
    updatedAt: now,
  };
  return {
    state: {
      schema: 1,
      records: { ...state.records, [key]: record },
      recentIds: [...state.recentIds, roundId].slice(-500),
    },
    result: { ...record, cleared, durationMs },
  };
}
