import { expect, test } from '@rstest/core';
import {
  GOMOKU_SIZE,
  type GomokuStone,
  getGomokuWin,
  getGomokuWinner,
} from '../src/lib/gomoku';

function idx(r: number, c: number): number {
  return r * GOMOKU_SIZE + c;
}

function sortedLine(board: GomokuStone[]): number[] {
  const win = getGomokuWin(board);
  return win ? [...win.line].sort((a, b) => a - b) : [];
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

test('无胜者时 getGomokuWin 返回 null', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let c = 0; c < 4; c++) board[idx(0, c)] = 'B';
  expect(getGomokuWin(board)).toBeNull();
});

test('getGomokuWin 返回横向连珠线', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let c = 3; c < 8; c++) board[idx(7, c)] = 'B';
  const win = getGomokuWin(board);
  expect(win?.stone).toBe('B');
  expect(win?.line).toEqual([
    idx(7, 3),
    idx(7, 4),
    idx(7, 5),
    idx(7, 6),
    idx(7, 7),
  ]);
});

test('getGomokuWin 返回竖向连珠线', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let r = 2; r < 7; r++) board[idx(r, 10)] = 'W';
  const win = getGomokuWin(board);
  expect(win?.stone).toBe('W');
  expect(win?.line).toEqual([
    idx(2, 10),
    idx(3, 10),
    idx(4, 10),
    idx(5, 10),
    idx(6, 10),
  ]);
});

test('getGomokuWin 返回正斜连珠线', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let i = 0; i < 5; i++) board[idx(2 + i, 3 + i)] = 'B';
  const win = getGomokuWin(board);
  expect(win?.stone).toBe('B');
  expect(sortedLine(board)).toEqual([
    idx(2, 3),
    idx(3, 4),
    idx(4, 5),
    idx(5, 6),
    idx(6, 7),
  ]);
});

test('getGomokuWin 返回反斜连珠线', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let i = 0; i < 5; i++) board[idx(10 - i, 5 + i)] = 'W';
  const win = getGomokuWin(board);
  expect(win?.stone).toBe('W');
  expect(sortedLine(board)).toEqual([
    idx(6, 9),
    idx(7, 8),
    idx(8, 7),
    idx(9, 6),
    idx(10, 5),
  ]);
});

test('getGomokuWin 长连返回全部棋子', () => {
  const board: GomokuStone[] = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);
  for (let c = 4; c < 10; c++) board[idx(9, c)] = 'B';
  const win = getGomokuWin(board);
  expect(win?.line).toHaveLength(6);
  expect(win?.line[0]).toBe(idx(9, 4));
  expect(win?.line[5]).toBe(idx(9, 9));
});
