import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'rstack/test';
import {
  openDatabase,
  getFamilyCup,
  listFamilyCups,
} from '../server/src/db';
import { RoomManager } from '../server/src/rooms/RoomManager';
import { createEmptySnapshot } from '../server/src/snapshot';
import {
  computeCupMatchPoints,
  computeCupStandings,
  type FamilyCupParticipant,
} from '../shared/contracts/room';
import {
  JOURNEY_STAGES,
  JOURNEY_STAGE_IDS,
  getJourneyStageForCharacter,
  createJourneyMatch,
  validateJourneyAttempt,
  resolveFailureReasonKey,
  normalizeJourneyProgress,
} from '../src/lib/riichiJourney';
import { JOURNEY_CONTENT_VERSION } from '../shared/contracts/journey';
import { getPracticeAiEvent } from '../src/lib/riichiPractice';
import { applyEvent, toReplayFile } from '../src/pages/mahjong/japanese/engine/match';
import { journeyMessages } from '../src/lib/journeyMessages';
import { familyMessages } from '../src/lib/familyMessages';
import { curatedMessages } from '../src/lib/curatedMessages';
import { getMessage } from '../src/lib/i18n';
import { CHARACTER_DEFS } from '../src/lib/playerCharacters';
import {
  resolveCuratedRecommendations,
  recordCuratedBadge,
  getCuratedBadges,
  CURATED_ROTATION_CONFIG_V1,
  CURATED_ROTATION_CONFIG_V2,
  CURATED_BADGES_STORAGE_KEY,
} from '../src/lib/curatedRotation';
import { setStorageDriver } from '../src/lib/storage';

afterEach(() => {
  delete process.env.GAME_HUB_DB_PATH;
  setStorageDriver(null);
  localStorage.removeItem(CURATED_BADGES_STORAGE_KEY);
});

// ==========================================
// P19: 雀庄巡礼第一季 (9-Character Journey Season 1)
// ==========================================

test('P19: all 10 journey stages are defined with unique deterministic seeds and valid targets', () => {
  expect(JOURNEY_STAGES).toHaveLength(10);
  expect(JOURNEY_STAGE_IDS).toHaveLength(10);

  const seeds = new Set<number>();
  for (const stage of JOURNEY_STAGES) {
    expect(JOURNEY_STAGE_IDS).toContain(stage.id);
    expect(seeds.has(stage.seed)).toBe(false);
    seeds.add(stage.seed);
    expect(stage.prefixEventCount).toBeGreaterThan(0);
    expect(stage.opponents).toHaveLength(3);
    expect(stage.goalKey).toBeTruthy();
    expect(stage.venueKey).toBeTruthy();
  }
});

test('P19: every playable character in CHARACTER_DEFS maps to an active Journey stage', () => {
  for (const char of CHARACTER_DEFS) {
    const stage = getJourneyStageForCharacter(char.id);
    expect(stage).toBeDefined();
    expect(stage?.characterId).toBe(char.id);
  }
});

test('P19: all 10 main stages and 20 variations have deterministic playable openings', () => {
  for (const stage of JOURNEY_STAGES) {
    for (const variation of [undefined, '1', '2'] as const) {
      const match = createJourneyMatch(stage.id, variation);
      expect(match.status).toBe('playing');
      expect(match.seatCharacters[0]).toBeNull();
      expect(match.seatCharacters.slice(1)).toEqual(stage.opponents);
      expect(match).toEqual(createJourneyMatch(stage.id, variation));
    }
  }
});

test('P19: Yoru preserves its fixed pon opening and can clear by making no new calls', () => {
  let match = createJourneyMatch('yoru-reading');
  expect(match.seed).toBe(91);
  expect(match.round.melds[0]).toHaveLength(1);
  for (let index = 0; index < 512 && match.status === 'playing'; index++) {
    let event = getPracticeAiEvent(match, null);
    if (event?.type === 'claim' && event.seat === 0)
      event = { type: 'claim', seat: 0, response: { type: 'pass' }, elapsed: 0 };
    if (!event) throw new Error('Journey fixture has no next action');
    const step = applyEvent(match, event);
    if (!step) throw new Error('Journey fixture rejected a legal action');
    match = step.match;
  }
  expect(validateJourneyAttempt({
    attemptId: 'yoru-no-new-calls',
    stageId: 'yoru-reading',
    contentVersion: JOURNEY_CONTENT_VERSION,
    replay: toReplayFile(match),
  })).toMatchObject({ completed: true, openMelds: 1, failureReasonKey: null });
});

test('P19: resolveFailureReasonKey evaluates distinct stage failure reasons', () => {
  // koharu-call fails if no open meld
  const koharuFail = resolveFailureReasonKey('koharu-call', {
    safeFinish: true,
    reachedTenpai: true,
    openedMeld: false,
    pointsDelta: 0,
    declaredRiichi: false,
    suitFocusCount: 5,
  });
  expect(koharuFail).toBe('journey.failure.noOpenMeld');

  // chitose-closed fails if opened hand
  const chitoseFail = resolveFailureReasonKey('chitose-closed', {
    safeFinish: true,
    reachedTenpai: true,
    openedMeld: true,
    pointsDelta: 1000,
    declaredRiichi: false,
    suitFocusCount: 4,
  });
  expect(chitoseFail).toBe('journey.failure.openedHand');

  // aya-riichi fails if no riichi declared
  const ayaFail = resolveFailureReasonKey('aya-riichi', {
    safeFinish: true,
    reachedTenpai: true,
    openedMeld: false,
    pointsDelta: 0,
    declaredRiichi: false,
    suitFocusCount: 4,
  });
  expect(ayaFail).toBe('journey.failure.noRiichi');

  // mahiru-flush fails if suit is scattered (< 9 tiles)
  const mahiruFail = resolveFailureReasonKey('mahiru-flush', {
    safeFinish: true,
    reachedTenpai: true,
    openedMeld: true,
    pointsDelta: 0,
    declaredRiichi: false,
    suitFocusCount: 6,
  });
  expect(mahiruFail).toBe('journey.failure.suitScattered');

  // tsubaki-finale fails if pointsDelta < 2000 without tenpai
  const tsubakiFail = resolveFailureReasonKey('tsubaki-finale', {
    safeFinish: true,
    reachedTenpai: false,
    openedMeld: false,
    pointsDelta: 1000,
    declaredRiichi: false,
    suitFocusCount: 5,
  });
  expect(tsubakiFail).toBe('journey.failure.comebackShort');

  // dealing in fails with dealtIn
  const dealtInFail = resolveFailureReasonKey('mio-defense', {
    safeFinish: false,
    reachedTenpai: false,
    openedMeld: false,
    pointsDelta: -8000,
    declaredRiichi: false,
    suitFocusCount: 3,
  });
  expect(dealtInFail).toBe('journey.failure.dealtIn');
});

test('P19: journeyMessages copy exists and matches in both zh and en for all 10 stages', () => {
  expect(Object.keys(journeyMessages.zh).sort()).toEqual(Object.keys(journeyMessages.en).sort());
  for (const stage of JOURNEY_STAGES) {
    for (const locale of ['zh', 'en'] as const) {
      expect(getMessage(locale, stage.titleKey)).not.toBe(stage.titleKey);
      expect(getMessage(locale, stage.goalKey)).not.toBe(stage.goalKey);
      expect(getMessage(locale, stage.venueKey)).not.toBe(stage.venueKey);
      expect(getMessage(locale, stage.introKey)).not.toBe(stage.introKey);
    }
  }
});

test('P19: normalizeJourneyProgress preserves P17 progress while allowing 10 stages', () => {
  const legacyProgress = {
    schema: 1,
    contentVersion: 1,
    stages: {
      'aoi-balance': { attempts: 2, completed: true, bestPointsDelta: 32000, updatedAt: 100 },
      'rin-tempo': { attempts: 1, completed: true, bestPointsDelta: 28000, updatedAt: 200 },
      'mio-defense': { attempts: 0, completed: false, bestPointsDelta: null, updatedAt: 0 },
    },
    creditedAttemptIds: ['att-1'],
    updatedAt: 200,
  };
  const normalized = normalizeJourneyProgress(legacyProgress);
  expect(normalized.stages['aoi-balance'].completed).toBe(true);
  expect(normalized.stages['rin-tempo'].completed).toBe(true);
  expect(normalized.stages['koharu-call'].completed).toBe(false);
  expect(normalized.stages['tsubaki-finale'].completed).toBe(false);
  expect(normalized.stages['aoi-balance'].bestPointsDelta).toBe(32000);
  expect(Object.keys(normalized.stages)).toHaveLength(10);
});

test('P19: SQLite table migration updates journey_attempts CHECK constraint for all 10 stages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'game-hub-p19-'));
  const dbPath = join(dir, 'test-p19-journey.sqlite');
  try {
    // 模拟由旧版本创建的数据库（仅包含 3 个 stage_id 的 CHECK 约束）
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY,
        pin_salt TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO members (id, pin_salt, pin_hash, snapshot, revision, created_at)
      VALUES ('m1', 'salt', 'hash', '{}', 0, '2026-01-01');

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
      INSERT INTO journey_attempts VALUES ('m1', 'att-1', 'aoi-balance', 1, 'hash1', '{"completed":true}', 100);
    `);
    legacyDb.close();

    process.env.GAME_HUB_DB_PATH = dbPath;
    const db = openDatabase();
    try {
      // 验证自动迁移后，能够正常写入第 9 关（yoru-reading）与第 10 关（tsubaki-finale）的挑战记录
      db.prepare(`
        INSERT INTO journey_attempts (member_id, attempt_id, stage_id, content_version, payload_hash, evaluation_json, created_at)
        VALUES ('m1', 'att-2', 'yoru-reading', 1, 'hash2', '{"completed":true}', 200),
               ('m1', 'att-3', 'tsubaki-finale', 1, 'hash3', '{"completed":true}', 300)
      `).run();

      const row = db.prepare('SELECT * FROM journey_attempts WHERE attempt_id = ?').get('att-3') as { stage_id: string };
      expect(row.stage_id).toBe('tsubaki-finale');
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ==========================================
// P20: 家庭雀庄杯 (Family Cup)
// ==========================================

test('P20: computeCupMatchPoints allocates N-1..0 points to human players and excludes AI', () => {
  const participants: FamilyCupParticipant[] = [
    { memberId: 'm1', nickname: 'Alice', avatarPresetId: 'a1', seatIndex: 0 },
    { memberId: 'm2', nickname: 'Bob', avatarPresetId: 'a2', seatIndex: 1 },
  ];

  // 2 humans, 2 AI. Scores: seat 0 (Alice) = 35000, seat 1 (Bob) = 25000, seat 2 (AI) = 20000, seat 3 (AI) = 20000
  const matchScores = [35000, 25000, 20000, 20000];
  const points = computeCupMatchPoints(participants, matchScores);

  expect(points['m1']).toBe(1);
  expect(points['m2']).toBe(0);

  // 4 humans
  const fourHumans: FamilyCupParticipant[] = [
    { memberId: 'm1', nickname: 'Alice', avatarPresetId: 'a1', seatIndex: 0 },
    { memberId: 'm2', nickname: 'Bob', avatarPresetId: 'a2', seatIndex: 1 },
    { memberId: 'm3', nickname: 'Charlie', avatarPresetId: 'a3', seatIndex: 2 },
    { memberId: 'm4', nickname: 'Dave', avatarPresetId: 'a4', seatIndex: 3 },
  ];
  const fourPoints = computeCupMatchPoints(fourHumans, [40000, 30000, 20000, 10000]);
  expect(fourPoints['m1']).toBe(3);
  expect(fourPoints['m2']).toBe(2);
  expect(fourPoints['m3']).toBe(1);
  expect(fourPoints['m4']).toBe(0);

  // Tied scores between humans: point sharing
  const tiedPoints = computeCupMatchPoints(participants, [30000, 30000, 20000, 20000]);
  expect(tiedPoints['m1']).toBe(0.5);
  expect(tiedPoints['m2']).toBe(0.5);
});

test('P20: familyMessages copy has matching Chinese and English keys', () => {
  expect(Object.keys(familyMessages.zh).sort()).toEqual(Object.keys(familyMessages.en).sort());
});

test('P20: computeCupStandings sorts by totalCupPoints desc then totalMatchScore desc', () => {
  const participants: FamilyCupParticipant[] = [
    { memberId: 'm1', nickname: 'Alice', avatarPresetId: 'a1', seatIndex: 0 },
    { memberId: 'm2', nickname: 'Bob', avatarPresetId: 'a2', seatIndex: 1 },
  ];

  const standings = computeCupStandings(participants, [
    {
      matchId: 'match-1',
      matchIndex: 1,
      completedAt: 100,
      finalScores: [32000, 28000, 20000, 20000],
      awardedPoints: { m1: 1, m2: 0 },
    },
    {
      matchId: 'match-2',
      matchIndex: 2,
      completedAt: 200,
      finalScores: [25000, 35000, 20000, 20000],
      awardedPoints: { m1: 0, m2: 1 },
    },
  ]);

  expect(standings).toHaveLength(2);
  expect(standings[0].memberId).toBe('m2');
  expect(standings[0].rank).toBe(1);
  expect(standings[0].totalCupPoints).toBe(1);
  expect(standings[0].totalMatchScore).toBe(63000);

  expect(standings[1].memberId).toBe('m1');
  expect(standings[1].rank).toBe(2);
  expect(standings[1].totalCupPoints).toBe(1);
  expect(standings[1].totalMatchScore).toBe(57000);
});

test('P20: RoomManager handles 2-match Family Cup progression, roster locking and settlement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'game-hub-p20-cup-'));
  const dbPath = join(dir, 'test-p20-cup.sqlite');
  try {
    process.env.GAME_HUB_DB_PATH = dbPath;
    const db = openDatabase();
    try {
      const snapshotAlice = createEmptySnapshot('mem-host', 'HostAlice');
      const snapshotBob = createEmptySnapshot('mem-guest', 'GuestBob');

      db.prepare(`
        INSERT INTO members (id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES ('mem-host', 'salt', 'hash', ?, 0, '2026-01-01'),
               ('mem-guest', 'salt', 'hash', ?, 0, '2026-01-01')
      `).run(JSON.stringify(snapshotAlice), JSON.stringify(snapshotBob));

      const manager = new RoomManager(db);
      // 创建 2 场杯赛房间
      const created = manager.createRoom(
        'mem-host',
        'HostAlice',
        'default-1',
        'dev-host',
        { matchLength: 'east', cupTotalMatches: 2 },
      );
      expect(created.cup).toBeDefined();
      expect(created.cup?.totalMatches).toBe(2);
      expect(created.cup?.completedMatches).toBe(0);

      // 加入第二位真人
      manager.joinSeat(created.id, 1, 'mem-guest', 'GuestBob', 'default-2', 'dev-guest');
      manager.setReady(created.id, 'mem-host', true);
      manager.setReady(created.id, 'mem-guest', true);

      // 开始第一场
      const startResult = manager.startGame(created.id, 'mem-host');
      expect(startResult.room.status).toBe('playing');
      expect(startResult.room.cup?.status).toBe('playing');

      // 模拟第一场直接结束并执行终局结算
      const inst = manager.getRoomInstance(created.id)!;
      inst.match = {
        ...inst.match!,
        status: 'matchEnd',
        matchEnd: {
          reason: 'east4_end',
          ranking: [0, 1, 2, 3],
          finalScores: [35000, 25000, 20000, 20000],
        },
      };
      (manager as unknown as { settleMatchEnd: (r: unknown) => void }).settleMatchEnd(inst);

      // 第一场结束后，状态应该回到 waiting（between_matches），且已完成 1 场
      expect(inst.summary.status).toBe('waiting');
      expect(inst.summary.cup?.status).toBe('between_matches');
      expect(inst.summary.cup?.completedMatches).toBe(1);
      expect(inst.summary.cup?.standings[0].memberId).toBe('mem-host');

      // 席位已锁定：其他玩家尝试入座或换座必须报错 CUP_ROSTER_LOCKED
      expect(() => {
        manager.joinSeat(created.id, 2, 'mem-other', 'Other', 'default-3', 'dev-other');
      }).toThrow('CUP_ROSTER_LOCKED');

      // 房主开启第二场
      manager.setReady(created.id, 'mem-host', true);
      manager.setReady(created.id, 'mem-guest', true);
      manager.startGame(created.id, 'mem-host');
      expect(inst.summary.status).toBe('playing');

      // 模拟第二场结束（GuestBob 第一）
      inst.match = {
        ...inst.match!,
        status: 'matchEnd',
        matchEnd: {
          reason: 'east4_end',
          ranking: [1, 0, 2, 3],
          finalScores: [24000, 36000, 20000, 20000],
        },
      };
      (manager as unknown as { settleMatchEnd: (r: unknown) => void }).settleMatchEnd(inst);

      // 2 场全部打完，房间终局状态 finished，杯赛 completed
      expect(inst.summary.status).toBe('finished');
      expect(inst.summary.cup?.status).toBe('completed');
      expect(inst.summary.cup?.completedMatches).toBe(2);

      // 查询持久化杯赛记录
      const cups = listFamilyCups(db);
      expect(cups.length).toBeGreaterThanOrEqual(1);
      const cupRecord = getFamilyCup(db, inst.summary.cup!.cupId);
      expect(cupRecord?.status).toBe('completed');
      expect(cupRecord?.matches).toHaveLength(2);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ==========================================
// P21: 精选轮换与回访 (Curated Rotation)
// ==========================================

test('P21: resolveCuratedRecommendations filters replay branch when player has no eligible replay', () => {
  const contextWithoutReplay = {
    memberMode: false,
    isServerAvailable: false,
    completedJourneyStageIds: [],
    hasEligibleReplay: false,
  };
  const recs = resolveCuratedRecommendations(contextWithoutReplay, CURATED_ROTATION_CONFIG_V1);
  expect(recs.some((r) => r.type === 'replay_branch')).toBe(false);

  const contextWithReplay = {
    ...contextWithoutReplay,
    hasEligibleReplay: true,
  };
  const recsWithReplay = resolveCuratedRecommendations(contextWithReplay, CURATED_ROTATION_CONFIG_V1);
  expect(recsWithReplay.some((r) => r.type === 'replay_branch')).toBe(true);
});

test('P21: resolveCuratedRecommendations hides family cup for guests when server is unavailable', () => {
  const offlineGuest = {
    memberMode: false,
    isServerAvailable: false,
    completedJourneyStageIds: [],
    hasEligibleReplay: true,
  };
  const guestRecs = resolveCuratedRecommendations(offlineGuest, CURATED_ROTATION_CONFIG_V1);
  expect(guestRecs.some((r) => r.type === 'family_cup')).toBe(false);

  const onlineGuest = {
    memberMode: false,
    isServerAvailable: true,
    completedJourneyStageIds: [],
    hasEligibleReplay: true,
  };
  const onlineRecs = resolveCuratedRecommendations(onlineGuest, CURATED_ROTATION_CONFIG_V1);
  expect(onlineRecs.some((r) => r.type === 'family_cup')).toBe(true);
});

test('P21: resolveCuratedRecommendations dynamically directs to next uncompleted Journey stage', () => {
  const context = {
    memberMode: true,
    isServerAvailable: true,
    completedJourneyStageIds: ['aoi-balance'],
    hasEligibleReplay: true,
  };
  const recs = resolveCuratedRecommendations(context, CURATED_ROTATION_CONFIG_V1);
  const journeyRec = recs.find((r) => r.type === 'journey');
  expect(journeyRec).toBeDefined();
  expect(journeyRec?.stageId).toBe('rin-tempo');
  expect(journeyRec?.badge).toBe('recommend');
});

test('P21: switching rotation configs does not alter past records, and badge rewards are idempotent', () => {
  const context = {
    memberMode: true,
    isServerAvailable: true,
    completedJourneyStageIds: ['aoi-balance', 'rin-tempo', 'mio-defense'],
    hasEligibleReplay: true,
  };

  const v1Recs = resolveCuratedRecommendations(context, CURATED_ROTATION_CONFIG_V1);
  const v2Recs = resolveCuratedRecommendations(context, CURATED_ROTATION_CONFIG_V2);

  // V1 routes to stage 4 (koharu-call) while V2 explicitly spots yoru-reading
  expect(v1Recs.find((r) => r.type === 'journey')?.stageId).toBe('koharu-call');
  expect(v2Recs.find((r) => r.type === 'journey')?.stageId).toBe('yoru-reading');

  // 验证精选徽记记录幂等性（P21 §21.2：不能重复获得相同精选徽记）
  const firstEarn = recordCuratedBadge('curated-season1-kickoff-badge');
  expect(firstEarn.newlyEarned).toBe(true);
  expect(getCuratedBadges()).toContain('curated-season1-kickoff-badge');

  const secondEarn = recordCuratedBadge('curated-season1-kickoff-badge');
  expect(secondEarn.newlyEarned).toBe(false);
  expect(getCuratedBadges().filter((b) => b === 'curated-season1-kickoff-badge')).toHaveLength(1);
});

test('P21: curatedMessages copy has matching Chinese and English keys', () => {
  expect(Object.keys(curatedMessages.zh).sort()).toEqual(Object.keys(curatedMessages.en).sort());
  for (const key of Object.keys(curatedMessages.zh)) {
    for (const locale of ['zh', 'en'] as const) {
      expect(getMessage(locale, key)).not.toBe(key);
    }
  }
});
