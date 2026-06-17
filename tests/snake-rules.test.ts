import { expect, test } from '@rstest/core';
import { hitsSnakeBody } from '../src/lib/snake.ts';

test('贪吃蛇移动到本回合离开的尾巴格不算自撞', () => {
  const snake = [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];

  expect(hitsSnakeBody({ x: 1, y: 2 }, snake, false)).toBe(false);
  expect(hitsSnakeBody({ x: 1, y: 2 }, snake, true)).toBe(true);
});
