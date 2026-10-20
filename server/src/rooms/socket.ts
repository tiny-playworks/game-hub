import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  HumanSeat,
  PlayerSeatPrivateState,
  PlayerViewSnapshot,
  RoomCommand,
  ServerMessage,
} from '../../../shared/contracts/room';
import { getMember, type MemberRow, type SessionRow } from '../db';
import { createHash } from 'node:crypto';
import type { RoomManager } from './RoomManager';
import type { GameRoomManager } from '../gameRooms/GameRoomManager';
import { gameSocketSession } from '../gameRooms/socket';

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
  gameManager?: GameRoomManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 16384 });
  const connections = new Map<string, number>();

  wss.on('connection', (ws: WebSocket, req) => {
    try {
      if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) {
        ws.close(4403, 'ORIGIN_NOT_ALLOWED');
        return;
      }
    } catch { ws.close(4403, 'ORIGIN_NOT_ALLOWED'); return; }
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
    const games = gameManager ? gameSocketSession(ws, gameManager, member.id, session.device_id) : null;
    let unsubscribe: (() => void) | null = null;
    const releaseRoom = () => {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      if (!activeRoomId) return;
      const key = `${activeRoomId}:${member.id}:${session.device_id}`;
      const remaining = Math.max(0, (connections.get(key) ?? 1) - 1);
      if (remaining) connections.set(key, remaining);
      else {
        connections.delete(key);
        roomManager.handleDisconnect(activeRoomId, member.id, session.device_id);
      }
      activeRoomId = null;
    };

    const sendJson = (msg: ServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', (data) => {
      try {
        if (!db.prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now())) {
          ws.close(4401, 'UNAUTHORIZED');
          return;
        }
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribe_game_room' && typeof message.roomId === 'string' && games) {
          releaseRoom();
          games.subscribe(message.roomId);
        } else if (message.type === 'game_command' && message.command && games) {
          games.command(message.command);
        } else if (message.type === 'subscribe_room' && typeof message.roomId === 'string') {
          games?.release();
          const targetRoomId = message.roomId;
          releaseRoom();
          activeRoomId = targetRoomId;
          const key = `${targetRoomId}:${member.id}:${session.device_id}`;
          connections.set(key, (connections.get(key) ?? 0) + 1);

          roomManager.handleReconnect(targetRoomId, member.id, session.device_id);

          const room = roomManager.getRoom(targetRoomId);
          if (room) {
            sendJson({ type: 'room_update', room });
            const seatIndex = room.seats.findIndex(
              (s) => s.type === 'human' && s.memberId === member.id,
            );
            const view = seatIndex === -1
              ? roomManager.getSpectatorView(targetRoomId)
              : roomManager.getPlayerView(targetRoomId, seatIndex, session.device_id);
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
              const isSpectator = seatIndex === -1 || seatIndex === undefined;
              const viewerSeat = isSpectator ? 0 : seatIndex;
              if (msg.view.viewerSeat === viewerSeat) {
                if (isSpectator) {
                  const view = roomManager.getSpectatorView(targetRoomId);
                  if (view) sendJson({ type: 'match_update', view });
                  return;
                }
                // 如果当前设备不是 Lease 拥有者，turnOptions 和 claimOptions 置空
                const targetSeat = roomManager.getRoom(targetRoomId)?.seats[viewerSeat];
                const isLeaseOwner =
                  targetSeat?.type === 'human'
                    ? (targetSeat as HumanSeat).leaseDeviceId === session.device_id
                    : false;

                if (!isLeaseOwner && msg.view.seats[viewerSeat]) {
                  const sanitized = {
                    ...msg.view,
                    seats: msg.view.seats.map((s: PlayerSeatPrivateState, idx: number) =>
                      idx === viewerSeat
                        ? { ...s, turnOptions: null, claimOptions: null, hasControlLease: false }
                        : s,
                    ) as PlayerViewSnapshot['seats'],
                  };
                  sendJson({ type: 'match_update', view: sanitized });
                } else {
                  sendJson(msg);
                }
              }
            } else if (msg.type === 'lease_lost') {
              if (msg.memberId === member.id && msg.newDeviceId !== session.device_id) {
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
      releaseRoom();
    });
  });

  return wss;
}
