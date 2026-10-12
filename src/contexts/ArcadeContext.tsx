import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { migrateLegacyArcadeStats } from '@/lib/achievements';
import {
  type ArcadeDifficulty,
  getArcadeDifficulty,
  setArcadeDifficulty,
} from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { createUuid } from '@/lib/uuid';
import type { ArcadeRecord } from '@/store/gameStore';

export type ArcadeOutcome = 'win' | 'lose' | 'draw';
type ArcadeResult = ArcadeRecord & {
  coinsEarned: number;
  capReached: boolean;
  outcome: ArcadeOutcome;
  score: number;
};
type Session = {
  gameId: string;
  difficulty: ArcadeDifficulty;
  paused: boolean;
  result: ArcadeResult | null;
  setPaused: (paused: boolean) => void;
  changeDifficulty: (difficulty: ArcadeDifficulty) => void;
  restart: () => void;
  newRound: () => void;
  start: () => void;
  finish: (
    outcome: ArcadeOutcome,
    score?: number,
    meta?: Record<string, unknown>,
  ) => void;
  snapshot: (reader: () => unknown) => () => void;
};
const ArcadeContext = createContext<Session | null>(null);
export function ArcadeSession({
  gameId,
  children,
}: {
  gameId: string;
  children: ReactNode;
}) {
  const [difficulty, setDifficulty] = useState(() =>
    getArcadeDifficulty(gameId),
  );
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<ArcadeResult | null>(null);
  const receipt = useRef({
    id: `arcade:${createUuid()}`,
    started: false,
    finished: false,
  });
  const snapshotReader = useRef<(() => unknown) | null>(null);
  const start = useCallback(() => {
    if (receipt.current.started) return;
    receipt.current.started = true;
    emitGameEvent({
      gameId,
      difficulty,
      type: 'start',
      meta: { roundId: receipt.current.id },
    });
  }, [gameId, difficulty]);
  const newRound = useCallback(() => {
    receipt.current = {
      id: `arcade:${createUuid()}`,
      started: false,
      finished: false,
    };
    setResult(null);
    setPaused(false);
  }, []);
  const restart = useCallback(() => {
    newRound();
    setRound((value) => value + 1);
  }, [newRound]);
  const changeDifficulty = useCallback(
    (next: ArcadeDifficulty) => {
      if (next === difficulty) return;
      setArcadeDifficulty(gameId, next);
      setDifficulty(next);
      restart();
    },
    [gameId, difficulty, restart],
  );
  const finish = useCallback(
    (outcome: ArcadeOutcome, score = 0, meta: Record<string, unknown> = {}) => {
      if (receipt.current.finished) return;
      start();
      receipt.current.finished = true;
      const event = {
        gameId,
        difficulty,
        score,
        meta: { ...meta, outcome, roundId: receipt.current.id },
      };
      const finished = emitGameEvent({ ...event, type: 'finish' });
      const won =
        outcome === 'win' ? emitGameEvent({ ...event, type: 'win' }) : null;
      const best = finished.record?.isNewBest
        ? emitGameEvent({ ...event, type: 'best' })
        : null;
      setPaused(false);
      setResult({
        ...(finished.record ?? {
          isNewBest: false,
          previousBest: null,
          currentBest: null,
        }),
        outcome,
        score,
        coinsEarned:
          finished.coinsEarned +
          (won?.coinsEarned ?? 0) +
          (best?.coinsEarned ?? 0),
        capReached:
          finished.arcadeCapReached === true ||
          won?.arcadeCapReached === true ||
          best?.arcadeCapReached === true,
      });
    },
    [gameId, difficulty, start],
  );
  const snapshot = useCallback((reader: () => unknown) => {
    snapshotReader.current = reader;
    return () => {
      if (snapshotReader.current === reader) snapshotReader.current = null;
    };
  }, []);
  useEffect(() => {
    migrateLegacyArcadeStats();
  }, []);
  useEffect(() => {
    const render = () =>
      JSON.stringify({
        gameId,
        difficulty,
        paused,
        result,
        coordinateSystem:
          'origin at top left; x/column increases right, y/row increases down',
        game: snapshotReader.current?.() ?? null,
      });
    Object.assign(window, { render_game_to_text: render });
    return () => {
      if (
        (window as Window & { render_game_to_text?: unknown })
          .render_game_to_text === render
      )
        Reflect.deleteProperty(window, 'render_game_to_text');
    };
  }, [gameId, difficulty, paused, result]);
  return (
    <ArcadeContext.Provider
      value={{
        gameId,
        difficulty,
        paused,
        setPaused,
        changeDifficulty,
        restart,
        newRound,
        start,
        finish,
        result,
        snapshot,
      }}
    >
      <Fragment key={`${gameId}:${difficulty}:${round}`}>{children}</Fragment>
    </ArcadeContext.Provider>
  );
}
export function useOptionalArcade() {
  return useContext(ArcadeContext);
}
export function useArcade() {
  const session = useOptionalArcade();
  if (!session) throw new Error('Arcade game requires ArcadeSession');
  return session;
}
export function useArcadeSnapshot(reader: () => unknown) {
  const session = useOptionalArcade();
  useEffect(() => session?.snapshot(reader));
}
