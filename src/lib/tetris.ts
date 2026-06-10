export const COLS = 10;
export const ROWS = 20;
export const SPAWN_X = Math.floor((COLS - 4) / 2);
export const INITIAL_DROP_INTERVAL = 48;
export const MIN_DROP_INTERVAL = 8;

export type ShapeGrid = number[][];
export type TetrisStatus = 'idle' | 'playing' | 'paused' | 'over';
export type TetrisBoard = number[][];

export interface TetrisState {
  board: TetrisBoard;
  piece: number;
  rot: number;
  px: number;
  py: number;
  nextPiece: number;
  score: number;
  level: number;
  lines: number;
  status: TetrisStatus;
  dropCounter: number;
  dropInterval: number;
}

export type TetrisAction =
  | { type: 'reset'; rng?: () => number }
  | { type: 'start' }
  | { type: 'togglePause' }
  | { type: 'tick'; rng?: () => number }
  | { type: 'move'; dx: number }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'softDrop'; rng?: () => number }
  | { type: 'hardDrop'; rng?: () => number };

export type TetrisEvent =
  | { type: 'piece_moved'; from: PiecePose; to: PiecePose; fast?: boolean }
  | { type: 'piece_rotated'; from: PiecePose; to: PiecePose }
  | { type: 'piece_locked'; rows: number[]; hardDropDistance?: number }
  | {
      type: 'lines_cleared';
      rows: number[];
      count: number;
      scoreDelta: number;
    }
  | { type: 'soft_drop_score'; delta: number }
  | { type: 'hard_drop_score'; delta: number; distance: number }
  | { type: 'game_over' }
  | { type: 'reset' };

export interface TetrisStepResult {
  state: TetrisState;
  events: TetrisEvent[];
}

export interface PiecePose {
  piece: number;
  rot: number;
  px: number;
  py: number;
}

export const SHAPES: ShapeGrid[][] = [
  [
    [
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  [
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
];

export const TETRIS_COLORS = [
  '',
  '#22d3ee',
  '#fbbf24',
  '#a78bfa',
  '#4ade80',
  '#f87171',
  '#38bdf8',
  '#fb923c',
];

export const LINE_SCORES = [0, 100, 300, 500, 800];

export function createTetrisBoard(): TetrisBoard {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export function createInitialTetrisState(
  rng: () => number = Math.random,
): TetrisState {
  return {
    board: createTetrisBoard(),
    piece: randomPiece(rng),
    rot: 0,
    px: SPAWN_X,
    py: 0,
    nextPiece: randomPiece(rng),
    score: 0,
    level: 1,
    lines: 0,
    status: 'idle',
    dropCounter: 0,
    dropInterval: INITIAL_DROP_INTERVAL,
  };
}

export function getActivePose(state: TetrisState): PiecePose {
  return {
    piece: state.piece,
    rot: state.rot,
    px: state.px,
    py: state.py,
  };
}

export function getPieceCells(
  piece: number,
  rot: number,
  px: number,
  py: number,
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const shape = SHAPES[piece]?.[normalizeRot(rot)];
  if (!shape) return cells;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c]) cells.push({ x: px + c, y: py + r });
    }
  }
  return cells;
}

export function hasCollision(
  board: TetrisBoard,
  piece: number,
  rot: number,
  px: number,
  py: number,
): boolean {
  for (const { x, y } of getPieceCells(piece, rot, px, py)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x]) return true;
  }
  return false;
}

export function getGhostY(state: TetrisState): number {
  let ghostY = state.py;
  while (
    !hasCollision(state.board, state.piece, state.rot, state.px, ghostY + 1)
  ) {
    ghostY++;
  }
  return ghostY;
}

export function applyTetrisAction(
  state: TetrisState,
  action: TetrisAction,
): TetrisStepResult {
  if (action.type === 'reset') {
    return {
      state: createInitialTetrisState(action.rng),
      events: [{ type: 'reset' }],
    };
  }

  if (action.type === 'start') {
    if (state.status !== 'idle') return unchanged(state);
    return { state: { ...cloneState(state), status: 'playing' }, events: [] };
  }

  if (action.type === 'togglePause') {
    if (state.status === 'playing')
      return { state: { ...cloneState(state), status: 'paused' }, events: [] };
    if (state.status === 'paused')
      return { state: { ...cloneState(state), status: 'playing' }, events: [] };
    return unchanged(state);
  }

  if (state.status !== 'playing') return unchanged(state);

  if (action.type === 'move') {
    return movePiece(state, action.dx, 0);
  }

  if (action.type === 'rotate') {
    const nextRot =
      action.direction === 'cw'
        ? normalizeRot(state.rot + 1)
        : normalizeRot(state.rot + 3);
    if (hasCollision(state.board, state.piece, nextRot, state.px, state.py)) {
      return unchanged(state);
    }

    const next = cloneState(state);
    const from = getActivePose(next);
    next.rot = nextRot;
    return {
      state: next,
      events: [{ type: 'piece_rotated', from, to: getActivePose(next) }],
    };
  }

  if (action.type === 'softDrop') {
    if (
      !hasCollision(state.board, state.piece, state.rot, state.px, state.py + 1)
    ) {
      const moved = movePiece(state, 0, 1, true);
      moved.state.score += 1;
      moved.events.push({ type: 'soft_drop_score', delta: 1 });
      return moved;
    }
    return lockPiece(state, action.rng);
  }

  if (action.type === 'hardDrop') {
    const next = cloneState(state);
    const from = getActivePose(next);
    const ghostY = getGhostY(next);
    const distance = ghostY - next.py;
    next.py = ghostY;
    next.score += distance * 2;
    const result = lockPiece(next, action.rng, distance);
    if (distance > 0) {
      result.events.unshift({
        type: 'piece_moved',
        from,
        to: getActivePose(next),
        fast: true,
      });
      result.events.unshift({
        type: 'hard_drop_score',
        delta: distance * 2,
        distance,
      });
    }
    return result;
  }

  if (action.type === 'tick') {
    const next = cloneState(state);
    next.dropCounter += 1;
    if (next.dropCounter < next.dropInterval) {
      return { state: next, events: [] };
    }

    next.dropCounter = 0;
    if (!hasCollision(next.board, next.piece, next.rot, next.px, next.py + 1)) {
      const from = getActivePose(next);
      next.py += 1;
      return {
        state: next,
        events: [{ type: 'piece_moved', from, to: getActivePose(next) }],
      };
    }
    return lockPiece(next, action.rng);
  }

  return unchanged(state);
}

function movePiece(
  state: TetrisState,
  dx: number,
  dy: number,
  fast = false,
): TetrisStepResult {
  if (
    hasCollision(
      state.board,
      state.piece,
      state.rot,
      state.px + dx,
      state.py + dy,
    )
  ) {
    return unchanged(state);
  }

  const next = cloneState(state);
  const from = getActivePose(next);
  next.px += dx;
  next.py += dy;
  return {
    state: next,
    events: [{ type: 'piece_moved', from, to: getActivePose(next), fast }],
  };
}

function lockPiece(
  state: TetrisState,
  rng: () => number = Math.random,
  hardDropDistance = 0,
): TetrisStepResult {
  const next = cloneState(state);
  const events: TetrisEvent[] = [];
  const lockedRows = new Set<number>();

  for (const { x, y } of getPieceCells(
    next.piece,
    next.rot,
    next.px,
    next.py,
  )) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      next.board[y][x] = next.piece + 1;
      lockedRows.add(y);
    }
  }

  events.push({
    type: 'piece_locked',
    rows: [...lockedRows].sort((a, b) => a - b),
    hardDropDistance,
  });

  const cleared = clearFullLines(next.board);
  next.board = cleared.board;

  if (cleared.rows.length > 0) {
    const totalLines = next.lines + cleared.rows.length;
    const scoreLevel = Math.min(10, 1 + Math.floor(totalLines / 10));
    const scoreDelta = LINE_SCORES[cleared.rows.length] * scoreLevel;
    next.lines = totalLines;
    next.score += scoreDelta;
    next.level = getLevel(next.lines);
    next.dropInterval = getDropInterval(next.level);
    events.push({
      type: 'lines_cleared',
      rows: cleared.rows,
      count: cleared.rows.length,
      scoreDelta,
    });
  } else {
    next.dropInterval = getDropInterval(getLevel(next.lines));
  }

  next.piece = next.nextPiece;
  next.rot = 0;
  next.px = SPAWN_X;
  next.py = 0;
  next.nextPiece = randomPiece(rng);
  next.dropCounter = 0;

  if (hasCollision(next.board, next.piece, next.rot, next.px, next.py)) {
    next.status = 'over';
    events.push({ type: 'game_over' });
  }

  return { state: next, events };
}

function clearFullLines(board: TetrisBoard): {
  board: TetrisBoard;
  rows: number[];
} {
  const rows: number[] = [];
  const remaining: TetrisBoard = [];

  for (let r = 0; r < ROWS; r++) {
    if (board[r].every((cell) => cell !== 0)) {
      rows.push(r);
    } else {
      remaining.push([...board[r]]);
    }
  }

  return {
    board: [
      ...Array.from({ length: rows.length }, () => Array(COLS).fill(0)),
      ...remaining,
    ],
    rows,
  };
}

function cloneState(state: TetrisState): TetrisState {
  return {
    ...state,
    board: state.board.map((row) => [...row]),
  };
}

function unchanged(state: TetrisState): TetrisStepResult {
  return { state: cloneState(state), events: [] };
}

function getLevel(lines: number): number {
  return Math.min(10, 1 + Math.floor(lines / 10));
}

function getDropInterval(level: number): number {
  return Math.max(MIN_DROP_INTERVAL, INITIAL_DROP_INTERVAL - level * 4);
}

function normalizeRot(rot: number): number {
  return ((rot % 4) + 4) % 4;
}

function randomPiece(rng: () => number): number {
  return Math.max(0, Math.min(6, Math.floor(rng() * 7)));
}
