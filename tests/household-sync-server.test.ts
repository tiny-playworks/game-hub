import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { afterEach, describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase, readSnapshot, type MemberRow } from '../server/src/db';
import { registerSyncRoutes } from '../server/src/routes/sync';
import { createEmptySnapshot } from '../server/src/snapshot';
import type {
  OfflineReceipt,
  ResumeSaveRecord,
  SyncBatchRequest,
  SyncBatchResponse,
} from '../shared/contracts/sync';
import { createMatch, toReplayFile } from '../src/pages/mahjong/japanese/engine/match';
import { simulateMatch } from './helpers/riichiSim';

afterEach(() => {
  delete process.env.GAME_HUB_DB_PATH;
});

function createTestServer() {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  const app = Fastify();
  const memberId = '00000000-0000-4000-8000-000000000001';
  const otherMemberId = '00000000-0000-4000-8000-000000000002';
  const deviceA = '00000000-0000-4000-8000-000000000011';
  const deviceB = '00000000-0000-4000-8000-000000000012';
  const tokenA = 'A'.repeat(43);
  const tokenB = 'B'.repeat(43);

  const snapshotA = createEmptySnapshot(memberId, 'Member Alpha');
  const snapshotB = createEmptySnapshot(otherMemberId, 'Member Beta');

  db.prepare(
    `INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
     VALUES (?, 'salt', 'hash', ?, 0, ?)`,
  ).run(memberId, JSON.stringify(snapshotA), snapshotA.updatedAt);

  db.prepare(
    `INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
     VALUES (?, 'salt', 'hash', ?, 0, ?)`,
  ).run(otherMemberId, JSON.stringify(snapshotB), snapshotB.updatedAt);

  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenA).digest('hex'),
    memberId,
    deviceA,
    Date.now() + 60_000,
  );

  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenB).digest('hex'),
    memberId,
    deviceB,
    Date.now() + 60_000,
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) reply.code(error.status).send(error.body);
    else reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });

  registerSyncRoutes(app, db);
  return { app, db, memberId, otherMemberId, deviceA, deviceB, tokenA, tokenB };
}

describe('P11 Offline Sync & Resume Saves Server Tests', () => {
  it('credits P16 only for a newly marked offline match and ignores old queued receipts', async () => {
    const { app, db, memberId, deviceA, tokenA } = createTestServer();
    const replay = toReplayFile(simulateMatch({ seed: 605, matchLength: 'east' }));
    const receipt = (eventId: string, matchId: string, eligible?: boolean): OfflineReceipt => ({
      schema: 1,
      eventId,
      memberId,
      deviceId: deviceA,
      matchId,
      matchSource: 'free',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'free',
        riichi: { replay, playerCharacterId: 'aoi', ...(eligible === undefined ? {} : { themeChallengeEligible: eligible }) },
      },
    });

    const old = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { baseRevision: 0, receipts: [receipt('old-event', 'old-match')] },
    });
    expect(old.statusCode).toBe(200);
    expect((old.json() as SyncBatchResponse).accepted).toHaveLength(1);
    expect((old.json() as SyncBatchResponse).snapshot.themeChallenges.progress['three-matches']).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS count FROM theme_challenge_matches').get() as { count: number }).count).toBe(0);

    const current = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { baseRevision: 1, receipts: [receipt('new-event', 'new-match', true)] },
    });
    expect(current.statusCode).toBe(200);
    expect((current.json() as SyncBatchResponse).accepted).toHaveLength(1);
    expect((current.json() as SyncBatchResponse).snapshot.themeChallenges.progress['three-matches']).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS count FROM theme_challenge_matches').get() as { count: number }).count).toBe(1);

    const retry = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { baseRevision: 2, receipts: [receipt('new-event', 'new-match', true)] },
    });
    expect((retry.json() as SyncBatchResponse).duplicates).toEqual(['new-event']);
    expect((retry.json() as SyncBatchResponse).snapshot.themeChallenges.progress['three-matches']).toBe(1);
  });

  it('accepts offline arcade receipt and awards coins correctly', async () => {
    const { app, db, memberId, deviceA, tokenA } = createTestServer();

    const receipt: OfflineReceipt = {
      schema: 1,
      eventId: 'evt-arcade-001',
      memberId,
      deviceId: deviceA,
      matchId: 'round-2048-001',
      matchSource: 'arcade',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'arcade',
        arcade: {
          gameId: '2048',
          difficulty: 'normal',
          score: 1024,
          outcome: 'win',
        },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: {
        baseRevision: 0,
        receipts: [receipt],
      } satisfies SyncBatchRequest,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SyncBatchResponse;
    expect(body.accepted).toHaveLength(1);
    expect(body.duplicates).toHaveLength(0);
    expect(body.rejected).toHaveLength(0);
    expect(body.accepted[0].eventId).toBe('evt-arcade-001');
    expect(body.accepted[0].coinsEarned).toBeGreaterThan(0);
    expect(body.snapshot.revision).toBe(1);

    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as unknown as MemberRow;
    const current = readSnapshot(row);
    expect(current.wallet.coins).toBe(body.snapshot.wallet.coins);
  });

  it('rejects ranked match receipt in offline sync', async () => {
    const { app, memberId, deviceA, tokenA } = createTestServer();
    const rankedMatch = createMatch({
      seed: 1234,
      matchLength: 'east',
      ranked: {
        id: 'ranked-ticket-1',
        seed: 1234,
        at: Date.now(),
        band: 'adept',
        level: 1,
        matchLength: 'east',
        characterId: 'aoi',
        affinityStart: 0,
        opponents: ['mio', 'rin', 'sora'],
        seatAiLevels: ['standard', 'standard', 'standard', 'standard'],
      },
    }).match;

    const receipt: OfflineReceipt = {
      schema: 1,
      eventId: 'evt-ranked-fraud',
      memberId,
      deviceId: deviceA,
      matchId: 'match-ranked-001',
      matchSource: 'free',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'free',
        riichi: {
          replay: toReplayFile(rankedMatch),
          playerCharacterId: 'aoi',
        },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: {
        baseRevision: 0,
        receipts: [receipt],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SyncBatchResponse;
    expect(body.accepted).toHaveLength(0);
    expect(body.rejected).toHaveLength(1);
    expect(body.rejected[0].code).toBe('RANKED_NOT_ALLOWED');
  });

  it('handles idempotent retries and duplicates without double awarding coins', async () => {
    const { app, memberId, deviceA, tokenA } = createTestServer();

    const receipt: OfflineReceipt = {
      schema: 1,
      eventId: 'evt-dup-001',
      memberId,
      deviceId: deviceA,
      matchId: 'round-snake-001',
      matchSource: 'arcade',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'arcade',
        arcade: {
          gameId: 'snake',
          difficulty: 'normal',
          score: 50,
          outcome: 'lose',
        },
      },
    };

    // 第一次提交
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { baseRevision: 0, receipts: [receipt] },
    });
    const body1 = res1.json() as SyncBatchResponse;
    expect(body1.accepted).toHaveLength(1);
    const coinsAfterFirst = body1.snapshot.wallet.coins;

    // 第二次提交相同凭据（模拟客户端未收到响应重试）
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { baseRevision: body1.snapshot.revision, receipts: [receipt] },
    });
    const body2 = res2.json() as SyncBatchResponse;
    expect(body2.accepted).toHaveLength(0);
    expect(body2.duplicates).toEqual(['evt-dup-001']);
    expect(body2.snapshot.wallet.coins).toBe(coinsAfterFirst);
  });

  it('manages multi-device resume saves without overwriting other devices', async () => {
    const { app, deviceA, deviceB, tokenA, tokenB } = createTestServer();

    const replayA = toReplayFile(createMatch({ seed: 101, matchLength: 'east' }).match);
    const replayB = toReplayFile(createMatch({ seed: 202, matchLength: 'south' }).match);

    // 设备 A 上传续局
    const putA = await app.inject({
      method: 'PUT',
      url: '/api/v1/saves/save-device-a',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: {
        replay: replayA,
        processedProgress: ['101:enter'],
        roundSummary: { round: 1, roundName: '东一局', scores: [25000, 25000, 25000, 25000] },
      },
    });
    expect(putA.statusCode).toBe(200);

    // 设备 B 上传续局
    const putB = await app.inject({
      method: 'PUT',
      url: '/api/v1/saves/save-device-b',
      headers: { cookie: `gh_session=${tokenB}` },
      payload: {
        replay: replayB,
        processedProgress: ['202:enter'],
        roundSummary: { round: 2, roundName: '南一局', scores: [28000, 24000, 25000, 23000] },
      },
    });
    expect(putB.statusCode).toBe(200);

    // 检查列表：两份对局各自保留
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saves',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as ResumeSaveRecord[];
    expect(list).toHaveLength(2);
    expect(list.some((s) => s.saveId === 'save-device-a' && s.deviceId === deviceA)).toBe(true);
    expect(list.some((s) => s.saveId === 'save-device-b' && s.deviceId === deviceB)).toBe(true);

    // 独立拉取详情
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saves/save-device-a',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().saveId).toBe('save-device-a');

    // 删除 A 的存档，B 存档完好无损
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/saves/save-device-a',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(delRes.statusCode).toBe(200);

    const listAfter = (await app.inject({
      method: 'GET',
      url: '/api/v1/saves',
      headers: { cookie: `gh_session=${tokenB}` },
    })).json();
    expect(listAfter).toHaveLength(1);
    expect(listAfter[0].saveId).toBe('save-device-b');
  });
});
