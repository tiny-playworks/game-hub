import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { getBestValue, type GameStats } from '@/lib/arcadeStats';
import type { MemberSnapshot } from '../../shared/contracts/member';
import { normalizeThemeChallengeState } from '../../shared/contracts/challenge';
import { normalizeJourneyProgress } from '../../shared/contracts/journey';
import { migrateGameRooms } from './gameRooms/schema';
import {
  computeCupMatchPoints,
  computeCupStandings,
  type FamilyCupMatchRecord,
  type FamilyCupParticipant,
  type FamilyCupSummary,
} from '../../shared/contracts/room';

export interface MemberRow {
  id: string;
  pin_salt: string;
  pin_hash: string;
  snapshot: string;
  revision: number;
  imported_at: string | null;
}

export interface SessionRow {
  token_hash: string;
  member_id: string;
  device_id: string;
  expires_at: number;
}

const defaultPath = fileURLToPath(new URL('../data/household.sqlite', import.meta.url));

export function openDatabase(): DatabaseSync {
  const path = process.env.GAME_HUB_DB_PATH ?? defaultPath;
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 5000 });
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pin_failures (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      ip TEXT NOT NULL,
      failures INTEGER NOT NULL,
      locked_until INTEGER NOT NULL,
      PRIMARY KEY(member_id, ip)
    );
    CREATE TABLE IF NOT EXISTS import_backups (
      member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      exported_at TEXT NOT NULL,
      save_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS arcade_rounds (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      round_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      result_json TEXT,
      PRIMARY KEY(member_id, round_id)
    );
    CREATE TABLE IF NOT EXISTS riichi_matches (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('free', 'ai-ranked')),
      state_json TEXT NOT NULL,
      player_character_id TEXT NOT NULL,
      challenge_eligible INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER,
      PRIMARY KEY(member_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS offline_receipts (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('free', 'arcade')),
      occurred_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('accepted', 'duplicate', 'rejected')),
      result_json TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, event_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS offline_receipts_match
      ON offline_receipts(member_id, match_id, source)
      WHERE status = 'accepted';
    CREATE TABLE IF NOT EXISTS theme_challenge_matches (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      challenge_set_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('free', 'ai-ranked')),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, challenge_set_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS theme_challenge_completions (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      challenge_set_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, challenge_set_id, challenge_id),
      CHECK(challenge_id IN ('menzen-win', 'safe-south', 'three-matches')),
      FOREIGN KEY(member_id, challenge_set_id, match_id)
        REFERENCES theme_challenge_matches(member_id, challenge_set_id, match_id)
        ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS resume_saves (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      save_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source = 'free'),
      save_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, device_id, save_id)
    );
    CREATE TABLE IF NOT EXISTS journey_attempts (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      attempt_id TEXT NOT NULL,
      stage_id TEXT NOT NULL CHECK(stage_id IN (
        'aoi-balance',
        'rin-tempo',
        'mio-defense',
        'koharu-call',
        'chitose-closed',
        'sora-value',
        'aya-riichi',
        'mahiru-flush',
        'yoru-reading',
        'tsubaki-finale'
      )),
      content_version INTEGER NOT NULL CHECK(content_version = 1),
      payload_hash TEXT NOT NULL,
      evaluation_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, attempt_id)
    );
    CREATE TABLE IF NOT EXISTS active_rooms (
      room_id TEXT PRIMARY KEY,
      summary_json TEXT NOT NULL,
      match_json TEXT,
      server_deadline INTEGER,
      is_paused INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_results (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      placement INTEGER NOT NULL,
      score INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      date_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS family_cups (
      cup_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1 CHECK(version = 1),
      match_length TEXT NOT NULL CHECK(match_length IN ('east', 'south')),
      total_matches INTEGER NOT NULL CHECK(total_matches IN (2, 3)),
      status TEXT NOT NULL CHECK(status IN ('waiting', 'playing', 'between_matches', 'completed')),
      participants_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS family_cup_matches (
      cup_id TEXT NOT NULL REFERENCES family_cups(cup_id) ON DELETE CASCADE,
      match_index INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      final_scores_json TEXT NOT NULL,
      awarded_points_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(cup_id, match_index),
      UNIQUE(cup_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS room_commands (
      room_id TEXT NOT NULL,
      command_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      command_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(room_id, command_id)
    );
    CREATE TABLE IF NOT EXISTS riichi_replays (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('free', 'ai-ranked', 'family')),
      room_id TEXT,
      viewer_seat INTEGER NOT NULL,
      player_character_id TEXT NOT NULL,
      ranking INTEGER NOT NULL,
      final_score INTEGER NOT NULL,
      match_length TEXT NOT NULL,
      replay_json TEXT NOT NULL,
      rounds_count INTEGER,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, match_id)
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS riichi_matches_active
      ON riichi_matches(member_id, device_id, finished_at, updated_at);
    CREATE INDEX IF NOT EXISTS resume_saves_member
      ON resume_saves(member_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS room_commands_order
      ON room_commands(room_id, revision ASC);
    CREATE INDEX IF NOT EXISTS riichi_replays_member_created
      ON riichi_replays(member_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS riichi_replays_member_fav
      ON riichi_replays(member_id, is_favorite, created_at DESC);
    CREATE INDEX IF NOT EXISTS family_cups_updated
      ON family_cups(updated_at DESC);
  `);
  const hadLeaderboard = Boolean(db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'leaderboard_entries'")
    .get());
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      round_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      value INTEGER NOT NULL,
      occurred_at INTEGER NOT NULL,
      hidden_at INTEGER,
      hidden_reason TEXT,
      PRIMARY KEY(member_id, round_id)
    );
    CREATE INDEX IF NOT EXISTS leaderboard_entries_board
      ON leaderboard_entries(game_id, difficulty, occurred_at);
    CREATE TABLE IF NOT EXISTS leaderboard_week_settlements (
      week_id TEXT PRIMARY KEY,
      settled_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_champions (
      week_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      value INTEGER NOT NULL,
      awarded_at INTEGER NOT NULL,
      PRIMARY KEY(week_id, game_id, difficulty, member_id)
    );
    CREATE TABLE IF NOT EXISTS family_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      member_id TEXT,
      game_id TEXT,
      difficulty TEXT,
      value INTEGER,
      week_id TEXT,
      cup_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  if (!hadLeaderboard) backfillLeaderboard(db);
  migrateGameRooms(db);
  const journeySql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'journey_attempts'")
    .get() as { sql?: string } | undefined;
  if (journeySql?.sql && !journeySql.sql.includes('tsubaki-finale')) {
    transaction(db, () => {
      db.exec(`
        CREATE TABLE journey_attempts_v2 (
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          attempt_id TEXT NOT NULL,
          stage_id TEXT NOT NULL CHECK(stage_id IN (
            'aoi-balance',
            'rin-tempo',
            'mio-defense',
            'koharu-call',
            'chitose-closed',
            'sora-value',
            'aya-riichi',
            'mahiru-flush',
            'yoru-reading',
            'tsubaki-finale'
          )),
          content_version INTEGER NOT NULL CHECK(content_version = 1),
          payload_hash TEXT NOT NULL,
          evaluation_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY(member_id, attempt_id)
        );
        INSERT INTO journey_attempts_v2
          SELECT member_id, attempt_id, stage_id, content_version, payload_hash, evaluation_json, created_at
          FROM journey_attempts;
        DROP TABLE journey_attempts;
        ALTER TABLE journey_attempts_v2 RENAME TO journey_attempts;
      `);
    });
  }
  const matchColumns = db.prepare('PRAGMA table_info(riichi_matches)').all() as Array<{ name: string }>;
  if (!matchColumns.some((column) => column.name === 'challenge_eligible')) {
    db.exec('ALTER TABLE riichi_matches ADD COLUMN challenge_eligible INTEGER NOT NULL DEFAULT 0');
  }
  const replayColumns = db.prepare('PRAGMA table_info(riichi_replays)').all() as Array<{ name: string }>;
  if (!replayColumns.some((column) => column.name === 'rounds_count')) {
    transaction(db, () => {
      db.exec('ALTER TABLE riichi_replays ADD COLUMN rounds_count INTEGER');
      const rows = db.prepare('SELECT member_id, match_id, replay_json FROM riichi_replays').all() as Array<{
        member_id: string;
        match_id: string;
        replay_json: string;
      }>;
      const update = db.prepare('UPDATE riichi_replays SET rounds_count = ? WHERE member_id = ? AND match_id = ?');
      for (const row of rows) {
        update.run(countReplayRounds(row.replay_json), row.member_id, row.match_id);
      }
    });
  }
}

function countReplayRounds(json: string): number | null {
  try {
    const file = JSON.parse(json) as { events?: Array<{ type?: string }> };
    return Array.isArray(file.events)
      ? file.events.filter((event) => event.type === 'nextRound').length + 1
      : null;
  } catch {
    return null;
  }
}

let transactionId = 0;
export function transaction<T>(db: DatabaseSync, run: () => T): T {
  const nested = db.isTransaction;
  const point = `game_hub_${++transactionId}`;
  db.exec(nested ? `SAVEPOINT ${point}` : 'BEGIN IMMEDIATE');
  try {
    const value = run();
    db.exec(nested ? `RELEASE SAVEPOINT ${point}` : 'COMMIT');
    return value;
  } catch (error) {
    db.exec(nested ? `ROLLBACK TO SAVEPOINT ${point}` : 'ROLLBACK');
    if (nested) db.exec(`RELEASE SAVEPOINT ${point}`);
    throw error;
  }
}

export function getMember(db: DatabaseSync, id: string): MemberRow | null {
  return (db.prepare('SELECT * FROM members WHERE id = ?').get(id) as unknown as MemberRow | undefined) ?? null;
}

export function readSnapshot(row: MemberRow): MemberSnapshot {
  const snapshot = JSON.parse(row.snapshot) as MemberSnapshot;
  if (
    snapshot.schema !== 1 ||
    snapshot.memberId !== row.id ||
    snapshot.revision !== row.revision
  ) {
    throw new Error('Member snapshot is inconsistent');
  }
  const journey = normalizeJourneyProgress(snapshot.journey);
  const unlockedByJourney = (['tsubaki'] as const).filter(
    (id) =>
      id === 'tsubaki' &&
      journey.stages['tsubaki-finale']?.completed &&
      !snapshot.characters.unlockedCharacterIds.includes(id),
  );
  return {
    ...snapshot,
    themeChallenges: normalizeThemeChallengeState(snapshot.themeChallenges),
    journey,
    ...(unlockedByJourney.length > 0
      ? {
          characters: {
            ...snapshot.characters,
            unlockedCharacterIds: [
              ...snapshot.characters.unlockedCharacterIds,
              ...unlockedByJourney,
            ],
            affinityByCharacter: {
              ...Object.fromEntries(unlockedByJourney.map((id) => [id, 0])),
              ...snapshot.characters.affinityByCharacter,
            },
          },
        }
      : {}),
  };
}

export function saveSnapshot(
  db: DatabaseSync,
  current: MemberRow,
  value: MemberSnapshot,
): MemberSnapshot {
  const next: MemberSnapshot = {
    ...value,
    schema: 1,
    memberId: current.id,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  const result = db.prepare(
    'UPDATE members SET snapshot = ?, revision = ? WHERE id = ? AND revision = ?',
  ).run(JSON.stringify(next), next.revision, current.id, current.revision);
  if (result.changes !== 1) throw new Error('Member revision conflict');
  return next;
}

export interface ReplayRow {
  member_id: string;
  match_id: string;
  source: 'free' | 'ai-ranked' | 'family';
  room_id: string | null;
  viewer_seat: number;
  player_character_id: string;
  ranking: number;
  final_score: number;
  match_length: string;
  replay_json: string;
  rounds_count: number | null;
  is_favorite: number;
  created_at: number;
}

export type ReplaySummaryRow = Omit<ReplayRow, 'replay_json'>;

export function archiveReplay(
  db: DatabaseSync,
  memberId: string,
  entry: {
    matchId: string;
    source: 'free' | 'ai-ranked' | 'family';
    roomId?: string | null;
    viewerSeat: number;
    playerCharacterId: string;
    ranking: number;
    finalScore: number;
    matchLength: string;
    replayJson: string;
    createdAt?: number;
  },
): void {
  transaction(db, () => {
    // 检查是否已存在
    const existing = db
      .prepare('SELECT match_id, is_favorite FROM riichi_replays WHERE member_id = ? AND match_id = ?')
      .get(memberId, entry.matchId) as { match_id: string; is_favorite: number } | undefined;

    const createdAt = entry.createdAt ?? Date.now();
    const roundsCount = countReplayRounds(entry.replayJson);

    if (!existing) {
      // 检查普通未收藏牌谱数量，保留最近 200 场（总纲 4.5）
      const countRow = db
        .prepare('SELECT count(*) as count FROM riichi_replays WHERE member_id = ? AND is_favorite = 0')
        .get(memberId) as { count: number };

      if (countRow.count >= 200) {
        const excess = countRow.count - 199;
        db.prepare(`
          DELETE FROM riichi_replays
          WHERE member_id = ? AND is_favorite = 0 AND match_id IN (
            SELECT match_id FROM riichi_replays
            WHERE member_id = ? AND is_favorite = 0
            ORDER BY created_at ASC
            LIMIT ?
          )
        `).run(memberId, memberId, excess);
      }
    }

    db.prepare(`
      INSERT OR REPLACE INTO riichi_replays (
        member_id, match_id, source, room_id, viewer_seat,
        player_character_id, ranking, final_score, match_length,
        replay_json, rounds_count, is_favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM riichi_replays WHERE member_id = ? AND match_id = ?), 0), ?)
    `).run(
      memberId,
      entry.matchId,
      entry.source,
      entry.roomId ?? null,
      entry.viewerSeat,
      entry.playerCharacterId,
      entry.ranking,
      entry.finalScore,
      entry.matchLength,
      entry.replayJson,
      roundsCount,
      memberId,
      entry.matchId,
      createdAt,
    );
  });
}

export function getReplay(
  db: DatabaseSync,
  memberId: string,
  matchId: string,
): ReplayRow | null {
  return (
    (db
      .prepare('SELECT * FROM riichi_replays WHERE member_id = ? AND match_id = ?')
      .get(memberId, matchId) as unknown as ReplayRow | undefined) ?? null
  );
}

export function listReplays(
  db: DatabaseSync,
  memberId: string,
  query: {
    source?: 'all' | 'free' | 'ai-ranked' | 'family';
    ranking?: 'all' | 1 | 2 | 3 | 4;
    favoriteOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): { total: number; favoritesCount: number; items: ReplaySummaryRow[] } {
  const conditions: string[] = ['member_id = ?'];
  const params: (string | number)[] = [memberId];

  if (query.source && query.source !== 'all') {
    conditions.push('source = ?');
    params.push(query.source);
  }

  if (query.ranking && query.ranking !== 'all') {
    conditions.push('ranking = ?');
    params.push(query.ranking);
  }

  if (query.favoriteOnly) {
    conditions.push('is_favorite = 1');
  }

  const whereClause = conditions.join(' AND ');

  const totalRow = db
    .prepare(`SELECT count(*) as count FROM riichi_replays WHERE ${whereClause}`)
    .get(...params) as { count: number };

  const favRow = db
    .prepare('SELECT count(*) as count FROM riichi_replays WHERE member_id = ? AND is_favorite = 1')
    .get(memberId) as { count: number };

  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  const items = db
    .prepare(
      `SELECT member_id, match_id, source, room_id, viewer_seat, player_character_id,
        ranking, final_score, match_length, rounds_count, is_favorite, created_at
        FROM riichi_replays WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as ReplaySummaryRow[];

  return {
    total: totalRow.count,
    favoritesCount: favRow.count,
    items,
  };
}

export function toggleFavoriteReplay(
  db: DatabaseSync,
  memberId: string,
  matchId: string,
  isFavorite: boolean,
): { success: boolean; code?: string } {
  return transaction(db, () => {
    const replay = getReplay(db, memberId, matchId);
    if (!replay) return { success: false, code: 'REPLAY_NOT_FOUND' };

    if (isFavorite) {
      const favCount = db
        .prepare('SELECT count(*) as count FROM riichi_replays WHERE member_id = ? AND is_favorite = 1')
        .get(memberId) as { count: number };
      if (favCount.count >= 100) {
        return { success: false, code: 'FAVORITE_LIMIT_REACHED' };
      }
    }

    db.prepare('UPDATE riichi_replays SET is_favorite = ? WHERE member_id = ? AND match_id = ?').run(
      isFavorite ? 1 : 0,
      memberId,
      matchId,
    );
    return { success: true };
  });
}

export function deleteReplay(
  db: DatabaseSync,
  memberId: string,
  matchId: string,
): boolean {
  const result = db
    .prepare('DELETE FROM riichi_replays WHERE member_id = ? AND match_id = ?')
    .run(memberId, matchId);
  return result.changes > 0;
}

interface FamilyCupRow {
  cup_id: string;
  room_id: string;
  version: 1;
  match_length: 'east' | 'south';
  total_matches: 2 | 3;
  status: 'waiting' | 'playing' | 'between_matches' | 'completed';
  participants_json: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface FamilyCupMatchRow {
  cup_id: string;
  match_index: number;
  match_id: string;
  final_scores_json: string;
  awarded_points_json: string;
  created_at: number;
}

function hydrateFamilyCup(
  db: DatabaseSync,
  row: FamilyCupRow,
): FamilyCupSummary {
  const participants = JSON.parse(row.participants_json) as FamilyCupParticipant[];
  const matchRows = db
    .prepare(
      'SELECT * FROM family_cup_matches WHERE cup_id = ? ORDER BY match_index ASC',
    )
    .all(row.cup_id) as unknown as FamilyCupMatchRow[];
  const matches: FamilyCupMatchRecord[] = matchRows.map((m) => ({
    matchIndex: m.match_index,
    matchId: m.match_id,
    finalScores: JSON.parse(m.final_scores_json) as [
      number,
      number,
      number,
      number,
    ],
    awardedPoints: JSON.parse(m.awarded_points_json) as Record<string, number>,
    completedAt: m.created_at,
  }));
  const standings = computeCupStandings(participants, matches);
  return {
    cupId: row.cup_id,
    roomId: row.room_id,
    version: 1,
    matchLength: row.match_length,
    totalMatches: row.total_matches,
    completedMatches: matches.length,
    status: row.status,
    participants,
    matches,
    standings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function upsertFamilyCup(
  db: DatabaseSync,
  cup: {
    cupId: string;
    roomId: string;
    matchLength: 'east' | 'south';
    totalMatches: 2 | 3;
    status: 'waiting' | 'playing' | 'between_matches' | 'completed';
    participants: FamilyCupParticipant[];
    createdAt?: number;
    updatedAt?: number;
    completedAt?: number | null;
  },
): FamilyCupSummary {
  const now = Date.now();
  const createdAt = cup.createdAt ?? now;
  const updatedAt = cup.updatedAt ?? now;
  db.prepare(
    `INSERT INTO family_cups (
       cup_id, room_id, version, match_length, total_matches, status,
       participants_json, created_at, updated_at, completed_at
     ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cup_id) DO UPDATE SET
       status = excluded.status,
       participants_json = excluded.participants_json,
       updated_at = excluded.updated_at,
       completed_at = COALESCE(excluded.completed_at, family_cups.completed_at)`,
  ).run(
    cup.cupId,
    cup.roomId,
    cup.matchLength,
    cup.totalMatches,
    cup.status,
    JSON.stringify(cup.participants),
    createdAt,
    updatedAt,
    cup.completedAt ?? null,
  );
  return getFamilyCup(db, cup.cupId)!;
}

export function recordFamilyCupMatch(
  db: DatabaseSync,
  cupId: string,
  matchId: string,
  finalScores: readonly number[],
  now = Date.now(),
): { cup: FamilyCupSummary; duplicate: boolean } {
  return transaction(db, () => {
    const row = db
      .prepare('SELECT * FROM family_cups WHERE cup_id = ?')
      .get(cupId) as unknown as FamilyCupRow | undefined;
    if (!row) throw new Error('CUP_NOT_FOUND');

    const existingByMatch = db
      .prepare('SELECT 1 FROM family_cup_matches WHERE cup_id = ? AND match_id = ?')
      .get(cupId, matchId);
    if (existingByMatch) {
      return { cup: hydrateFamilyCup(db, row), duplicate: true };
    }

    const countRow = db
      .prepare('SELECT count(*) as count FROM family_cup_matches WHERE cup_id = ?')
      .get(cupId) as { count: number };
    const nextIndex = countRow.count + 1;
    if (nextIndex > row.total_matches) {
      return { cup: hydrateFamilyCup(db, row), duplicate: true };
    }

    const participants = JSON.parse(row.participants_json) as FamilyCupParticipant[];
    const scoresTuple: [number, number, number, number] = [
      finalScores[0] ?? 25000,
      finalScores[1] ?? 25000,
      finalScores[2] ?? 25000,
      finalScores[3] ?? 25000,
    ];
    const awardedPoints = computeCupMatchPoints(participants, scoresTuple);

    db.prepare(
      `INSERT INTO family_cup_matches (
         cup_id, match_index, match_id, final_scores_json, awarded_points_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      cupId,
      nextIndex,
      matchId,
      JSON.stringify(scoresTuple),
      JSON.stringify(awardedPoints),
      now,
    );

    const isCompleted = nextIndex >= row.total_matches;
    const nextStatus = isCompleted ? 'completed' : 'between_matches';
    db.prepare(
      `UPDATE family_cups
       SET status = ?, updated_at = ?, completed_at = ?
       WHERE cup_id = ?`,
    ).run(nextStatus, now, isCompleted ? now : null, cupId);
    if (isCompleted) appendFamilyFeed(db, { kind: 'family-cup', cupId, createdAt: now });

    const updatedRow = db
      .prepare('SELECT * FROM family_cups WHERE cup_id = ?')
      .get(cupId) as unknown as FamilyCupRow;
    return { cup: hydrateFamilyCup(db, updatedRow), duplicate: false };
  });
}

export function getFamilyCup(
  db: DatabaseSync,
  cupId: string,
): FamilyCupSummary | null {
  const row = db
    .prepare('SELECT * FROM family_cups WHERE cup_id = ?')
    .get(cupId) as unknown as FamilyCupRow | undefined;
  return row ? hydrateFamilyCup(db, row) : null;
}

export function listFamilyCups(
  db: DatabaseSync,
  limit = 10,
): FamilyCupSummary[] {
  const rows = db
    .prepare('SELECT * FROM family_cups ORDER BY updated_at DESC LIMIT ?')
    .all(Math.min(Math.max(1, limit), 50)) as unknown as FamilyCupRow[];
  return rows.map((row) => hydrateFamilyCup(db, row));
}



/**
 * One-time seeding when the leaderboard tables are first created: every member's
 * existing personal bests become `occurred_at = 0` entries (all-time board only),
 * so boards agree with personal-best displays from day one.
 */
function backfillLeaderboard(db: DatabaseSync): void {
  const rows = db.prepare('SELECT id, snapshot FROM members').all() as Array<{ id: string; snapshot: string }>;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO leaderboard_entries
       (member_id, round_id, game_id, difficulty, value, occurred_at)
     VALUES (?, ?, ?, ?, ?, 0)`,
  );
  transaction(db, () => {
    for (const row of rows) {
      let stats: Record<string, GameStats>;
      try {
        stats = (JSON.parse(row.snapshot) as MemberSnapshot).arcade?.stats ?? {};
      } catch {
        continue;
      }
      for (const [key, value] of Object.entries(stats)) {
        const [gameId, difficulty] = key.split(':');
        if (!gameId || !difficulty || gameId === 'mahjong-japanese') continue;
        const best = getBestValue(gameId, value);
        if (best !== null && Number.isSafeInteger(best) && best > 0)
          insert.run(row.id, `legacy:${key}`, gameId, difficulty, best);
      }
    }
  });
}

const FAMILY_FEED_LIMIT = 100;

export function appendFamilyFeed(
  db: DatabaseSync,
  item: {
    kind: 'family-record' | 'weekly-champion' | 'family-cup' | 'family-arcade';
    memberId?: string | null;
    gameId?: string | null;
    difficulty?: string | null;
    value?: number | null;
    weekId?: string | null;
    cupId?: string | null;
    createdAt?: number;
  },
): void {
  db.prepare(
    `INSERT INTO family_feed (kind, member_id, game_id, difficulty, value, week_id, cup_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.kind,
    item.memberId ?? null,
    item.gameId ?? null,
    item.difficulty ?? null,
    item.value ?? null,
    item.weekId ?? null,
    item.cupId ?? null,
    item.createdAt ?? Date.now(),
  );
  db.prepare(
    `DELETE FROM family_feed WHERE id NOT IN (
       SELECT id FROM family_feed ORDER BY id DESC LIMIT ?
     )`,
  ).run(FAMILY_FEED_LIMIT);
}
