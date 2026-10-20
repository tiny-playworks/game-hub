import type { DatabaseSync } from 'node:sqlite';

export function migrateGameRooms(db: DatabaseSync): void {
  // family_results is the common household reward ledger. Existing riichi writes
  // keep their default source and keep counting the same daily household cap.
  const columns = db.prepare('PRAGMA table_info(family_results)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'source')) {
    db.exec("ALTER TABLE family_results ADD COLUMN source TEXT NOT NULL DEFAULT 'family'");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS family_results_source
      ON family_results(member_id, match_id, source);
    CREATE TABLE IF NOT EXISTS game_rooms (
      room_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK(schema_version = 1),
      record_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_room_commands (
      room_id TEXT NOT NULL REFERENCES game_rooms(room_id),
      command_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      command_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(room_id, command_id)
    );
    CREATE TABLE IF NOT EXISTS family_arcade_matches (
      match_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source = 'family-arcade'),
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_arcade_results (
      member_id TEXT NOT NULL REFERENCES members(id),
      match_id TEXT NOT NULL REFERENCES family_arcade_matches(match_id),
      source TEXT NOT NULL CHECK(source = 'family-arcade'),
      game_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('win', 'lose', 'draw')),
      team INTEGER NOT NULL,
      PRIMARY KEY(member_id, match_id, source)
    );
    CREATE INDEX IF NOT EXISTS family_arcade_results_member
      ON family_arcade_results(member_id, game_id);
  `);
}
