import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { afterEach, beforeAll, describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase, readSnapshot, type MemberRow } from '../server/src/db';
import { RoomManager, type RoomInstance } from '../server/src/rooms/RoomManager';
import { registerRoomRoutes } from '../server/src/routes/rooms';
import { recordRoomCommand } from '../server/src/rooms/recovery';
import { createEmptySnapshot } from '../server/src/snapshot';
import { preloadRiichiRules } from '../src/lib/riichiRules';
import type { RoomCommand } from '../shared/contracts/room';
import { applyEvent, getPendingSeats, type RiichiEffect } from '../src/pages/mahjong/japanese/engine';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

interface TestRoomManagerHooks {
  settleMatchEnd: (room: RoomInstance) => void;
  recordPresentation: (room: RoomInstance, effects: RiichiEffect[]) => void;
}

afterEach(() => {
  delete process.env.GAME_HUB_DB_PATH;
});

beforeAll(async () => {
  await preloadRiichiRules();
});

function createTestContext() {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  const roomManager = new RoomManager(db);
  const app = Fastify();

  const memberA = '00000000-0000-4000-8000-000000000001';
  const memberB = '00000000-0000-4000-8000-000000000002';
  const deviceA = '00000000-0000-4000-8000-000000000011';
  const deviceB = '00000000-0000-4000-8000-000000000012';
  const tokenA = 'A'.repeat(43);
  const tokenB = 'B'.repeat(43);

  const snapshotA = createEmptySnapshot(memberA, 'Player Alpha');
  const snapshotB = createEmptySnapshot(memberB, 'Player Beta');

  db.prepare(
    `INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
     VALUES (?, 'salt', 'hash', ?, 0, ?)`,
  ).run(memberA, JSON.stringify(snapshotA), snapshotA.updatedAt);

  db.prepare(
    `INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
     VALUES (?, 'salt', 'hash', ?, 0, ?)`,
  ).run(memberB, JSON.stringify(snapshotB), snapshotB.updatedAt);

  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenA).digest('hex'),
    memberA,
    deviceA,
    Date.now() + 60_000,
  );

  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenB).digest('hex'),
    memberB,
    deviceB,
    Date.now() + 60_000,
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.code(error.status).send(error.body);
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    reply.code(500).send({ message });
  });

  registerRoomRoutes(app, db, roomManager);

  return {
    app,
    db,
    roomManager,
    memberA,
    memberB,
    deviceA,
    deviceB,
    cookieA: `gh_session=${tokenA}`,
    cookieB: `gh_session=${tokenB}`,
  };
}

describe('P12 家庭真人牌桌服务端测试', () => {
  it('未入座成员观战时只收到公开牌面', async () => {
    const { app, cookieA, cookieB } = createTestContext();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
      payload: { nickname: 'Host' },
    });
    const roomId = createRes.json().id;
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA },
    });
    expect(startRes.statusCode).toBe(200);

    const participant = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/view`,
      headers: { cookie: cookieA },
    });
    const spectator = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/view`,
      headers: { cookie: cookieB },
    });
    expect(participant.json().seats[0].hand.length).toBeGreaterThanOrEqual(13);
    expect(spectator.statusCode).toBe(200);
    expect(spectator.json().isSpectator).toBe(true);
    for (const seat of spectator.json().seats) {
      expect(seat.hand).toEqual([]);
      expect(seat.turnOptions).toBeNull();
      expect(seat.claimOptions).toBeNull();
      expect(seat.hasControlLease).toBe(false);
      expect(seat.tileCount).toBeGreaterThanOrEqual(13);
    }
  });

  it('支持创建房间、查看房间列表与详情', async () => {
    const { app, cookieA, memberA } = createTestContext();

    // 1. 创建房间
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
      payload: {
        nickname: 'Player Alpha',
        avatarPresetId: 'avatar-1',
        settings: { matchLength: 'east', turnTimeLimitSeconds: 15 },
      },
    });

    expect(createRes.statusCode).toBe(200);
    const room = createRes.json();
    expect(room.id).toBeTruthy();
    expect(room.hostMemberId).toBe(memberA);
    expect(room.status).toBe('waiting');
    expect(room.seats[0].type).toBe('human');
    expect(room.seats[0].nickname).toBe('Player Alpha');
    expect(room.seats[0].isReady).toBe(true);
    expect(room.seats[1].type).toBe('empty');

    // 2. 列表查询
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(1);
    expect(listRes.json()[0].id).toBe(room.id);
  });

  it('支持其他真人入座、离席与填充/移除 AI 席位', async () => {
    const { app, cookieA, cookieB, memberB } = createTestContext();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
      payload: { nickname: 'Host' },
    });
    const roomId = createRes.json().id;

    // 1. 第二个真人加入 1 号席位
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB },
      payload: { seatIndex: 1, nickname: 'Player Beta', avatarPresetId: 'avatar-2' },
    });
    expect(joinRes.statusCode).toBe(200);
    const joinedRoom = joinRes.json();
    expect(joinedRoom.seats[1].type).toBe('human');
    expect(joinedRoom.seats[1].memberId).toBe(memberB);
    expect(joinedRoom.humanCount).toBe(2);

    // 2. 在 2 号席位填充 AI
    const aiRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ai`,
      headers: { cookie: cookieA },
      payload: { seatIndex: 2, characterId: 'mio', aiLevel: 'standard' },
    });
    expect(aiRes.statusCode).toBe(200);
    expect(aiRes.json().seats[2].type).toBe('ai');
    expect(aiRes.json().seats[2].characterId).toBe('mio');

    // 3. 移除 2 号席位 AI
    const removeAiRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/rooms/${roomId}/ai/2`,
      headers: { cookie: cookieA },
    });
    expect(removeAiRes.statusCode).toBe(200);
    expect(removeAiRes.json().seats[2].type).toBe('empty');

    // 4. 第二个真人离席
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/leave`,
      headers: { cookie: cookieB },
    });
    expect(leaveRes.statusCode).toBe(200);
    expect(leaveRes.json().seats[1].type).toBe('empty');
    expect(leaveRes.json().humanCount).toBe(1);
  });

  it('就绪状态控制、自动 AI 补齐开局与私有视角隐私隔离', async () => {
    const { app, cookieA, cookieB } = createTestContext();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
      payload: { nickname: 'Host' },
    });
    const roomId = createRes.json().id;

    // B 玩家加入席位 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB },
      payload: { seatIndex: 1, nickname: 'Player Beta' },
    });

    // 未准备时点击开局 -> 失败
    const earlyStart = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA },
    });
    expect(earlyStart.statusCode).toBe(400);

    // A 与 B 双方准备
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB },
      payload: { isReady: true },
    });

    // 成功开局：空席位 2 与 3 自动填充 AI，状态变为 playing
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA },
    });
    expect(startRes.statusCode).toBe(200);
    const playingRoom = startRes.json();
    expect(playingRoom.status).toBe('playing');
    expect(playingRoom.currentMatchId).toBeTruthy();
    expect(playingRoom.seats[2].type).toBe('ai');
    expect(playingRoom.seats[3].type).toBe('ai');

    // 关键隐私验证：A 视角看对局
    const viewARes = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/view`,
      headers: { cookie: cookieA },
    });
    expect(viewARes.statusCode).toBe(200);
    const viewA = viewARes.json();
    expect(viewA.viewerSeat).toBe(0);

    // A 的 0 号座位必须有手牌 (13 或 14 张)
    expect(viewA.seats[0].hand.length).toBeGreaterThanOrEqual(13);
    // B 的 1 号座位手牌对 A 必须完全遮蔽为空数组 []，但 tileCount 正确展示
    expect(viewA.seats[1].hand).toEqual([]);
    expect(viewA.seats[1].tileCount).toBeGreaterThanOrEqual(13);
    // AI 2、3 号座位手牌对 A 也必须为空数组
    expect(viewA.seats[2].hand).toEqual([]);
    expect(viewA.seats[3].hand).toEqual([]);
    // 牌山内容禁止暴露，只允许展示剩余牌数
    expect(viewA.round.wallRemaining).toBeGreaterThan(0);
    expect('wall' in viewA.round).toBe(false);

    // 关键隐私验证：B 视角看对局
    const viewBRes = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/view`,
      headers: { cookie: cookieB },
    });
    expect(viewBRes.statusCode).toBe(200);
    const viewB = viewBRes.json();
    expect(viewB.viewerSeat).toBe(1);
    // B 视角下，0 号座位 (A) 手牌为空数组
    expect(viewB.seats[0].hand).toEqual([]);
    expect(viewB.seats[0].tileCount).toBeGreaterThanOrEqual(13);
    // B 视角下，1 号座位 (自家) 手牌完整可见
    expect(viewB.seats[1].hand.length).toBeGreaterThanOrEqual(13);
    // Dealer seat 0 is deciding: seat 1 must not receive seat 0's legal tile ids.
    expect(viewA.seats[0].turnOptions?.seat).toBe(0);
    expect(viewB.seats[1].turnOptions).toBeNull();
  });

  it('支持指令幂等防重与合法出牌流转', async () => {
    const { app, cookieA, cookieB } = createTestContext();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA },
      payload: { nickname: 'Host' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB },
      payload: { seatIndex: 1, nickname: 'Player Beta' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA },
    });

    // 庄家为 0 号位 (Host)
    const viewARes = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/view`,
      headers: { cookie: cookieA },
    });
    const viewA = viewARes.json();

    // 庄家摸牌后，可打出第一张手牌
    const discardable = viewA.seats[0].turnOptions?.discardable;
    expect(discardable).toBeTruthy();
    expect(discardable.length).toBeGreaterThan(0);

    const tileToDiscard = discardable[0];
    const command: RoomCommand = {
      protocol: 1,
      commandId: 'cmd-test-1',
      roomId,
      expectedRevision: viewA.revision,
      type: 'discard',
      payload: { tile: tileToDiscard },
    };

    // A 打出牌
    const cmdRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA },
      payload: command,
    });
    expect(cmdRes.statusCode).toBe(200);
    expect(cmdRes.json().accepted).toBe(true);

    // 幂等测试：重复提交相同 commandId
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA },
      payload: command,
    });
    expect(dupRes.statusCode).toBe(200);
    expect(dupRes.json().accepted).toBe(true);
  });

  it('多家荣和按赢家顺序发布两个公开演出事件，省略重复宣告和暗牌', () => {
    const { roomManager, memberA, deviceA } = createTestContext();
    const room = roomManager.createRoom(memberA, 'Host', 'avatar-1', deviceA);
    roomManager.startGame(room.id, memberA);
    const instance = roomManager.getRoomInstance(room.id)!;
    const round = createTestRound();
    round.hands[0] = tiles('147m147p147s12345z');
    round.hands[1] = tiles('123456m123p789s5z');
    round.hands[2] = tiles('123456m123p789s5z');
    round.riichiDeclared[1] = true;
    round.riichiDeclared[2] = true;
    let step = applyEvent(matchWithRound(round), { type: 'discard', seat: 0, tile: tile('5z') });
    if (!step) throw new Error('Invalid multi-ron fixture');
    const effects = [...step.effects];
    while (step.match.round.phase === 'claim') {
      const [seat] = getPendingSeats(step.match.round);
      const next = applyEvent(step.match, { type: 'claim', seat,
        response: { type: seat === 1 || seat === 2 ? 'ron' : 'pass' } });
      if (!next) throw new Error('Invalid multi-ron claim');
      effects.push(...next.effects);
      step = next;
    }
    instance.match = step.match;
    instance.presentation = { epoch: 'multi-ron', cursor: 0, events: [] };
    (roomManager as unknown as TestRoomManagerHooks).recordPresentation(instance, effects);
    const stream = roomManager.getPlayerView(room.id, 0, deviceA)!.presentation!;
    expect(stream.events.filter((event) => event.sound === 'ron')).toEqual([
      { id: 'multi-ron:2', sequence: 2, sound: 'ron', seat: 1 },
      { id: 'multi-ron:3', sequence: 3, sound: 'ron', seat: 2 },
    ]);
    expect(stream.cursor).toBe(3);
    expect(stream.events.every((event) => Object.keys(event).sort().join(',') === 'id,seat,sequence,sound')).toBe(true);
    if (instance.turnTimeoutTimer) clearTimeout(instance.turnTimeoutTimer);
  });

  it('2 名真人对局终局结算时正确发放家庭金库雀币', async () => {
    const { roomManager, memberA, memberB, deviceA, deviceB, db } = createTestContext();

    const room = roomManager.createRoom(memberA, 'Host', 'avatar-1', deviceA);
    roomManager.joinSeat(room.id, 1, memberB, 'Guest', 'avatar-2', deviceB);
    roomManager.setReady(room.id, memberA, true);
    roomManager.setReady(room.id, memberB, true);
    roomManager.startGame(room.id, memberA);

    const instance = roomManager.getRoomInstance(room.id)!;
    expect(instance).toBeTruthy();

    // 模拟终局状态
    instance.match!.status = 'matchEnd';
    instance.match!.matchEnd = {
      reason: 'east4_end',
      ranking: [0, 1, 2, 3], // A 第一，B 第二
      finalScores: [35000, 25000, 20000, 20000],
    };

    // 触发结算
    for (const [memberId, deviceId] of [[memberA, deviceA], [memberB, deviceB]]) {
      recordRoomCommand(db, room.id, { protocol: 1, roomId: room.id, matchId: instance.summary.currentMatchId, commandId: `played-${memberId}`,
        expectedRevision: 1, type: 'discard', payload: { tile: 0 } }, memberId, deviceId);
    }
    (roomManager as unknown as TestRoomManagerHooks).settleMatchEnd(instance);

    // 验证家庭成员档案：A 和 B 的钱包均得到结算发放
    const rowA = db.prepare('SELECT * FROM members WHERE id = ?').get(memberA) as unknown as MemberRow;
    const snapA = readSnapshot(rowA);
    expect(snapA.wallet.coins).toBeGreaterThan(0);

    const rowB = db.prepare('SELECT * FROM members WHERE id = ?').get(memberB) as unknown as MemberRow;
    const snapB = readSnapshot(rowB);
    expect(snapB.wallet.coins).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM active_rooms WHERE room_id = ?').get(room.id)).toEqual({ count: 0 });
    (roomManager as unknown as TestRoomManagerHooks).settleMatchEnd(instance);
    const retry = readSnapshot(db.prepare('SELECT * FROM members WHERE id = ?').get(memberA) as unknown as MemberRow);
    expect(retry.wallet.coins).toBe(snapA.wallet.coins);
    expect(retry.ranked).toEqual(snapA.ranked);
  });
});
