import type { DatabaseSync } from 'node:sqlite';
import { createUuid } from '@/lib/uuid';
import type {
  AiSeat,
  HumanSeat,
  PlayerViewSnapshot,
  RoomCommand,
  RoomSeat,
  RoomSettings,
  RoomSummary,
} from '../../../shared/contracts/room';
import {
  applyEvent,
  createMatch,
  nextServerAiEvent,
} from '../riichi/runtime';
import type {
  RiichiEvent,
  RiichiMatchState,
} from '@/pages/mahjong/japanese/engine/match';
import { recordRiichiMatchFinish } from '@/lib/riichiProgress';
import { getMember, readSnapshot, saveSnapshot } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';
import { createPlayerView } from './projectView';

export interface RoomInstance {
  summary: RoomSummary;
  match: RiichiMatchState | null;
  executedCommandIds: Set<string>;
  turnTimeoutTimer: NodeJS.Timeout | null;
  serverDeadline: number | null;
  subscribers: Set<(msg: any) => void>;
}

const DEFAULT_SETTINGS: RoomSettings = {
  matchLength: 'east',
  defaultAiLevel: 'standard',
  turnTimeLimitSeconds: 15,
};

const AI_POOL = ['aoi', 'mio', 'rin', 'sora', 'koharu', 'chitose', 'kuro', 'shiro'];

export class RoomManager {
  private rooms = new Map<string, RoomInstance>();

  constructor(private db: DatabaseSync) {}

  createRoom(
    hostMemberId: string,
    hostNickname: string,
    avatarPresetId: string,
    deviceId: string,
    settings: Partial<RoomSettings> = {},
  ): RoomSummary {
    const roomId = createUuid();
    const fullSettings: RoomSettings = { ...DEFAULT_SETTINGS, ...settings };

    const initialSeats: [RoomSeat, RoomSeat, RoomSeat, RoomSeat] = [
      {
        type: 'human',
        seatIndex: 0,
        memberId: hostMemberId,
        nickname: hostNickname,
        avatarPresetId,
        deviceId,
        isReady: true, // 房主默认就绪
        connected: true,
      },
      { type: 'empty', seatIndex: 1 },
      { type: 'empty', seatIndex: 2 },
      { type: 'empty', seatIndex: 3 },
    ];

    const summary: RoomSummary = {
      id: roomId,
      hostMemberId,
      hostNickname,
      status: 'waiting',
      settings: fullSettings,
      playerCount: 1,
      humanCount: 1,
      seats: initialSeats,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
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
    return summary;
  }

  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .map((r) => r.summary)
      .sort((a, b) => b.createdAt - a.createdAt);
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
    if (seatIndex < 0 || seatIndex > 3) throw new Error('INVALID_SEAT_INDEX');

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
      isReady: memberId === room.summary.hostMemberId,
      connected: true,
    };

    room.summary.seats[seatIndex] = newSeat;
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    this.broadcastRoom(room);
    return room.summary;
  }

  leaveSeat(roomId: string, memberId: string): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_IN_PROGRESS');

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
        return room.summary;
      }
    }

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
    if (seatIndex < 0 || seatIndex > 3) throw new Error('INVALID_SEAT_INDEX');

    const currentSeat = room.summary.seats[seatIndex];
    if (currentSeat.type === 'human') throw new Error('SEAT_OCCUPIED_BY_HUMAN');

    const chosenChar =
      characterId ??
      AI_POOL[seatIndex % AI_POOL.length] ??
      'aoi';
    const chosenLevel = aiLevel ?? room.summary.settings.defaultAiLevel;

    const aiSeat: AiSeat = {
      type: 'ai',
      seatIndex,
      characterId: chosenChar,
      aiLevel: chosenLevel,
    };

    room.summary.seats[seatIndex] = aiSeat;
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

    this.broadcastRoom(room);
    return room.summary;
  }

  removeAiSeat(roomId: string, seatIndex: number): RoomSummary {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.status !== 'waiting') throw new Error('GAME_ALREADY_STARTED');

    const s = room.summary.seats[seatIndex];
    if (s.type !== 'ai') throw new Error('NOT_AN_AI_SEAT');

    room.summary.seats[seatIndex] = { type: 'empty', seatIndex };
    this.refreshCounts(room.summary);
    room.summary.revision++;
    room.summary.updatedAt = Date.now();

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

    this.broadcastRoom(room);
    return room.summary;
  }

  startGame(roomId: string, memberId: string): { room: RoomSummary; match: RiichiMatchState } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.summary.hostMemberId !== memberId) throw new Error('ONLY_HOST_CAN_START');
    if (room.summary.status !== 'waiting') throw new Error('ALREADY_PLAYING');

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

    // 检查真人是否全部就绪
    const unready = room.summary.seats.find((s) => s.type === 'human' && !s.isReady);
    if (unready) throw new Error('PLAYERS_NOT_READY');

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
      any,
      any,
      any,
      any,
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

    // 幂等防重检查
    if (room.executedCommandIds.has(command.commandId)) {
      return { accepted: true, revision: room.summary.revision };
    }

    // 校验执行者在哪个座位
    const seatIndex = room.summary.seats.findIndex(
      (s): s is HumanSeat => s.type === 'human' && s.memberId === memberId && s.deviceId === deviceId,
    );
    if (seatIndex === -1) {
      return { accepted: false, code: 'UNAUTHORIZED_OR_NOT_IN_SEAT', revision: room.summary.revision };
    }

    // 构造 RiichiEvent
    let riichiEvent: RiichiEvent | null = null;
    const payload = command.payload as any;

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

    // 检查是否终局结算
    if (room.match.status === 'matchEnd') {
      this.settleMatchEnd(room);
    } else {
      this.scheduleNextTurn(room);
    }

    this.broadcastViews(room);
    return { accepted: true, revision: room.summary.revision };
  }

  getPlayerView(roomId: string, viewerSeat: number): PlayerViewSnapshot | null {
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
    );
  }

  subscribe(roomId: string, listener: (msg: any) => void): () => void {
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

  private scheduleNextTurn(room: RoomInstance): void {
    if (!room.match || room.match.status !== 'playing') return;

    if (room.turnTimeoutTimer) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }

    const isAiSeat = (seat: number) => room.summary.seats[seat]?.type === 'ai';

    let autoEvent = nextServerAiEvent(room.match, isAiSeat);
    while (autoEvent && room.match.status === 'playing') {
      const step = applyEvent(room.match, autoEvent);
      if (!step) break;
      room.match = step.match;
      room.summary.revision++;
      room.summary.updatedAt = Date.now();
      if (room.match.status === 'matchEnd') {
        this.settleMatchEnd(room);
        return;
      }
      autoEvent = nextServerAiEvent(room.match, isAiSeat);
    }

    if (room.match.status !== 'playing') return;

    // 轮到真人时，设定超时截止时间
    const deadline = Date.now() + room.summary.settings.turnTimeLimitSeconds * 1000;
    room.serverDeadline = deadline;
  }

  private settleMatchEnd(room: RoomInstance): void {
    if (!room.match || !room.match.matchEnd) return;
    const ranking = room.match.matchEnd.ranking;
    const matchId = room.summary.currentMatchId ?? createUuid();
    const matchLength = room.summary.settings.matchLength;

    // 仅在至少 2 名真人参与对局时，按规则发放家庭基础雀币（4.5 契约）
    if (room.summary.humanCount >= 2) {
      for (const seat of room.summary.seats) {
        if (seat.type === 'human') {
          const placement = ranking.indexOf(seat.seatIndex) + 1;

          try {
            const memberRow = getMember(this.db, seat.memberId);
            if (memberRow) {
              const currentSnapshot = readSnapshot(memberRow);
              const updated = runSnapshotMutation(currentSnapshot, () => {
                recordRiichiMatchFinish(placement, matchLength, matchId);
              });
              saveSnapshot(this.db, memberRow, updated.snapshot);
            }
          } catch {
            // ignore per member settlement issue
          }
        }
      }
    }

    room.summary.status = 'finished';
    room.summary.revision++;
    room.summary.updatedAt = Date.now();
    this.broadcastRoom(room);
  }
}
