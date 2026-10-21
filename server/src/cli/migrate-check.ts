import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Rehearses the DB migration on a COPY of a household database (never the original):
 * records every member's snapshot hash/revision, opens the copy with the current
 * server code (running all migrations), and verifies nothing changed except new tables.
 * Usage: migrate-check <path-to-household.sqlite>
 */
function memberDigest(path: string): Map<string, string> {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db
      .prepare('SELECT id, snapshot, revision FROM members ORDER BY id')
      .all() as Array<{ id: string; snapshot: string; revision: number }>;
    return new Map(
      rows.map((row) => [
        row.id,
        `${row.revision}:${createHash('sha256').update(row.snapshot).digest('hex')}`,
      ]),
    );
  } finally {
    db.close();
  }
}

const source = process.argv[2] ? resolve(process.argv[2]) : '';
if (!source || !existsSync(source)) {
  console.error(
    '用法：migrate-check <household.sqlite 路径>（只会在临时副本上演练）',
  );
  process.exit(2);
}
const dir = mkdtempSync(join(tmpdir(), 'game-hub-migrate-'));
const copy = join(dir, 'household.sqlite');
let ok = false;
try {
  // SQLite takes a consistent snapshot including committed WAL pages. Copying
  // the three files separately can mix generations while the live service writes.
  const original = new DatabaseSync(source, { readOnly: true, timeout: 5000 });
  try {
    original.prepare('VACUUM INTO ?').run(copy);
  } finally {
    original.close();
  }
  process.env.GAME_HUB_DB_PATH = copy;
  const { openDatabase } = await import('../db');
  const before = memberDigest(copy);
  const db = openDatabase();
  const integrity = (
    db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
  ).integrity_check;
  const foreign = db.prepare('PRAGMA foreign_key_check').all().length;
  db.close();
  // Second open must be a no-op (idempotent migrations).
  openDatabase().close();
  const after = memberDigest(copy);
  const changed = [...before]
    .filter(([id, digest]) => after.get(id) !== digest)
    .map(([id]) => id);
  console.log(
    `成员 ${before.size} 名；integrity_check=${integrity}；foreign_key_check 异常=${foreign}`,
  );
  for (const [id, digest] of after)
    console.log(`  ${id}  ${digest.slice(0, 20)}…`);
  if (
    integrity !== 'ok' ||
    foreign > 0 ||
    changed.length > 0 ||
    before.size !== after.size
  ) {
    console.error(
      `迁移演练失败；快照变化的成员：${changed.join(', ') || '无'}`,
    );
  } else {
    console.log('迁移演练通过：成员快照与 revision 未变化');
    ok = true;
  }
} catch (error) {
  console.error(
    '迁移演练失败：',
    error instanceof Error ? error.message : error,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
