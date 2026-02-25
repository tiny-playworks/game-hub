import { expect, test } from '@rstest/core';
import {
  GOMOKU_SIZE,
  type GomokuStone,
  getGomokuWinner,
} from '../src/lib/gomoku';

function idx(r: number, c: number): number {
  return r * GOMOKU_SIZE + c;
}

test('空棋盘无胜者', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  expect(getGomokuWinner(board)).toBeNull();
});

test('横五连黑胜', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let c = 0; c < 5; c++) board[idx(7, c)] = 'B';
  expect(getGomokuWinner(board)).toBe('B');
});

test('竖五连白胜', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let r = 0; r < 5; r++) board[idx(r, 10)] = 'W';
  expect(getGomokuWinner(board)).toBe('W');
});

test('斜五连黑胜', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let i = 0; i < 5; i++) board[idx(2 + i, 3 + i)] = 'B';
  expect(getGomokuWinner(board)).toBe('B');
});

test('反斜五连白胜', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let i = 0; i < 5; i++) board[idx(10 - i, 5 + i)] = 'W';
  expect(getGomokuWinner(board)).toBe('W');
});

test('四连无胜', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let c = 0; c < 4; c++) board[idx(0, c)] = 'B';
  expect(getGomokuWinner(board)).toBeNull();
});
