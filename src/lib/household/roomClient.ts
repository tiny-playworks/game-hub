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

export interface RoomPresentationBaseline {
  version: number;
  matchId: string;
  epoch: string;
  cursor: number;
}

export function useRoomClient(roomId?: string, memberId?: string) {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [view, setView] = useState<PlayerViewSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [leaseLost, setLeaseLost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandPending, setCommandPending] = useState(false);
  const [presentationBaseline, setPresentationBaseline] = useState<RoomPresentationBaseline | null>(null);
  const viewRef = useRef<PlayerViewSnapshot | null>(null);
  const scope = `${roomId ?? ''}:${memberId ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const viewScope = useRef('');
  const connectionScope = useRef('');
  const pendingRef = useRef<{
    id: string;
    timer: ReturnType<typeof setTimeout>;
    resolve: (accepted: boolean) => void;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isDestroyedRef = useRef(false);

  const finishPending = useCallback((id: string, accepted: boolean) => {
    const pending = pendingRef.current;
    if (!pending || pending.id !== id) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setCommandPending(false);
    pending.resolve(accepted);
  }, []);

  const receiveView = useCallback((next: PlayerViewSnapshot, baseline = false) => {
    if (next.roomId !== roomId || scopeRef.current !== scope) return;
    if (viewRef.current?.roomId === next.roomId && viewRef.current.revision > next.revision) return;
    viewRef.current = next;
    viewScope.current = scope;
    setView(next);
    setLeaseLost(!next.isSpectator && !next.seats[next.viewerSeat].hasControlLease);
    if (baseline) setPresentationBaseline((previous) => next.presentation ? {
      version: (previous?.version ?? 0) + 1,
      matchId: next.matchId,
      epoch: next.presentation.epoch,
      cursor: next.presentation.cursor,
    } : null);
  }, [roomId, scope]);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const summary = await getRoom(roomId);
      if (isDestroyedRef.current || scopeRef.current !== scope) return;
      setRoom((previous) => previous?.id === summary.id && previous.revision > summary.revision ? previous : summary);
      if (summary.status === 'playing' || summary.status === 'finished') {
        const pView = await getRoomPlayerView(roomId).catch(() => null);
        if (pView && !isDestroyedRef.current && scopeRef.current === scope) receiveView(pView, !viewRef.current);
      } else if (!viewRef.current || summary.revision >= viewRef.current.revision) {
        viewRef.current = null;
        setView(null);
      }
    } catch (err: unknown) {
      if (!isDestroyedRef.current && scopeRef.current === scope && err instanceof Error) setError(err.message);
    }
  }, [roomId, scope, receiveView]);

  useEffect(() => {
    if (!roomId) return;
    isDestroyedRef.current = false;
    viewRef.current = null;
    setView(null);
    setRoom(null);
    setConnected(false);
    setCommandPending(false);
    setLeaseLost(false);
    setError(null);

    let ws: WebSocket | null = null;

    function connect() {
      if (isDestroyedRef.current || scopeRef.current !== scope) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;

      try {
        let firstSnapshot = true;
        ws = new WebSocket(url);
        socketRef.current = ws;
        const activeSocket = ws;

        ws.onopen = () => {
          if (isDestroyedRef.current || socketRef.current !== activeSocket || scopeRef.current !== scope) {
            activeSocket.close();
            return;
          }
          connectionScope.current = scope;
          setConnected(true);
          setError(null);
          // 订阅房间
          activeSocket.send(JSON.stringify({ type: 'subscribe_room', roomId }));
        };

        ws.onmessage = (event) => {
          if (isDestroyedRef.current || socketRef.current !== activeSocket || scopeRef.current !== scope) return;
          try {
            const msg = JSON.parse(event.data) as ServerMessage;
            if (msg.type === 'room_update') {
              setRoom((previous) => previous?.id === msg.room.id && previous.revision > msg.room.revision ? previous : msg.room);
              if (msg.room.status === 'waiting' && (!viewRef.current || msg.room.revision >= viewRef.current.revision)) {
                viewRef.current = null;
                setView(null);
              }
            } else if (msg.type === 'match_update') {
              receiveView(msg.view, firstSnapshot);
              firstSnapshot = false;
            } else if (msg.type === 'ack') {
              if (pendingRef.current?.id !== msg.commandId) return;
              finishPending(msg.commandId, msg.accepted);
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
              if (pendingRef.current) finishPending(pendingRef.current.id, false);
            } else if (msg.type === 'error') {
              setError(msg.code);
              if (pendingRef.current) finishPending(pendingRef.current.id, false);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (isDestroyedRef.current || socketRef.current !== activeSocket) return;
          setConnected(false);
          socketRef.current = null;
          if (pendingRef.current) finishPending(pendingRef.current.id, false);
          if (!isDestroyedRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          activeSocket.close();
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
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current = null;
        pending.resolve(false);
      }
    };
  }, [roomId, refresh, receiveView, finishPending]);

  const sendCommand = useCallback(
    async (type: RoomCommandType, payload?: unknown) => {
      if (!roomId) throw new Error('NO_ROOM');
      if (scopeRef.current !== scope || (viewRef.current && viewScope.current !== scope)) return false;
      if (pendingRef.current) return false;
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

      setError(null);
      setCommandPending(true);
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (pendingRef.current?.id !== cmd.commandId) return;
          setError('play.roomActionFailed');
          finishPending(cmd.commandId, false);
          void refresh();
        }, 8000);
        pendingRef.current = { id: cmd.commandId, timer, resolve };
        const send = async () => {
          try {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            } else {
              const ack = await sendRoomCommand(roomId, cmd);
              if (pendingRef.current?.id !== cmd.commandId) return;
              setError(ack.accepted ? null : ack.code === 'ROOM_REVISION_CONFLICT'
                ? 'play.roomStateChanged' : 'play.roomActionFailed');
              await refresh();
              finishPending(cmd.commandId, ack.accepted);
            }
          } catch {
            if (pendingRef.current?.id !== cmd.commandId) return;
            setError('play.roomActionFailed');
            finishPending(cmd.commandId, false);
          }
        };
        void send();
      });
    },
    [
      roomId,
      scope,
      room?.currentMatchId,
      room?.revision,
      view?.matchId,
      view?.revision,
      refresh,
      finishPending,
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
  const declareAnkan = useCallback((tiles: number[]) => sendCommand('ankan', { tiles }), [sendCommand]);
  const declareKakan = useCallback((meldIndex: number, tile: number) => sendCommand('kakan', { meldIndex, tile }), [sendCommand]);
  const declareKyuushu = useCallback(() => sendCommand('kyuushu'), [sendCommand]);

  const declareRon = useCallback(() => sendCommand('ron'), [sendCommand]);

  const passClaim = useCallback(() => sendCommand('pass'), [sendCommand]);

  const declareClaim = useCallback(
    (claimType: 'chi' | 'pon' | 'minkan', tiles?: [number, number]) =>
      sendCommand('claim', { claimType, tiles }),
    [sendCommand],
  );

  const nextRound = useCallback(() => sendCommand('next_round'), [sendCommand]);

  const takeoverControl = useCallback(async () => {
    if (await sendCommand('takeover_control')) setLeaseLost(false);
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
    view: viewScope.current === scope ? view : null,
    connected: connected && connectionScope.current === scope,
    leaseLost,
    error,
    commandPending,
    presentationBaseline,
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
    declareAnkan,
    declareKakan,
    declareKyuushu,
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
