import type { DatabaseSync } from 'node:sqlite';
import { createUuid } from '@/lib/uuid';
import {
  computeCupStandings,
  type AiSeat,
  type FamilyCupParticipant,
  type FamilyCupSummary,
  type HumanSeat,
  type PlayerViewSnapshot,
  type RoomCommand,
  type RoomSeat,
  type RoomSettings,
  type RoomSummary,
  type ServerMessage,
} from '../../../shared/contracts/room';
import type { RiichiAiLevel } from '@/pages/mahjong/japanese/engine/rules';
import {
  applyEvent,
  createMatch,
  nextServerAiEvent,
} from '../riichi/runtime';
import {
  toReplayFile,
  type RiichiEvent,
  type RiichiMatchState,
} from '@/pages/mahjong/japanese/engine/match';
import { addCoins, getRiichiMatchCoins } from '@/lib/wallet';
import { recordCharacterMatchFinish } from '@/lib/playerCharacters';
import {
  archiveReplay,
  getFamilyCup,
  getMember,
  listFamilyCups,
  readSnapshot,
  recordFamilyCupMatch,
  saveSnapshot,
  transaction,
  upsertFamilyCup,
} from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';
import { createPlayerView } from './projectView';
import {
  deleteRoomState,
  loadActiveRooms,
  recordRoomCommand,
  saveRoomState,
} from './recovery';
import {
  hasControlLease,
  markSeatConnected,
  markSeatDisconnected,
  shouldTriggerAutoplay,
  takeoverSeatControl,
} from './controlLease';

export interface RoomInstance {
  summary: RoomSummary;
  match: RiichiMatchState | null;
  executedCommandIds: Set<string>;
  turnTimeoutTimer: ReturnType<typeof setTimeout> | null;
  serverDeadline: number | null;
  subscribers: Set<(msg: ServerMessage) => void>;
}

const DEFAULT_SETTINGS: RoomSettings = {
  matchLength: 'east',
  defaultAiLevel: 'standard',
  turnTimeLimitSeconds: 15,
  cupTotalMatches: null,
};

const AI_POOL = ['aoi', 'mio', 'rin', 'sora', 'koharu', 'chitose', 'kuro', 'shiro'];

function extractHumanParticipants(seats: readonly RoomSeat[]): FamilyCupParticipant[] {
  const participants: FamilyCupParticipant[] = [];
  for (const seat of seats) {
    if (seat.type === 'human') {
      participants.push({
        seatIndex: seat.seatIndex,
        memberId: seat.memberId,
        nickname: seat.nickname,
        avatarPresetId: seat.avatarPresetId,
      });
    }
  }
  return participants;
}

export class RoomManager {
  private rooms = new Map<string, RoomInstance>();

  constructor(private db: DatabaseSync) {
    this.restoreFromDb();
  }

  createRoom(
    hostMemberId: string,
    hostNickname: string,
    avatarPresetId: string,
    deviceId: string,
    settings: Partial<RoomSettings> = {},
  ): RoomSummary {
    const roomId = createUuid();
    const fullSettings: RoomSettings = { ...DEFAULT_SETTINGS, ...settings };
    if (
      !['east', 'south'].includes(fullSettings.matchLength) ||
      !['beginner', 'standard', 'strong', 'expert'].includes(fullSettings.defaultAiLevel) ||
      !Number.isInteger(fullSettings.turnTimeLimitSeconds) ||
      fullSettings.turnTimeLimitSeconds < 1 ||
      fullSettings.turnTimeLimitSeconds > 120 ||
      (fullSettings.cupTotalMatches !== undefined &&
        fullSettings.cupTotalMatches !== null &&
        fullSettings.cupTotalMatches !== 2 &&
        fullSettings.cupTotalMatches !== 3)
    )
      throw new Error('BAD_REQUEST');

    const initialSeats: [RoomSeat, RoomSeat, RoomSeat, RoomSeat] = [
      {
        type: 'human',
        seatIndex: 0,
        memberId: hostMemberId,
        nickname: hostNickname,
        avatarPresetId,
        deviceId,
        leaseDeviceId: deviceId,
        isReady: true, // 房主默认就绪
        connected: true,
        disconnectedAt: null,
        isAutoplay: false,
      },
      { type: 'empty', seatIndex: 1 },
      { type: 'empty', seatIndex: 2 },
      { type: 'empty', seatIndex: 3 },
    ];

    const now = Date.now();
    const cupTotalMatches = fullSettings.cupTotalMatches ?? null;
    const initialParticipants = extractHumanParticipants(initialSeats);
    const cup: FamilyCupSummary | null =
      cupTotalMatches === 2 || cupTotalMatches === 3
        ? {
            cupId: createUuid(),
            roomId,
            version: 1,
            matchLength: fullSettings.matchLength,
            totalMatches: cupTotalMatches,
            completedMatches: 0,
            status: 'waiting',
            participants: initialParticipants,
            matches: [],
            standings: computeCupStandings(initialParticipants, []),
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          }
        : null;

    const summary: RoomSummary = {
      id: roomId,
      hostMemberId,
      hostNickname,
      status: 'waiting',
      settings: fullSettings,
      playerCount: 1,
      humanCount: 1,
      seats: initialSeats,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      isPaused: false,
      cup,
    };

    const instance: RoomInstance = {
      summary,
      match: null,
      executedCommandIds: new Set(),
      turnTimeoutTimer: null,
      serverDeadline: null,
      subscribers: new Set(),
    };

    this.rooms.set(roomId, instance);
    saveRoomState(this.db, summary, null, null, false);
    return summary;
  }

  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .map((r) => r.summary)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  listCups(limit = 10): FamilyCupSummary[] {
    return listFamilyCups(this.db, limit);
  }

  getCup(cupId: string): FamilyCupSummary | null {
    return getFamilyCup(this.db, cupId);
  }

  getRoom(roomId: string): RoomSummary | null {
    return this.rooms.get(roomId)?.summary ?? null;
  }

  getRoomInstance(roomId: string): RoomInstance | null {
    return this.rooms.get(roomId) ?? null;
  }

  joinSeat(
    roomId: string,
    seatIndex: number,
    memberId: string,
    nickname: string,
    avatarPresetId: string,
    deviceId: string,
  ): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_ALREADY_STARTED');
    if (room.summary.cup && room.summary.cup.completedMatches > 0)
      throw new Error('CUP_ROSTER_LOCKED');
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 3) throw new Error('INVALID_SEAT_INDEX');

    // 检查该成员是否已在其他位置
    for (const seat of room.summary.seats) {
      if (seat.type === 'human' && seat.memberId === memberId && seat.seatIndex !== seatIndex) {
        throw new Error('ALREADY_IN_ROOM');
      }
    }

    const currentSeat = room.summary.seats[seatIndex];
    if (currentSeat.type === 'human') throw new Error('SEAT_OCCUPIED');

    const newSeat: HumanSeat = {
      type: 'human',
      seatIndex,
      memberId,
      nickname,
      avatarPresetId,
      deviceId,
      leaseDeviceId: deviceId,
      isReady: memberId === room.summary.hostMemberId,
      connected: true,
      disconnectedAt: null,
      isAutoplay: false,
    };

    room.summary.seats[seatIndex] = newSeat;
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    return room.summary;
  }

  leaveSeat(roomId: string, memberId: string): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_IN_PROGRESS');
    if (room.summary.cup && room.summary.cup.completedMatches > 0)
      throw new Error('CUP_ROSTER_LOCKED');

    let seatFound = false;
    for (let i = 0; i < 4; i++) {
      const s = room.summary.seats[i];
      if (s.type === 'human' && s.memberId === memberId) {
        room.summary.seats[i] = { type: 'empty', seatIndex: i };
        seatFound = true;
        break;
      }
    }

    if (!seatFound) throw new Error('NOT_IN_SEAT');

    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    // 如果房主退出，自动移交房主或解散
    if (room.summary.hostMemberId === memberId) {
      const nextHuman = room.summary.seats.find((s): s is HumanSeat => s.type === 'human');
      if (nextHuman) {
        room.summary.hostMemberId = nextHuman.memberId;
        room.summary.hostNickname = nextHuman.nickname;
      } else {
        this.rooms.delete(roomId);
        deleteRoomState(this.db, roomId);
        return room.summary;
      }
    }

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    return room.summary;
  }

  fillAiSeat(
    roomId: string,
    seatIndex: number,
    characterId?: string,
    aiLevel?: 'beginner' | 'standard' | 'expert' | 'strong',
  ): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_ALREADY_STARTED');
    if (room.summary.cup && room.summary.cup.completedMatches > 0)
      throw new Error('CUP_ROSTER_LOCKED');
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 3) throw new Error('INVALID_SEAT_INDEX');

    const targetSeat = room.summary.seats[seatIndex];
    if (targetSeat.type === 'human') throw new Error('SEAT_OCCUPIED_BY_HUMAN');

    const resolvedCharacter = characterId ?? AI_POOL[seatIndex % AI_POOL.length] ?? 'aoi';
    const resolvedLevel = aiLevel ?? room.summary.settings.defaultAiLevel;

    const aiSeat: AiSeat = {
      type: 'ai',
      seatIndex,
      characterId: resolvedCharacter,
      aiLevel: resolvedLevel,
    };

    room.summary.seats[seatIndex] = aiSeat;
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    return room.summary;
  }

  removeAiSeat(roomId: string, seatIndex: number): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_ALREADY_STARTED');
    if (room.summary.cup && room.summary.cup.completedMatches > 0)
      throw new Error('CUP_ROSTER_LOCKED');
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 3) throw new Error('INVALID_SEAT_INDEX');

    const targetSeat = room.summary.seats[seatIndex];
    if (targetSeat.type !== 'ai') throw new Error('NOT_AN_AI_SEAT');

    room.summary.seats[seatIndex] = { type: 'empty', seatIndex };
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    return room.summary;
  }

  setReady(roomId: string, memberId: string, isReady: boolean): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const seat = room.summary.seats.find((s): s is HumanSeat => s.type === 'human' && s.memberId === memberId);
    if (!seat) throw new Error('SEAT_NOT_FOUND');

    seat.isReady = isReady;
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    return room.summary;
  }

  reopenForRematch(roomId: string, memberId: string, expectedRevision: number): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.hostMemberId !== memberId) throw new Error('ONLY_HOST_CAN_START');
    // A repeated request may observe ready-state changes; never reset them again.
    if (room.summary.status === 'waiting' && !room.summary.currentMatchId) return room.summary;
    if (room.summary.revision !== expectedRevision) throw new Error('ROOM_REVISION_CONFLICT');
    if (room.summary.status !== 'finished') throw new Error('ALREADY_PLAYING');
    if (room.turnTimeoutTimer) clearTimeout(room.turnTimeoutTimer);
    room.turnTimeoutTimer = null;
    room.serverDeadline = null;
    room.match = null;
    room.executedCommandIds.clear();
    room.summary.status = 'waiting';
    room.summary.isPaused = false;
    delete room.summary.currentMatchId;
    for (const seat of room.summary.seats) if (seat.type === 'human') {
      seat.isReady = false;
      seat.isAutoplay = false;
    }
    if (room.summary.cup) {
      const now = Date.now();
      const participants = extractHumanParticipants(room.summary.seats);
      room.summary.cup = { ...room.summary.cup, cupId: createUuid(), status: 'waiting', completedMatches: 0,
        participants, matches: [], standings: computeCupStandings(participants, []), createdAt: now, updatedAt: now, completedAt: null };
    }
    room.summary.revision++;
    room.summary.updatedAt = Date.now();
    saveRoomState(this.db, room.summary, null, null, false);
    this.broadcastRoom(room);
    return room.summary;
  }

  startGame(roomId: string, memberId: string): { room: RoomSummary; match: RiichiMatchState } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.hostMemberId !== memberId) throw new Error('ONLY_HOST_CAN_START');
    if (room.summary.status !== 'waiting') throw new Error('ALREADY_PLAYING');
    if (room.summary.cup && room.summary.humanCount < 2) {
      throw new Error('CUP_REQUIRES_TWO_HUMANS');
    }
    for (const seat of room.summary.seats) {
      if (seat.type !== 'human') continue;
      const row = getMember(this.db, seat.memberId);
      if (row && readSnapshot(row).ranked.activeMatchId) throw new Error('RANKED_MATCH_ACTIVE');
      if ([...this.rooms.values()].some((other) => other !== room && other.summary.status === 'playing' &&
        other.summary.seats.some((otherSeat) => otherSeat.type === 'human' && otherSeat.memberId === seat.memberId)))
        throw new Error('FAMILY_MATCH_ACTIVE');
    }

    // 检查所有空席位，用默认 AI 补齐
    for (let i = 0; i < 4; i++) {
      if (room.summary.seats[i].type === 'empty') {
        const charId = AI_POOL[i % AI_POOL.length] ?? 'aoi';
        room.summary.seats[i] = {
          type: 'ai',
          seatIndex: i,
          characterId: charId,
          aiLevel: room.summary.settings.defaultAiLevel,
        };
      }
    }
    this.refreshCounts(room.summary);

    // 检查真人是否全部就绪
    const unready = room.summary.seats.find((s) => s.type === 'human' && !s.isReady);
    if (unready) throw new Error('PLAYERS_NOT_READY');

    if (room.summary.cup) {
      const lockedParticipants =
        room.summary.cup.completedMatches > 0
          ? room.summary.cup.participants
          : extractHumanParticipants(room.summary.seats);
      room.summary.cup = upsertFamilyCup(this.db, {
        cupId: room.summary.cup.cupId,
        roomId: room.summary.id,
        matchLength: room.summary.settings.matchLength,
        totalMatches: room.summary.cup.totalMatches,
        status: 'playing',
        participants: lockedParticipants,
        createdAt: room.summary.cup.createdAt,
        updatedAt: Date.now(),
      });
    }

    const getAiChar = (index: number, fallback: string) => {
      const s = room.summary.seats[index];
      return s.type === 'ai' ? s.characterId : fallback;
    };

    const seatCharacters: [null, string, string, string] = [
      null,
      getAiChar(1, 'mio'),
      getAiChar(2, 'rin'),
      getAiChar(3, 'sora'),
    ];

    const seatAiLevels = room.summary.seats.map((s) => (s.type === 'ai' ? s.aiLevel : 'standard')) as [
      RiichiAiLevel,
      RiichiAiLevel,
      RiichiAiLevel,
      RiichiAiLevel,
    ];

    const matchId = createUuid();
    const created = createMatch({
      seed: Math.floor(Math.random() * 100_000_000),
      matchLength: room.summary.settings.matchLength,
      seatCharacters,
      seatAiLevels,
    });

    room.match = created.match;
    room.summary.status = 'playing';
    room.summary.currentMatchId = matchId;
    room.summary.revision++;
    room.summary.updatedAt = Date.now();
    room.summary.isPaused = false;

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.scheduleNextTurn(room);
    this.broadcastRoom(room);
    this.broadcastViews(room);

    return { room: room.summary, match: room.match };
  }

  dispatchAction(
    roomId: string,
    memberId: string,
    deviceId: string,
    command: RoomCommand,
  ): { accepted: boolean; code?: string; revision: number } {
    const room = this.rooms.get(roomId);
    if (!room || !room.match) {
      return { accepted: false, code: 'ROOM_OR_MATCH_NOT_FOUND', revision: 0 };
    }

    if (!command || command.protocol !== 1 || command.roomId !== roomId ||
      typeof command.commandId !== 'string' || !command.commandId || command.commandId.length > 128 ||
      !Number.isSafeInteger(command.expectedRevision) ||
      (command.matchId !== undefined && command.matchId !== room.summary.currentMatchId))
      return { accepted: false, code: 'BAD_REQUEST', revision: room.summary.revision };

    // 校验执行者在哪个座位
    const seat = room.summary.seats.find(
      (s): s is HumanSeat => s.type === 'human' && s.memberId === memberId,
    );
    if (!seat) {
      return { accepted: false, code: 'UNAUTHORIZED_OR_NOT_IN_SEAT', revision: room.summary.revision };
    }

    // Read durable credentials too: retries after a process restart must not replay an action.
    const previous = this.db.prepare('SELECT member_id, device_id, command_json FROM room_commands WHERE room_id = ? AND command_id = ?')
      .get(roomId, command.commandId) as { member_id: string; device_id: string; command_json: string } | undefined;
    if (previous) {
      const accepted = previous.member_id === memberId && previous.device_id === deviceId &&
        previous.command_json === JSON.stringify(command);
      return { accepted, code: accepted ? undefined : 'COMMAND_CONFLICT', revision: room.summary.revision };
    }
    if (command.type !== 'takeover_control' && !hasControlLease(seat, deviceId))
      return { accepted: false, code: 'CONTROL_LEASE_LOST', revision: room.summary.revision };
    if (command.expectedRevision !== room.summary.revision)
      return { accepted: false, code: 'ROOM_REVISION_CONFLICT', revision: room.summary.revision };
    if (room.summary.status === 'finished')
      return { accepted: false, code: 'MATCH_FINISHED', revision: room.summary.revision };

    interface CommandPayload {
      tile?: number;
      claimType?: string;
      tiles?: number[];
      isAutoplay?: boolean;
    }
    const payload = (command.payload ?? {}) as CommandPayload;

    // 特殊指令 1: 接管控制权 (Takeover control)
    if (command.type === 'takeover_control') {
      const { changed, previousDeviceId } = takeoverSeatControl(seat, deviceId);
      if (changed && previousDeviceId) {
        this.broadcastMessage(room, {
          type: 'lease_lost',
          roomId,
          memberId,
          newDeviceId: deviceId,
        });
      }
      room.summary.revision++;
      room.executedCommandIds.add(command.commandId);
      recordRoomCommand(this.db, roomId, command, memberId, deviceId);
      saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
      if (room.summary.isPaused) {
        room.summary.isPaused = false;
        this.scheduleNextTurn(room);
      }
      this.broadcastRoom(room);
      this.broadcastViews(room);
      return { accepted: true, revision: room.summary.revision };
    }

    // 特殊指令 2: 切换托管 (Toggle autoplay)
    if (command.type === 'toggle_autoplay') {
      if (!hasControlLease(seat, deviceId)) {
        return { accepted: false, code: 'CONTROL_LEASE_LOST', revision: room.summary.revision };
      }
      seat.isAutoplay = Boolean(payload?.isAutoplay);
      room.summary.revision++;
      room.executedCommandIds.add(command.commandId);
      recordRoomCommand(this.db, roomId, command, memberId, deviceId);
      saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
      if (seat.isAutoplay) {
        this.scheduleNextTurn(room);
      }
      this.broadcastRoom(room);
      this.broadcastViews(room);
      return { accepted: true, revision: room.summary.revision };
    }

    // 特殊指令 3: 恢复对局 (Resume game)
    if (command.type === 'resume_game') {
      if (!hasControlLease(seat, deviceId))
        return { accepted: false, code: 'CONTROL_LEASE_LOST', revision: room.summary.revision };
      if (room.summary.isPaused) {
        room.summary.isPaused = false;
        room.summary.revision++;
        this.scheduleNextTurn(room);
        saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
        this.broadcastRoom(room);
        this.broadcastViews(room);
      }
      recordRoomCommand(this.db, roomId, command, memberId, deviceId);
      return { accepted: true, revision: room.summary.revision };
    }

    // 常规对局行牌指令必须持有 Lease
    if (!hasControlLease(seat, deviceId)) {
      return { accepted: false, code: 'CONTROL_LEASE_LOST', revision: room.summary.revision };
    }

    // 玩家手动操作自动解除托管
    if (seat.isAutoplay) {
      seat.isAutoplay = false;
    }

    const seatIndex = seat.seatIndex;

    // 构造 RiichiEvent
    let riichiEvent: RiichiEvent | null;

    switch (command.type) {
      case 'discard':
        if (typeof payload?.tile !== 'number') return { accepted: false, code: 'INVALID_TILE', revision: room.summary.revision };
        riichiEvent = { type: 'discard', seat: seatIndex, tile: payload.tile };
        break;
      case 'riichi':
        if (typeof payload?.tile !== 'number') return { accepted: false, code: 'INVALID_TILE', revision: room.summary.revision };
        riichiEvent = { type: 'riichi', seat: seatIndex, tile: payload.tile };
        break;
      case 'tsumo':
        riichiEvent = { type: 'tsumo', seat: seatIndex };
        break;
      case 'ron':
        riichiEvent = { type: 'claim', seat: seatIndex, response: { type: 'ron' } };
        break;
      case 'pass':
        riichiEvent = { type: 'claim', seat: seatIndex, response: { type: 'pass' } };
        break;
      case 'claim':
        if (!payload?.claimType) {
          return { accepted: false, code: 'INVALID_CLAIM', revision: room.summary.revision };
        }
        if (payload.claimType === 'chi') {
          if (!Array.isArray(payload.tiles) || payload.tiles.length !== 2) {
            return { accepted: false, code: 'INVALID_CHI_TILES', revision: room.summary.revision };
          }
          riichiEvent = {
            type: 'claim',
            seat: seatIndex,
            response: { type: 'chi', tiles: [payload.tiles[0], payload.tiles[1]] },
          };
        } else if (payload.claimType === 'pon') {
          riichiEvent = { type: 'claim', seat: seatIndex, response: { type: 'pon' } };
        } else if (payload.claimType === 'minkan') {
          riichiEvent = { type: 'claim', seat: seatIndex, response: { type: 'minkan' } };
        } else {
          return { accepted: false, code: 'UNKNOWN_CLAIM_TYPE', revision: room.summary.revision };
        }
        break;
      case 'next_round':
        riichiEvent = { type: 'nextRound' };
        break;
      default:
        return { accepted: false, code: 'UNKNOWN_COMMAND_TYPE', revision: room.summary.revision };
    }

    if (!riichiEvent) {
      return { accepted: false, code: 'UNKNOWN_COMMAND_TYPE', revision: room.summary.revision };
    }

    const step = applyEvent(room.match, riichiEvent);
    if (!step) {
      return { accepted: false, code: 'ILLEGAL_MOVE', revision: room.summary.revision };
    }

    room.match = step.match;
    room.executedCommandIds.add(command.commandId);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();
    transaction(this.db, () => {
      recordRoomCommand(this.db, roomId, command, memberId, deviceId);
      saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    });

    // 检查是否终局结算
    if (room.match.status === 'matchEnd') {
      this.settleMatchEnd(room);
    } else {
      this.scheduleNextTurn(room);
    }

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastViews(room);
    return { accepted: true, revision: room.summary.revision };
  }

  handleDisconnect(roomId: string, memberId: string, deviceId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const seat = room.summary.seats.find(
      (s): s is HumanSeat => s.type === 'human' && s.memberId === memberId,
    );
    if (!seat || (deviceId && !hasControlLease(seat, deviceId))) return;

    markSeatDisconnected(seat);

    // 检查是否全真人离线
    const allHumansOffline = room.summary.seats.every(
      (s) => s.type !== 'human' || !s.connected,
    );

    if (allHumansOffline && room.summary.status === 'playing') {
      room.summary.isPaused = true;
      if (room.turnTimeoutTimer) {
        clearTimeout(room.turnTimeoutTimer);
        room.turnTimeoutTimer = null;
      }
    }

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    this.broadcastViews(room);
  }

  handleReconnect(roomId: string, memberId: string, deviceId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const seat = room.summary.seats.find(
      (s): s is HumanSeat => s.type === 'human' && s.memberId === memberId,
    );
    if (!seat || !hasControlLease(seat, deviceId)) return;

    markSeatConnected(seat, deviceId);
    seat.isAutoplay = false;

    // 如果房间处于全员离线暂停状态，任意真人重连后恢复对局
    if (room.summary.isPaused && room.summary.status === 'playing') {
      room.summary.isPaused = false;
      this.scheduleNextTurn(room);
    }

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    this.broadcastViews(room);
  }

  takeoverControl(roomId: string, memberId: string, deviceId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const seat = room.summary.seats.find(
      (s): s is HumanSeat => s.type === 'human' && s.memberId === memberId,
    );
    if (!seat) return false;

    const { changed, previousDeviceId } = takeoverSeatControl(seat, deviceId);
    if (changed && previousDeviceId) {
      this.broadcastMessage(room, {
        type: 'lease_lost',
        roomId,
        memberId,
        newDeviceId: deviceId,
      });
    }

    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
    this.broadcastRoom(room);
    this.broadcastViews(room);
    return true;
  }

  getPlayerView(roomId: string, viewerSeat: number, viewerDeviceId?: string): PlayerViewSnapshot | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.match) return null;
    return createPlayerView(
      roomId,
      room.summary.currentMatchId ?? '',
      viewerSeat,
      room.summary.revision,
      room.match,
      room.summary,
      room.serverDeadline,
      viewerDeviceId,
    );
  }

  getSpectatorView(roomId: string): PlayerViewSnapshot | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.match) return null;
    return createPlayerView(
      roomId,
      room.summary.currentMatchId ?? '',
      0,
      room.summary.revision,
      room.match,
      room.summary,
      room.serverDeadline,
      undefined,
      true,
    );
  }

  subscribe(roomId: string, listener: (msg: ServerMessage) => void): () => void {
    const room = this.rooms.get(roomId);
    if (!room) return () => {};
    room.subscribers.add(listener);
    return () => {
      room.subscribers.delete(listener);
    };
  }

  private refreshCounts(summary: RoomSummary): void {
    summary.playerCount = summary.seats.filter((s) => s.type !== 'empty').length;
    summary.humanCount = summary.seats.filter((s) => s.type === 'human').length;
    if (summary.cup && summary.cup.completedMatches === 0 && summary.status === 'waiting') {
      const participants = extractHumanParticipants(summary.seats);
      summary.cup = {
        ...summary.cup,
        participants,
        standings: computeCupStandings(participants, []),
        updatedAt: Date.now(),
      };
    }
  }

  private broadcastRoom(room: RoomInstance): void {
    for (const sub of room.subscribers) {
      try {
        sub({ type: 'room_update', room: room.summary });
      } catch {
        // ignore
      }
    }
  }

  private broadcastViews(room: RoomInstance): void {
    if (!room.match) return;
    for (let seat = 0; seat < 4; seat++) {
      const view = this.getPlayerView(room.summary.id, seat);
      if (view) {
        for (const sub of room.subscribers) {
          try {
            sub({ type: 'match_update', view });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  private broadcastMessage(room: RoomInstance, msg: ServerMessage): void {
    for (const sub of room.subscribers) {
      try {
        sub(msg);
      } catch {
        // ignore
      }
    }
  }

  private scheduleNextTurn(room: RoomInstance): void {
    if (!room.match || room.match.status !== 'playing') return;
    if (room.summary.isPaused) return;

    if (room.turnTimeoutTimer) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }

    const isAutoSeat = (seat: number) => {
      const s = room.summary.seats[seat];
      if (!s) return false;
      if (s.type === 'ai') return true;
      if (s.type === 'human') {
        const trigger = shouldTriggerAutoplay(s);
        if (trigger && !s.isAutoplay) {
          s.isAutoplay = true;
        }
        return trigger;
      }
      return false;
    };

    // 循环推进所有 AI 或已超 60 秒托管的席位
    let autoEvent = nextServerAiEvent(room.match, isAutoSeat);
    while (autoEvent && room.match.status === 'playing' && !room.summary.isPaused) {
      const step = applyEvent(room.match, autoEvent);
      if (!step) break;
      room.match = step.match;
      room.summary.revision++;
      room.summary.updatedAt = Date.now();
      saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
      if (room.match.status === 'matchEnd') {
        this.settleMatchEnd(room);
        return;
      }
      autoEvent = nextServerAiEvent(room.match, isAutoSeat);
    }

    if (room.match.status !== 'playing' || room.summary.isPaused) return;

    // 当前轮到真人手牌或真人鸣牌决策
    const deadline = Date.now() + room.summary.settings.turnTimeLimitSeconds * 1000;
    room.serverDeadline = deadline;
    saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);

    // 设定倒计时定时器：如果到期未操作且离线，触发默认摸切/过牌
    room.turnTimeoutTimer = setTimeout(() => {
      this.handleTurnTimeout(room.summary.id);
    }, room.summary.settings.turnTimeLimitSeconds * 1000);
  }

  private handleTurnTimeout(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.match || room.match.status !== 'playing' || room.summary.isPaused) return;

    const round = room.match.round;
    if (round.phase === 'discard') {
      const currentSeat = round.currentPlayer;
      const seat = room.summary.seats[currentSeat];
      if (seat.type === 'human') {
        const turnOpts = round.turnOptions;
        if (turnOpts && turnOpts.discardable.length > 0) {
          const tile = turnOpts.discardable[turnOpts.discardable.length - 1];
          const step = applyEvent(room.match, { type: 'discard', seat: currentSeat, tile });
          if (step) {
            room.match = step.match;
            room.summary.revision++;
            room.summary.updatedAt = Date.now();
            saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
            this.scheduleNextTurn(room);
            this.broadcastViews(room);
          }
        }
      }
    } else if (round.phase === 'claim' && round.claim) {
      for (let s = 0; s < 4; s++) {
        if (round.claim.options[s] !== null && round.claim.responses[s] === null) {
          const seat = room.summary.seats[s];
          if (seat.type === 'human') {
            const step = applyEvent(room.match, {
              type: 'claim',
              seat: s,
              response: { type: 'pass' },
            });
            if (step) {
              room.match = step.match;
              room.summary.revision++;
              room.summary.updatedAt = Date.now();
            }
          }
        }
      }
      saveRoomState(this.db, room.summary, room.match, room.serverDeadline, room.summary.isPaused);
      this.scheduleNextTurn(room);
      this.broadcastViews(room);
    }
  }

  private settleMatchEnd(room: RoomInstance): void {
    if (!room.match || !room.match.matchEnd) return;
    const match = room.match;
    const matchEnd = room.match.matchEnd;
    const ranking = room.match.matchEnd.ranking;
    const matchId = room.summary.currentMatchId ?? createUuid();
    const matchLength = room.summary.settings.matchLength;

    const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(Date.now());
    let hasMoreCupMatches = false;
    transaction(this.db, () => {
      for (const seat of room.summary.seats) {
        if (seat.type !== 'human') continue;
        if (this.db.prepare('SELECT 1 FROM family_results WHERE member_id = ? AND match_id = ?').get(seat.memberId, matchId)) continue;
        const placement = ranking.indexOf(seat.seatIndex) + 1;
        const commands = this.db.prepare('SELECT command_json FROM room_commands WHERE room_id = ? AND member_id = ?')
          .all(room.summary.id, seat.memberId) as Array<{ command_json: string }>;
        const played = commands.some((row) => ['discard', 'riichi', 'tsumo', 'ron', 'pass', 'claim'].includes(JSON.parse(row.command_json).type));
        const previous = this.db.prepare('SELECT COALESCE(SUM(coins), 0) AS coins FROM family_results WHERE member_id = ? AND date_key = ?')
          .get(seat.memberId, dateKey) as { coins: number };
        const coins = room.summary.humanCount >= 2 && played
          ? Math.min(getRiichiMatchCoins(placement, matchLength), Math.max(0, 200 - previous.coins)) : 0;
        const memberRow = getMember(this.db, seat.memberId);
        if (memberRow && room.summary.humanCount >= 2 && played) {
          const snapshot = readSnapshot(memberRow);
          const updated = runSnapshotMutation(snapshot, () => {
            if (coins) addCoins(coins, 'wallet.reason.familyMatch', Date.now(), `family:${matchId}`);
            recordCharacterMatchFinish({ matchId: `family:${matchId}`, characterId: snapshot.characters.activeCharacterId,
              opponents: room.summary.seats.flatMap((other) => other.type === 'ai' ? [other.characterId] : []),
              ranking: ranking.map((index) => (index - seat.seatIndex + 4) % 4) });
          });
          saveSnapshot(this.db, memberRow, updated.snapshot);
        }
        this.db.prepare('INSERT INTO family_results(member_id, match_id, room_id, placement, score, coins, date_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(seat.memberId, matchId, room.summary.id, placement, room.match!.matchEnd!.finalScores[seat.seatIndex], coins, dateKey, Date.now());
      }

      // 归档整场终局牌谱供参赛成员回放（总纲 4.5 & P15）
      const replayFile = toReplayFile(match);
      const replayJson = JSON.stringify(replayFile);
      for (const seat of room.summary.seats) {
        if (seat.type === 'human') {
          const placement = ranking.indexOf(seat.seatIndex) + 1;
          const finalScore = matchEnd.finalScores[seat.seatIndex] ?? 25000;
          archiveReplay(this.db, seat.memberId, {
            matchId,
            source: 'family',
            roomId: room.summary.id,
            viewerSeat: seat.seatIndex,
            playerCharacterId: (match.seatCharacters[seat.seatIndex] as string) ?? 'koharu',
            ranking: placement,
            finalScore,
            matchLength,
            replayJson,
          });
        }
      }

      if (room.summary.cup) {
        const cupRecorded = recordFamilyCupMatch(
          this.db,
          room.summary.cup.cupId,
          matchId,
          matchEnd.finalScores,
        );
        room.summary.cup = cupRecorded.cup;
        hasMoreCupMatches = room.summary.cup.status === 'between_matches';
      }

      if (!hasMoreCupMatches) {
        deleteRoomState(this.db, room.summary.id);
      }
    });

    if (hasMoreCupMatches) {
      room.summary.status = 'waiting';
      room.summary.isPaused = false;
      room.serverDeadline = null;
      for (const seat of room.summary.seats) {
        if (seat.type === 'human') {
          seat.isReady = true;
          seat.isAutoplay = false;
        }
      }
      room.summary.revision++;
      room.summary.updatedAt = Date.now();
      saveRoomState(this.db, room.summary, null, null, false);
    } else {
      room.summary.status = 'finished';
      room.summary.revision++;
      room.summary.updatedAt = Date.now();
      deleteRoomState(this.db, room.summary.id);
    }
    this.broadcastRoom(room);
  }

  private restoreFromDb(): void {
    const recovered = loadActiveRooms(this.db);
    for (const data of recovered) {
      // 恢复时标记真人连接为断开（因为进程刚重启，连接未建立）
      for (const s of data.summary.seats) {
        if (s.type === 'human') {
          s.connected = false;
          s.disconnectedAt = Date.now();
        }
      }

      if (data.summary.cup?.cupId) {
        const persistedCup = getFamilyCup(this.db, data.summary.cup.cupId);
        if (persistedCup) data.summary.cup = persistedCup;
      }

      // 重启恢复的未完房间默认暂停，等待真人上线
      const isPaused = data.summary.status === 'playing' ? true : data.isPaused;
      data.summary.isPaused = isPaused;

      const instance: RoomInstance = {
        summary: data.summary,
        match: data.match,
        executedCommandIds: new Set(),
        turnTimeoutTimer: null,
        serverDeadline: data.serverDeadline,
        subscribers: new Set(),
      };

      this.rooms.set(data.summary.id, instance);
      if (instance.match?.status === 'matchEnd') this.settleMatchEnd(instance);
    }
  }
}
