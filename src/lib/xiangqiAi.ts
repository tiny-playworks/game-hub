/** 中国象棋 AI：alpha-beta 剪枝的极小化极大搜索 */

import {
  type Board,
  getLegalMoves,
  getPieceValue,
  isInCheck,
  type Piece,
  type Side,
  XIANGQI_COLS,
  XIANGQI_ROWS,
  type XiangqiMove,
} from './xiangqi';

export type XiangqiDifficulty = 'easy' | 'normal' | 'hard';

/** 各难度的搜索层数（ply） */
const SEARCH_DEPTH: Record<XiangqiDifficulty, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
};

/** 将死分值，远大于任何子力差 */
const MATE_SCORE = 900000;
/** 节点预算：超出后直接返回静态评估，保证浏览器内同步搜索不会卡死 */
const MAX_NODES = 120000;
/** 分支太多时降一层，避免极端局面下耗时失控（象棋常规局面约 20-50 着） */
const WIDE_BRANCH_LIMIT = 60;
/** easy 难度从前 N 个候选里随机挑一个 */
const EASY_CANDIDATES = 3;

interface SearchState {
  nodes: number;
}

function opponentOf(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

/** 原地走子，返回被吃的子以便撤销（搜索期间避免整盘复制） */
function makeMove(board: Board, move: XiangqiMove): Piece | null {
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;
  const captured = board[toR][toC];
  board[toR][toC] = board[fromR][fromC];
  board[fromR][fromC] = null;
  return captured;
}

function unmakeMove(
  board: Board,
  move: XiangqiMove,
  captured: Piece | null,
): void {
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;
  board[fromR][fromC] = board[toR][toC];
  board[toR][toC] = captured;
}

/** side 的全部合法走法（走后不会让己方被将军） */
function generateMoves(board: Board, side: Side): XiangqiMove[] {
  const moves: XiangqiMove[] = [];
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.side !== side) continue;
      for (const [toR, toC] of getLegalMoves(board, r, c)) {
        const move: XiangqiMove = { from: [r, c], to: [toR, toC] };
        const captured = makeMove(board, move);
        const safe = !isInCheck(board, side);
        unmakeMove(board, move, captured);
        if (safe) moves.push(move);
      }
    }
  }
  return moves;
}

/** MVV-LVA：优先搜索「吃大子、用小子吃」的走法，剪枝效率更高 */
function moveOrderScore(board: Board, move: XiangqiMove): number {
  const victim = board[move.to[0]][move.to[1]];
  if (!victim) return 0;
  const attacker = board[move.from[0]][move.from[1]];
  const attackerValue = attacker ? getPieceValue(attacker.type) : 0;
  return getPieceValue(victim.type) * 10 - attackerValue;
}

function orderMoves(board: Board, moves: XiangqiMove[]): XiangqiMove[] {
  return moves
    .map((move) => ({ move, score: moveOrderScore(board, move) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

/** 静态评估，分值以 side 的视角给出 */
function evaluate(board: Board, side: Side): number {
  let score = 0;
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      let value = getPieceValue(piece.type);
      if (piece.type === 'p') {
        // 过河兵价值大增，且越靠近对方底线越值钱
        const advance = piece.side === 'red' ? 4 - r : r - 5;
        if (advance >= 0) value += 80 + advance * 10;
      } else if (
        piece.type === 'r' ||
        piece.type === 'c' ||
        piece.type === 'h'
      ) {
        value += 0.5 * getLegalMoves(board, r, c).length; // 机动性
        if (piece.type !== 'r' && c >= 3 && c <= 5) value += 20; // 马炮占中路
      }
      score += piece.side === side ? value : -value;
    }
  }
  return score;
}

/** 无棋可走：将死或困毙都算被将死方负；depth 越大表示越早成杀 */
function mateValue(maximizing: boolean, depth: number): number {
  return maximizing ? -(MATE_SCORE + depth) : MATE_SCORE + depth;
}

function search(
  board: Board,
  side: Side,
  sideToMove: Side,
  depth: number,
  alpha: number,
  beta: number,
  state: SearchState,
): number {
  const maximizing = sideToMove === side;
  state.nodes++;
  if (state.nodes >= MAX_NODES) return evaluate(board, side);

  if (depth <= 0) {
    // 叶子节点只在被将军时才验证是否已被将死，避免每个叶子都生成走法
    if (
      isInCheck(board, sideToMove) &&
      generateMoves(board, sideToMove).length === 0
    ) {
      return mateValue(maximizing, depth);
    }
    return evaluate(board, side);
  }

  const moves = orderMoves(board, generateMoves(board, sideToMove));
  if (moves.length === 0) return mateValue(maximizing, depth);

  const next = opponentOf(sideToMove);
  let currentAlpha = alpha;
  let currentBeta = beta;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const move of moves) {
    const captured = makeMove(board, move);
    const value = search(
      board,
      side,
      next,
      depth - 1,
      currentAlpha,
      currentBeta,
      state,
    );
    unmakeMove(board, move, captured);
    if (maximizing) {
      if (value > best) best = value;
      if (best > currentAlpha) currentAlpha = best;
    } else {
      if (value < best) best = value;
      if (best < currentBeta) currentBeta = best;
    }
    if (currentBeta <= currentAlpha) break; // 剪枝
  }
  return best;
}

/**
 * 为 side 选一步棋；没有合法走法（被将死或困毙）时返回 null。
 * 传入 rng 可保证结果可复现。
 */
export function chooseXiangqiMove(
  board: Board,
  side: Side,
  difficulty: XiangqiDifficulty,
  rng: () => number = Math.random,
): XiangqiMove | null {
  const work = cloneBoard(board);
  const moves = orderMoves(work, generateMoves(work, side));
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  let depth = SEARCH_DEPTH[difficulty];
  if (depth >= 3 && moves.length > WIDE_BRANCH_LIMIT) depth -= 1;

  const state: SearchState = { nodes: 0 };
  const next = opponentOf(side);
  // easy 需要对候选走法排序，因此根节点用全窗口搜索，避免剪枝产生的近似分值
  const narrowRoot = difficulty !== 'easy';
  const scored: { move: XiangqiMove; score: number }[] = [];
  let alpha = Number.NEGATIVE_INFINITY;
  for (const move of moves) {
    const captured = makeMove(work, move);
    const score = search(
      work,
      side,
      next,
      depth - 1,
      narrowRoot ? alpha : Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      state,
    );
    unmakeMove(work, move, captured);
    scored.push({ move, score });
    if (score > alpha) alpha = score;
  }

  if (difficulty !== 'easy') {
    let best = scored[0];
    for (const entry of scored) {
      if (entry.score > best.score) best = entry;
    }
    return best.move;
  }

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, Math.min(EASY_CANDIDATES, ranked.length));
  const index = Math.min(
    top.length - 1,
    Math.max(0, Math.floor(rng() * top.length)),
  );
  return top[index].move;
}
