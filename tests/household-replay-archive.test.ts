import { createHash } from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { afterEach, describe, expect, it } from 'rstack/test';
import { ApiError } from '../server/src/auth';
import {
  archiveReplay,
  getMember,
  getReplay,
  openDatabase,
  readSnapshot,
  saveSnapshot,
} from '../server/src/db';
import { RoomManager, type RoomInstance } from '../server/src/rooms/RoomManager';
import { registerReplayRoutes } from '../server/src/routes/replays';
import { registerRoomRoutes } from '../server/src/routes/rooms';
import { createEmptySnapshot } from '../server/src/snapshot';
import {
  createMatch,
  toReplayFile,
} from '../src/pages/mahjong/japanese/engine/match';
import { DEFAULT_RIICHI_RULES } from '../src/pages/mahjong/japanese/engine/rules';
import { buildMatchReview } from '../src/lib/riichiMatchReview';
import {
  computeWeaknessSummary,
  evaluateTrainingChoice,
} from '../src/lib/riichiTraining';
import { createGuestEntry } from '../src/lib/riichiReplayArchive';
import { simulateMatch } from './helpers/riichiSim';

interface TestRoomManagerHooks {
  settleMatchEnd: (room: RoomInstance) => void;
}

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
  const memberC = '00000000-0000-4000-8000-000000000003';

  for (const [id, name] of [
    [memberA, 'Player A'],
    [memberB, 'Player B'],
    [memberC, 'Player C'],
  ]) {
    const snap = createEmptySnapshot(id, name);
    db.prepare(`
      INSERT INTO members (id, pin_salt, pin_hash, snapshot, revision, created_at)
      VALUES (?, 'salt', 'hash', ?, 0, datetime('now'))
    `).run(id, JSON.stringify(snap));
  }

  // 创建 sessions (Token 必须是 43 位)
  const tokenA = 'A'.repeat(43);
  const tokenB = 'B'.repeat(43);
  const tokenC = 'C'.repeat(43);
  const hash = (t: string) => createHash('sha256').update(t).digest('hex');

  db.prepare(`
    INSERT INTO sessions (token_hash, member_id, device_id, expires_at)
    VALUES (?, ?, 'device-a', ?)
  `).run(hash(tokenA), memberA, Date.now() + 3600_000);

  db.prepare(`
    INSERT INTO sessions (token_hash, member_id, device_id, expires_at)
    VALUES (?, ?, 'device-b', ?)
  `).run(hash(tokenB), memberB, Date.now() + 3600_000);

  db.prepare(`
    INSERT INTO sessions (token_hash, member_id, device_id, expires_at)
    VALUES (?, ?, 'device-c', ?)
  `).run(hash(tokenC), memberC, Date.now() + 3600_000);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.code(error.status).send(error.body);
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    reply.code(500).send({ message });
  });

  registerReplayRoutes(app, db);
  registerRoomRoutes(app, db, roomManager);

  return { db, app, roomManager, memberA, memberB, memberC, tokenA, tokenB, tokenC };
}

describe('P15 Replay Archive and Training Closed Loop', () => {
  it('archives replays on match end and allows participants to access while non-participants cannot', async () => {
    const { app, roomManager, memberA, memberB, tokenA, tokenC } =
      createTestContext();

    // 创建家庭房间并开始
    const room = roomManager.createRoom(memberA, 'Player A', 'avatar-1', 'device-a');
    roomManager.joinSeat(room.id, 1, memberB, 'Player B', 'avatar-2', 'device-b');
    roomManager.setReady(room.id, memberA, true);
    roomManager.setReady(room.id, memberB, true);
    roomManager.startGame(room.id, memberA);

    const instance = roomManager.getRoomInstance(room.id);
    expect(instance).toBeTruthy();

    // 模拟终局状态
    instance!.match!.status = 'matchEnd';
    instance!.match!.matchEnd = {
      reason: 'east4_end',
      ranking: [0, 1, 2, 3],
      finalScores: [32000, 28000, 20000, 20000],
    };

    // 触发结算与归档
    (roomManager as unknown as TestRoomManagerHooks).settleMatchEnd(instance!);

    // Member A (座位 0) 查询列表
    const resA = await app.inject({
      method: 'GET',
      url: '/api/v1/replays',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(resA.statusCode).toBe(200);
    const listA = resA.json();
    expect(listA.total).toBe(1);
    expect(listA.items[0].source).toBe('family');
    expect(listA.items[0].viewerSeat).toBe(0);
    expect(listA.items[0].ranking).toBe(1);

    // Member A 查询详情成功
    const detailA = await app.inject({
      method: 'GET',
      url: `/api/v1/replays/${listA.items[0].matchId}`,
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(detailA.statusCode).toBe(200);
    expect(detailA.json().file).toBeTruthy();

    // Member C (非参赛成员) 试图查询同一对局牌谱被拒绝 (404)
    const detailC = await app.inject({
      method: 'GET',
      url: `/api/v1/replays/${listA.items[0].matchId}`,
      headers: { cookie: `gh_session=${tokenC}` },
    });
    expect(detailC.statusCode).toBe(404);
  });

  it('prohibits querying full replay for ongoing family rooms', async () => {
    const { db, app, memberA, tokenA } = createTestContext();

    const ongoingRoomId = 'ongoing-room-123';
    const matchId = 'ongoing-match-123';

    // 写入正在进行的 active_rooms
    db.prepare(`
      INSERT INTO active_rooms (room_id, summary_json, is_paused, updated_at)
      VALUES (?, '{}', 0, ?)
    `).run(ongoingRoomId, Date.now());

    // 写入一条指向该 room_id 的牌谱行
    archiveReplay(db, memberA, {
      matchId,
      source: 'family',
      roomId: ongoingRoomId,
      viewerSeat: 0,
      playerCharacterId: 'koharu',
      ranking: 1,
      finalScore: 25000,
      matchLength: 'east',
      replayJson: JSON.stringify({ version: 1, events: [] }),
    });

    // 试图查询进行中的房间牌谱 -> 403 FORBIDDEN_ONGOING_ROOM
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/replays/${matchId}`,
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN_ONGOING_ROOM');
  });

  it('supports favorite toggle, enforces 100 limit, and prunes non-favorites at 200 without affecting coins', async () => {
    const { db, app, memberA, tokenA } = createTestContext();

    // 预置初始雀币
    const rowA = getMember(db, memberA)!;
    const snapA = readSnapshot(rowA);
    snapA.wallet.coins = 500;
    saveSnapshot(db, rowA, snapA);

    // 归档 205 条牌谱
    for (let i = 1; i <= 205; i++) {
      archiveReplay(db, memberA, {
        matchId: `match-${i.toString().padStart(4, '0')}`,
        source: 'free',
        viewerSeat: 0,
        playerCharacterId: 'koharu',
        ranking: ((i % 4) + 1),
        finalScore: 25000,
        matchLength: 'east',
        replayJson: JSON.stringify({ version: 1, events: [] }),
        createdAt: 1000000 + i,
      });
    }

    // 检查总数：普通牌谱最多保留 200 条，最早的 5 条被自动淘汰 (FIFO)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/replays?limit=100',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(listRes.json().total).toBe(200);

    // 最旧的 match-0001 已被淘汰
    const oldestRow = getReplay(db, memberA, 'match-0001');
    expect(oldestRow).toBeNull();
    // 较新的 match-0006 依然存在
    const keptRow = getReplay(db, memberA, 'match-0006');
    expect(keptRow).toBeTruthy();

    // 收藏一条牌谱
    const favRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/replays/match-0006/favorite',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { isFavorite: true },
    });
    expect(favRes.statusCode).toBe(200);
    expect(favRes.json().isFavorite).toBe(true);

    // 验证收藏上限 100：模拟已有 100 条收藏后继续收藏报错
    db.prepare(`
      UPDATE riichi_replays SET is_favorite = 1
      WHERE member_id = ? AND match_id IN (
        SELECT match_id FROM riichi_replays WHERE member_id = ? AND match_id != 'match-0007' LIMIT 100
      )
    `).run(memberA, memberA);
    const favLimitRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/replays/match-0007/favorite',
      headers: { cookie: `gh_session=${tokenA}` },
      payload: { isFavorite: true },
    });
    expect(favLimitRes.statusCode).toBe(409);
    expect(favLimitRes.json().code).toBe('FAVORITE_LIMIT_REACHED');

    // 删除一条牌谱
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/replays/match-0006',
      headers: { cookie: `gh_session=${tokenA}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(getReplay(db, memberA, 'match-0006')).toBeNull();

    // 确认删除牌谱后，钱包余额和奖励完全不受影响
    const finalMember = getMember(db, memberA)!;
    const finalSnap = readSnapshot(finalMember);
    expect(finalSnap.wallet.coins).toBe(500);
  });

  it('reviews decisions parameterized by viewerSeat 0/1/2/3 correctly', async () => {
    const match = simulateMatch({
      seed: 7,
      matchLength: 'east',
      levels: ['beginner', 'standard', 'strong', 'expert'],
    });
    expect(match.status).toBe('matchEnd');

    const replayFile = toReplayFile(match);

    // 验证 viewerSeat 0, 1, 2, 3 均能正常生成复盘分析且视点正确
    for (const seat of [0, 1, 2, 3]) {
      const review = await buildMatchReview(replayFile, { viewerSeat: seat });
      expect(review.viewerSeat).toBe(seat);
      expect(review.stats.rounds).toBeGreaterThanOrEqual(1);
    }
  });

  it('converts decisions into training problems and evaluates user choices correctly', () => {
    const mockProblem = {
      id: 'test-prob-1',
      matchId: 'match-1',
      frameIndex: 12,
      category: 'shanten' as const,
      viewerSeat: 0,
      wind: 0,
      roundNumber: 1,
      honba: 0,
      turn: 3,
      hand: [0, 1, 2, 10, 11, 12, 18, 19, 20, 27, 28, 29, 31, 32],
      melds: [],
      playedTile: 31, // 白
      recommendedTile: 32, // 发
      playerRiichi: false,
      recommendedRiichi: false,
      reasonTextKey: 'riichi.review.reason.shanten',
      explanation: {
        shantenDiff: 1,
        ukeireDiff: 4,
        dangerLoss: 0,
        safer: false,
      },
    };

    // 玩家选择了推荐牌
    const evalCorrect = evaluateTrainingChoice(mockProblem, 32, false);
    expect(evalCorrect.isRecommended).toBe(true);
    expect(evalCorrect.explanationKey).toBe('riichi.training.eval.correct');

    // 玩家选择了其他手牌
    const evalWrong = evaluateTrainingChoice(mockProblem, 31, false);
    expect(evalWrong.isRecommended).toBe(false);
    expect(evalWrong.explanationKey).toBe('riichi.training.eval.shanten');
  });

  it('computes weakness summary with sample size check', () => {
    // 模拟少于 5 场对局：样本不足
    const mockReviewsShort = Array.from({ length: 3 }, () => ({
      viewerSeat: 0,
      frames: [],
      stats: { rounds: 4, wins: 1, dealIns: 1, riichi: 1, calls: 0, averageWin: 3900 },
      decisions: [
        {
          frameIndex: 1,
          roundId: 1,
          wind: 0,
          roundNumber: 1,
          honba: 0,
          turn: 5,
          hand: [],
          melds: [],
          played: 1,
          recommended: 2,
          playerRiichi: false,
          aiRiichi: false,
          reason: 'shanten' as const,
          impact: 1000,
          shantenDifference: 1,
          ukeireDifference: 2,
          loss: 0,
          safer: false,
          opponents: [],
        },
      ],
    }));

    const summaryShort = computeWeaknessSummary(mockReviewsShort);
    expect(summaryShort.totalMatchesAnalyzed).toBe(3);
    expect(summaryShort.hasEnoughSamples).toBe(false);
    expect(summaryShort.countsByCategory.shanten).toBe(3);

    // 模拟 6 场对局：样本充足
    const mockReviewsLong = Array.from({ length: 6 }, () => mockReviewsShort[0]);
    const summaryLong = computeWeaknessSummary(mockReviewsLong);
    expect(summaryLong.totalMatchesAnalyzed).toBe(6);
    expect(summaryLong.hasEnoughSamples).toBe(true);
  });

  it('creates guest archive entry and preserves last replay', () => {
    const match = createMatch({
      seed: 9999,
      matchLength: 'east',
      rules: DEFAULT_RIICHI_RULES,
    }).match;
    const file = toReplayFile(match);

    const guestEntry = createGuestEntry(file, 'free', 0);
    expect(guestEntry.summary.source).toBe('free');
    expect(guestEntry.summary.viewerSeat).toBe(0);
    expect(guestEntry.file.seed).toBe(9999);
  });
});
