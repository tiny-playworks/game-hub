import { expect, test } from '@rstest/core';
import { GOMOKU_SIZE, type GomokuStone } from '../src/lib/gomoku';
import { chooseGomokuMove } from '../src/lib/gomokuAi';

function idx(r: number, c: number): number {
  return r * GOMOKU_SIZE + c;
}

function emptyBoard(): GomokuStone[] {
  return Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
}

/** 线性同余随机源，保证测试可复现 */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

test('空棋盘落天元', () => {
  expect(chooseGomokuMove(emptyBoard(), 'B', 'normal')).toBe(idx(7, 7));
  expect(chooseGomokuMove(emptyBoard(), 'W', 'hard')).toBe(idx(7, 7));
});

test('自己有四连时直接成五', () => {
  const board = emptyBoard();
  for (let c = 3; c <= 6; c++) board[idx(5, c)] = 'B';
  board[idx(0, 0)] = 'W';
  board[idx(0, 1)] = 'W';
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseGomokuMove(board, 'B', difficulty, makeRng(7));
    expect([idx(5, 2), idx(5, 7)]).toContain(move);
  }
});

test('堵掉对手的活四', () => {
  const board = emptyBoard();
  for (let c = 3; c <= 6; c++) board[idx(5, c)] = 'W';
  board[idx(9, 9)] = 'B';
  board[idx(10, 10)] = 'B';
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseGomokuMove(board, 'B', difficulty, makeRng(11));
    expect([idx(5, 2), idx(5, 7)]).toContain(move);
  }
});

test('堵掉对手的活三', () => {
  const board = emptyBoard();
  for (let c = 5; c <= 7; c++) board[idx(5, c)] = 'W';
  board[idx(10, 2)] = 'B';
  expect([idx(5, 4), idx(5, 8)]).toContain(
    chooseGomokuMove(board, 'B', 'normal'),
  );
  expect([idx(5, 4), idx(5, 8)]).toContain(
    chooseGomokuMove(board, 'B', 'hard'),
  );
});

test('成五优先于堵对手', () => {
  const board = emptyBoard();
  for (let c = 3; c <= 6; c++) board[idx(2, c)] = 'B';
  for (let c = 3; c <= 6; c++) board[idx(9, c)] = 'W';
  const move = chooseGomokuMove(board, 'B', 'normal');
  expect([idx(2, 2), idx(2, 7)]).toContain(move);
});

test('传入固定随机源时结果确定', () => {
  const board = emptyBoard();
  board[idx(7, 7)] = 'B';
  board[idx(7, 8)] = 'W';
  board[idx(6, 7)] = 'B';
  board[idx(8, 8)] = 'W';
  const first = chooseGomokuMove(board, 'B', 'easy', makeRng(2026));
  for (let i = 0; i < 5; i++) {
    expect(chooseGomokuMove(board, 'B', 'easy', makeRng(2026))).toBe(first);
  }
  const hard = chooseGomokuMove(board, 'B', 'hard', makeRng(1));
  expect(chooseGomokuMove(board, 'B', 'hard', makeRng(99))).toBe(hard);
});

test('返回的落点必须是空位', () => {
  const board = emptyBoard();
  board[idx(7, 7)] = 'B';
  board[idx(6, 6)] = 'W';
  board[idx(7, 6)] = 'B';
  board[idx(8, 8)] = 'W';
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseGomokuMove(board, 'W', difficulty, makeRng(5));
    expect(move).not.toBeNull();
    expect(board[move as number]).toBeNull();
  }
});

test('棋盘已满返回 null', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill('B');
  expect(chooseGomokuMove(board, 'W', 'hard')).toBeNull();
});

test('hard 难度在时间预算内完成', () => {
  const board = emptyBoard();
  const stones: [number, number, 'B' | 'W'][] = [
    [7, 7, 'B'],
    [7, 8, 'W'],
    [6, 7, 'B'],
    [8, 8, 'W'],
    [6, 8, 'B'],
    [8, 6, 'W'],
    [5, 6, 'B'],
    [9, 9, 'W'],
    [5, 8, 'B'],
    [6, 6, 'W'],
    [4, 7, 'B'],
    [9, 7, 'W'],
    [8, 7, 'B'],
    [5, 5, 'W'],
    [4, 4, 'B'],
    [10, 8, 'W'],
    [6, 9, 'B'],
    [7, 5, 'W'],
    [8, 9, 'B'],
    [9, 5, 'W'],
  ];
  for (const [r, c, stone] of stones) board[idx(r, c)] = stone;
  const start = Date.now();
  const move = chooseGomokuMove(board, 'B', 'hard');
  const elapsed = Date.now() - start;
  expect(move).not.toBeNull();
  expect(elapsed).toBeLessThan(300);
});
