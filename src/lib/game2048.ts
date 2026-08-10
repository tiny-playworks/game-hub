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

export interface Game2048State {
  tiles: Record<string, Tile>;
  score: number;
  combo: number;
  gameOver: boolean;
}

export type MoveBoardResult =
  | {
      isMoved: true;
      state: Game2048State;
      addedScore: number;
      mergeCount: number;
    }
  | {
      isMoved: false;
      state: Game2048State;
      addedScore: 0;
      mergeCount: 0;
    };

export function createEmptyState(): Game2048State {
  return { tiles: {}, score: 0, combo: 0, gameOver: false };
}

export function spawnTile(
  tiles: Record<string, Tile>,
  rng: () => number,
  nextId: () => string,
): Tile | null {
  const occupied = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  for (const t of Object.values(tiles)) {
    if (!t.mergedInto) occupied[t.r][t.c] = true;
  }

  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!occupied[r][c]) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;

  const [r, c] = empty[Math.floor(rng() * empty.length)];
  return {
    id: nextId(),
    value: rng() < 0.9 ? 2 : 4,
    r,
    c,
    isNew: true,
  };
}

export function isGameOver(tiles: Record<string, Tile>): boolean {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  let emptyCount = 0;

  for (const t of Object.values(tiles)) {
    if (!t.mergedInto) board[t.r][t.c] = t.value;
  }

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

export function createInitialState(
  rng: () => number,
  nextId: () => string,
): Game2048State {
  const t1 = spawnTile({}, rng, nextId);
  const tiles: Record<string, Tile> = {};
  if (t1) tiles[t1.id] = t1;
  const t2 = spawnTile(tiles, rng, nextId);
  if (t2) tiles[t2.id] = t2;
  return {
    tiles,
    score: 0,
    combo: 0,
    gameOver: false,
  };
}

/**
 * Pure board move. Clones all tiles; never mutates input state.
 * On success, spawns one random tile via rng/nextId.
 */
export function moveBoard(
  state: Game2048State,
  dir: Dir,
  rng: () => number,
  nextId: () => string,
): MoveBoardResult {
  if (state.gameOver) {
    return { isMoved: false, state, addedScore: 0, mergeCount: 0 };
  }

  const newTiles: Record<string, Tile> = {};
  for (const t of Object.values(state.tiles)) {
    if (!t.mergedInto) {
      newTiles[t.id] = { ...t, isNew: false, isMerged: false };
    }
  }

  const board: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(null),
  );
  for (const t of Object.values(newTiles)) {
    board[t.r][t.c] = t;
  }

  let isMoved = false;
  let addedScore = 0;
  let mergeCount = 0;

  const rows = dir === 'down' ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const cols = dir === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];

  let dr = 0;
  let dc = 0;
  if (dir === 'up') dr = -1;
  if (dir === 'down') dr = 1;
  if (dir === 'left') dc = -1;
  if (dir === 'right') dc = 1;

  for (const r of rows) {
    for (const c of cols) {
      const tile = board[r][c];
      if (!tile) continue;

      let nextR = r;
      let nextC = c;

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
          !nextTile.isMerged
        ) {
          nextR += dr;
          nextC += dc;
          break;
        } else {
          break;
        }
      }

      if (nextR === r && nextC === c) continue;

      isMoved = true;
      const targetTile = board[nextR][nextC];
      if (
        targetTile &&
        targetTile.value === tile.value &&
        !targetTile.mergedInto
      ) {
        const newTileId = nextId();
        const mergedTile: Tile = {
          id: newTileId,
          value: tile.value * 2,
          r: nextR,
          c: nextC,
          isMerged: true,
        };
        newTiles[newTileId] = mergedTile;
        newTiles[tile.id] = {
          ...newTiles[tile.id],
          r: nextR,
          c: nextC,
          mergedInto: newTileId,
        };
        newTiles[targetTile.id] = {
          ...newTiles[targetTile.id],
          mergedInto: newTileId,
        };
        board[r][c] = null;
        board[nextR][nextC] = mergedTile;
        addedScore += tile.value * 2;
        mergeCount++;
      } else {
        newTiles[tile.id] = {
          ...newTiles[tile.id],
          r: nextR,
          c: nextC,
        };
        board[r][c] = null;
        board[nextR][nextC] = newTiles[tile.id];
      }
    }
  }

  if (!isMoved) {
    return { isMoved: false, state, addedScore: 0, mergeCount: 0 };
  }

  const spawned = spawnTile(newTiles, rng, nextId);
  if (spawned) newTiles[spawned.id] = spawned;

  const newCombo = mergeCount > 0 ? state.combo + mergeCount : 0;

  return {
    isMoved: true,
    addedScore,
    mergeCount,
    state: {
      tiles: newTiles,
      score: state.score + addedScore,
      combo: newCombo,
      gameOver: isGameOver(newTiles),
    },
  };
}
