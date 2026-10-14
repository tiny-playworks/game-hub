import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type { MemberSnapshot } from '../../shared/contracts/member';

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
    CREATE TABLE IF NOT EXISTS resume_saves (
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      save_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source = 'free'),
      save_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(member_id, device_id, save_id)
    );
    CREATE TABLE IF NOT EXISTS active_rooms (
      room_id TEXT PRIMARY KEY,
      summary_json TEXT NOT NULL,
      match_json TEXT,
      server_deadline INTEGER,
      is_paused INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
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
  `);
}

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = run();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
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
  return snapshot;
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
  is_favorite: number;
  created_at: number;
}

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
        replay_json, is_favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM riichi_replays WHERE member_id = ? AND match_id = ?), 0), ?)
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
): { total: number; favoritesCount: number; items: ReplayRow[] } {
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
      `SELECT * FROM riichi_replays WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as ReplayRow[];

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

