import { useCallback, useEffect, useState } from 'react';

export const SIZE = 4;

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: string;
  value: number;
  r: number;
  c: number;
  isNew?: boolean;
  isMerged?: boolean;
  mergedInto?: string;
}

interface GameState {
  tiles: Record<string, Tile>;
  score: number;
  combo: number;
  gameOver: boolean;
}

let tileIdCounter = 0;
const nextId = () => `tile-${Date.now()}-${tileIdCounter++}`;

export function useEngine2048() {
  const [history, setHistory] = useState<GameState[]>([]);
  const [state, setState] = useState<GameState>({
    tiles: {},
    score: 0,
    combo: 0,
    gameOver: false,
  });

  const [maxCombo, setMaxCombo] = useState(0);

  // Initialize game
  const initGame = useCallback(() => {
    const t1 = createRandomTile({});
    const t2 = createRandomTile({ [t1.id]: t1 });
    setState({
      tiles: { [t1.id]: t1, [t2.id]: t2 },
      score: 0,
      combo: 0,
      gameOver: false,
    });
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
      if (state.gameOver) return { addedScore: 0, isMoved: false };

      // Clean up previously merged tiles and clone
      const newTiles: Record<string, Tile> = {};
      Object.values(state.tiles).forEach((t) => {
        if (!t.mergedInto) {
          newTiles[t.id] = { ...t, isNew: false, isMerged: false };
        }
      });

      const activeTiles = Object.values(newTiles);

      const board: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
        Array(SIZE).fill(null),
      );
      activeTiles.forEach((t) => {
        board[t.r][t.c] = t;
      });

      let isMoved = false;
      let addedScore = 0;
      let mergeCount = 0;

      const traverse = (cb: (r: number, c: number) => void) => {
        const rows = dir === 'down' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const cols = dir === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        rows.forEach((r) => {
          cols.forEach((c) => {
            cb(r, c);
          });
        });
      };

      traverse((r, c) => {
        const tile = board[r][c];
        if (!tile) return;

        let nextR = r;
        let nextC = c;
        let dr = 0;
        let dc = 0;

        if (dir === 'up') dr = -1;
        if (dir === 'down') dr = 1;
        if (dir === 'left') dc = -1;
        if (dir === 'right') dc = 1;

        while (
          nextR + dr >= 0 &&
          nextR + dr < SIZE &&
          nextC + dc >= 0 &&
          nextC + dc < SIZE
        ) {
          const nextTile = board[nextR + dr][nextC + dc];
          if (!nextTile) {
            nextR += dr;
            nextC += dc;
          } else if (
            nextTile.value === tile.value &&
            !nextTile.mergedInto &&
            !nextTile.isMerged // prevent double merge in one stroke
          ) {
            nextR += dr;
            nextC += dc;
            break;
          } else {
            break;
          }
        }

        if (nextR !== r || nextC !== c) {
          isMoved = true;
          const targetTile = board[nextR][nextC];
          if (
            targetTile &&
            targetTile.value === tile.value &&
            !targetTile.mergedInto
          ) {
            // Merge!
            const newTileId = nextId();
            const mergedTile: Tile = {
              id: newTileId,
              value: tile.value * 2,
              r: nextR,
              c: nextC,
              isMerged: true,
            };
            newTiles[newTileId] = mergedTile;

            newTiles[tile.id].r = nextR;
            newTiles[tile.id].c = nextC;
            newTiles[tile.id].mergedInto = newTileId;

            newTiles[targetTile.id].mergedInto = newTileId;

            board[r][c] = null;
            board[nextR][nextC] = mergedTile; // So it can't be merged again this turn

            addedScore += tile.value * 2;
            mergeCount++;
          } else {
            // Just move
            newTiles[tile.id].r = nextR;
            newTiles[tile.id].c = nextC;
            board[r][c] = null;
            board[nextR][nextC] = newTiles[tile.id];
          }
        }
      });

      if (isMoved) {
        // Save history before adding the new random tile
        setHistory((prev) => {
          const newHistory = [...prev, state];
          if (newHistory.length > 5) newHistory.shift();
          return newHistory;
        });

        // Add random tile
        const t1 = createRandomTile(newTiles);
        if (t1) {
          newTiles[t1.id] = t1;
        }

        const newCombo = mergeCount > 0 ? state.combo + mergeCount : 0;
        if (newCombo > maxCombo) {
          setMaxCombo(newCombo);
        }

        const gameOver = checkGameOver(newTiles);

        setState({
          tiles: newTiles,
          score: state.score + addedScore,
          combo: newCombo,
          gameOver,
        });
      } else {
        // Reset combo if you move but nothing happens? No, just keep combo
      }

      return { addedScore, isMoved };
    },
    [state, maxCombo],
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

function createRandomTile(tiles: Record<string, Tile>): Tile {
  const empty: [number, number][] = [];
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  Object.values(tiles).forEach((t) => {
    if (!t.mergedInto) board[t.r][t.c] = true;
  });

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) empty.push([r, c]);
    }
  }

  if (empty.length === 0) {
    // Should not happen if game is not over
    return { id: nextId(), value: 2, r: 0, c: 0 };
  }

  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  return {
    id: nextId(),
    value: Math.random() < 0.9 ? 2 : 4,
    r,
    c,
    isNew: true,
  };
}

function checkGameOver(tiles: Record<string, Tile>): boolean {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  let emptyCount = 0;

  Object.values(tiles).forEach((t) => {
    if (!t.mergedInto) board[t.r][t.c] = t.value;
  });

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) emptyCount++;
    }
  }
  if (emptyCount > 0) return false;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c];
      if (c + 1 < SIZE && board[r][c + 1] === v) return false;
      if (r + 1 < SIZE && board[r + 1][c] === v) return false;
    }
  }
  return true;
}
