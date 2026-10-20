import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { FAMILY_GAME_IDS, type FamilyGameId, type GameRoomCommand, type GameRoomSettings } from '../../../shared/contracts/gameRoom';
import { apiError, requireSession } from '../auth';
import type { GameRoomManager } from '../gameRooms/GameRoomManager';
import { listHeadToHead } from '../gameRooms/settlement';

export function registerGameRoomRoutes(app: FastifyInstance, db: DatabaseSync, manager: GameRoomManager): void {
  app.get('/api/v1/game-rooms', async (request) => {
    requireSession(db, request);
    return manager.list();
  });
  app.post('/api/v1/game-rooms', async (request) => {
    const { member, session } = requireSession(db, request);
    const body = (request.body ?? {}) as { gameId?: FamilyGameId; settings?: Partial<GameRoomSettings> };
    if (!FAMILY_GAME_IDS.includes(body.gameId!)) throw apiError(400, 'BAD_REQUEST');
    return manager.create(body.gameId!, member.id, session.device_id, body.settings);
  });
  app.get('/api/v1/me/family-arcade', async (request) => {
    const { member } = requireSession(db, request);
    return listHeadToHead(db, member.id);
  });
  app.get('/api/v1/game-rooms/:roomId', async (request) => {
    const { member, session } = requireSession(db, request);
    const view = manager.view((request.params as { roomId: string }).roomId, member.id, session.device_id);
    if (!view) throw apiError(404, 'ROOM_NOT_FOUND');
    return view;
  });
  app.post('/api/v1/game-rooms/:roomId/command', async (request) => {
    const { member, session } = requireSession(db, request);
    return manager.command((request.params as { roomId: string }).roomId, member.id, session.device_id, request.body as GameRoomCommand);
  });
  app.post('/api/v1/game-rooms/:roomId/watch', async (request) => {
    const { member, session } = requireSession(db, request);
    const roomId = (request.params as { roomId: string }).roomId;
    const body = request.body as { active?: boolean } | null;
    if (typeof body?.active !== 'boolean') throw apiError(400, 'BAD_REQUEST');
    manager.watch(roomId, member.id, body.active);
    return manager.view(roomId, member.id, session.device_id);
  });
}
