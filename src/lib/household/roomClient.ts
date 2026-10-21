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
  reopenRoomForRematch,
} from './api';

export function useRoomClient(roomId?: string, memberId?: string) {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [view, setView] = useState<PlayerViewSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [leaseLost, setLeaseLost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isDestroyedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const summary = await getRoom(roomId);
      setRoom(summary);
      if (summary.status === 'playing' || summary.status === 'finished') {
        const pView = await getRoomPlayerView(roomId).catch(() => null);
        if (pView) setView(pView);
      } else setView(null);
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
              if (msg.room.status === 'waiting') setView(null);
            } else if (msg.type === 'match_update') {
              setView(msg.view);
            } else if (msg.type === 'ack') {
              if (msg.accepted) setError(null);
              else {
                setError(
                  msg.code === 'ROOM_REVISION_CONFLICT'
                    ? 'play.roomStateChanged'
                    : 'play.roomActionFailed',
                );
                if (msg.code === 'ROOM_REVISION_CONFLICT') void refresh();
              }
            } else if (msg.type === 'lease_lost') {
              setLeaseLost(true);
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
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
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
        expectedRevision: Math.max(
          room?.revision ?? 0,
          view?.matchId === room?.currentMatchId ? (view?.revision ?? 0) : 0,
        ),
        type,
        payload,
      };

      try {
        // 优先通过 WebSocket 发送
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({ type: 'command', command: cmd }),
          );
        } else {
          const ack = await sendRoomCommand(roomId, cmd);
          setError(
            ack.accepted
              ? null
              : ack.code === 'ROOM_REVISION_CONFLICT'
                ? 'play.roomStateChanged'
                : 'play.roomActionFailed',
          );
          await refresh();
        }
      } catch {
        setError('play.roomActionFailed');
      }
    },
    [
      roomId,
      room?.currentMatchId,
      room?.revision,
      view?.matchId,
      view?.revision,
      refresh,
    ],
  );

  const joinSeat = useCallback(
    async (seatIndex: number, nickname?: string, avatarPresetId?: string) => {
      if (!roomId) return;
      const updated = await joinRoomSeat(
        roomId,
        seatIndex,
        nickname,
        avatarPresetId,
      );
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
    async (
      seatIndex: number,
      characterId: string,
      aiLevel: string = 'standard',
    ) => {
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
  const rematch = useCallback(async () => {
    if (!roomId || !room) return;
    setError(null);
    try {
      const updated = await reopenRoomForRematch(roomId, room.revision);
      setRoom(updated);
      setView(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'BAD_REQUEST');
    }
  }, [roomId, room]);

  const discardTile = useCallback(
    (tile: number) => sendCommand('discard', { tile }),
    [sendCommand],
  );

  const declareRiichi = useCallback(
    (tile: number) => sendCommand('riichi', { tile }),
    [sendCommand],
  );

  const declareTsumo = useCallback(() => sendCommand('tsumo'), [sendCommand]);

  const declareRon = useCallback(() => sendCommand('ron'), [sendCommand]);

  const passClaim = useCallback(() => sendCommand('pass'), [sendCommand]);

  const declareClaim = useCallback(
    (claimType: 'chi' | 'pon' | 'minkan', tiles?: [number, number]) =>
      sendCommand('claim', { claimType, tiles }),
    [sendCommand],
  );

  const nextRound = useCallback(() => sendCommand('next_round'), [sendCommand]);

  const takeoverControl = useCallback(async () => {
    await sendCommand('takeover_control');
    setLeaseLost(false);
  }, [sendCommand]);

  const toggleAutoplay = useCallback(
    async (isAutoplay: boolean) => {
      await sendCommand('toggle_autoplay', { isAutoplay });
    },
    [sendCommand],
  );

  const resumeGame = useCallback(async () => {
    await sendCommand('resume_game');
  }, [sendCommand]);

  // 计算本人坐在第几号席位 (0..3)，未入座则为 -1
  const mySeatIndex =
    room && memberId
      ? room.seats.findIndex(
          (s) => s.type === 'human' && s.memberId === memberId,
        )
      : -1;

  const isHost = room && memberId ? room.hostMemberId === memberId : false;

  return {
    room,
    view,
    connected,
    leaseLost,
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
    rematch,
    discardTile,
    declareRiichi,
    declareTsumo,
    declareRon,
    passClaim,
    declareClaim,
    nextRound,
    takeoverControl,
    toggleAutoplay,
    resumeGame,
    sendCommand,
  };
}
