import { expect, test } from '@rstest/core';
import {
  applyMove,
  chooseTicTacToeMove,
  fadingIndex,
  getWinningLine,
  type TicMove,
} from '../src/lib/tictactoe';

test('applyMove 拒绝占用格', () => {
  const moves: TicMove[] = [{ player: 'X', index: 0 }];
  expect(applyMove(moves, 'O', 0)).toBeNull();
});

function mustApply(
  moves: TicMove[],
  player: TicMove['player'],
  index: number,
): TicMove[] {
  const next = applyMove(moves, player, index);
  if (!next) throw new Error(`expected legal move at ${index}`);
  return next;
}

test('applyMove 第四子时移除最旧子', () => {
  let moves: TicMove[] = [];
  moves = mustApply(moves, 'X', 0);
  moves = mustApply(moves, 'O', 1);
  moves = mustApply(moves, 'X', 2);
  moves = mustApply(moves, 'O', 3);
  moves = mustApply(moves, 'X', 4);
  moves = mustApply(moves, 'O', 5);
  // X 已有 0,2,4；再下 6 应移除最旧的 0
  const next = mustApply(moves, 'X', 6);
  const xIndices = next.filter((m) => m.player === 'X').map((m) => m.index);
  expect(xIndices).toEqual([2, 4, 6]);
  expect(xIndices).not.toContain(0);
});

test('getWinningLine 检测行/列/对角', () => {
  expect(
    getWinningLine([
      { player: 'X', index: 0 },
      { player: 'O', index: 3 },
      { player: 'X', index: 1 },
      { player: 'O', index: 4 },
      { player: 'X', index: 2 },
    ]),
  ).toEqual([0, 1, 2]);

  expect(
    getWinningLine([
      { player: 'O', index: 0 },
      { player: 'X', index: 1 },
      { player: 'O', index: 3 },
      { player: 'X', index: 2 },
      { player: 'O', index: 6 },
    ]),
  ).toEqual([0, 3, 6]);

  expect(
    getWinningLine([
      { player: 'X', index: 0 },
      { player: 'O', index: 1 },
      { player: 'X', index: 4 },
      { player: 'O', index: 2 },
      { player: 'X', index: 8 },
    ]),
  ).toEqual([0, 4, 8]);
});

test('fadingIndex 在已有三子时返回最旧索引', () => {
  const moves: TicMove[] = [
    { player: 'X', index: 0 },
    { player: 'O', index: 1 },
    { player: 'X', index: 2 },
    { player: 'O', index: 3 },
    { player: 'X', index: 4 },
  ];
  expect(fadingIndex(moves, 'X')).toBe(0);
  expect(fadingIndex(moves, 'O')).toBeNull();
});

test('AI 会走获胜步', () => {
  // O 在 0,1；空 2 可横三连
  const moves: TicMove[] = [
    { player: 'X', index: 3 },
    { player: 'O', index: 0 },
    { player: 'X', index: 4 },
    { player: 'O', index: 1 },
    { player: 'X', index: 6 },
  ];
  expect(chooseTicTacToeMove(moves, 'O', () => 0)).toBe(2);
});

test('AI 会阻挡对手获胜', () => {
  // X 在 0,1；O 应挡 2
  const moves: TicMove[] = [
    { player: 'X', index: 0 },
    { player: 'O', index: 3 },
    { player: 'X', index: 1 },
  ];
  expect(chooseTicTacToeMove(moves, 'O', () => 0)).toBe(2);
});

test('AI 固定 rng 时结果确定', () => {
  const moves: TicMove[] = [{ player: 'X', index: 4 }];
  const a = chooseTicTacToeMove(moves, 'O', () => 0.1);
  const b = chooseTicTacToeMove(moves, 'O', () => 0.1);
  expect(a).toBe(b);
  expect(a).not.toBeNull();

  const c = chooseTicTacToeMove(moves, 'O', () => 0.9);
  // 空位固定顺序下，不同 rng 可能选不同格；至少两次调用各自确定
  expect(chooseTicTacToeMove(moves, 'O', () => 0.9)).toBe(c);
});
