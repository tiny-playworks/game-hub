import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase, readSnapshot, type MemberRow } from '../server/src/db';
import { registerArcadeRoutes } from '../server/src/routes/arcade';
import { createEmptySnapshot } from '../server/src/snapshot';

describe('P10 online arcade settlement', () => {
  it('settles on the server and returns the same result for a repeated finish', async () => {
    process.env.GAME_HUB_DB_PATH = ':memory:';
    const db = openDatabase();
    const app = Fastify();
    const memberId = '00000000-0000-4000-8000-000000000001';
    const token = 'A'.repeat(43);
    const snapshot = createEmptySnapshot(memberId, 'Arcade Test');
    db.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
      VALUES (?, 'salt', 'hash', ?, 0, ?)`).run(memberId, JSON.stringify(snapshot), snapshot.updatedAt);
    db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(createHash('sha256').update(token).digest('hex'), memberId,
        '00000000-0000-4000-8000-000000000002', Date.now() + 60_000);
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof ApiError) reply.code(error.status).send(error.body);
      else reply.code(500).send({ code: 'INTERNAL_ERROR' });
    });
    registerArcadeRoutes(app, db);
    const roundId = 'arcade:00000000-0000-4000-8000-000000000003';
    const headers = { cookie: `gh_session=${token}` };
    try {
      const start = await app.inject({
        method: 'POST', url: '/api/v1/me/arcade/events', headers,
        payload: { baseRevision: 0, event: { type: 'start', roundId,
          gameId: '2048', difficulty: 'normal' } },
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().snapshot.revision).toBe(1);

      const finish = await app.inject({
        method: 'POST', url: '/api/v1/me/arcade/events', headers,
        payload: { baseRevision: 1, event: { type: 'finish', roundId,
          gameId: '2048', difficulty: 'normal', score: 512,
          outcome: 'win', meta: { maxTile: 512 } } },
      });
      expect(finish.statusCode).toBe(200);
      expect(finish.json().result.coinsEarned).toBe(40);
      expect(finish.json().snapshot.wallet.coins).toBe(40);
      expect(finish.json().snapshot.arcade.stats['2048:normal'].wins).toBe(1);

      const repeat = await app.inject({
        method: 'POST', url: '/api/v1/me/arcade/events', headers,
        payload: { baseRevision: 1, event: { type: 'finish', roundId,
          gameId: '2048', difficulty: 'normal', score: 512,
          outcome: 'win', meta: { maxTile: 512 } } },
      });
      expect(repeat.statusCode).toBe(200);
      expect(repeat.json().result.coinsEarned).toBe(40);
      const saved = readSnapshot(db.prepare('SELECT * FROM members WHERE id = ?')
        .get(memberId) as unknown as MemberRow);
      expect(saved.revision).toBe(2);
      expect(saved.wallet.coins).toBe(40);
    } finally {
      await app.close();
      db.close();
      delete process.env.GAME_HUB_DB_PATH;
    }
  });
});
