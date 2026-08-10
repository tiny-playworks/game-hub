import { expect, test } from '@rstest/core';
import {
  canSetDir,
  hitsSnakeBody,
  nextHead,
  placeFood,
  type SnakeLogicState,
  stepSnake,
} from '../src/lib/snake.ts';

test('贪吃蛇移动到本回合离开的尾巴格不算自撞', () => {
  const snake = [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];

  expect(hitsSnakeBody({ x: 1, y: 2 }, snake, false)).toBe(false);
  expect(hitsSnakeBody({ x: 1, y: 2 }, snake, true)).toBe(true);
});

test('nextHead 四个方向各移动一格', () => {
  const head = { x: 5, y: 5 };
  expect(nextHead(head, 'up')).toEqual({ x: 5, y: 4 });
  expect(nextHead(head, 'down')).toEqual({ x: 5, y: 6 });
  expect(nextHead(head, 'left')).toEqual({ x: 4, y: 5 });
  expect(nextHead(head, 'right')).toEqual({ x: 6, y: 5 });
});

test('canSetDir 禁止 180 度掉头', () => {
  expect(canSetDir('up', 'down')).toBe(false);
  expect(canSetDir('down', 'up')).toBe(false);
  expect(canSetDir('left', 'right')).toBe(false);
  expect(canSetDir('right', 'left')).toBe(false);
  expect(canSetDir('up', 'left')).toBe(true);
  expect(canSetDir('up', 'up')).toBe(true);
});

test('stepSnake 撞墙死亡', () => {
  const state: SnakeLogicState = {
    snake: [{ x: 0, y: 0 }],
    dir: 'left',
    nextDir: 'left',
    food: { x: 5, y: 5, type: 'normal', timer: 0 },
    cols: 20,
    rows: 20,
  };
  const result = stepSnake(state, () => 0);
  expect(result).toEqual({ kind: 'dead', reason: 'wall' });
});

test('stepSnake 自撞死亡', () => {
  const state: SnakeLogicState = {
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    dir: 'left',
    nextDir: 'left',
    food: { x: 9, y: 9, type: 'normal', timer: 0 },
    cols: 20,
    rows: 20,
  };
  // head (2,2) left → (1,2)，撞到非尾巴身体
  const result = stepSnake(state, () => 0);
  expect(result).toEqual({ kind: 'dead', reason: 'self' });
});

test('stepSnake 吃普通食物加长并按固定 rng 放置新食物', () => {
  const state: SnakeLogicState = {
    snake: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    dir: 'right',
    nextDir: 'right',
    food: { x: 2, y: 1, type: 'normal', timer: 0 },
    cols: 4,
    rows: 4,
  };
  // placeFood: first two rng for x,y → floor(0.75*4)=3, floor(0*4)=0 → (3,0)
  // third rng for golden: 0.5 → normal
  let calls = 0;
  const rng = () => {
    const values = [0.75, 0, 0.5];
    return values[calls++] ?? 0;
  };

  const result = stepSnake(state, rng);
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.ate).toBe(true);
  if (!result.ate) return;
  expect(result.foodType).toBe('normal');
  expect(result.scoreDelta).toBe(10);
  expect(result.state.snake).toEqual([
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  expect(result.state.food).toEqual({
    x: 3,
    y: 0,
    type: 'normal',
    timer: 0,
  });
  expect(result.state.dir).toBe('right');
});

test('stepSnake 吃金色食物 scoreDelta 50 且额外加长', () => {
  const state: SnakeLogicState = {
    snake: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    dir: 'right',
    nextDir: 'right',
    food: { x: 2, y: 1, type: 'golden', timer: 3000 },
    cols: 4,
    rows: 4,
  };
  let calls = 0;
  const rng = () => {
    const values = [0.75, 0, 0.5];
    return values[calls++] ?? 0;
  };

  const result = stepSnake(state, rng);
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.ate).toBe(true);
  if (!result.ate) return;
  expect(result.foodType).toBe('golden');
  expect(result.scoreDelta).toBe(50);
  // normal grow (don't pop) + 3 extra copies of old tail
  expect(result.state.snake).toEqual([
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 1 },
  ]);
});

test('stepSnake 未生长时移入即将离开的尾巴格合法', () => {
  const state: SnakeLogicState = {
    snake: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
    dir: 'down',
    nextDir: 'down',
    food: { x: 9, y: 9, type: 'normal', timer: 0 },
    cols: 20,
    rows: 20,
  };
  // head (1,1) down → (1,2) 正是即将离开的尾巴
  const result = stepSnake(state, () => 0);
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.ate).toBe(false);
  expect(result.state.snake).toEqual([
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ]);
});

test('placeFood 不会落在蛇身上（固定 rng 首次会撞身体）', () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ];
  // 4x1 board conceptually cols=2 rows=1: cells (0,0)(1,0) occupied
  // Use 3x1: empty is (2,0)
  // First attempt: x=floor(0*3)=0, y=0 → occupied
  // Second: x=floor((2/3)*3)=2? wait floor(0.9*3)=2, y=0
  // golden: 0.5 → normal
  let calls = 0;
  const rng = () => {
    const values = [0, 0, 0.9, 0, 0.5];
    return values[calls++] ?? 0;
  };

  const food = placeFood(snake, 3, 1, rng);
  expect(food).toEqual({ x: 2, y: 0, type: 'normal', timer: 0 });
  expect(calls).toBe(5);
});
