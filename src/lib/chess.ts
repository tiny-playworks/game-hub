/** 国际象棋：8×8，row 0 为黑方底线，row 7 为白方底线 */

export type Side = 'white' | 'black';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface Piece {
  type: PieceType;
  side: Side;
}

export type Board = (Piece | null)[][];

const COLS = 8;
const ROWS = 8;

export const CHESS_COLS = COLS;
export const CHESS_ROWS = ROWS;

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 判断 (r, c) 是否被 side 一方攻击（用于将/杀检测） */
export function isSquareAttacked(
  board: Board,
  r: number,
  c: number,
  bySide: Side,
): boolean {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const p = board[row][col];
      if (!p || p.side !== bySide) continue;
      const dr = r - row;
      const dc = c - col;
      switch (p.type) {
        case 'K':
          if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) return true;
          break;
        case 'Q':
          if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
            const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
            const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
            let nr = row + stepR;
            let nc = col + stepC;
            while (nr !== r || nc !== c) {
              if (board[nr][nc]) break;
              nr += stepR;
              nc += stepC;
            }
            if (nr === r && nc === c) return true;
          }
          break;
        case 'R':
          if (dr === 0 || dc === 0) {
            const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
            const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
            let nr = row + stepR;
            let nc = col + stepC;
            while (nr !== r || nc !== c) {
              if (board[nr][nc]) break;
              nr += stepR;
              nc += stepC;
            }
            if (nr === r && nc === c) return true;
          }
          break;
        case 'B':
          if (Math.abs(dr) === Math.abs(dc)) {
            const stepR = dr > 0 ? 1 : -1;
            const stepC = dc > 0 ? 1 : -1;
            let nr = row + stepR;
            let nc = col + stepC;
            while (nr !== r || nc !== c) {
              if (board[nr][nc]) break;
              nr += stepR;
              nc += stepC;
            }
            if (nr === r && nc === c) return true;
          }
          break;
        case 'N': {
          const d = [Math.abs(dr), Math.abs(dc)].sort((a, b) => b - a);
          if (d[0] === 2 && d[1] === 1) return true;
          break;
        }
        case 'P': {
          const dir = bySide === 'white' ? -1 : 1;
          if (row + dir === r && Math.abs(col - c) === 1) return true;
          break;
        }
      }
    }
  }
  return false;
}

/** 获取从 (fromR, fromC) 可走到的位置（不滤除“移动后己方王被将”的走法，由调用方在应用走子时用） */
function getRawMoves(
  board: Board,
  fromR: number,
  fromC: number,
): [number, number][] {
  const piece = board[fromR][fromC];
  if (!piece) return [];
  const moves: [number, number][] = [];
  const side = piece.side;
  const dir = side === 'white' ? -1 : 1;

  const tryAdd = (r: number, c: number) => {
    if (!inBounds(r, c)) return;
    const target = board[r][c];
    if (target?.side === side) return;
    moves.push([r, c]);
  };

  switch (piece.type) {
    case 'K': {
      for (const dr of [-1, 0, 1]) {
        for (const dc of [-1, 0, 1]) {
          if (dr === 0 && dc === 0) continue;
          tryAdd(fromR + dr, fromC + dc);
        }
      }
      return moves;
    }
    case 'Q':
    case 'R': {
      for (const [stepR, stepC] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let r = fromR + stepR;
        let c = fromC + stepC;
        while (inBounds(r, c)) {
          tryAdd(r, c);
          if (board[r][c]) break;
          r += stepR;
          c += stepC;
        }
      }
      if (piece.type === 'R') return moves;
      for (const [stepR, stepC] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        let r = fromR + stepR;
        let c = fromC + stepC;
        while (inBounds(r, c)) {
          tryAdd(r, c);
          if (board[r][c]) break;
          r += stepR;
          c += stepC;
        }
      }
      return moves;
    }
    case 'B':
      for (const [stepR, stepC] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        let r = fromR + stepR;
        let c = fromC + stepC;
        while (inBounds(r, c)) {
          tryAdd(r, c);
          if (board[r][c]) break;
          r += stepR;
          c += stepC;
        }
      }
      return moves;
    case 'N': {
      for (const [dr, dc] of [
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
      ]) {
        tryAdd(fromR + dr, fromC + dc);
      }
      return moves;
    }
    case 'P': {
      const one = fromR + dir;
      const two = fromR + 2 * dir;
      const startRow = side === 'white' ? 6 : 1;
      if (inBounds(one, fromC) && !board[one][fromC]) {
        moves.push([one, fromC]);
        if (fromR === startRow && inBounds(two, fromC) && !board[two][fromC]) {
          moves.push([two, fromC]);
        }
      }
      for (const dc of [fromC - 1, fromC + 1]) {
        if (
          inBounds(one, dc) &&
          board[one][dc]?.side !== side &&
          board[one][dc]
        )
          moves.push([one, dc]);
      }
      return moves;
    }
    default:
      return moves;
  }
}

/** 仅返回移动后己方王不被将的走法 */
export function getLegalMoves(
  board: Board,
  fromR: number,
  fromC: number,
): [number, number][] {
  const piece = board[fromR][fromC];
  if (!piece) return [];
  const raw = getRawMoves(board, fromR, fromC);
  const opponent: Side = piece.side === 'white' ? 'black' : 'white';
  return raw.filter(([toR, toC]) => {
    const next = movePiece(board, fromR, fromC, toR, toC);
    const kingPos = findKing(next, piece.side);
    if (!kingPos) return false;
    return !isSquareAttacked(next, kingPos[0], kingPos[1], opponent);
  });
}

export function createInitialBoard(): Board {
  const board = emptyBoard();
  const white: Side = 'white';
  const black: Side = 'black';
  // Black back rank (row 0)
  board[0][0] = board[0][7] = { type: 'R', side: black };
  board[0][1] = board[0][6] = { type: 'N', side: black };
  board[0][2] = board[0][5] = { type: 'B', side: black };
  board[0][3] = { type: 'Q', side: black };
  board[0][4] = { type: 'K', side: black };
  for (let c = 0; c < 8; c++) board[1][c] = { type: 'P', side: black };
  // White back rank (row 7)
  board[7][0] = board[7][7] = { type: 'R', side: white };
  board[7][1] = board[7][6] = { type: 'N', side: white };
  board[7][2] = board[7][5] = { type: 'B', side: white };
  board[7][3] = { type: 'Q', side: white };
  board[7][4] = { type: 'K', side: white };
  for (let c = 0; c < 8; c++) board[6][c] = { type: 'P', side: white };
  return board;
}

/** 移动并处理兵升变：到底线升后 */
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
  if (piece.type === 'P' && (toR === 0 || toR === 7)) {
    next[toR][toC] = { type: 'Q', side: piece.side };
  } else {
    next[toR][toC] = piece;
  }
  return next;
}

export function findKing(board: Board, side: Side): [number, number] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p?.type === 'K' && p.side === side) return [r, c];
    }
  }
  return null;
}

/** 是否被将：当前轮到 side 走，side 的王是否被对方攻击 */
export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return false;
  const opponent: Side = side === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, king[0], king[1], opponent);
}

/** 当前方是否有任何合法走法 */
export function hasAnyLegalMove(board: Board, side: Side): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p?.side === side && getLegalMoves(board, r, c).length > 0)
        return true;
    }
  }
  return false;
}

const PIECE_SYMBOLS: Record<Side, Record<PieceType, string>> = {
  white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

export function getPieceLabel(piece: Piece): string {
  return PIECE_SYMBOLS[piece.side][piece.type];
}
