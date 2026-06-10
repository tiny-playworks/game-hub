export const COLS = 10;
export const ROWS = 20;
export const SPAWN_X = Math.floor((COLS - 4) / 2);
export const INITIAL_DROP_INTERVAL = 48;
export const MIN_DROP_INTERVAL = 8;

export type ShapeGrid = number[][];
export type TetrisStatus = 'idle' | 'playing' | 'paused' | 'over';
export type TetrisBoard = number[][];
export type TetrisSpecial = 'bomb' | 'ice' | 'wildcard';
export type TetrisUpgrade =
  | 'score_boost'
  | 'slow_fall'
  | 'skill_boost'
  | 'bomb_rate'
  | 'combo_boost';

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
  heldPiece: number | null;
  holdUsed: boolean;
  activeSpecial: TetrisSpecial | null;
  nextSpecial: TetrisSpecial | null;
  piecesLocked: number;
  specialInterval: number;
  skillEnergy: number;
  skillMax: number;
  skillGainMultiplier: number;
  scoreMultiplier: number;
  combo: number;
  comboBonus: number;
  fallIntervalBonus: number;
  slowTicks: number;
  nextUpgradeAt: number;
  pendingUpgradeChoices: TetrisUpgrade[];
  upgrades: Partial<Record<TetrisUpgrade, number>>;
}

export type TetrisAction =
  | { type: 'reset'; rng?: () => number }
  | { type: 'start' }
  | { type: 'togglePause' }
  | { type: 'tick'; rng?: () => number }
  | { type: 'move'; dx: number }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'softDrop'; rng?: () => number }
  | { type: 'hardDrop'; rng?: () => number }
  | { type: 'hold'; rng?: () => number }
  | { type: 'useSkill' }
  | { type: 'chooseUpgrade'; upgrade: TetrisUpgrade };

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
  | { type: 'skill_used'; skill: 'clear_bottom'; rows: number[] }
  | {
      type: 'special_triggered';
      special: TetrisSpecial;
      cells: Array<{ x: number; y: number }>;
    }
  | { type: 'upgrade_choices_ready'; choices: TetrisUpgrade[] }
  | { type: 'upgrade_selected'; upgrade: TetrisUpgrade }
  | { type: 'piece_held'; heldPiece: number; piece: number }
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
    heldPiece: null,
    holdUsed: false,
    activeSpecial: null,
    nextSpecial: null,
    piecesLocked: 0,
    specialInterval: 12,
    skillEnergy: 0,
    skillMax: 100,
    skillGainMultiplier: 1,
    scoreMultiplier: 1,
    combo: 0,
    comboBonus: 0.25,
    fallIntervalBonus: 0,
    slowTicks: 0,
    nextUpgradeAt: 10,
    pendingUpgradeChoices: [],
    upgrades: {},
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

  if (action.type === 'chooseUpgrade') {
    return chooseUpgrade(state, action.upgrade);
  }

  if (state.status !== 'playing') return unchanged(state);

  if (action.type === 'hold') {
    return holdPiece(state, action.rng);
  }

  if (action.type === 'useSkill') {
    return activateClearBottomSkill(state);
  }

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
    if (next.slowTicks > 0) next.slowTicks -= 1;
    next.dropInterval = getDropInterval(
      getLevel(next.lines),
      next.fallIntervalBonus,
      next.slowTicks,
    );
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

function holdPiece(
  state: TetrisState,
  rng: () => number = Math.random,
): TetrisStepResult {
  if (state.holdUsed) return unchanged(state);

  const next = cloneState(state);
  const currentPiece = next.piece;
  if (next.heldPiece === null) {
    next.heldPiece = currentPiece;
    next.piece = next.nextPiece;
    next.activeSpecial = next.nextSpecial;
    next.nextPiece = randomPiece(rng);
    next.nextSpecial = rollNextSpecial(next, rng);
  } else {
    next.piece = next.heldPiece;
    next.heldPiece = currentPiece;
    next.activeSpecial = null;
  }
  next.rot = 0;
  next.px = SPAWN_X;
  next.py = 0;
  next.holdUsed = true;

  if (hasCollision(next.board, next.piece, next.rot, next.px, next.py)) {
    next.status = 'over';
    return { state: next, events: [{ type: 'game_over' }] };
  }

  return {
    state: next,
    events: [
      {
        type: 'piece_held',
        heldPiece: next.heldPiece,
        piece: next.piece,
      },
    ],
  };
}

function activateClearBottomSkill(state: TetrisState): TetrisStepResult {
  if (state.skillEnergy < state.skillMax) return unchanged(state);
  const next = cloneState(state);
  const bottomRow = ROWS - 1;
  next.board = [Array(COLS).fill(0), ...next.board.slice(0, bottomRow)];
  next.skillEnergy = 0;
  next.lines += 1;
  next.score += 50 * next.level;
  next.level = getLevel(next.lines);
  next.dropInterval = getDropInterval(
    next.level,
    next.fallIntervalBonus,
    next.slowTicks,
  );
  maybeOfferUpgrade(next, []);

  return {
    state: next,
    events: [
      {
        type: 'skill_used',
        skill: 'clear_bottom',
        rows: [bottomRow],
      },
    ],
  };
}

function chooseUpgrade(
  state: TetrisState,
  upgrade: TetrisUpgrade,
): TetrisStepResult {
  if (!state.pendingUpgradeChoices.includes(upgrade)) return unchanged(state);

  const next = cloneState(state);
  next.upgrades[upgrade] = (next.upgrades[upgrade] ?? 0) + 1;
  next.pendingUpgradeChoices = [];

  if (upgrade === 'score_boost') {
    next.scoreMultiplier = roundOneDecimal(next.scoreMultiplier + 0.2);
  } else if (upgrade === 'slow_fall') {
    next.fallIntervalBonus += 4;
    next.dropInterval = getDropInterval(
      next.level,
      next.fallIntervalBonus,
      next.slowTicks,
    );
  } else if (upgrade === 'skill_boost') {
    next.skillGainMultiplier = roundTwoDecimals(
      next.skillGainMultiplier + 0.25,
    );
  } else if (upgrade === 'bomb_rate') {
    next.specialInterval = Math.max(8, next.specialInterval - 2);
  } else if (upgrade === 'combo_boost') {
    next.comboBonus = roundTwoDecimals(next.comboBonus + 0.15);
  }

  return {
    state: next,
    events: [{ type: 'upgrade_selected', upgrade }],
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
  const lockedCells: Array<{ x: number; y: number }> = [];

  for (const { x, y } of getPieceCells(
    next.piece,
    next.rot,
    next.px,
    next.py,
  )) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      next.board[y][x] = next.piece + 1;
      lockedRows.add(y);
      lockedCells.push({ x, y });
    }
  }

  if (next.activeSpecial) {
    const affected = applySpecialEffect(next, next.activeSpecial, lockedCells);
    events.push({
      type: 'special_triggered',
      special: next.activeSpecial,
      cells: affected,
    });
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
    next.combo += 1;
    const comboMultiplier =
      next.combo > 1 ? 1 + (next.combo - 1) * next.comboBonus : 1;
    const scoreDelta = Math.round(
      LINE_SCORES[cleared.rows.length] *
        scoreLevel *
        next.scoreMultiplier *
        comboMultiplier,
    );
    next.lines = totalLines;
    next.score += scoreDelta;
    next.level = getLevel(next.lines);
    next.dropInterval = getDropInterval(
      next.level,
      next.fallIntervalBonus,
      next.slowTicks,
    );
    next.skillEnergy = Math.min(
      next.skillMax,
      next.skillEnergy +
        Math.round(cleared.rows.length * 25 * next.skillGainMultiplier),
    );
    events.push({
      type: 'lines_cleared',
      rows: cleared.rows,
      count: cleared.rows.length,
      scoreDelta,
    });
    maybeOfferUpgrade(next, events);
  } else {
    next.combo = 0;
    next.dropInterval = getDropInterval(
      getLevel(next.lines),
      next.fallIntervalBonus,
      next.slowTicks,
    );
  }

  next.piecesLocked += 1;
  next.piece = next.nextPiece;
  next.activeSpecial = next.nextSpecial;
  next.rot = 0;
  next.px = SPAWN_X;
  next.py = 0;
  next.nextPiece = randomPiece(rng);
  next.nextSpecial = rollNextSpecial(next, rng);
  next.holdUsed = false;
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

function applySpecialEffect(
  state: TetrisState,
  special: TetrisSpecial,
  lockedCells: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (special === 'bomb') {
    return applyBombEffect(state.board, lockedCells);
  }
  if (special === 'ice') {
    state.slowTicks = 180;
    state.dropInterval = getDropInterval(
      getLevel(state.lines),
      state.fallIntervalBonus,
      state.slowTicks,
    );
    return lockedCells;
  }
  return applyWildcardEffect(state.board, lockedCells, state.piece + 1);
}

function applyBombEffect(
  board: TetrisBoard,
  lockedCells: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const affected = new Map<string, { x: number; y: number }>();
  for (const { x, y } of lockedCells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        board[ny][nx] = 0;
        affected.set(`${nx},${ny}`, { x: nx, y: ny });
      }
    }
  }
  return [...affected.values()];
}

function applyWildcardEffect(
  board: TetrisBoard,
  lockedCells: Array<{ x: number; y: number }>,
  color: number,
): Array<{ x: number; y: number }> {
  const affected: Array<{ x: number; y: number }> = [];
  const columns = [...new Set(lockedCells.map((cell) => cell.x))];
  for (const col of columns) {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 0) {
        board[row][col] = color;
        affected.push({ x: col, y: row });
        break;
      }
    }
  }
  return affected;
}

function maybeOfferUpgrade(state: TetrisState, events: TetrisEvent[]): void {
  if (
    state.lines < state.nextUpgradeAt ||
    state.pendingUpgradeChoices.length > 0
  )
    return;

  const choices: TetrisUpgrade[] = ['score_boost', 'slow_fall', 'skill_boost'];
  if ((state.upgrades.bomb_rate ?? 0) === 0) choices[2] = 'bomb_rate';
  if ((state.upgrades.combo_boost ?? 0) === 0 && state.lines >= 20)
    choices[1] = 'combo_boost';

  state.pendingUpgradeChoices = choices;
  state.nextUpgradeAt += 10;
  events.push({ type: 'upgrade_choices_ready', choices });
}

function rollNextSpecial(
  state: TetrisState,
  rng: () => number,
): TetrisSpecial | null {
  if (
    state.piecesLocked <= 0 ||
    state.piecesLocked % state.specialInterval !== 0
  ) {
    return null;
  }

  const roll = rng();
  if (roll < 0.4) return 'bomb';
  if (roll < 0.7) return 'ice';
  return 'wildcard';
}

function cloneState(state: TetrisState): TetrisState {
  return {
    ...state,
    board: state.board.map((row) => [...row]),
    pendingUpgradeChoices: [...state.pendingUpgradeChoices],
    upgrades: { ...state.upgrades },
  };
}

function unchanged(state: TetrisState): TetrisStepResult {
  return { state: cloneState(state), events: [] };
}

function getLevel(lines: number): number {
  return Math.min(10, 1 + Math.floor(lines / 10));
}

function getDropInterval(
  level: number,
  fallIntervalBonus = 0,
  slowTicks = 0,
): number {
  const slowBonus = slowTicks > 0 ? 16 : 0;
  return Math.max(
    MIN_DROP_INTERVAL,
    INITIAL_DROP_INTERVAL - level * 4 + fallIntervalBonus + slowBonus,
  );
}

function normalizeRot(rot: number): number {
  return ((rot % 4) + 4) % 4;
}

function randomPiece(rng: () => number): number {
  return Math.max(0, Math.min(6, Math.floor(rng() * 7)));
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
