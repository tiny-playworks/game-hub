import { expect, test } from '@rstest/core';
import {
  applyTetrisAction,
  COLS,
  createInitialTetrisState,
  createTetrisBoard,
  getGhostY,
  hasCollision,
  ROWS,
} from '../src/lib/tetris.ts';

function rngSequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

test('创建 10×20 空棋盘并使用可注入随机数生成当前与下一个方块', () => {
  const state = createInitialTetrisState(rngSequence(0, 0.99));

  expect(state.board).toHaveLength(ROWS);
  expect(state.board[0]).toHaveLength(COLS);
  expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(
    true,
  );
  expect(state.piece).toBe(0);
  expect(state.nextPiece).toBe(6);
  expect(state.status).toBe('idle');
});

test('碰撞检测识别墙、地面和已固定方块', () => {
  const board = createTetrisBoard();
  board[5][4] = 2;

  expect(hasCollision(board, 0, 0, -1, 0)).toBe(true);
  expect(hasCollision(board, 0, 1, 3, ROWS - 3)).toBe(true);
  expect(hasCollision(board, 1, 0, 4, 5)).toBe(true);
  expect(hasCollision(board, 1, 0, 4, 3)).toBe(false);
});

test('移动、旋转和暂停只改变合法状态', () => {
  let state = createInitialTetrisState(rngSequence(2, 3));
  state = applyTetrisAction(state, { type: 'start' }).state;
  state = applyTetrisAction(state, { type: 'move', dx: -1 }).state;
  state = applyTetrisAction(state, { type: 'rotate', direction: 'cw' }).state;

  expect(state.px).toBe(2);
  expect(state.rot).toBe(1);

  const paused = applyTetrisAction(state, { type: 'togglePause' }).state;
  const afterMove = applyTetrisAction(paused, { type: 'move', dx: 1 }).state;
  const afterTick = applyTetrisAction(paused, { type: 'tick' }).state;

  expect(paused.status).toBe('paused');
  expect(afterMove).toEqual(paused);
  expect(afterTick).toEqual(paused);
});

test('软降计 1 分，硬降每格计 2 分并锁定方块', () => {
  let state = createInitialTetrisState(rngSequence(0.14, 0.28));
  state = applyTetrisAction(state, { type: 'start' }).state;

  const soft = applyTetrisAction(state, { type: 'softDrop' }).state;
  expect(soft.py).toBe(1);
  expect(soft.score).toBe(1);

  const hard = applyTetrisAction(soft, {
    type: 'hardDrop',
    rng: rngSequence(0.42),
  });
  expect(hard.state.score).toBeGreaterThan(1);
  expect(hard.state.piece).toBe(1);
  expect(hard.events.some((event) => event.type === 'piece_locked')).toBe(true);
});

test('消除四行使用经典计分并更新等级和下落间隔', () => {
  const state = createInitialTetrisState(rngSequence(0, 0.14, 0.28));
  state.status = 'playing';
  state.px = 3;
  state.rot = 1;
  state.py = ROWS - 4;
  for (let r = ROWS - 4; r < ROWS; r++) {
    state.board[r] = Array(COLS).fill(7);
    state.board[r][5] = 0;
  }

  const result = applyTetrisAction(state, { type: 'hardDrop' });

  expect(result.state.lines).toBe(4);
  expect(result.state.score).toBe(800);
  expect(result.state.level).toBe(1);
  expect(result.state.dropInterval).toBe(44);
  expect(result.events).toContainEqual({
    type: 'lines_cleared',
    rows: [16, 17, 18, 19],
    count: 4,
    scoreDelta: 800,
  });
});

test('等级每 10 行提升且上限为 10', () => {
  const state = createInitialTetrisState(rngSequence(0, 1, 2));
  state.status = 'playing';
  state.lines = 98;
  state.level = 10;
  state.dropInterval = 8;
  state.px = 3;
  state.rot = 1;
  state.py = ROWS - 4;
  for (let r = ROWS - 4; r < ROWS; r++) {
    state.board[r] = Array(COLS).fill(5);
    state.board[r][5] = 0;
  }

  const result = applyTetrisAction(state, { type: 'hardDrop' });

  expect(result.state.lines).toBe(102);
  expect(result.state.level).toBe(10);
  expect(result.state.dropInterval).toBe(8);
  expect(result.state.score).toBe(8000);
});

test('幽灵落点返回当前方块的最终整数行', () => {
  const state = createInitialTetrisState(rngSequence(1, 2));
  expect(getGhostY(state)).toBe(ROWS - 2);
});

test('生成位置被占用时游戏结束', () => {
  const state = createInitialTetrisState(rngSequence(0, 0.14, 0.28));
  state.status = 'playing';
  state.py = ROWS - 1;
  state.board[0][3] = 4;

  const result = applyTetrisAction(state, { type: 'hardDrop' });

  expect(result.state.status).toBe('over');
  expect(result.events.some((event) => event.type === 'game_over')).toBe(true);
});
