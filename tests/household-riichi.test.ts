import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { afterEach, describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase, readSnapshot, type MemberRow } from '../server/src/db';
import {
  nextServerAiEvent,
  prepareRiichiRuntime,
} from '../server/src/riichi/runtime';
import { registerRiichiRoutes } from '../server/src/routes/riichi';
import { createEmptySnapshot } from '../server/src/snapshot';
import { setRiichiOnlineBridge } from '../src/lib/household/riichiBridge';
import { createStorageFromSnapshot } from '../src/lib/household/snapshotStorage';
import { setStorageDriver } from '../src/lib/storage';
import { getSeatTurnOptions } from '../src/pages/mahjong/japanese/engine';
import { useRiichiStore } from '../src/pages/mahjong/japanese/store/riichiMatchStore';

afterEach(() => {
  setRiichiOnlineBridge(null);
  setStorageDriver(null);
  useRiichiStore.getState().resetForIdentity();
  delete process.env.GAME_HUB_DB_PATH;
});

function createTestServer() {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  const app = Fastify();
  const memberId = '00000000-0000-4000-8000-000000000101';
  const deviceA = '00000000-0000-4000-8000-000000000201';
  const deviceB = '00000000-0000-4000-8000-000000000202';
  const tokenA = 'R'.repeat(43);
  const tokenB = 'S'.repeat(43);
  const snapshot = createEmptySnapshot(memberId, 'Riichi Member');
  snapshot.ranked.band = 'adept';
  snapshot.ranked.level = 1;
  snapshot.ranked.pt = 300;
  snapshot.ranked.peak = { band: 'adept', level: 1 };

  db.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
    VALUES (?, 'salt', 'hash', ?, 0, ?)`)
    .run(memberId, JSON.stringify(snapshot), snapshot.updatedAt);
  db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(createHash('sha256').update(tokenA).digest('hex'), memberId, deviceA, Date.now() + 60_000);
  db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(createHash('sha256').update(tokenB).digest('hex'), memberId, deviceB, Date.now() + 60_000);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) reply.code(error.status).send(error.body);
    else reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  registerRiichiRoutes(app, db);

  return {
    db,
    app,
    memberId,
    headersA: { cookie: `gh_session=${tokenA}` },
    headersB: { cookie: `gh_session=${tokenB}` },
  };
}

describe('P10 online member Riichi match & settlement', () => {
  it('runs a full server-authoritative free match, validates turns/devices/timeouts, and settles coins & affinity', async () => {
    await prepareRiichiRuntime();
    const { db, app, memberId, headersA, headersB } = createTestServer();
    const matchId = '00000000-0000-4000-8000-000000000301';

    try {
      // 1. 创建自由对局
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/matches',
        headers: headersA,
        payload: {
          matchId,
          source: 'free',
          matchLength: 'east',
          aiLevel: 'standard',
          opponents: ['koharu', 'rin', 'chitose'],
        },
      });
      expect(startRes.statusCode).toBe(200);
      const started = startRes.json();
      expect(started.matchId).toBe(matchId);
      expect(started.snapshot.revision).toBe(1);
      expect(started.snapshot.characters.encounteredCharacterIds).toEqual(
        expect.arrayContaining(['koharu', 'rin', 'chitose']),
      );

      // 2. 同设备重复 start 幂等返回，跨设备同 matchId 返回 409
      const repeatStart = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/matches',
        headers: headersA,
        payload: { matchId, source: 'free', matchLength: 'east' },
      });
      expect(repeatStart.statusCode).toBe(200);

      const conflictDeviceStart = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/matches',
        headers: headersB,
        payload: { matchId, source: 'free', matchLength: 'east' },
      });
      expect(conflictDeviceStart.statusCode).toBe(409);
      expect(conflictDeviceStart.json().code).toBe('MATCH_CONFLICT');

      // 3. 当前设备可恢复未完赛对局，其他设备不可见该设备自由局
      const currentA = await app.inject({
        method: 'GET',
        url: '/api/v1/me/riichi/current',
        headers: headersA,
      });
      expect(currentA.statusCode).toBe(200);
      expect(currentA.json().matchId).toBe(matchId);

      const currentB = await app.inject({
        method: 'GET',
        url: '/api/v1/me/riichi/current',
        headers: headersB,
      });
      expect(currentB.statusCode).toBe(200);
      expect(currentB.json().matchId).toBeNull();

      let match = started.match;

      // 4. 跨设备提交事件返回 403 DEVICE_NOT_OWNER
      const firstEv = nextServerAiEvent(match, true)!;
      const wrongDeviceEv = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/events',
        headers: headersB,
        payload: { matchId, expectedTurn: match.turn, event: firstEv },
      });
      expect(wrongDeviceEv.statusCode).toBe(403);
      expect(wrongDeviceEv.json().code).toBe('DEVICE_NOT_OWNER');

      // 5. 错误 expectedTurn 返回 409 MATCH_TURN_CONFLICT
      const wrongTurnEv = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/events',
        headers: headersA,
        payload: { matchId, expectedTurn: match.turn + 5, event: firstEv },
      });
      expect(wrongTurnEv.statusCode).toBe(409);
      expect(wrongTurnEv.json().code).toBe('MATCH_TURN_CONFLICT');

      // 6. 推进到第一个 seat 0 出牌回合，验证超时强制摸切保护
      for (let guard = 0; guard < 30; guard++) {
        if (match.round.currentPlayer === 0 && match.round.phase === 'discard') break;
        const ev = nextServerAiEvent(match, true)!;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/me/riichi/events',
          headers: headersA,
          payload: { matchId, expectedTurn: match.turn, event: ev },
        });
        expect(res.statusCode).toBe(200);
        match = res.json().match;
      }

      if (match.round.currentPlayer === 0 && match.round.phase === 'discard') {
        const options = getSeatTurnOptions(match.round, 0)!;
        const drawn = match.round.drawnTile;
        const forcedTile =
          drawn !== null && options.discardable.includes(drawn)
            ? drawn
            : options.discardable[options.discardable.length - 1];
        const nonForcedTile = options.discardable.find((t) => t !== forcedTile);

        // 将 updated_at 拨回 60 秒前模拟超时
        db.prepare('UPDATE riichi_matches SET updated_at = ? WHERE match_id = ?')
          .run(Date.now() - 60_000, matchId);

        if (nonForcedTile !== undefined) {
          const timeoutReject = await app.inject({
            method: 'POST',
            url: '/api/v1/me/riichi/events',
            headers: headersA,
            payload: {
              matchId,
              expectedTurn: match.turn,
              event: { type: 'discard', seat: 0, tile: nonForcedTile },
            },
          });
          expect(timeoutReject.statusCode).toBe(409);
          expect(timeoutReject.json().code).toBe('MATCH_TIMEOUT');
        }

        const timeoutAccept = await app.inject({
          method: 'POST',
          url: '/api/v1/me/riichi/events',
          headers: headersA,
          payload: {
            matchId,
            expectedTurn: match.turn,
            event: { type: 'discard', seat: 0, tile: forcedTile },
          },
        });
        expect(timeoutAccept.statusCode).toBe(200);
        const acceptedTurn = match.turn;
        match = timeoutAccept.json().match;
        expect(match.events[acceptedTurn].timeout).toBe(true);

        // 重复发送同一历史事件幂等返回 200
        const idempotentRes = await app.inject({
          method: 'POST',
          url: '/api/v1/me/riichi/events',
          headers: headersA,
          payload: {
            matchId,
            expectedTurn: acceptedTurn,
            event: { type: 'discard', seat: 0, tile: forcedTile },
          },
        });
        expect(idempotentRes.statusCode).toBe(200);
      }

      // 7. 篡改 AI 座位动作被服务端拒绝（400 INVALID_MATCH_EVENT）
      for (let guard = 0; guard < 30; guard++) {
        const aiEv = nextServerAiEvent(match, false);
        if (aiEv && aiEv.type === 'discard') {
          const forgedEv = { ...aiEv, tile: (aiEv.tile + 1) % 34 };
          const forgedRes = await app.inject({
            method: 'POST',
            url: '/api/v1/me/riichi/events',
            headers: headersA,
            payload: { matchId, expectedTurn: match.turn, event: forgedEv },
          });
          if (forgedEv.tile !== aiEv.tile) {
            expect(forgedRes.statusCode).toBe(400);
            expect(forgedRes.json().code).toBe('INVALID_MATCH_EVENT');
          }
          break;
        }
        const ev = nextServerAiEvent(match, true)!;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/me/riichi/events',
          headers: headersA,
          payload: { matchId, expectedTurn: match.turn, event: ev },
        });
        expect(res.statusCode).toBe(200);
        match = res.json().match;
      }

      // 8. 连续推进整场自由对局至 matchEnd，验证服务端权威结算雀币与好感
      for (let step = 0; step < 3000 && match.status !== 'matchEnd'; step++) {
        const ev =
          match.status === 'roundEnd'
            ? ({ type: 'nextRound' } as const)
            : nextServerAiEvent(match, true);
        if (!ev) break;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/me/riichi/events',
          headers: headersA,
          payload: { matchId, expectedTurn: match.turn, event: ev },
        });
        expect(res.statusCode).toBe(200);
        match = res.json().match;
      }

      expect(match.status).toBe('matchEnd');
      const finalSnapshot = readSnapshot(
        db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as unknown as MemberRow,
      );
      expect(finalSnapshot.wallet.rewardedMatchIds).toContain(matchId);
      expect(finalSnapshot.wallet.coins).toBeGreaterThan(0);
      expect(finalSnapshot.characters.rewardedMatchIds).toContain(matchId);
      expect(finalSnapshot.characters.affinityByCharacter.mio).toBeGreaterThanOrEqual(2);

      // 完赛后 current 不再返回进行中对局
      const afterFinishCurrent = await app.inject({
        method: 'GET',
        url: '/api/v1/me/riichi/current',
        headers: headersA,
      });
      expect(afterFinishCurrent.json().match).toBeNull();
    } finally {
      await app.close();
      db.close();
    }
  }, 30_000);

  it('enforces single active ranked match, supports ranked forfeit, and settles completed ranked matches via store bridge', async () => {
    await prepareRiichiRuntime();
    const { db, app, memberId, headersA } = createTestServer();
    const rankedId1 = '00000000-0000-4000-8000-000000000401';
    const rankedId2 = '00000000-0000-4000-8000-000000000402';

    try {
      // 挂载前端存储驱动与在线日麻桥接
      const initialRow = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as unknown as MemberRow;
      setStorageDriver(createStorageFromSnapshot(readSnapshot(initialRow)));

      setRiichiOnlineBridge({
        start: async (input) => {
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/me/riichi/matches',
            headers: headersA,
            payload: input,
          });
          if (res.statusCode !== 200) throw new Error(res.body);
          const data = res.json();
          setStorageDriver(createStorageFromSnapshot(data.snapshot));
          return data;
        },
        event: async (input) => {
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/me/riichi/events',
            headers: headersA,
            payload: input,
          });
          if (res.statusCode !== 200) throw new Error(res.body);
          const data = res.json();
          setStorageDriver(createStorageFromSnapshot(data.snapshot));
          return data;
        },
        current: async () => {
          const res = await app.inject({
            method: 'GET',
            url: '/api/v1/me/riichi/current',
            headers: headersA,
          });
          return res.json();
        },
        forfeit: async (matchId) => {
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/me/riichi/forfeit',
            headers: headersA,
            payload: { matchId },
          });
          if (res.statusCode !== 200) throw new Error(res.body);
          const data = res.json();
          setStorageDriver(createStorageFromSnapshot(data.snapshot));
          return data;
        },
      });

      // 1. 通过前端 useRiichiStore 启动段位赛 1
      await useRiichiStore.getState().startMatch({
        ranked: {
          id: rankedId1,
          seed: 1,
          at: Date.now(),
          band: 'adept',
          level: 1,
          matchLength: 'east',
          characterId: 'mio',
          affinityStart: 0,
          opponents: ['koharu', 'rin', 'chitose'],
          seatAiLevels: ['standard', 'standard', 'standard', 'standard'],
        },
      });
      expect(useRiichiStore.getState().sessionId).toBe(rankedId1);

      // 2. 未结束前服务端拒绝新建第二场对局（409 RANKED_MATCH_ACTIVE）
      const duplicateRanked = await app.inject({
        method: 'POST',
        url: '/api/v1/me/riichi/matches',
        headers: headersA,
        payload: { matchId: rankedId2, source: 'ai-ranked', matchLength: 'east' },
      });
      expect(duplicateRanked.statusCode).toBe(409);
      expect(duplicateRanked.json().code).toBe('RANKED_MATCH_ACTIVE');

      // 3. 调用 abandonRanked 弃赛结算
      expect(await useRiichiStore.getState().abandonRanked()).toBe(true);
      const afterForfeit = readSnapshot(
        db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as unknown as MemberRow,
      );
      expect(afterForfeit.ranked.activeMatchId).toBeNull();
      expect(afterForfeit.ranked.history).toHaveLength(1);
      expect(afterForfeit.ranked.history[0]).toMatchObject({
        id: rankedId1,
        forfeit: true,
        placement: 4,
      });

      // 4. 启动段位赛 2 并通过 store.dispatch 跑完整个东风段位局
      await useRiichiStore.getState().startMatch({
        ranked: {
          id: rankedId2,
          seed: 2,
          at: Date.now(),
          band: 'adept',
          level: 1,
          matchLength: 'east',
          characterId: 'mio',
          affinityStart: 0,
          opponents: ['koharu', 'rin', 'chitose'],
          seatAiLevels: ['standard', 'standard', 'standard', 'standard'],
        },
      });

      // 验证中断后可从服务端 resumeSaved 恢复
      useRiichiStore.setState({ match: null, view: 'rules' });
      expect(await useRiichiStore.getState().resumeSaved()).toBe(true);
      expect(useRiichiStore.getState().sessionId).toBe(rankedId2);

      for (
        let step = 0;
        step < 3000 && useRiichiStore.getState().match?.status !== 'matchEnd';
        step++
      ) {
        const current = useRiichiStore.getState().match!;
        useRiichiStore.getState().clearCutIns();
        const ev =
          current.status === 'roundEnd'
            ? ({ type: 'nextRound' } as const)
            : nextServerAiEvent(current, true);
        if (!ev) break;
        expect(await useRiichiStore.getState().dispatch(ev)).toBe(true);
      }

      expect(useRiichiStore.getState().match?.status).toBe('matchEnd');
      const afterComplete = readSnapshot(
        db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as unknown as MemberRow,
      );
      expect(afterComplete.ranked.activeMatchId).toBeNull();
      expect(afterComplete.ranked.history).toHaveLength(2);
      expect(afterComplete.ranked.history.at(-1)).toMatchObject({
        id: rankedId2,
        forfeit: false,
      });
    } finally {
      await app.close();
      db.close();
    }
  }, 30_000);
});
