import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GameRoomCommand,
  GameRoomView,
} from '../../shared/contracts/gameRoom';
import { HouseholdApiError } from '@/lib/household/api';
import {
  GameRoomConnection,
  getGameRoom,
  sendGameCommand,
} from '@/lib/household/gameRoomClient';
import { createUuid } from '@/lib/uuid';

export function useGameRoom(roomId: string, memberId?: string) {
  const [view, setView] = useState<GameRoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<GameRoomView | null>(null);
  const connection = useRef<GameRoomConnection | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const activeScope = useRef<string | null>(null);
  const scopeKey = `${roomId}:${memberId ?? ''}`;
  const update = useCallback(
    (next: GameRoomView) => {
      if (activeScope.current !== scopeKey || next.room.id !== roomId) return;
      if (
        latest.current?.room.id === next.room.id &&
        latest.current.room.revision > next.room.revision
      )
        return;
      latest.current = next;
      setView(next);
    },
    [roomId, scopeKey],
  );

  useEffect(() => {
    generation.current++;
    activeScope.current = memberId ? scopeKey : null;
    busy.current = false;
    setPending(false);
    latest.current = null;
    setView(null);
    setError(null);
    if (!roomId || !memberId) return;
    let disposed = false;
    void getGameRoom(roomId)
      .then((next) => {
        if (!disposed) update(next);
      })
      .catch((reason: unknown) => {
        if (!disposed)
          setError(
            reason instanceof HouseholdApiError ? reason.code : 'NETWORK',
          );
      });
    const client = new GameRoomConnection(
      roomId,
      (next) => {
        if (!disposed) update(next);
      },
      (online) => {
        if (!disposed) setConnected(online);
      },
    );
    connection.current = client;
    return () => {
      disposed = true;
      generation.current++;
      activeScope.current = null;
      client.close();
      connection.current = null;
      setConnected(false);
    };
  }, [roomId, memberId, scopeKey, update]);

  const send = useCallback(
    async (
      type: GameRoomCommand['type'],
      payload?: GameRoomCommand['payload'],
    ) => {
      if (
        !memberId ||
        activeScope.current !== scopeKey ||
        !latest.current ||
        busy.current
      )
        return false;
      const requestGeneration = generation.current;
      const command: GameRoomCommand = {
        protocol: 1,
        commandId: createUuid(),
        roomId,
        expectedRevision: latest.current.room.revision,
        type,
        payload,
      };
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        const ack = await (connection.current?.command(command) ??
          sendGameCommand(command));
        if (generation.current !== requestGeneration) return false;
        if (ack.view) update(ack.view);
        if (!ack.accepted) setError(ack.code ?? 'ACTION_REJECTED');
        return ack.accepted;
      } catch (reason) {
        if (generation.current === requestGeneration)
          setError(
            reason instanceof HouseholdApiError ? reason.code : 'NETWORK',
          );
        return false;
      } finally {
        if (generation.current === requestGeneration) {
          busy.current = false;
          setPending(false);
        }
      }
    },
    [roomId, memberId, scopeKey, update],
  );

  return { view, connected, pending, error, send, update };
}
