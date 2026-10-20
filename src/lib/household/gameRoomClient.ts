import type {
  FamilyGameId,
  FamilyHeadToHead,
  GameRoomAck,
  GameRoomCommand,
  GameRoomServerMessage,
  GameRoomSettings,
  GameRoomSummary,
  GameRoomView,
} from '../../../shared/contracts/gameRoom';
import { request } from './api';

export const listGameRooms = () =>
  request<GameRoomSummary[]>('/api/v1/game-rooms');
export const getGameRoom = (roomId: string) =>
  request<GameRoomView>(`/api/v1/game-rooms/${encodeURIComponent(roomId)}`);
export const createGameRoom = (
  gameId: FamilyGameId,
  settings?: Partial<GameRoomSettings>,
) =>
  request<GameRoomView>('/api/v1/game-rooms', {
    method: 'POST',
    body: JSON.stringify({ gameId, settings }),
  });
export const sendGameCommand = (command: GameRoomCommand) =>
  request<GameRoomAck>(
    `/api/v1/game-rooms/${encodeURIComponent(command.roomId)}/command`,
    {
      method: 'POST',
      body: JSON.stringify(command),
    },
  );
export const watchGameRoom = (roomId: string, active: boolean) =>
  request<GameRoomView>(
    `/api/v1/game-rooms/${encodeURIComponent(roomId)}/watch`,
    {
      method: 'POST',
      body: JSON.stringify({ active }),
    },
  );
export const getFamilyHeadToHead = () =>
  request<FamilyHeadToHead[]>('/api/v1/me/family-arcade');

export class GameRoomConnection {
  private socket: WebSocket | null = null;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private pending = new Map<string, (ack: GameRoomAck) => void>();
  constructor(
    private roomId: string,
    private onView: (view: GameRoomView) => void,
    private onConnection: (connected: boolean) => void,
  ) {
    queueMicrotask(() => this.connect());
  }

  private connect(): void {
    if (this.stopped) return;
    const url = new URL('/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.stopped) {
        socket.close();
        return;
      }
      this.retries = 0;
      this.onConnection(true);
      socket.send(
        JSON.stringify({ type: 'subscribe_game_room', roomId: this.roomId }),
      );
    };
    socket.onmessage = (event) => {
      if (this.stopped) return;
      try {
        const message = JSON.parse(event.data) as GameRoomServerMessage;
        if (message.type === 'game_room') this.onView(message.view);
        if (message.type === 'game_ack') {
          if (message.ack.view) this.onView(message.ack.view);
          this.pending.get(message.ack.commandId)?.(message.ack);
        }
      } catch {
        /* Ignore malformed transport frames; HTTP refresh remains available. */
      }
    };
    socket.onclose = (event) => {
      if (this.stopped) return;
      this.onConnection(false);
      if (event.code === 4401 || event.code === 4403) return;
      this.timer = setTimeout(
        () => this.connect(),
        Math.min(10_000, 500 * 2 ** this.retries++),
      );
    };
    socket.onerror = () => socket.close();
  }

  async command(command: GameRoomCommand): Promise<GameRoomAck> {
    if (this.socket?.readyState !== WebSocket.OPEN)
      return sendGameCommand(command);
    const ack = await new Promise<GameRoomAck | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.pending.delete(command.commandId);
        resolve(null);
      }, 4000);
      this.pending.set(command.commandId, (result) => {
        clearTimeout(timeout);
        this.pending.delete(command.commandId);
        resolve(result);
      });
      this.socket!.send(JSON.stringify({ type: 'game_command', command }));
    });
    // Retry the exact same envelope: a lost ACK cannot execute an action twice.
    return ack ?? sendGameCommand(command);
  }

  close(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close();
  }
}
