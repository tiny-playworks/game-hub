/** 国际象棋 AI：Alpha-Beta 极小化极大搜索 + 子力/位置/机动性评估 */

import {
  type Board,
  CHESS_COLS,
  CHESS_ROWS,
  getLegalMoves,
  isInCheck,
  movePiece,
  type PieceType,
  type Side,
} from './chess';

export interface ChessMove {
  from: [number, number];
  to: [number, number];
}

export type ChessDifficulty = 'easy' | 'normal' | 'hard';

const ROWS = CHESS_ROWS;
const COLS = CHESS_COLS;

/** 将杀基准分，按剩余深度微调，使更快的杀着得分更高 */
const MATE_SCORE = 900_000;
/** 双象加成 */
const BISHOP_PAIR_BONUS = 30;
/** 机动性权重（每个伪合法目标格） */
const MOBILITY_WEIGHT = 2;
/** easy 在前若干着法中随机 */
const EASY_TOP_MOVES = 3;

const SEARCH_DEPTH: Record<ChessDifficulty, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
};

const PIECE_VALUE: Record<PieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20_000,
};

/**
 * 位置价值表，以白方视角书写：第 0 行对应 row 0（白方最远的底线），
 * 黑方查表时按 7 - row 镜像。
 */
const PAWN_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_TABLE: number[][] = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_TABLE: number[][] = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const KING_TABLE: number[][] = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const PIECE_SQUARE_TABLE: Record<PieceType, number[][] | null> = {
  P: PAWN_TABLE,
  N: KNIGHT_TABLE,
  B: BISHOP_TABLE,
  R: ROOK_TABLE,
  Q: null,
  K: KING_TABLE,
};

const SLIDING_DIRS: Record<'R' | 'B', [number, number][]> = {
  R: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  B: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

const KNIGHT_DELTAS: [number, number][] = [
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
];

function other(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 枚举 side 一方全部合法走法（getLegalMoves 已过滤送将） */
export function getAllChessMoves(board: Board, side: Side): ChessMove[] {
  const moves: ChessMove[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece?.side !== side) continue;
      for (const [toR, toC] of getLegalMoves(board, r, c)) {
        moves.push({ from: [r, c], to: [toR, toC] });
      }
    }
  }
  return moves;
}

function pieceSquareValue(
  type: PieceType,
  side: Side,
  r: number,
  c: number,
): number {
  const table = PIECE_SQUARE_TABLE[type];
  if (!table) return 0;
  return table[side === 'white' ? r : ROWS - 1 - r][c];
}

/** 伪合法机动性：只统计马与滑行子（象/车/后），忽略是否送将，足够廉价 */
function pseudoMobility(board: Board, side: Side): number {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece?.side !== side) continue;
      if (piece.type === 'N') {
        for (const [dr, dc] of KNIGHT_DELTAS) {
          const nr = r + dr;
          const nc = c + dc;
          if (inBounds(nr, nc) && board[nr][nc]?.side !== side) count++;
        }
        continue;
      }
      const dirs: [number, number][] = [];
      if (piece.type === 'R' || piece.type === 'Q')
        dirs.push(...SLIDING_DIRS.R);
      if (piece.type === 'B' || piece.type === 'Q')
        dirs.push(...SLIDING_DIRS.B);
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (target?.side === side) break;
          count++;
          if (target) break;
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return count;
}

/** 静态评估，返回值为 side 视角（越大对 side 越有利） */
function evaluate(board: Board, side: Side): number {
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const value =
        PIECE_VALUE[piece.type] +
        pieceSquareValue(piece.type, piece.side, r, c);
      score += piece.side === 'white' ? value : -value;
      if (piece.type === 'B') {
        if (piece.side === 'white') whiteBishops++;
        else blackBishops++;
      }
    }
  }
  if (whiteBishops >= 2) score += BISHOP_PAIR_BONUS;
  if (blackBishops >= 2) score -= BISHOP_PAIR_BONUS;
  score +=
    (pseudoMobility(board, 'white') - pseudoMobility(board, 'black')) *
    MOBILITY_WEIGHT;
  return side === 'white' ? score : -score;
}

/** MVV-LVA：优先搜索“吃大子、用小子”的走法，提升剪枝效率 */
function orderMoves(board: Board, moves: ChessMove[]): ChessMove[] {
  const keyed = moves.map((move, order) => {
    const victim = board[move.to[0]][move.to[1]];
    const attacker = board[move.from[0]][move.from[1]];
    const score = victim
      ? PIECE_VALUE[victim.type] * 10 -
        (attacker ? PIECE_VALUE[attacker.type] : 0)
      : 0;
    return { move, order, score };
  });
  keyed.sort((a, b) =>
    b.score === a.score ? a.order - b.order : b.score - a.score,
  );
  return keyed.map((item) => item.move);
}

function negamax(
  board: Board,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0) {
    // 叶子节点只补一次「被将且无法应将」的判定，避免漏掉最后一步的杀
    if (isInCheck(board, side) && getAllChessMoves(board, side).length === 0) {
      return -MATE_SCORE;
    }
    return evaluate(board, side);
  }
  const moves = getAllChessMoves(board, side);
  if (moves.length === 0) {
    // 被将且无着法为将杀，否则和棋（逼和）
    return isInCheck(board, side) ? -(MATE_SCORE + depth) : 0;
  }
  const ordered = orderMoves(board, moves);
  const opponent = other(side);
  let best = Number.NEGATIVE_INFINITY;
  let localAlpha = alpha;
  for (const move of ordered) {
    const next = movePiece(
      board,
      move.from[0],
      move.from[1],
      move.to[0],
      move.to[1],
    );
    const score = -negamax(next, opponent, depth - 1, -beta, -localAlpha);
    if (score > best) best = score;
    if (best > localAlpha) localAlpha = best;
    if (localAlpha >= beta) break;
  }
  return best;
}

interface ScoredChessMove {
  move: ChessMove;
  score: number;
}

/**
 * 根节点搜索。
 * @param narrow 是否收窄 alpha 窗口：加速但非最优着法只得到上界分
 */
function searchRoot(
  board: Board,
  side: Side,
  depth: number,
  narrow: boolean,
): ScoredChessMove[] {
  const ordered = orderMoves(board, getAllChessMoves(board, side));
  const opponent = other(side);
  const results: ScoredChessMove[] = [];
  let alpha = Number.NEGATIVE_INFINITY;
  for (const move of ordered) {
    const next = movePiece(
      board,
      move.from[0],
      move.from[1],
      move.to[0],
      move.to[1],
    );
    const window = narrow ? -alpha : Number.POSITIVE_INFINITY;
    const score = -negamax(
      next,
      opponent,
      depth - 1,
      Number.NEGATIVE_INFINITY,
      window,
    );
    results.push({ move, score });
    if (score > alpha) alpha = score;
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * 为 side 一方选择走法。
 * @param difficulty easy 深度 1 且在前三选一；normal 深度 2；hard 深度 3
 * @param rng 随机源，传入固定实现可得确定性结果
 * @returns 走法；无合法走法（将杀/逼和）时返回 null
 */
export function chooseChessMove(
  board: Board,
  side: Side,
  difficulty: ChessDifficulty,
  rng: () => number = Math.random,
): ChessMove | null {
  const depth = SEARCH_DEPTH[difficulty];
  const results = searchRoot(board, side, depth, difficulty !== 'easy');
  if (results.length === 0) return null;
  if (difficulty !== 'easy') return results[0].move;
  const pool = results.slice(0, Math.min(EASY_TOP_MOVES, results.length));
  const pick = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[Math.max(0, pick)].move;
}
