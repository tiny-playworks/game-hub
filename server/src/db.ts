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
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS riichi_matches_active
      ON riichi_matches(member_id, device_id, finished_at, updated_at);
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
