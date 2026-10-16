import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type { RoomCommand, RoomSettings } from '../../../shared/contracts/room';
import type { RiichiAiLevel } from '@/pages/mahjong/japanese/engine/rules';
import { apiError, requireSession } from '../auth';
import type { RoomManager } from '../rooms/RoomManager';

interface CreateRoomBody {
  nickname?: string;
  avatarPresetId?: string;
  settings?: Partial<RoomSettings>;
}

interface JoinSeatBody {
  seatIndex?: number;
  nickname?: string;
  avatarPresetId?: string;
}

interface FillAiBody {
  seatIndex?: number;
  characterId?: string;
  aiLevel?: RiichiAiLevel;
}

interface ReadyBody {
  isReady?: boolean;
}

export function registerRoomRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  roomManager: RoomManager,
): void {
  // 列出当前所有房间
  app.get('/api/v1/rooms', async (request) => {
    requireSession(db, request);
    return roomManager.listRooms();
  });

  // 创建房间
  app.post('/api/v1/rooms', async (request) => {
    const { member, session } = requireSession(db, request);
    const body = (request.body ?? {}) as CreateRoomBody;
    const settings = body.settings ?? {};

    try {
      const summary = roomManager.createRoom(
      member.id,
      body.nickname ?? 'Host',
      body.avatarPresetId ?? 'default-1',
      session.device_id,
      settings,
    );
      return summary;
    } catch { throw apiError(400, 'BAD_REQUEST'); }
  });

  // 列出最近家庭杯赛记录
  app.get('/api/v1/rooms/cups', async (request) => {
    requireSession(db, request);
    const query = (request.query ?? {}) as { limit?: string };
    const limit = query.limit ? Number(query.limit) : 10;
    return roomManager.listCups(Number.isFinite(limit) && limit > 0 ? limit : 10);
  });

  // 获取单个杯赛记录
  app.get('/api/v1/rooms/cups/:cupId', async (request) => {
    requireSession(db, request);
    const { cupId } = request.params as { cupId: string };
    const cup = roomManager.getCup(cupId);
    if (!cup) throw apiError(404, 'CUP_NOT_FOUND');
    return cup;
  });

  // 获取房间详情
  app.get('/api/v1/rooms/:roomId', async (request) => {
    requireSession(db, request);
    const { roomId } = request.params as { roomId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) throw apiError(404, 'ROOM_NOT_FOUND');
    return room;
  });

  // 加入指定席位
  app.post('/api/v1/rooms/:roomId/join', async (request) => {
    const { member, session } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };
    const body = (request.body ?? {}) as JoinSeatBody;

    if (typeof body.seatIndex !== 'number') {
      throw apiError(400, 'BAD_REQUEST');
    }

    try {
      return roomManager.joinSeat(
        roomId,
        body.seatIndex,
        member.id,
        body.nickname ?? 'Player',
        body.avatarPresetId ?? 'default-1',
        session.device_id,
      );
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'JOIN_FAILED';
      throw apiError(400, code);
    }
  });

  // 离开席位
  app.post('/api/v1/rooms/:roomId/leave', async (request) => {
    const { member } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };

    try {
      return roomManager.leaveSeat(roomId, member.id);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'LEAVE_FAILED';
      throw apiError(400, code);
    }
  });

  // 填充 AI 席位
  app.post('/api/v1/rooms/:roomId/ai', async (request) => {
    const { member } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };
    if (roomManager.getRoom(roomId)?.hostMemberId !== member.id)
      throw apiError(403, 'ONLY_HOST_CAN_START');
    const body = (request.body ?? {}) as FillAiBody;

    if (typeof body.seatIndex !== 'number') {
      throw apiError(400, 'BAD_REQUEST');
    }

    try {
      return roomManager.fillAiSeat(
        roomId,
        body.seatIndex,
        body.characterId,
        body.aiLevel,
      );
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'FILL_AI_FAILED';
      throw apiError(400, code);
    }
  });

  // 移除 AI 席位
  app.delete('/api/v1/rooms/:roomId/ai/:seatIndex', async (request) => {
    const { member } = requireSession(db, request);
    const { roomId, seatIndex } = request.params as { roomId: string; seatIndex: string };
    if (roomManager.getRoom(roomId)?.hostMemberId !== member.id)
      throw apiError(403, 'ONLY_HOST_CAN_START');

    try {
      return roomManager.removeAiSeat(roomId, Number(seatIndex));
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'REMOVE_AI_FAILED';
      throw apiError(400, code);
    }
  });

  // 准备/取消准备
  app.post('/api/v1/rooms/:roomId/ready', async (request) => {
    const { member } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };
    const body = (request.body ?? {}) as ReadyBody;

    try {
      return roomManager.setReady(roomId, member.id, Boolean(body.isReady));
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'READY_FAILED';
      throw apiError(400, code);
    }
  });

  // 开始对局（仅房主）
  app.post('/api/v1/rooms/:roomId/start', async (request) => {
    const { member } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };

    try {
      const result = roomManager.startGame(roomId, member.id);
      return result.room;
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'START_FAILED';
      throw apiError(400, code);
    }
  });

  // 获取本人的私有视角（根据当前 memberId 的座位过滤手牌）
  app.get('/api/v1/rooms/:roomId/view', async (request) => {
    const { member, session } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };

    const room = roomManager.getRoom(roomId);
    if (!room) throw apiError(404, 'ROOM_NOT_FOUND');

    const seatIndex = room.seats.findIndex((s) => s.type === 'human' && s.memberId === member.id);
    const view = seatIndex === -1
      ? roomManager.getSpectatorView(roomId)
      : roomManager.getPlayerView(roomId, seatIndex, session.device_id);
    if (!view) throw apiError(404, 'VIEW_NOT_AVAILABLE');
    return view;
  });

  // 提交对局操作命令
  app.post('/api/v1/rooms/:roomId/command', async (request) => {
    const { member, session } = requireSession(db, request);
    const { roomId } = request.params as { roomId: string };
    const command = request.body as RoomCommand;

    const result = roomManager.dispatchAction(roomId, member.id, session.device_id, command);
    if (!result.accepted) {
      throw apiError(['CONTROL_LEASE_LOST', 'ROOM_REVISION_CONFLICT', 'COMMAND_CONFLICT'].includes(result.code ?? '') ? 409 : 400, result.code ?? 'ACTION_REJECTED');
    }
    return result;
  });
}
