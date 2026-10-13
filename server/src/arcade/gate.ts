import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { openDatabase, readSnapshot, type MemberRow } from '../db';
import { registerArcadeRoutes } from '../routes/arcade';
import { createEmptySnapshot } from '../snapshot';

// Runs the actual HTTP settlement path in Node, without a browser DOM shim.
assert.equal(typeof window, 'undefined');
process.env.GAME_HUB_DB_PATH = ':memory:';
const db = openDatabase();
const app = Fastify();
const memberId = '00000000-0000-4000-8000-000000000001';
const roundId = 'arcade:00000000-0000-4000-8000-000000000003';
const token = 'A'.repeat(43);
const snapshot = createEmptySnapshot(memberId, 'Arcade Gate');
db.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
  VALUES (?, 'salt', 'hash', ?, 0, ?)`).run(memberId, JSON.stringify(snapshot), snapshot.updatedAt);
db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
  .run(createHash('sha256').update(token).digest('hex'), memberId,
    '00000000-0000-4000-8000-000000000002', Date.now() + 60_000);
registerArcadeRoutes(app, db);
const headers = { cookie: `gh_session=${token}` };

try {
  const start = await app.inject({
    method: 'POST', url: '/api/v1/me/arcade/events', headers,
    payload: { baseRevision: 0, event: { type: 'start', roundId,
      gameId: '2048', difficulty: 'normal' } },
  });
  assert.equal(start.statusCode, 200, start.body);
  assert.equal(start.json().snapshot.revision, 1);

  const finishEvent = { type: 'finish', roundId, gameId: '2048',
    difficulty: 'normal', score: 512, outcome: 'win', meta: { maxTile: 512 } };
  const finish = await app.inject({ method: 'POST',
    url: '/api/v1/me/arcade/events', headers,
    payload: { baseRevision: 1, event: finishEvent } });
  assert.equal(finish.statusCode, 200, finish.body);
  assert.equal(finish.json().result.coinsEarned, 40);
  assert.equal(finish.json().snapshot.wallet.coins, 40);
  assert.equal(finish.json().snapshot.arcade.stats['2048:normal'].wins, 1);

  const repeat = await app.inject({ method: 'POST',
    url: '/api/v1/me/arcade/events', headers,
    payload: { baseRevision: 1, event: finishEvent } });
  assert.equal(repeat.statusCode, 200, repeat.body);
  assert.equal(repeat.json().result.coinsEarned, 40);
  const saved = readSnapshot(db.prepare('SELECT * FROM members WHERE id = ?')
    .get(memberId) as unknown as MemberRow);
  assert.equal(saved.revision, 2);
  assert.equal(saved.wallet.coins, 40);
  console.log('Node arcade settlement gate passed');
} finally {
  await app.close();
  db.close();
}
