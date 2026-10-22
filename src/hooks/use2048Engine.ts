import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  type Dir,
  type Game2048State,
  moveBoard,
  SIZE,
  type Tile,
} from '@/lib/game2048';
import type { ArcadePositions } from '@/lib/arcadeResume';

export type { Dir, Tile };
export { SIZE };

let tileIdCounter = 0;
const defaultNextId = () => `tile-${Date.now()}-${tileIdCounter++}`;

export function useEngine2048(size = 4, saved: ArcadePositions['2048'] | null = null) {
  const nextIdRef = useRef(defaultNextId);
  const [history, setHistory] = useState<Game2048State[]>(() => saved?.history ?? []);
  const [state, setState] = useState<Game2048State>(() =>
    saved?.state ?? createInitialState(Math.random, nextIdRef.current, size),
  );
  const [maxCombo, setMaxCombo] = useState(saved?.maxCombo ?? 0);
  const previousSize = useRef(size);
  const stateRef = useRef(state);
  stateRef.current = state;

  const initGame = useCallback(() => {
    const initial = createInitialState(Math.random, nextIdRef.current, size);
    stateRef.current = initial;
    setState(initial);
    setHistory([]);
    setMaxCombo(0);
  }, [size]);

  useEffect(() => {
    if (previousSize.current === size) return;
    previousSize.current = size;
    initGame();
  }, [initGame, size]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    stateRef.current = previous;
    setState(previous);
  }, [history]);

  const move = useCallback(
    (dir: Dir): { addedScore: number; isMoved: boolean } => {
      const previous = stateRef.current;
      const result = moveBoard(previous, dir, Math.random, nextIdRef.current);
      if (!result.isMoved) {
        return { addedScore: 0, isMoved: false };
      }

      setHistory((prev) => {
        const next = [...prev, previous];
        if (next.length > 5) next.shift();
        return next;
      });

      setMaxCombo((m) => Math.max(m, result.state.combo));
      stateRef.current = result.state;
      setState(result.state);
      return {
        addedScore: result.addedScore,
        isMoved: true,
      };
    },
    [],
  );

  return {
    state,
    history,
    maxCombo,
    move,
    undo,
    initGame,
    canUndo: history.length > 0,
  };
}
