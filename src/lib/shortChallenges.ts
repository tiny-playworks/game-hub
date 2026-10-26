import { moveBoard, type Dir, type Game2048State } from './game2048';
import {
  applyTetrisAction,
  createInitialTetrisState,
  type TetrisAction,
} from './tetris';
import {
  getSafeMoves,
  getXiangqiResult,
  movePiece,
  type Board,
} from './xiangqi';
import { mixSeed, mulberry32 } from './seededRandom';

export type ShortGame = '2048' | 'xiangqi' | 'tetris';
export type ShortAction =
  Dir | 'left' | 'right' | 'rotate' | 'drop' | [number, number, number, number];
export function parseChallengeCode(
  value: string,
): { game: ShortGame; seed: number; code: string } | null {
  const match = /^GH1-(2048|XIANGQI|TETRIS)-(\d{1,4})$/i.exec(value.trim());
  if (!match || Number(match[2]) < 1) return null;
  const game = match[1].toLowerCase() as ShortGame;
  const seed = Number(match[2]);
  return { game, seed, code: `GH1-${game.toUpperCase()}-${seed}` };
}
export function validShortActions(
  game: ShortGame,
  value: unknown,
): value is ShortAction[] {
  return (
    Array.isArray(value) &&
    value.length <= 500 &&
    value.every((a) =>
      game === 'xiangqi'
        ? Array.isArray(a) &&
          a.length === 4 &&
          a.every(
            (n, i) => Number.isInteger(n) && n >= 0 && n < (i % 2 ? 9 : 10),
          )
        : typeof a === 'string' &&
          (game === '2048'
            ? ['up', 'down', 'left', 'right']
            : ['left', 'right', 'rotate', 'drop']
          ).includes(a),
    )
  );
}

export function replay2048(seed: number, actions: ShortAction[]) {
  let serial = 0;
  let state: Game2048State = {
    size: 4,
    tiles: {},
    score: 0,
    combo: 0,
    gameOver: false,
  };
  for (let i = 0; i < 4; i++) {
    const id = String(serial++);
    const r = Math.floor(i / 2);
    const c = i % 2;
    state.tiles[id] = {
      id,
      value: 32,
      r: seed % 2 ? r : 3 - r,
      c: seed % 3 ? c : 3 - c,
    };
  }
  let moves = 0;
  for (const action of actions) {
    if (
      moves >= 8 ||
      Object.values(state.tiles).some((t) => t.value >= 128 && !t.mergedInto) ||
      state.gameOver
    )
      break;
    const next = moveBoard(
      state,
      action as Dir,
      mulberry32(mixSeed(seed, moves)),
      () => String(serial++),
    );
    if (next.isMoved) {
      state = next.state;
      moves++;
    }
  }
  const won = Object.values(state.tiles).some(
    (t) => t.value >= 128 && !t.mergedInto,
  );
  return { state, moves, won, over: won || moves >= 8 || state.gameOver };
}
export function replayTetris(seed: number, actions: ShortAction[]) {
  let state = createInitialTetrisState(mulberry32(seed));
  state.status = 'playing';
  state.piece = 0;
  state.nextPiece = 0;
  const gap = seed % 10;
  for (let r = 16; r < 20; r++)
    state.board[r] = Array.from({ length: 10 }, (_, c) => (c === gap ? 0 : 2));
  for (let i = 0; i < actions.length; i++) {
    if (state.lines >= 4 || state.piecesLocked >= 4 || state.status === 'over')
      break;
    const action = actions[i];
    const input: TetrisAction =
      action === 'rotate'
        ? { type: 'rotate', direction: 'cw' }
        : action === 'drop'
          ? {
              type: 'hardDrop',
              rng: mulberry32(mixSeed(seed, state.piecesLocked)),
            }
          : { type: 'move', dx: action === 'left' ? -1 : 1 };
    state = applyTetrisAction(state, input).state;
  }
  return {
    state,
    won: state.lines >= 4,
    over:
      state.lines >= 4 ||
      state.piecesLocked >= 4 ||
      state.status === 'over' ||
      actions.length >= 500,
  };
}
export function replayXiangqi(seed: number, actions: ShortAction[]) {
  let board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const files = [0, 1, 2, 6, 7, 8];
  board[0][4] = { type: 'k', side: 'black' };
  board[9][4] = { type: 'k', side: 'red' };
  board[5][4] = { type: 'p', side: 'red' };
  board[1][files[seed % 6]] = { type: 'r', side: 'red' };
  board[2][files[(seed + 1) % 6]] = { type: 'r', side: 'red' };
  let moved = false;
  for (const action of actions) {
    if (!Array.isArray(action) || moved) break;
    const [r, c, tr, tc] = action;
    if (
      board[r][c]?.side !== 'red' ||
      !getSafeMoves(board, r, c).some(([y, x]) => y === tr && x === tc)
    )
      continue;
    board = movePiece(board, r, c, tr, tc);
    moved = true;
  }
  const result = moved ? getXiangqiResult(board, 'black') : null;
  return {
    board,
    won: result?.winner === 'red' && result.kind === 'checkmate',
    over: moved,
  };
}
