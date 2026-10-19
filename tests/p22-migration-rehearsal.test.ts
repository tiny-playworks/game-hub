import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'rstack/test';
import { openDatabase } from '../server/src/db';
import { createEmptySnapshot } from '../server/src/snapshot';

const ID = '00000000-0000-4000-8000-0000000000e1';
const digest = (db: DatabaseSync) => {
  const row = db.prepare('SELECT snapshot, revision FROM members WHERE id = ?').get(ID) as
    { snapshot: string; revision: number };
  return `${row.revision}:${createHash('sha256').update(row.snapshot).digest('hex')}`;
};

describe('P22 pre-release migration rehearsal (local, non-NAS)', () => {
  it('upgrades a pre-P19/P20/P23 database without touching member snapshots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p22-'));
    process.env.GAME_HUB_DB_PATH = join(dir, 'household.sqlite');
    try {
      // Create current schema, then roll it back to the pre-round-3/4 shape.
      const seed = openDatabase();
      const snapshot = createEmptySnapshot(ID, 'Legacy');
      snapshot.arcade.stats['snake:normal'] = {
        highScore: 777, playCount: 3, maxCombo: 0, minValue: null, wins: 0, streak: 0,
        bestStreak: 0, drawStreak: 0, landlordStreak: 0, maxTile: 0, maxLines: 0,
      };
      seed.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES (?, 's', 'h', ?, 7, ?)`).run(ID, JSON.stringify(snapshot), snapshot.updatedAt);
      seed.exec(`
        DROP TABLE journey_attempts;
        CREATE TABLE journey_attempts (
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          attempt_id TEXT NOT NULL,
          stage_id TEXT NOT NULL CHECK(stage_id IN ('aoi-balance', 'rin-tempo', 'mio-defense')),
          content_version INTEGER NOT NULL CHECK(content_version = 1),
          payload_hash TEXT NOT NULL,
          evaluation_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY(member_id, attempt_id)
        );
        INSERT INTO journey_attempts VALUES ('${ID}', 'a1', 'aoi-balance', 1, 'h', '{}', 1);
        DROP TABLE family_cup_matches;
        DROP TABLE family_cups;
        DROP TABLE leaderboard_entries;
        DROP TABLE leaderboard_week_settlements;
        DROP TABLE weekly_champions;
        DROP TABLE family_feed;
      `);
      const before = digest(seed);
      seed.close();

      const migrated = openDatabase();
      expect(digest(migrated)).toBe(before);
      const tables = (migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as
        Array<{ name: string }>).map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining([
        'family_cups', 'family_cup_matches', 'leaderboard_entries',
        'leaderboard_week_settlements', 'weekly_champions', 'family_feed',
      ]));
      // Old journey attempt survives and the new stages are writable.
      expect(migrated.prepare('SELECT count(*) AS n FROM journey_attempts').get()).toEqual({ n: 1 });
      migrated.prepare(`INSERT INTO journey_attempts VALUES (?, 'a2', 'yoru-reading', 1, 'h', '{}', 2)`).run(ID);
      // P23 seeds the existing personal best for the all-time board.
      expect(migrated.prepare('SELECT value FROM leaderboard_entries WHERE member_id = ?').get(ID))
        .toEqual({ value: 777 });
      expect(migrated.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      migrated.close();

      // Idempotent: reopening changes nothing.
      const again = openDatabase();
      expect(digest(again)).toBe(before);
      expect(again.prepare('SELECT count(*) AS n FROM leaderboard_entries').get()).toEqual({ n: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
