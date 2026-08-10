import { expect, test } from '@rstest/core';
import {
  canPlace,
  createInitialState,
  GO_SIZE,
  type GoState,
  pass,
  placeStone,
  type Stone,
} from '../src/lib/go';
import { chooseGoMove } from '../src/lib/goAi';

/** 用固定序列的伪随机源，保证测试可复现 */
const seededRng = (seed: number) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

/** 按 [row, col] 顺序轮流落子，返回结果状态 */
const playSequence = (moves: [number, number][]): GoState => {
  let state = createInitialState();
  for (const [row, col] of moves) {
    state = placeStone(state, row, col);
  }
  return state;
};

/** 直接摆一个局面，不走轮次逻辑 */
const buildState = (
  stones: { row: number; col: number; stone: Stone }[],
  blackTurn: boolean,
): GoState => {
  const state = createInitialState();
  for (const { row, col, stone } of stones) {
    state.board[row][col] = stone;
  }
  return { ...state, blackTurn };
};

test('围棋 AI：开局返回一个合法落点', () => {
  const state = createInitialState();
  const move = chooseGoMove(state, 'normal', seededRng(1));
  expect(move.kind).toBe('play');
  if (move.kind === 'play') {
    expect(canPlace(state, move.row, move.col)).toBe(true);
  }
});

test('围棋 AI：能提子时会把只剩一口气的敌子吃掉', () => {
  // 白子在 (4,4)，黑已占三面，只剩 (5,4) 一口气
  const state = buildState(
    [
      { row: 4, col: 4, stone: 'W' },
      { row: 3, col: 4, stone: 'B' },
      { row: 4, col: 3, stone: 'B' },
      { row: 4, col: 5, stone: 'B' },
    ],
    true,
  );
  const move = chooseGoMove(state, 'normal', seededRng(7));
  expect(move).toEqual({ kind: 'play', row: 5, col: 4 });
});

test('围棋 AI：不会填自己的真眼', () => {
  // (4,4) 是黑棋被四面包住的真眼，四个对角也是黑子
  const state = buildState(
    [
      { row: 3, col: 4, stone: 'B' },
      { row: 5, col: 4, stone: 'B' },
      { row: 4, col: 3, stone: 'B' },
      { row: 4, col: 5, stone: 'B' },
      { row: 3, col: 3, stone: 'B' },
      { row: 3, col: 5, stone: 'B' },
      { row: 5, col: 3, stone: 'B' },
      { row: 5, col: 5, stone: 'B' },
    ],
    true,
  );
  for (const seed of [1, 2, 3, 11, 29]) {
    const move = chooseGoMove(state, 'normal', seededRng(seed));
    expect(move).not.toEqual({ kind: 'play', row: 4, col: 4 });
  }
});

test('围棋 AI：对手虚着且自己领先时跟着虚着，让对局能终局', () => {
  // 黑棋占了明显更多的地，轮到黑走且白刚虚着
  const withStones = playSequence([
    [2, 2],
    [8, 8],
    [2, 6],
    [8, 7],
    [6, 2],
    [7, 8],
    [6, 6],
    [7, 7],
    [4, 4],
  ]);
  const state = pass(withStones); // 白虚着，轮到黑
  expect(state.blackTurn).toBe(true);
  expect(state.lastPass).toBe(true);
  expect(chooseGoMove(state, 'normal', seededRng(5))).toEqual({ kind: 'pass' });
});

test('围棋 AI：注入相同 rng 时结果可复现', () => {
  const state = createInitialState();
  const a = chooseGoMove(state, 'easy', seededRng(42));
  const b = chooseGoMove(state, 'easy', seededRng(42));
  expect(a).toEqual(b);
});

test('围棋 AI：连下 30 手不会产生非法落点，也不会卡住', () => {
  let state = createInitialState();
  const rng = seededRng(2024);
  for (let i = 0; i < 30 && !state.gameOver; i++) {
    const move = chooseGoMove(state, i % 2 === 0 ? 'normal' : 'easy', rng);
    if (move.kind === 'pass') {
      state = pass(state);
      continue;
    }
    expect(canPlace(state, move.row, move.col)).toBe(true);
    const next = placeStone(state, move.row, move.col);
    expect(next).not.toBe(state);
    state = next;
  }
  const stones = state.board.flat().filter(Boolean).length;
  expect(stones).toBeGreaterThan(10);
  expect(stones).toBeLessThanOrEqual(GO_SIZE * GO_SIZE);
});

test('围棋 AI：hard 难度单手耗时在可接受范围内', () => {
  let state = createInitialState();
  const rng = seededRng(99);
  for (let i = 0; i < 8; i++) {
    const move = chooseGoMove(state, 'normal', rng);
    if (move.kind === 'play') state = placeStone(state, move.row, move.col);
  }
  const started = Date.now();
  chooseGoMove(state, 'hard', rng);
  expect(Date.now() - started).toBeLessThan(1500);
});
