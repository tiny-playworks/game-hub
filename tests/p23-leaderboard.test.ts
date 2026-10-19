import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase, readSnapshot, type MemberRow } from '../server/src/db';
import { registerArcadeRoutes } from '../server/src/routes/arcade';
import { registerLeaderboardRoutes } from '../server/src/routes/leaderboard';
import {
  getFamilyFeed,
  getLeaderboard,
  getMemberChampions,
  recordRankedResult,
  setEntryHidden,
  weekIdOf,
  weekRange,
} from '../server/src/services/leaderboard';
import { createEmptySnapshot } from '../server/src/snapshot';
import { DEFAULT_GAME_STATS } from '@/lib/arcadeStats';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const DAY = 24 * 60 * 60 * 1000;
// Monday 2026-01-05 00:00 Asia/Shanghai
const WEEK1 = Date.parse('2026-01-04T16:00:00.000Z');

function freshDb() {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  for (const [id, name] of [[A, 'Alice'], [B, 'Bob']]) {
    const snapshot = createEmptySnapshot(id, name);
    db.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
      VALUES (?, 's', 'h', ?, 0, ?)`).run(id, JSON.stringify(snapshot), snapshot.updatedAt);
  }
  return db;
}

let counter = 0;
function result(
  db: ReturnType<typeof freshDb>,
  memberId: string,
  gameId: string,
  score: number,
  at: number,
  extra: { outcome?: 'win' | 'lose' | 'draw'; streak?: number; durationMs?: number | null; now?: number } = {},
) {
  return recordRankedResult(db, {
    memberId,
    roundId: `arcade:${++counter}`,
    gameId,
    difficulty: 'normal',
    outcome: extra.outcome ?? 'win',
    score,
    stats: { ...DEFAULT_GAME_STATS, streak: extra.streak ?? 1 },
    occurredAt: at,
    durationMs: extra.durationMs === undefined ? 60_000 : extra.durationMs,
    now: extra.now ?? at,
  });
}

describe('P23 family leaderboard', () => {
  it('switches weeks at Monday 00:00 Asia/Shanghai', () => {
    expect(weekIdOf(WEEK1)).toBe('2026-01-05');
    expect(weekIdOf(WEEK1 - 1)).toBe('2025-12-29');
    expect(weekIdOf(WEEK1 + 6 * DAY + 23 * 3600_000)).toBe('2026-01-05');
    expect(weekRange('2026-01-05')).toEqual({ start: WEEK1, end: WEEK1 + 7 * DAY });
  });

  it('ranks max, min and wins metrics consistently with personal bests', () => {
    const db = freshDb();
    result(db, A, 'snake', 100, WEEK1 + 1000);
    result(db, B, 'snake', 250, WEEK1 + 2000);
    result(db, A, 'snake', 80, WEEK1 + 3000);
    result(db, A, 'guess-number', 7, WEEK1 + 1000);
    result(db, B, 'guess-number', 4, WEEK1 + 2000);
    result(db, A, 'guess-number', 3, WEEK1 + 3000, { outcome: 'lose' });
    result(db, A, 'tictactoe', 1, WEEK1 + 1000, { streak: 3 });
    result(db, B, 'tictactoe', 1, WEEK1 + 2000, { streak: 2 });
    const now = WEEK1 + DAY;
    const snake = getLeaderboard(db, 'snake', 'normal', 'all-time', now);
    expect(snake.entries.map((e) => [e.nickname, e.value])).toEqual([['Bob', 250], ['Alice', 100]]);
    const guess = getLeaderboard(db, 'guess-number', 'normal', 'all-time', now);
    expect(guess.entries.map((e) => [e.nickname, e.value])).toEqual([['Bob', 4], ['Alice', 7]]);
    const ttt = getLeaderboard(db, 'tictactoe', 'normal', 'week', now);
    expect(ttt.entries.map((e) => [e.nickname, e.value])).toEqual([['Alice', 3], ['Bob', 2]]);
  });

  it('puts the earlier achiever first on ties and shares the rank', () => {
    const db = freshDb();
    result(db, B, 'snake', 100, WEEK1 + 5000);
    result(db, A, 'snake', 100, WEEK1 + 1000);
    const board = getLeaderboard(db, 'snake', 'normal', 'all-time', WEEK1 + DAY);
    expect(board.entries.map((e) => [e.nickname, e.rank])).toEqual([['Alice', 1], ['Bob', 1]]);
  });

  it('does not rank short, unknown-duration or unsupported results', () => {
    const db = freshDb();
    expect(result(db, A, 'snake', 100, WEEK1, { durationMs: 100 })).toBeNull();
    expect(result(db, A, 'snake', 100, WEEK1, { durationMs: null })).toBeNull();
    expect(result(db, A, 'mahjong-japanese', 1, WEEK1)).toBeNull();
    expect(result(db, A, 'tictactoe', 0, WEEK1, { outcome: 'lose' })).toBeNull();
    expect(getLeaderboard(db, 'snake', 'normal', 'all-time', WEEK1).entries).toEqual([]);
  });

  it('reports standing, gap and family records', () => {
    const db = freshDb();
    const first = result(db, A, 'snake', 100, WEEK1 + 1000)!;
    expect(first).toMatchObject({ allTimeRank: 1, isFamilyRecord: false });
    const second = result(db, B, 'snake', 60, WEEK1 + 2000)!;
    expect(second).toMatchObject({ allTimeRank: 2, allTimeGapToPrevious: 40, isFamilyRecord: false });
    const third = result(db, B, 'snake', 180, WEEK1 + 3000)!;
    expect(third).toMatchObject({ allTimeRank: 1, weekRank: 1, isFamilyRecord: true });
    expect(getFamilyFeed(db, 10, WEEK1 + 4000).map((i) => i.kind)).toEqual(['family-record']);
  });

  it('awards weekly champions once, only with at least two members', () => {
    const db = freshDb();
    result(db, A, 'snake', 100, WEEK1 + 1000);
    result(db, B, 'snake', 150, WEEK1 + 2000);
    result(db, A, 'tank', 500, WEEK1 + 3000); // only one participant
    const nextWeek = WEEK1 + 7 * DAY + 1000;
    expect(getMemberChampions(db, B, nextWeek)).toEqual([
      expect.objectContaining({ weekId: '2026-01-05', gameId: 'snake', value: 150 }),
    ]);
    expect(getMemberChampions(db, A, nextWeek)).toEqual([]);
    expect(getMemberChampions(db, B, nextWeek + DAY)).toHaveLength(1);
    expect(getFamilyFeed(db, 10, nextWeek).filter((i) => i.kind === 'weekly-champion')).toHaveLength(1);
  });

  it('awards tied first places together', () => {
    const db = freshDb();
    result(db, A, 'snake', 100, WEEK1 + 1000);
    result(db, B, 'snake', 100, WEEK1 + 2000);
    const nextWeek = WEEK1 + 8 * DAY;
    expect(getMemberChampions(db, A, nextWeek)).toHaveLength(1);
    expect(getMemberChampions(db, B, nextWeek)).toHaveLength(1);
  });

  it('does not re-judge a settled week when a late offline receipt arrives', () => {
    const db = freshDb();
    result(db, A, 'snake', 100, WEEK1 + 1000);
    result(db, B, 'snake', 150, WEEK1 + 2000);
    const nextWeek = WEEK1 + 8 * DAY;
    expect(getMemberChampions(db, B, nextWeek)).toHaveLength(1);
    // Alice syncs a much better result that happened inside the settled week.
    result(db, A, 'snake', 900, WEEK1 + 3000, { now: nextWeek + DAY });
    expect(getMemberChampions(db, A, nextWeek + DAY)).toEqual([]);
    expect(getMemberChampions(db, B, nextWeek + DAY)).toHaveLength(1);
    // ...but it still counts for the all-time board.
    expect(getLeaderboard(db, 'snake', 'normal', 'all-time', nextWeek + DAY).entries[0])
      .toMatchObject({ nickname: 'Alice', value: 900 });
  });

  it('seals a week that only received a late first receipt', () => {
    const db = freshDb();
    const later = WEEK1 + 8 * DAY;
    result(db, A, 'snake', 100, WEEK1 + 1000, { now: later });
    result(db, B, 'snake', 150, WEEK1 + 2000, { now: later });
    expect(getMemberChampions(db, B, later + DAY)).toEqual([]);
  });

  it('excludes hidden results from boards and champions and can restore them', () => {
    const db = freshDb();
    result(db, A, 'snake', 100, WEEK1 + 1000);
    result(db, B, 'snake', 150, WEEK1 + 2000);
    const bobRound = (db.prepare('SELECT round_id FROM leaderboard_entries WHERE member_id = ?')
      .get(B) as { round_id: string }).round_id;
    expect(setEntryHidden(db, B, bobRound, true, 'cheating', WEEK1 + 3000)).toBe(true);
    const board = getLeaderboard(db, 'snake', 'normal', 'all-time', WEEK1 + DAY);
    expect(board.entries.map((e) => e.nickname)).toEqual(['Alice']);
    expect(getMemberChampions(db, B, WEEK1 + 8 * DAY)).toEqual([]);
    expect(setEntryHidden(db, B, bobRound, false, null)).toBe(true);
    expect(getLeaderboard(db, 'snake', 'normal', 'all-time', WEEK1 + DAY).entries).toHaveLength(2);
  });

  it('seeds existing personal bests for the all-time board only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p23-'));
    process.env.GAME_HUB_DB_PATH = join(dir, 'h.sqlite');
    try {
      const first = openDatabase();
      const snapshot = createEmptySnapshot(A, 'Alice');
      snapshot.arcade.stats['snake:normal'] = { ...DEFAULT_GAME_STATS, highScore: 321 };
      snapshot.arcade.stats['rubiks:normal'] = { ...DEFAULT_GAME_STATS, minValue: 42 };
      snapshot.arcade.stats['gomoku:normal'] = { ...DEFAULT_GAME_STATS, bestStreak: 5 };
      first.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES (?, 's', 'h', ?, 0, ?)`).run(A, JSON.stringify(snapshot), snapshot.updatedAt);
      first.exec('DROP TABLE leaderboard_entries');
      first.close();
      const db = openDatabase();
      const now = Date.now();
      const value = (game: string) =>
        getLeaderboard(db, game, 'normal', 'all-time', now).entries[0]?.value;
      expect(value('snake')).toBe(321);
      expect(value('rubiks')).toBe(42);
      expect(value('gomoku')).toBe(5);
      expect(getLeaderboard(db, 'snake', 'normal', 'week', now).entries).toEqual([]);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('P23 online settlement integration', () => {
  it('returns the standing on finish and rejects implausible scores', async () => {
    const db = freshDb();
    const token = 'B'.repeat(43);
    db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(createHash('sha256').update(token).digest('hex'), A,
        '00000000-0000-4000-8000-0000000000c3', Date.now() + 60_000);
    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof ApiError) reply.code(error.status).send(error.body);
      else reply.code(500).send({ code: 'INTERNAL_ERROR' });
    });
    registerArcadeRoutes(app, db);
    registerLeaderboardRoutes(app, db);
    const headers = { cookie: `gh_session=${token}` };
    const roundId = 'arcade:00000000-0000-4000-8000-0000000000d4';
    const post = (baseRevision: number, event: Record<string, unknown>) => app.inject({
      method: 'POST', url: '/api/v1/me/arcade/events', headers, payload: { baseRevision, event },
    });
    try {
      expect((await post(0, { type: 'start', roundId, gameId: 'snake', difficulty: 'normal' })).statusCode).toBe(200);
      // Finishing right away is too fast to rank, but still settles personally.
      const early = await post(1, { type: 'finish', roundId, gameId: 'snake', difficulty: 'normal',
        score: 50, outcome: 'lose' });
      expect(early.statusCode).toBe(200);
      expect(early.json().result.leaderboard).toBeUndefined();
      expect(early.json().snapshot.arcade.stats['snake:normal'].highScore).toBe(50);

      // Back-date the next round so it is long enough to rank.
      const round2 = 'arcade:00000000-0000-4000-8000-0000000000d5';
      expect((await post(2, { type: 'start', roundId: round2, gameId: 'snake', difficulty: 'normal' })).statusCode).toBe(200);
      db.prepare('UPDATE arcade_rounds SET started_at = ? WHERE round_id = ?').run(Date.now() - 60_000, round2);
      const ranked = await post(3, { type: 'finish', roundId: round2, gameId: 'snake', difficulty: 'normal',
        score: 70, outcome: 'lose' });
      expect(ranked.json().result.leaderboard).toMatchObject({ allTimeRank: 1, weekRank: 1 });
      const coins = readSnapshot(db.prepare('SELECT * FROM members WHERE id = ?').get(A) as unknown as MemberRow).wallet.coins;
      const board = await app.inject({ method: 'GET', headers,
        url: '/api/v1/leaderboard?gameId=snake&difficulty=normal&scope=all-time' });
      expect(board.statusCode).toBe(200);
      expect(board.json().entries).toHaveLength(1);
      expect(readSnapshot(db.prepare('SELECT * FROM members WHERE id = ?').get(A) as unknown as MemberRow).wallet.coins).toBe(coins);

      const round3 = 'arcade:00000000-0000-4000-8000-0000000000d6';
      expect((await post(4, { type: 'start', roundId: round3, gameId: 'tetris', difficulty: 'normal' })).statusCode).toBe(200);
      const absurd = await post(5, { type: 'finish', roundId: round3, gameId: 'tetris', difficulty: 'normal',
        score: 9_000_000, outcome: 'lose' });
      expect(absurd.statusCode).toBe(400);
      const contradictory = await post(5, { type: 'finish', roundId: round3, gameId: 'tetris', difficulty: 'normal',
        score: 100, outcome: 'lose', meta: { lines: 500 } });
      expect(contradictory.statusCode).toBe(400);

      expect((await app.inject({ method: 'GET', headers, url: '/api/v1/leaderboard?gameId=nope&difficulty=normal&scope=week' })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/v1/feed' })).statusCode).not.toBe(200);
      expect((await app.inject({ method: 'GET', headers, url: '/api/v1/feed' })).json()).toEqual({ items: [] });
    } finally {
      await app.close();
    }
  });
});
