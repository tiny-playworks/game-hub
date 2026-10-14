import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PlayerViewSnapshot,
  RoomCommand,
  RoomCommandType,
  RoomSummary,
  ServerMessage,
} from '../../../shared/contracts/room';
import { createUuid } from '@/lib/uuid';
import {
  fillRoomAi,
  getRoom,
  getRoomPlayerView,
  joinRoomSeat,
  leaveRoomSeat,
  removeRoomAi,
  sendRoomCommand,
  setRoomReady,
  startRoomGame,
} from './api';

export function useRoomClient(roomId?: string, memberId?: string) {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [view, setView] = useState<PlayerViewSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const summary = await getRoom(roomId);
      setRoom(summary);
      if (summary.status === 'playing') {
        const pView = await getRoomPlayerView(roomId).catch(() => null);
        if (pView) setView(pView);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    isDestroyedRef.current = false;

    let ws: WebSocket | null = null;

    function connect() {
      if (isDestroyedRef.current) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isDestroyedRef.current) {
            ws?.close();
            return;
          }
          setConnected(true);
          setError(null);
          // 订阅房间
          ws?.send(JSON.stringify({ type: 'subscribe_room', roomId }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as ServerMessage;
            if (msg.type === 'room_update') {
              setRoom(msg.room);
            } else if (msg.type === 'match_update') {
              setView(msg.view);
            } else if (msg.type === 'error') {
              setError(msg.code);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setConnected(false);
          socketRef.current = null;
          if (!isDestroyedRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isDestroyedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    }

    refresh();
    connect();

    return () => {
      isDestroyedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [roomId, refresh]);

  const sendCommand = useCallback(
    async (type: RoomCommandType, payload?: unknown) => {
      if (!roomId) throw new Error('NO_ROOM');
      const cmd: RoomCommand = {
        protocol: 1,
        commandId: createUuid(),
        roomId,
        matchId: room?.currentMatchId,
        expectedRevision: room?.revision ?? 0,
        type,
        payload,
      };

      // 优先通过 WebSocket 发送
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
      } else {
        // HTTP 降级备份通道
        await sendRoomCommand(roomId, cmd);
      }
    },
    [roomId, room?.currentMatchId, room?.revision],
  );

  const joinSeat = useCallback(
    async (seatIndex: number, nickname?: string, avatarPresetId?: string) => {
      if (!roomId) return;
      const updated = await joinRoomSeat(roomId, seatIndex, nickname, avatarPresetId);
      setRoom(updated);
    },
    [roomId],
  );

  const leaveSeat = useCallback(async () => {
    if (!roomId) return;
    const updated = await leaveRoomSeat(roomId);
    setRoom(updated);
  }, [roomId]);

  const fillAi = useCallback(
    async (seatIndex: number, characterId: string, aiLevel: string = 'standard') => {
      if (!roomId) return;
      const updated = await fillRoomAi(roomId, seatIndex, characterId, aiLevel);
      setRoom(updated);
    },
    [roomId],
  );

  const removeAi = useCallback(
    async (seatIndex: number) => {
      if (!roomId) return;
      const updated = await removeRoomAi(roomId, seatIndex);
      setRoom(updated);
    },
    [roomId],
  );

  const setReady = useCallback(
    async (isReady: boolean) => {
      if (!roomId) return;
      const updated = await setRoomReady(roomId, isReady);
      setRoom(updated);
    },
    [roomId],
  );

  const startGame = useCallback(async () => {
    if (!roomId) return;
    const updated = await startRoomGame(roomId);
    setRoom(updated);
    const pView = await getRoomPlayerView(roomId).catch(() => null);
    if (pView) setView(pView);
  }, [roomId]);

  const discardTile = useCallback(
    (tile: number) => sendCommand('discard', { tile }),
    [sendCommand],
  );

  const declareRiichi = useCallback(
    (tile: number) => sendCommand('riichi', { tile }),
    [sendCommand],
  );

  const declareTsumo = useCallback(
    () => sendCommand('tsumo'),
    [sendCommand],
  );

  const declareRon = useCallback(
    () => sendCommand('ron'),
    [sendCommand],
  );

  const passClaim = useCallback(
    () => sendCommand('pass'),
    [sendCommand],
  );

  const declareClaim = useCallback(
    (claimType: 'chi' | 'pon' | 'minkan', tiles?: [number, number]) =>
      sendCommand('claim', { claimType, tiles }),
    [sendCommand],
  );

  const nextRound = useCallback(
    () => sendCommand('next_round'),
    [sendCommand],
  );

  // 计算本人坐在第几号席位 (0..3)，未入座则为 -1
  const mySeatIndex =
    room && memberId
      ? room.seats.findIndex((s) => s.type === 'human' && s.memberId === memberId)
      : -1;

  const isHost = room && memberId ? room.hostMemberId === memberId : false;

  return {
    room,
    view,
    connected,
    error,
    mySeatIndex,
    isHost,
    refresh,
    joinSeat,
    leaveSeat,
    fillAi,
    removeAi,
    setReady,
    startGame,
    discardTile,
    declareRiichi,
    declareTsumo,
    declareRon,
    passClaim,
    declareClaim,
    nextRound,
    sendCommand,
  };
}
