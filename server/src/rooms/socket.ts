import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { WebSocket, WebSocketServer } from 'ws';
import type { RoomCommand, ServerMessage } from '../../../shared/contracts/room';
import { getMember, type MemberRow, type SessionRow } from '../db';
import { createHash } from 'node:crypto';
import type { RoomManager } from './RoomManager';

const COOKIE = 'gh_session';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const part = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE}=`));
  return part ? part.slice(COOKIE.length + 1) : null;
}

export function setupRoomWebSocket(
  httpServer: Server,
  db: DatabaseSync,
  roomManager: RoomManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const token = parseCookieToken(req.headers.cookie);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      ws.close(4401, 'UNAUTHORIZED');
      return;
    }

    const session = db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .get(tokenHash(token), Date.now()) as unknown as SessionRow | undefined;

    if (!session) {
      ws.close(4401, 'UNAUTHORIZED');
      return;
    }

    const member = getMember(db, session.member_id);
    if (!member) {
      ws.close(4401, 'UNAUTHORIZED');
      return;
    }

    let activeRoomId: string | null = null;
    let unsubscribe: (() => void) | null = null;

    const sendJson = (msg: ServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribe_room' && typeof message.roomId === 'string') {
          const targetRoomId = message.roomId;
          activeRoomId = targetRoomId;
          if (unsubscribe) unsubscribe();

          const room = roomManager.getRoom(targetRoomId);
          if (room) {
            sendJson({ type: 'room_update', room });
            const seatIndex = room.seats.findIndex(
              (s) => s.type === 'human' && s.memberId === member.id,
            );
            const viewerSeat = seatIndex !== -1 ? seatIndex : 0;
            const view = roomManager.getPlayerView(targetRoomId, viewerSeat);
            if (view) sendJson({ type: 'match_update', view });
          }

          unsubscribe = roomManager.subscribe(targetRoomId, (msg) => {
            if (msg.type === 'room_update') {
              sendJson(msg);
            } else if (msg.type === 'match_update') {
              // 关键安全机制：仅下发匹配当前用户座位的私有视角
              const seatIndex = roomManager
                .getRoom(targetRoomId)
                ?.seats.findIndex((s) => s.type === 'human' && s.memberId === member.id);
              const viewerSeat = seatIndex !== -1 && seatIndex !== undefined ? seatIndex : 0;
              if (msg.view.viewerSeat === viewerSeat) {
                sendJson(msg);
              }
            }
          });
        } else if (message.type === 'command' && message.command) {
          const command = message.command as RoomCommand;
          const result = roomManager.dispatchAction(
            command.roomId,
            member.id,
            session.device_id,
            command,
          );
          sendJson({
            type: 'ack',
            commandId: command.commandId,
            accepted: result.accepted,
            code: result.code,
            revision: result.revision,
          });
        }
      } catch (err: unknown) {
        sendJson({
          type: 'error',
          code: 'BAD_REQUEST',
          messageKey: 'household.error.BAD_REQUEST',
        });
      }
    });

    ws.on('close', () => {
      if (unsubscribe) unsubscribe();
    });
  });

  return wss;
}
