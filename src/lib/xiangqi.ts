/** 中国象棋：9 列 x 10 行，row 0 为黑方底线，row 9 为红方底线 */

export type Side = 'red' | 'black';
export type PieceType = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p'; // 将帅 士 象 马 车 炮 兵卒

export interface Piece {
  type: PieceType;
  side: Side;
}

export type Board = (Piece | null)[][]; // board[row][col]

const COLS = 9;
const ROWS = 10;

export const XIANGQI_COLS = COLS;
export const XIANGQI_ROWS = ROWS;

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

/** 红方九宫: row 7-9, col 3-5；黑方九宫: row 0-2, col 3-5 */
function inPalace(row: number, col: number, side: Side): boolean {
  if (side === 'red') return row >= 7 && row <= 9 && col >= 3 && col <= 5;
  return row >= 0 && row <= 2 && col >= 3 && col <= 5;
}

/** 红方象不过河: row >= 5；黑方象不过河: row <= 4 */
function elephantRegion(row: number, side: Side): boolean {
  return side === 'red' ? row >= 5 : row <= 4;
}

/** 将帅不能同列照面。移动后己方将在 (toR, toC)，检查是否与对方将同列且中间无子 */
function wouldKingsFace(
  board: Board,
  toR: number,
  toC: number,
  movingSide: Side,
): boolean {
  let otherKingR = -1;
  for (let r = 0; r < ROWS; r++) {
    const p = board[r][toC];
    if (p?.type === 'k' && p.side !== movingSide) {
      otherKingR = r;
      break;
    }
  }
  if (otherKingR < 0) return false;
  const lo = Math.min(toR, otherKingR) + 1;
  const hi = Math.max(toR, otherKingR);
  for (let r = lo; r < hi; r++) {
    if (board[r][toC]) return false;
  }
  return true;
}

function addMove(
  moves: [number, number][],
  board: Board,
  row: number,
  col: number,
  side: Side,
): void {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
  const target = board[row][col];
  if (target?.side === side) return; // 不能吃己方
  moves.push([row, col]);
}

/** 获取从 (fromR, fromC) 可走到的位置 */
export function getLegalMoves(
  board: Board,
  fromR: number,
  fromC: number,
): [number, number][] {
  const piece = board[fromR][fromC];
  if (!piece) return [];
  const moves: [number, number][] = [];
  const side = piece.side;
  const dr = side === 'red' ? -1 : 1; // 红方“前”为 row 减

  const tryAdd = (r: number, c: number) => addMove(moves, board, r, c, side);

  switch (piece.type) {
    case 'k': {
      for (const [dy, dx] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const r = fromR + dy;
        const c = fromC + dx;
        if (inPalace(r, c, side)) tryAdd(r, c);
      }
      // 过滤照面：移动后将到 (toR,toC)，检查是否与对方将照面
      return moves.filter(([toR, toC]) => {
        const simulated = board.map((row) => [...row]);
        simulated[toR][toC] = piece;
        simulated[fromR][fromC] = null;
        return !wouldKingsFace(simulated, toR, toC, side);
      });
    }
    case 'a': {
      for (const [dy, dx] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        const r = fromR + dy;
        const c = fromC + dx;
        if (inPalace(r, c, side)) tryAdd(r, c);
      }
      return moves;
    }
    case 'e': {
      for (const [dy, dx] of [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2],
      ]) {
        const r = fromR + dy;
        const c = fromC + dx;
        if (!elephantRegion(r, side)) continue;
        const midR = fromR + dy / 2;
        const midC = fromC + dx / 2;
        if (board[midR][midC]) continue; // 塞象眼
        tryAdd(r, c);
      }
      return moves;
    }
    case 'h': {
      for (const [legR, legC, toR, toC] of [
        [fromR - 1, fromC, fromR - 2, fromC - 1],
        [fromR - 1, fromC, fromR - 2, fromC + 1],
        [fromR + 1, fromC, fromR + 2, fromC - 1],
        [fromR + 1, fromC, fromR + 2, fromC + 1],
        [fromR, fromC - 1, fromR - 1, fromC - 2],
        [fromR, fromC - 1, fromR + 1, fromC - 2],
        [fromR, fromC + 1, fromR - 1, fromC + 2],
        [fromR, fromC + 1, fromR + 1, fromC + 2],
      ]) {
        if (legR < 0 || legR >= ROWS || legC < 0 || legC >= COLS) continue;
        if (board[legR][legC]) continue; // 蹩马腿
        tryAdd(toR, toC);
      }
      return moves;
    }
    case 'r': {
      for (const [dy, dx] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        let r = fromR + dy;
        let c = fromC + dx;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          tryAdd(r, c);
          if (board[r][c]) break;
          r += dy;
          c += dx;
        }
      }
      return moves;
    }
    case 'c': {
      for (const [dy, dx] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        let r = fromR + dy;
        let c = fromC + dx;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          if (!board[r][c]) tryAdd(r, c);
          else {
            r += dy;
            c += dx;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
              tryAdd(r, c);
              if (board[r][c]) break;
              r += dy;
              c += dx;
            }
            break;
          }
          r += dy;
          c += dx;
        }
      }
      return moves;
    }
    case 'p': {
      tryAdd(fromR + dr, fromC);
      const overRiver = side === 'red' ? fromR <= 4 : fromR >= 5;
      if (overRiver) {
        tryAdd(fromR, fromC - 1);
        tryAdd(fromR, fromC + 1);
      }
      return moves;
    }
    default:
      return moves;
  }
}

export function createInitialBoard(): Board {
  const board = emptyBoard();
  const red: Side = 'red';
  const black: Side = 'black';
  // 黑方 row 0-3
  board[0][0] = board[0][8] = { type: 'r', side: black };
  board[0][1] = board[0][7] = { type: 'h', side: black };
  board[0][2] = board[0][6] = { type: 'e', side: black };
  board[0][3] = board[0][5] = { type: 'a', side: black };
  board[0][4] = { type: 'k', side: black };
  board[2][1] = board[2][7] = { type: 'c', side: black };
  for (const c of [0, 2, 4, 6, 8]) board[3][c] = { type: 'p', side: black };
  // 红方 row 6-9
  board[9][0] = board[9][8] = { type: 'r', side: red };
  board[9][1] = board[9][7] = { type: 'h', side: red };
  board[9][2] = board[9][6] = { type: 'e', side: red };
  board[9][3] = board[9][5] = { type: 'a', side: red };
  board[9][4] = { type: 'k', side: red };
  board[7][1] = board[7][7] = { type: 'c', side: red };
  for (const c of [0, 2, 4, 6, 8]) board[6][c] = { type: 'p', side: red };
  return board;
}

export function movePiece(
  board: Board,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
): Board {
  const next = board.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null)),
  );
  const piece = next[fromR][fromC];
  if (!piece) return board;
  next[fromR][fromC] = null;
  next[toR][toC] = piece;
  return next;
}

/** 是否将死：对方将/帅被吃 */
export function findKing(board: Board, side: Side): [number, number] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p?.type === 'k' && p.side === side) return [r, c];
    }
  }
  return null;
}

export const PIECE_LABELS: Record<PieceType, { red: string; black: string }> = {
  k: { red: '帅', black: '将' },
  a: { red: '仕', black: '士' },
  e: { red: '相', black: '象' },
  h: { red: '马', black: '马' },
  r: { red: '车', black: '车' },
  c: { red: '炮', black: '炮' },
  p: { red: '兵', black: '卒' },
};

export function getPieceLabel(piece: Piece): string {
  return PIECE_LABELS[piece.type][piece.side];
}
