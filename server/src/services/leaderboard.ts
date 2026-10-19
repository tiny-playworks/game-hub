import type { DatabaseSync } from 'node:sqlite';
import { games } from '@/data/games';
import type { GameStats } from '@/lib/arcadeStats';
import type {
  FamilyFeedItem,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScope,
  LeaderboardStanding,
  WeeklyChampionBadge,
} from '../../../shared/contracts/leaderboard';
import type { MemberSnapshot } from '../../../shared/contracts/member';
import { appendFamilyFeed, transaction } from '../db';

type Metric = 'max' | 'min' | 'wins';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Shortest plausible round (ms) for a result to count on a board. Shorter rounds
 * still settle personal stats and rewards; they are just not ranked.
 */
const MIN_RANKED_DURATION_MS: Record<string, number> = {
  'guess-number': 3_000,
  tictactoe: 2_000,
  memory: 8_000,
  '2048': 10_000,
  snake: 5_000,
  breakout: 5_000,
  shooter: 5_000,
  tank: 8_000,
  tetris: 10_000,
  rubiks: 3_000,
  go: 15_000,
  xiangqi: 15_000,
  chess: 15_000,
  gomoku: 8_000,
  doudizhu: 20_000,
  shengji: 20_000,
};
const DEFAULT_MIN_RANKED_DURATION_MS = 5_000;
const MAX_REPORTED_DURATION_MS = 24 * 60 * 60 * 1000;

export function metricOf(gameId: string): Metric | null {
  return games.find((game) => game.id === gameId)?.bestMetric ?? null;
}

export function isRankedGame(gameId: string): boolean {
  return gameId !== 'mahjong-japanese' && metricOf(gameId) !== null;
}

/** Monday 00:00 (Asia/Shanghai) of the week containing `ms`, as `YYYY-MM-DD`. */
export function weekIdOf(ms: number): string {
  const local = ms + SHANGHAI_OFFSET_MS;
  const day = Math.floor(local / DAY_MS);
  // 1970-01-01 was a Thursday; (day + 3) % 7 === 0 on Mondays.
  const monday = day - ((day + 3) % 7);
  return new Date(monday * DAY_MS).toISOString().slice(0, 10);
}

export function weekRange(weekId: string): { start: number; end: number } {
  const start = Date.parse(`${weekId}T00:00:00.000Z`) - SHANGHAI_OFFSET_MS;
  return { start, end: start + WEEK_MS };
}

/** Server-measured duration for online rounds; client-reported for offline ones. */
export function reportedDurationMs(meta: Record<string, unknown> | undefined): number | null {
  const value = meta?.durationMs;
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_REPORTED_DURATION_MS ? value : null;
}

function entryValue(
  gameId: string,
  outcome: 'win' | 'lose' | 'draw',
  score: number,
  stats: GameStats | undefined,
): number | null {
  const metric = metricOf(gameId);
  if (metric === 'max') return score > 0 ? score : null;
  if (metric === 'min') return outcome === 'win' && score > 0 ? score : null;
  if (metric === 'wins')
    return outcome === 'win' && stats && stats.streak > 0 ? stats.streak : null;
  return null;
}

interface Row {
  member_id: string;
  round_id: string;
  value: number;
  occurred_at: number;
}

function better(metric: Metric, a: Row, b: Row): boolean {
  if (a.value !== b.value) return metric === 'min' ? a.value < b.value : a.value > b.value;
  return a.occurred_at < b.occurred_at;
}

function boardRows(
  db: DatabaseSync,
  gameId: string,
  difficulty: string,
  window?: { start: number; end: number },
): Row[] {
  const metric = metricOf(gameId);
  if (!metric) return [];
  const rows = (window
    ? db.prepare(
      `SELECT member_id, round_id, value, occurred_at FROM leaderboard_entries
       WHERE game_id = ? AND difficulty = ? AND hidden_at IS NULL
         AND occurred_at >= ? AND occurred_at < ?`,
    ).all(gameId, difficulty, window.start, window.end)
    : db.prepare(
      `SELECT member_id, round_id, value, occurred_at FROM leaderboard_entries
       WHERE game_id = ? AND difficulty = ? AND hidden_at IS NULL`,
    ).all(gameId, difficulty)) as unknown as Row[];
  const bestByMember = new Map<string, Row>();
  for (const row of rows) {
    const current = bestByMember.get(row.member_id);
    if (!current || better(metric, row, current)) bestByMember.set(row.member_id, row);
  }
  return [...bestByMember.values()].sort((a, b) =>
    a.value === b.value ? a.occurred_at - b.occurred_at
      : better(metric, a, b) ? -1 : 1);
}

function standingIn(
  rows: Row[],
  memberId: string,
): { rank: number | null; gap: number | null } {
  const index = rows.findIndex((row) => row.member_id === memberId);
  if (index < 0) return { rank: null, gap: null };
  // Competition ranking: equal values share the rank of the earliest of them.
  const rank = rows.findIndex((row) => row.value === rows[index].value) + 1;
  const above = rank > 1 ? rows[rank - 2] : null;
  return { rank, gap: above ? Math.abs(above.value - rows[index].value) : null };
}

function memberLabels(db: DatabaseSync, ids: string[]): Map<string, { nickname: string; avatar?: string }> {
  const labels = new Map<string, { nickname: string; avatar?: string }>();
  const select = db.prepare('SELECT snapshot FROM members WHERE id = ?');
  for (const id of new Set(ids)) {
    const row = select.get(id) as { snapshot: string } | undefined;
    if (!row) continue;
    try {
      const profile = (JSON.parse(row.snapshot) as MemberSnapshot).profile;
      labels.set(id, { nickname: profile.nickname, avatar: profile.avatarPresetId });
    } catch {
      labels.set(id, { nickname: '?' });
    }
  }
  return labels;
}

/** Lazily awards weekly champions for every finished week that has not been settled. */
export function settleFinishedWeeks(db: DatabaseSync, now = Date.now()): void {
  const currentStart = weekRange(weekIdOf(now)).start;
  const pending = db.prepare(
    `SELECT DISTINCT occurred_at FROM leaderboard_entries
     WHERE occurred_at > 0 AND occurred_at < ? AND hidden_at IS NULL`,
  ).all(currentStart) as Array<{ occurred_at: number }>;
  const weeks = [...new Set(pending.map((row) => weekIdOf(row.occurred_at)))]
    .filter((weekId) => !db.prepare(
      'SELECT 1 FROM leaderboard_week_settlements WHERE week_id = ?',
    ).get(weekId))
    .sort();
  if (weeks.length === 0) return;
  transaction(db, () => {
    for (const weekId of weeks) {
      const window = weekRange(weekId);
      const boards = db.prepare(
        `SELECT DISTINCT game_id, difficulty FROM leaderboard_entries
         WHERE occurred_at >= ? AND occurred_at < ? AND hidden_at IS NULL`,
      ).all(window.start, window.end) as Array<{ game_id: string; difficulty: string }>;
      for (const board of boards) {
        const rows = boardRows(db, board.game_id, board.difficulty, window);
        if (rows.length < 2) continue;
        const winners = rows.filter((row) => row.value === rows[0].value);
        for (const winner of winners) {
          const inserted = db.prepare(
            `INSERT OR IGNORE INTO weekly_champions
               (week_id, game_id, difficulty, member_id, value, awarded_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(weekId, board.game_id, board.difficulty, winner.member_id, winner.value, now);
          if (inserted.changes === 1)
            appendFamilyFeed(db, {
              kind: 'weekly-champion', memberId: winner.member_id,
              gameId: board.game_id, difficulty: board.difficulty,
              value: winner.value, weekId, createdAt: now,
            });
        }
      }
      db.prepare('INSERT OR IGNORE INTO leaderboard_week_settlements(week_id, settled_at) VALUES (?, ?)')
        .run(weekId, now);
    }
  });
}

export interface RankedResultInput {
  memberId: string;
  roundId: string;
  gameId: string;
  difficulty: string;
  outcome: 'win' | 'lose' | 'draw';
  score: number;
  /** Member stats for this game/difficulty after the result was settled. */
  stats: GameStats | undefined;
  occurredAt: number;
  /** null when unknown; such results never reach the boards. */
  durationMs: number | null;
  now?: number;
}

/** Records a settled result on the family boards. Returns null when it is not ranked. */
export function recordRankedResult(
  db: DatabaseSync,
  input: RankedResultInput,
): LeaderboardStanding | null {
  if (!isRankedGame(input.gameId)) return null;
  const minimum = MIN_RANKED_DURATION_MS[input.gameId] ?? DEFAULT_MIN_RANKED_DURATION_MS;
  if (input.durationMs === null || input.durationMs < minimum) return null;
  const value = entryValue(input.gameId, input.outcome, input.score, input.stats);
  if (value === null) return null;
  const now = input.now ?? Date.now();
  const occurredAt = Math.min(Math.max(1, input.occurredAt), now);

  return transaction(db, () => {
    settleFinishedWeeks(db, now);
    const metric = metricOf(input.gameId)!;
    const before = boardRows(db, input.gameId, input.difficulty)[0];
    const inserted = db.prepare(
      `INSERT OR IGNORE INTO leaderboard_entries
         (member_id, round_id, game_id, difficulty, value, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(input.memberId, input.roundId, input.gameId, input.difficulty, value, occurredAt);
    if (inserted.changes !== 1) return null;

    const entryWeek = weekIdOf(occurredAt);
    if (entryWeek < weekIdOf(now))
      db.prepare('INSERT OR IGNORE INTO leaderboard_week_settlements(week_id, settled_at) VALUES (?, ?)')
        .run(entryWeek, now);

    const isFamilyRecord = Boolean(before) && better(
      metric,
      { member_id: input.memberId, round_id: input.roundId, value, occurred_at: occurredAt },
      before,
    ) && before.value !== value;
    if (isFamilyRecord)
      appendFamilyFeed(db, {
        kind: 'family-record', memberId: input.memberId, gameId: input.gameId,
        difficulty: input.difficulty, value, createdAt: now,
      });

    const all = standingIn(boardRows(db, input.gameId, input.difficulty), input.memberId);
    const week = standingIn(
      boardRows(db, input.gameId, input.difficulty, weekRange(weekIdOf(now))),
      input.memberId,
    );
    return {
      allTimeRank: all.rank,
      weekRank: week.rank,
      allTimeGapToPrevious: all.gap,
      weekGapToPrevious: week.gap,
      isFamilyRecord,
    };
  });
}

/** Convenience for settle paths holding a post-settlement snapshot. */
export function statsFor(
  snapshot: MemberSnapshot,
  gameId: string,
  difficulty: string,
): GameStats | undefined {
  return snapshot.arcade.stats[`${gameId}:${difficulty}`];
}

export function getLeaderboard(
  db: DatabaseSync,
  gameId: string,
  difficulty: string,
  scope: LeaderboardScope,
  now = Date.now(),
): LeaderboardResponse {
  settleFinishedWeeks(db, now);
  const metric = metricOf(gameId) ?? 'max';
  const weekId = scope === 'week' ? weekIdOf(now) : null;
  const rows = boardRows(db, gameId, difficulty, weekId ? weekRange(weekId) : undefined);
  const labels = memberLabels(db, rows.map((row) => row.member_id));
  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: rows.findIndex((other) => other.value === row.value) + 1 || index + 1,
    memberId: row.member_id,
    nickname: labels.get(row.member_id)?.nickname ?? '?',
    avatar: labels.get(row.member_id)?.avatar,
    value: row.value,
    achievedAt: row.occurred_at,
  }));
  return { gameId, difficulty, scope, metric, weekId, entries };
}

export function getFamilyFeed(db: DatabaseSync, limit = 20, now = Date.now()): FamilyFeedItem[] {
  settleFinishedWeeks(db, now);
  const rows = db.prepare(
    `SELECT id, kind, member_id, game_id, difficulty, value, week_id, cup_id, created_at
     FROM family_feed ORDER BY id DESC LIMIT ?`,
  ).all(Math.min(Math.max(1, Math.floor(limit)), 100)) as Array<{
    id: number; kind: FamilyFeedItem['kind']; member_id: string | null; game_id: string | null;
    difficulty: string | null; value: number | null; week_id: string | null;
    cup_id: string | null; created_at: number;
  }>;
  const labels = memberLabels(db, rows.flatMap((row) => row.member_id ? [row.member_id] : []));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    memberId: row.member_id,
    nickname: row.member_id ? labels.get(row.member_id)?.nickname ?? null : null,
    gameId: row.game_id,
    difficulty: row.difficulty,
    value: row.value,
    weekId: row.week_id,
    cupId: row.cup_id,
    createdAt: row.created_at,
  }));
}

export function getMemberChampions(db: DatabaseSync, memberId: string, now = Date.now()): WeeklyChampionBadge[] {
  settleFinishedWeeks(db, now);
  const rows = db.prepare(
    `SELECT week_id, game_id, difficulty, value, awarded_at FROM weekly_champions
     WHERE member_id = ? ORDER BY week_id DESC, game_id`,
  ).all(memberId) as Array<{
    week_id: string; game_id: string; difficulty: string; value: number; awarded_at: number;
  }>;
  return rows.map((row) => ({
    weekId: row.week_id, gameId: row.game_id, difficulty: row.difficulty,
    value: row.value, awardedAt: row.awarded_at,
  }));
}

export interface AdminBoardRow {
  rank: number;
  memberId: string;
  roundId: string;
  value: number;
  occurredAt: number;
}

/** Admin view: top N members of a board, including the round id needed to hide it. */
export function listTopEntries(
  db: DatabaseSync,
  gameId: string,
  difficulty: string,
  scope: LeaderboardScope,
  limit: number,
  now = Date.now(),
): AdminBoardRow[] {
  const rows = boardRows(db, gameId, difficulty, scope === 'week' ? weekRange(weekIdOf(now)) : undefined);
  return rows.slice(0, limit).map((row, index) => ({
    rank: index + 1, memberId: row.member_id, roundId: row.round_id,
    value: row.value, occurredAt: row.occurred_at,
  }));
}

export function setEntryHidden(
  db: DatabaseSync,
  memberId: string,
  roundId: string,
  hidden: boolean,
  reason: string | null,
  now = Date.now(),
): boolean {
  const result = hidden
    ? db.prepare(
      'UPDATE leaderboard_entries SET hidden_at = ?, hidden_reason = ? WHERE member_id = ? AND round_id = ?',
    ).run(now, reason, memberId, roundId)
    : db.prepare(
      'UPDATE leaderboard_entries SET hidden_at = NULL, hidden_reason = NULL WHERE member_id = ? AND round_id = ?',
    ).run(memberId, roundId);
  return result.changes === 1;
}
