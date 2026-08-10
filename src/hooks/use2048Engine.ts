import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  type Dir,
  type Game2048State,
  moveBoard,
  SIZE,
  type Tile,
} from '@/lib/game2048';

export type { Dir, Tile };
export { SIZE };

let tileIdCounter = 0;
const defaultNextId = () => `tile-${Date.now()}-${tileIdCounter++}`;

export function useEngine2048() {
  const nextIdRef = useRef(defaultNextId);
  const [history, setHistory] = useState<Game2048State[]>([]);
  const [state, setState] = useState<Game2048State>(() =>
    createInitialState(Math.random, nextIdRef.current),
  );
  const [maxCombo, setMaxCombo] = useState(0);

  const initGame = useCallback(() => {
    setState(createInitialState(Math.random, nextIdRef.current));
    setHistory([]);
    setMaxCombo(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setState(previous);
  }, [history]);

  const move = useCallback(
    (dir: Dir): { addedScore: number; isMoved: boolean } => {
      const result = moveBoard(state, dir, Math.random, nextIdRef.current);
      if (!result.isMoved) {
        return { addedScore: 0, isMoved: false };
      }

      setHistory((prev) => {
        const next = [...prev, state];
        if (next.length > 5) next.shift();
        return next;
      });

      setMaxCombo((m) => Math.max(m, result.state.combo));
      setState(result.state);
      return {
        addedScore: result.addedScore,
        isMoved: true,
      };
    },
    [state],
  );

  return {
    state,
    maxCombo,
    move,
    undo,
    initGame,
    canUndo: history.length > 0,
  };
}
