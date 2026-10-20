import { WebSocket } from 'ws';
import type {
  GameRoomCommand,
  GameRoomServerMessage,
} from '../../../shared/contracts/gameRoom';
import type { GameRoomManager } from './GameRoomManager';

/** Uses the existing /ws origin, session and cookie validation. Never broadcasts full states. */
export function gameSocketSession(
  ws: WebSocket,
  manager: GameRoomManager,
  memberId: string,
  deviceId: string,
  authorized: () => boolean,
) {
  let roomId: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let alive = true;
  const send = (message: GameRoomServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const heartbeat = setInterval(() => {
    if (!roomId) return;
    if (!authorized()) {
      ws.close(4401, 'UNAUTHORIZED');
      return;
    }
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    ws.ping();
  }, 15_000);
  heartbeat.unref();
  ws.on('pong', () => {
    alive = true;
  });
  const release = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (roomId) manager.connection(roomId, memberId, deviceId, false);
    roomId = null;
  };
  ws.once('close', () => {
    release();
    clearInterval(heartbeat);
  });
  return {
    release,
    subscribe(target: string) {
      release();
      if (!manager.view(target, memberId, deviceId)) {
        send({ type: 'game_error', code: 'ROOM_NOT_FOUND' });
        return;
      }
      roomId = target;
      manager.connection(target, memberId, deviceId, true);
      const publish = () => {
        if (!authorized()) {
          ws.close(4401, 'UNAUTHORIZED');
          return;
        }
        const view = manager.view(target, memberId, deviceId);
        if (view) send({ type: 'game_room', view });
      };
      unsubscribe = manager.subscribe(target, publish);
      publish();
    },
    command(command: GameRoomCommand) {
      if (!roomId || command?.roomId !== roomId) {
        send({ type: 'game_error', code: 'ROOM_NOT_FOUND' });
        return;
      }
      send({
        type: 'game_ack',
        ack: manager.command(roomId, memberId, deviceId, command),
      });
    },
  };
}
