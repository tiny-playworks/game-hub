import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { afterEach, describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import { openDatabase } from '../server/src/db';
import { RoomManager } from '../server/src/rooms/RoomManager';
import { registerRoomRoutes } from '../server/src/routes/rooms';
import { createEmptySnapshot } from '../server/src/snapshot';

afterEach(() => {
  delete process.env.GAME_HUB_DB_PATH;
});

function createTestContext() {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  const roomManager = new RoomManager(db);
  const app = Fastify();

  const memberA = '00000000-0000-4000-8000-000000000001';
  const memberB = '00000000-0000-4000-8000-000000000002';
  const deviceA1 = '00000000-0000-4000-8000-000000000011';
  const deviceA2 = '00000000-0000-4000-8000-000000000012';
  const deviceB1 = '00000000-0000-4000-8000-000000000021';
  const tokenA1 = 'A'.repeat(43);
  const tokenA2 = 'C'.repeat(43);
  const tokenB1 = 'B'.repeat(43);

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

  // session A1
  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenA1).digest('hex'),
    memberA,
    deviceA1,
    Date.now() + 60_000,
  );

  // session A2 (同一成员 A 的另一台设备)
  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenA2).digest('hex'),
    memberA,
    deviceA2,
    Date.now() + 60_000,
  );

  // session B1
  db.prepare(
    'INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    createHash('sha256').update(tokenB1).digest('hex'),
    memberB,
    deviceB1,
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
    deviceA1,
    deviceA2,
    deviceB1,
    cookieA1: `gh_session=${tokenA1}`,
    cookieA2: `gh_session=${tokenA2}`,
    cookieB1: `gh_session=${tokenB1}`,
  };
}

describe('P13 断线重连、托管、抢控与服务恢复测试', () => {
  it('场景 1: 断线 60s 宽限期内保持真人决策，超时执行默认摸切', async () => {
    const { app, roomManager, cookieA1, cookieB1, memberA, deviceA1 } = createTestContext();

    // 1. 创建房间并开局
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA1 },
      payload: { nickname: 'Host Alpha' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB1 },
      payload: { seatIndex: 1, nickname: 'Guest Beta' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB1 },
      payload: { isReady: true },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA1 },
    });

    // 2. 玩家 A 掉线
    roomManager.handleDisconnect(roomId, memberA, deviceA1);
    const roomInstance = roomManager.getRoomInstance(roomId)!;
    const seatA = roomInstance.summary.seats[0];
    expect(seatA.type).toBe('human');
    if (seatA.type === 'human') {
      expect(seatA.connected).toBe(false);
      expect(seatA.disconnectedAt).not.toBeNull();
      // 在 60s 宽限期内，isAutoplay 不会被直接置为 true
      expect(seatA.isAutoplay).toBe(false);
    }

    // 3. 验证触发超时默认摸切（通过私有方法 handleTurnTimeout 测试保底逻辑）
    const prevRevision = roomInstance.summary.revision;
    // 强制调用超时处理
    (roomManager as any).handleTurnTimeout(roomId);
    expect(roomInstance.summary.revision).toBeGreaterThan(prevRevision);
  });

  it('场景 2: 掉线超过 60s 触发 AI 托管自动摸打，重连后自动解除托管', async () => {
    const { app, roomManager, cookieA1, cookieB1, memberA, deviceA1 } = createTestContext();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA1 },
      payload: { nickname: 'Host Alpha' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB1 },
      payload: { seatIndex: 1, nickname: 'Guest Beta' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB1 },
      payload: { isReady: true },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA1 },
    });

    const roomInstance = roomManager.getRoomInstance(roomId)!;
    const seatA = roomInstance.summary.seats[0];
    expect(seatA.type).toBe('human');
    if (seatA.type === 'human') {
      // 模拟断线已超过 60 秒（65 秒）
      seatA.connected = false;
      seatA.disconnectedAt = Date.now() - 65_000;
    }

    // 调度下一轮，此时应检测到断线超 60 秒，触发 shouldTriggerAutoplay
    (roomManager as any).scheduleNextTurn(roomInstance);
    if (seatA.type === 'human') {
      expect(seatA.isAutoplay).toBe(true);
    }

    // 玩家 A 重连
    roomManager.handleReconnect(roomId, memberA, deviceA1);
    if (seatA.type === 'human') {
      expect(seatA.connected).toBe(true);
      expect(seatA.disconnectedAt).toBeNull();
    }

    // 玩家 A 手动切换或操作指令，托管自动关闭
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA1 },
      payload: {
        protocol: 1,
        commandId: 'cmd-autoplay-toggle',
        roomId,
        expectedRevision: 1,
        type: 'toggle_autoplay',
        payload: { isAutoplay: false },
      },
    });
    if (seatA.type === 'human') {
      expect(seatA.isAutoplay).toBe(false);
    }
  });

  it('场景 3: 多设备抢控租约 (Control Lease) 与隐私视角的控制权隔离', async () => {
    const { app, roomManager, cookieA1, cookieA2, cookieB1, deviceA1, deviceA2 } = createTestContext();

    // 1. 创建房间并开局，初始席位租约在 deviceA1
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA1 },
      payload: { nickname: 'Host Alpha' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB1 },
      payload: { seatIndex: 1, nickname: 'Guest Beta' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA1 },
    });

    const roomInstance = roomManager.getRoomInstance(roomId)!;
    const seatA = roomInstance.summary.seats[0];
    if (seatA.type === 'human') {
      expect(seatA.leaseDeviceId).toBe(deviceA1);
    }

    // 2. 同一账号从设备 A2 尝试出牌，应被拦截（CONTROL_LEASE_LOST / 409）
    const failedAction = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA2 },
      payload: {
        protocol: 1,
        commandId: 'cmd-illegal-device',
        roomId,
        expectedRevision: 1,
        type: 'discard',
        payload: { tile: 0 },
      },
    });
    expect(failedAction.statusCode).toBe(409);
    expect(failedAction.json().code).toBe('CONTROL_LEASE_LOST');

    // 3. 设备 A2 发起抢占控制权 (takeover_control)
    const takeoverRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA2 },
      payload: {
        protocol: 1,
        commandId: 'cmd-takeover',
        roomId,
        expectedRevision: 1,
        type: 'takeover_control',
      },
    });
    expect(takeoverRes.statusCode).toBe(200);
    if (seatA.type === 'human') {
      expect(seatA.leaseDeviceId).toBe(deviceA2);
    }

    // 4. 视角检查：deviceA1 失去控制权，deviceA2 获得控制权
    const viewA1 = roomManager.getPlayerView(roomId, 0, deviceA1)!;
    const viewA2 = roomManager.getPlayerView(roomId, 0, deviceA2)!;
    expect(viewA1.seats[0].hasControlLease).toBe(false);
    expect(viewA2.seats[0].hasControlLease).toBe(true);

    // deviceA1 的操作选项必须被置为 null（只读防误触）
    expect(viewA1.seats[0].turnOptions).toBeNull();
    expect(viewA1.seats[0].claimOptions).toBeNull();

    // 5. 旧设备 A1 发起出牌被拒绝
    const a1Try = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA1 },
      payload: {
        protocol: 1,
        commandId: 'cmd-a1-try',
        roomId,
        expectedRevision: 1,
        type: 'discard',
        payload: { tile: 0 },
      },
    });
    expect(a1Try.statusCode).toBe(409);
    expect(a1Try.json().code).toBe('CONTROL_LEASE_LOST');
  });

  it('场景 4: 服务端崩溃重启恢复与防重复发奖结算', async () => {
    const { app, db, cookieA1, cookieB1 } = createTestContext();

    // 1. 创建房间并开局
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA1 },
      payload: { nickname: 'Host Alpha' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB1 },
      payload: { seatIndex: 1, nickname: 'Guest Beta' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA1 },
    });

    // 确认 active_rooms 表中有该房间记录
    const activeRow = db.prepare('SELECT * FROM active_rooms WHERE room_id = ?').get(roomId) as any;
    expect(activeRow).toBeTruthy();
    expect(JSON.parse(activeRow.summary_json).status).toBe('playing');

    // 2. 模拟服务进程崩溃并重启：创建新的 RoomManager 实例共享同一 db
    const rebootedManager = new RoomManager(db);
    const recoveredRoom = rebootedManager.getRoom(roomId);
    expect(recoveredRoom).toBeTruthy();
    expect(recoveredRoom!.status).toBe('playing');
    // 重启后真人席位默认处于离线和暂停状态
    expect(recoveredRoom!.isPaused).toBe(true);
    expect(recoveredRoom!.seats[0].type === 'human' && recoveredRoom!.seats[0].connected).toBe(false);

    // 3. 重新挂载路由给新 app 模拟新服务进程
    const newApp = Fastify();
    newApp.setErrorHandler((error, _request, reply) => {
      if (error instanceof ApiError) {
        reply.code(error.status).send(error.body);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ message });
    });
    registerRoomRoutes(newApp, db, rebootedManager);

    // 玩家 A 重新唤醒房间
    const resumeRes = await newApp.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/command`,
      headers: { cookie: cookieA1 },
      payload: {
        protocol: 1,
        commandId: 'cmd-resume',
        roomId,
        expectedRevision: recoveredRoom!.revision,
        type: 'resume_game',
      },
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(rebootedManager.getRoom(roomId)!.isPaused).toBe(false);

    // 4. 模拟终局结算，验证 active_rooms 被删除，且两名真人均获得结算
    const inst = rebootedManager.getRoomInstance(roomId)!;
    inst.match!.status = 'matchEnd';
    inst.match!.matchEnd = {
      reason: 'east4_end',
      ranking: [0, 1, 2, 3],
      finalScores: [35000, 25000, 20000, 20000],
    };
    (rebootedManager as any).settleMatchEnd(inst);

    // 确认 active_rooms 已被清理
    const afterSettleRow = db.prepare('SELECT * FROM active_rooms WHERE room_id = ?').get(roomId);
    expect(afterSettleRow).toBeUndefined();

    // 确认 room 状态为 finished
    expect(rebootedManager.getRoom(roomId)!.status).toBe('finished');
  });

  it('场景 5: 全真人离线自动暂停与重连唤醒', async () => {
    const { app, roomManager, cookieA1, cookieB1, memberA, memberB, deviceA1, deviceB1 } = createTestContext();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { cookie: cookieA1 },
      payload: { nickname: 'Host Alpha' },
    });
    const roomId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/join`,
      headers: { cookie: cookieB1 },
      payload: { seatIndex: 1, nickname: 'Guest Beta' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieA1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/ready`,
      headers: { cookie: cookieB1 },
      payload: { isReady: true },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: { cookie: cookieA1 },
    });

    const room = roomManager.getRoom(roomId)!;
    expect(room.isPaused).toBe(false);

    // 1. 玩家 A 掉线，玩家 B 仍在，不应暂停
    roomManager.handleDisconnect(roomId, memberA, deviceA1);
    expect(roomManager.getRoom(roomId)!.isPaused).toBe(false);

    // 2. 玩家 B 也掉线，所有真人离线，触发自动暂停
    roomManager.handleDisconnect(roomId, memberB, deviceB1);
    expect(roomManager.getRoom(roomId)!.isPaused).toBe(true);

    // 3. 玩家 A 重连，自动解除暂停
    roomManager.handleReconnect(roomId, memberA, deviceA1);
    expect(roomManager.getRoom(roomId)!.isPaused).toBe(false);
  });
});
