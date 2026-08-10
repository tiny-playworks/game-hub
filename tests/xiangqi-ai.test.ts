import { expect, test } from '@rstest/core';
import {
  type Board,
  createInitialBoard,
  getAllSafeMoves,
  getXiangqiResult,
  movePiece,
  type Piece,
  type PieceType,
  type Side,
  XIANGQI_COLS,
  XIANGQI_ROWS,
  type XiangqiMove,
} from '../src/lib/xiangqi';
import { chooseXiangqiMove } from '../src/lib/xiangqiAi';

function emptyBoard(): Board {
  return Array.from({ length: XIANGQI_ROWS }, () =>
    Array.from({ length: XIANGQI_COLS }, () => null as Piece | null),
  );
}

function place(
  board: Board,
  row: number,
  col: number,
  type: PieceType,
  side: Side,
): void {
  board[row][col] = { type, side };
}

function isLegal(board: Board, side: Side, move: XiangqiMove): boolean {
  return getAllSafeMoves(board, side).some(
    (m) =>
      m.from[0] === move.from[0] &&
      m.from[1] === move.from[1] &&
      m.to[0] === move.to[0] &&
      m.to[1] === move.to[1],
  );
}

/** 固定序列的伪随机数，保证 easy 难度可复现 */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('开局各难度都返回合法着法', () => {
  const board = createInitialBoard();
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseXiangqiMove(board, 'red', difficulty, seededRng(1));
    expect(move).not.toBeNull();
    if (!move) return;
    expect(isLegal(board, 'red', move)).toBe(true);
  }
});

test('无棋可走时返回 null', () => {
  const board = emptyBoard();
  place(board, 0, 4, 'k', 'black');
  place(board, 9, 3, 'k', 'red');
  place(board, 0, 0, 'r', 'red');
  place(board, 1, 0, 'r', 'red');
  expect(chooseXiangqiMove(board, 'black', 'hard')).toBeNull();
});

test('白吃对方无根车时会主动吃子', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 3, 'k', 'black');
  place(board, 9, 0, 'r', 'red');
  place(board, 5, 0, 'r', 'black'); // 无保护的黑车

  const move = chooseXiangqiMove(board, 'red', 'normal', seededRng(7));
  expect(move).toEqual({ from: [9, 0], to: [5, 0] });
});

test('能一步杀时必定走出杀着', () => {
  const board = emptyBoard();
  place(board, 0, 4, 'k', 'black');
  place(board, 9, 3, 'k', 'red');
  place(board, 1, 0, 'r', 'red'); // 已封住次底线
  place(board, 5, 8, 'r', 'red'); // 进底线即成绝杀
  place(board, 6, 0, 'p', 'black'); // 黑方尚有闲着，排除困毙的可能

  const move = chooseXiangqiMove(board, 'red', 'hard', seededRng(3));
  expect(move).not.toBeNull();
  if (!move) return;
  const next = movePiece(board, ...move.from, ...move.to);
  expect(getXiangqiResult(next, 'black')).toEqual({
    kind: 'checkmate',
    winner: 'red',
  });
});

test('给定相同 rng 时结果可复现', () => {
  const board = createInitialBoard();
  const first = chooseXiangqiMove(board, 'red', 'easy', seededRng(42));
  const second = chooseXiangqiMove(board, 'red', 'easy', seededRng(42));
  expect(first).toEqual(second);

  const other = chooseXiangqiMove(board, 'red', 'easy', () => 0);
  expect(other).not.toBeNull();
  if (!other) return;
  expect(isLegal(board, 'red', other)).toBe(true);
});

test('normal 与 hard 不依赖随机数，结果稳定', () => {
  const board = createInitialBoard();
  expect(chooseXiangqiMove(board, 'red', 'hard', () => 0)).toEqual(
    chooseXiangqiMove(board, 'red', 'hard', () => 0.999),
  );
});

test('AI 不会走出让自己被将军的着法', () => {
  let board = createInitialBoard();
  let side: Side = 'red';
  for (let ply = 0; ply < 12; ply++) {
    const move = chooseXiangqiMove(board, side, 'normal', seededRng(ply + 1));
    expect(move).not.toBeNull();
    if (!move) break;
    expect(isLegal(board, side, move)).toBe(true);
    board = movePiece(board, ...move.from, ...move.to);
    side = side === 'red' ? 'black' : 'red';
  }
});

test('hard 难度（3 层搜索）耗时在预算内', () => {
  const board = createInitialBoard();
  const started = Date.now();
  const move = chooseXiangqiMove(board, 'red', 'hard', seededRng(9));
  const elapsed = Date.now() - started;
  expect(move).not.toBeNull();
  expect(elapsed).toBeLessThan(1500);
});
