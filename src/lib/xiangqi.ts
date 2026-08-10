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

/** 伪合法走法：只按棋子走法规则生成，不过滤照面，也不考虑走后己方是否被将军 */
function getPseudoMoves(
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
      return moves;
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
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
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
        // 无炮架时与车相同，只能走到空点
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && !board[r][c]) {
          tryAdd(r, c);
          r += dy;
          c += dx;
        }
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        // 越过炮架后只能吃第一个棋子，不能落在中间的空点
        r += dy;
        c += dx;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && !board[r][c]) {
          r += dy;
          c += dx;
        }
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) tryAdd(r, c);
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

/** 获取从 (fromR, fromC) 可走到的位置（将/帅额外过滤照面，但不检测走后是否被将军） */
export function getLegalMoves(
  board: Board,
  fromR: number,
  fromC: number,
): [number, number][] {
  const piece = board[fromR][fromC];
  if (!piece) return [];
  const moves = getPseudoMoves(board, fromR, fromC);
  if (piece.type !== 'k') return moves;
  // 过滤照面：移动后将到 (toR,toC)，检查是否与对方将照面
  return moves.filter(([toR, toC]) => {
    const simulated = board.map((row) => [...row]);
    simulated[toR][toC] = piece;
    simulated[fromR][fromC] = null;
    return !wouldKingsFace(simulated, toR, toC, piece.side);
  });
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

/** 一步棋：从 from 走到 to */
export interface XiangqiMove {
  from: [number, number];
  to: [number, number];
}

function opponentOf(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}

/** 双方将帅是否同列照面（中间无子） */
function kingsAreFacing(board: Board): boolean {
  const red = findKing(board, 'red');
  const black = findKing(board, 'black');
  if (!red || !black) return false;
  if (red[1] !== black[1]) return false;
  const col = red[1];
  const lo = Math.min(red[0], black[0]) + 1;
  const hi = Math.max(red[0], black[0]);
  for (let r = lo; r < hi; r++) {
    if (board[r][col]) return false;
  }
  return true;
}

const ORTHO_DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const HORSE_ORIGINS: readonly (readonly [number, number])[] = [
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
];

/**
 * (row, col) 是否被 by 一方的棋子攻击。
 * 用「从被攻击点反向扫描」代替遍历所有敌子生成走法，结果与逐子枚举伪合法走法等价，
 * 但没有数组分配，AI 搜索时快很多（等价性由 tests/xiangqi-rules.test.ts 的随机对拍用例保证）。
 * 士/象因活动范围受限，永远无法攻击到对方将/帅所在的九宫，故无需检测。
 */
function isSquareAttacked(
  board: Board,
  row: number,
  col: number,
  by: Side,
): boolean {
  // 车 / 炮 / 贴身或照面的将帅：沿四个正方向扫描
  for (const [dy, dx] of ORTHO_DIRS) {
    let r = row + dy;
    let c = col + dx;
    let step = 0;
    let hasScreen = false;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      step++;
      const p = board[r][c];
      if (p) {
        if (!hasScreen) {
          if (p.side === by) {
            if (p.type === 'r') return true;
            // 将帅贴身可吃，同列时为照面
            if (p.type === 'k' && (step === 1 || dx === 0)) return true;
          }
          hasScreen = true; // 任意棋子都可作炮架
        } else {
          if (p.side === by && p.type === 'c') return true;
          break;
        }
      }
      r += dy;
      c += dx;
    }
  }
  // 马：反查八个可能的马位，并检查蹩马腿
  for (const [dr, dc] of HORSE_ORIGINS) {
    const hr = row + dr;
    const hc = col + dc;
    if (hr < 0 || hr >= ROWS || hc < 0 || hc >= COLS) continue;
    const p = board[hr][hc];
    if (!p || p.type !== 'h' || p.side !== by) continue;
    const legR = Math.abs(dr) === 2 ? hr - Math.sign(dr) : hr;
    const legC = Math.abs(dc) === 2 ? hc - Math.sign(dc) : hc;
    if (!board[legR][legC]) return true;
  }
  // 兵/卒：正前方一格；过河后还可横吃
  const pawnRow = by === 'red' ? row + 1 : row - 1;
  if (pawnRow >= 0 && pawnRow < ROWS) {
    const p = board[pawnRow][col];
    if (p && p.type === 'p' && p.side === by) return true;
  }
  const pawnCrossed = by === 'red' ? row <= 4 : row >= 5;
  if (pawnCrossed) {
    for (const dc of [-1, 1]) {
      const pc = col + dc;
      if (pc < 0 || pc >= COLS) continue;
      const p = board[row][pc];
      if (p && p.type === 'p' && p.side === by) return true;
    }
  }
  return false;
}

/** side 一方是否被将军（含双方将帅照面的非法局面） */
export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return false;
  if (kingsAreFacing(board)) return true;
  return isSquareAttacked(board, king[0], king[1], opponentOf(side));
}

/** 真正合法的走法：走完之后己方不能仍被将军（含不能送将、不能照面） */
export function getSafeMoves(
  board: Board,
  fromR: number,
  fromC: number,
): [number, number][] {
  const piece = board[fromR][fromC];
  if (!piece) return [];
  const side = piece.side;
  return getLegalMoves(board, fromR, fromC).filter(([toR, toC]) => {
    const next = movePiece(board, fromR, fromC, toR, toC);
    return !isInCheck(next, side);
  });
}

/** side 一方当前所有合法走法 */
export function getAllSafeMoves(board: Board, side: Side): XiangqiMove[] {
  const result: XiangqiMove[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p || p.side !== side) continue;
      for (const [toR, toC] of getSafeMoves(board, r, c)) {
        result.push({ from: [r, c], to: [toR, toC] });
      }
    }
  }
  return result;
}

export type XiangqiResult =
  | { kind: 'checkmate'; winner: Side }
  | { kind: 'stalemate'; winner: Side }
  | null;

/** 判定当前局面结果。象棋中被困毙（无棋可走）同样判负 */
export function getXiangqiResult(
  board: Board,
  sideToMove: Side,
): XiangqiResult {
  if (getAllSafeMoves(board, sideToMove).length > 0) return null;
  const winner = opponentOf(sideToMove);
  return isInCheck(board, sideToMove)
    ? { kind: 'checkmate', winner }
    : { kind: 'stalemate', winner };
}

const PIECE_VALUES: Record<PieceType, number> = {
  r: 900,
  c: 450,
  h: 400,
  e: 200,
  a: 200,
  p: 100,
  k: 100000,
};

/** 棋子基础价值，供 AI 评估使用 */
export function getPieceValue(type: PieceType): number {
  return PIECE_VALUES[type];
}

const CHINESE_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 红方用汉字数字，黑方用阿拉伯数字；n 取值 1-9 */
function numeralFor(side: Side, n: number): string {
  if (side === 'black') return String(n);
  return CHINESE_DIGITS[n - 1] ?? String(n);
}

/** 纵线序号：红方自右向左为一至九，黑方自左向右为 1 至 9 */
function fileNumber(side: Side, col: number): string {
  return numeralFor(side, side === 'red' ? COLS - col : col + 1);
}

/** 记谱时不带纵线序号、改用前/后区分的棋子（同线同名子） */
function samePieceRowsOnFile(
  board: Board,
  col: number,
  piece: Piece,
): number[] {
  const rows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    const p = board[r][col];
    if (p && p.type === piece.type && p.side === piece.side) rows.push(r);
  }
  return rows;
}

/** 生成中文记谱，如「炮二平五」「马８进７」。board 为走子之前的局面 */
export function toChineseMoveNotation(board: Board, move: XiangqiMove): string {
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;
  const piece = board[fromR][fromC];
  if (!piece) return '';
  const side = piece.side;
  const name = getPieceLabel(piece);

  // 同一纵线上有两个同名子时用前/后代替纵线序号
  const rows = samePieceRowsOnFile(board, fromC, piece);
  let head: string;
  if (rows.length >= 2) {
    // 红方向 row 小的方向为前，黑方相反
    const frontRow = side === 'red' ? rows[0] : rows[rows.length - 1];
    const backRow = side === 'red' ? rows[rows.length - 1] : rows[0];
    if (fromR === frontRow) head = `前${name}`;
    else if (fromR === backRow) head = `后${name}`;
    else head = `中${name}`;
  } else {
    head = `${name}${fileNumber(side, fromC)}`;
  }

  if (toR === fromR) return `${head}平${fileNumber(side, toC)}`;

  const forward = side === 'red' ? -1 : 1;
  const dir = (toR - fromR) * forward > 0 ? '进' : '退';
  // 马/象/士 斜行，尾数记目标纵线；车炮兵将直行，尾数记步数
  const diagonal =
    piece.type === 'h' || piece.type === 'e' || piece.type === 'a';
  const tail = diagonal
    ? fileNumber(side, toC)
    : numeralFor(side, Math.abs(toR - fromR));
  return `${head}${dir}${tail}`;
}
