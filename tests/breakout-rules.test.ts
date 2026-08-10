import { expect, test } from '@rstest/core';
import {
  BREAKOUT,
  type BreakoutState,
  bounceOffPaddle,
  createBricks,
  createInitialState,
  resolveCircleRectBounce,
  stepBreakout,
} from '../src/lib/breakout.ts';

test('createBricks 生成 60 块砖且全部存活', () => {
  const bricks = createBricks();
  expect(bricks).toHaveLength(60);
  expect(bricks.every((b) => b.alive)).toBe(true);
});

test('bounceOffPaddle 左/中/右击中给出预期 vx 符号与大小', () => {
  const { paddleW, paddleY } = BREAKOUT;
  const paddleX = 100;
  const ballY = paddleY;
  const ballVy = 6;

  const left = bounceOffPaddle(paddleX, ballY, 0, ballVy, paddleX);
  expect(left.ballVy).toBe(-6);
  expect(left.ballVx).toBeCloseTo(-5);

  const center = bounceOffPaddle(
    paddleX + paddleW / 2,
    ballY,
    0,
    ballVy,
    paddleX,
  );
  expect(center.ballVy).toBe(-6);
  expect(center.ballVx).toBeCloseTo(0);

  const right = bounceOffPaddle(paddleX + paddleW, ballY, 0, ballVy, paddleX);
  expect(right.ballVy).toBe(-6);
  expect(right.ballVx).toBeCloseTo(5);
});

test('resolveCircleRectBounce 从下方击中翻转 vy', () => {
  const r = BREAKOUT.ballR;
  const rect = { x: 100, y: 100, w: 80, h: 24 };
  // ball center below rect, overlapping top edge, moving up
  const ballX = rect.x + rect.w / 2;
  const ballY = rect.y + rect.h + r - 2;
  const result = resolveCircleRectBounce(
    ballX,
    ballY,
    0,
    -4,
    r,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
  );
  expect(result).not.toBeNull();
  expect(result?.ballVy).toBe(4);
  expect(result?.ballVx).toBe(0);
});

test('resolveCircleRectBounce 从侧面击中翻转 vx', () => {
  const r = BREAKOUT.ballR;
  const rect = { x: 100, y: 100, w: 80, h: 24 };
  // ball center to the left of rect, overlapping left edge, moving right
  const ballX = rect.x - r + 2;
  const ballY = rect.y + rect.h / 2;
  const result = resolveCircleRectBounce(
    ballX,
    ballY,
    4,
    0,
    r,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
  );
  expect(result).not.toBeNull();
  expect(result?.ballVx).toBe(-4);
  expect(result?.ballVy).toBe(0);
});

test('stepBreakout 左墙反弹翻转 vx', () => {
  const base = createInitialState();
  const state: BreakoutState = {
    ...base,
    status: 'playing',
    launched: true,
    ballX: BREAKOUT.ballR - 1,
    ballY: 200,
    ballVx: -3,
    ballVy: 0,
    bricks: createBricks(),
  };
  const { state: next } = stepBreakout(state, 1);
  expect(next.ballVx).toBe(3);
  expect(next.ballX).toBeGreaterThanOrEqual(BREAKOUT.ballR);
});

test('stepBreakout 侧面撞砖摧毁并正确翻转 vx，发出 brick_hit', () => {
  const brick = {
    x: 200,
    y: 100,
    w: 80,
    h: 24,
    alive: true,
    color: '#ef4444',
  };
  const r = BREAKOUT.ballR;
  const state: BreakoutState = {
    ...createInitialState(),
    status: 'playing',
    launched: true,
    score: 0,
    ballX: brick.x - r + 2,
    ballY: brick.y + brick.h / 2,
    ballVx: 4,
    ballVy: 0,
    bricks: [brick],
  };
  const { state: next, events } = stepBreakout(state, 1);
  expect(next.bricks[0].alive).toBe(false);
  expect(next.score).toBe(10);
  expect(next.ballVx).toBe(-4);
  expect(events).toContainEqual({ type: 'brick_hit', scoreDelta: 10 });
});

test('stepBreakout 球掉落发出 life_lost，最后一命发出 lose', () => {
  const base = createInitialState();
  const falling: BreakoutState = {
    ...base,
    status: 'playing',
    launched: true,
    lives: 2,
    ballX: BREAKOUT.canvasW / 2,
    ballY: BREAKOUT.canvasH + BREAKOUT.ballR + 1,
    ballVx: 3,
    ballVy: 5,
    bricks: createBricks(),
  };
  const lost = stepBreakout(falling, 1);
  expect(lost.events).toContainEqual({ type: 'life_lost', lives: 1 });
  expect(lost.state.launched).toBe(false);
  expect(lost.state.ballVx).toBe(0);
  expect(lost.state.ballVy).toBe(0);
  expect(lost.state.status).toBe('idle');
  expect(lost.state.lives).toBe(1);

  const lastLife: BreakoutState = {
    ...falling,
    lives: 1,
  };
  const lose = stepBreakout(lastLife, 1);
  expect(lose.events).toContainEqual({ type: 'lose' });
  expect(lose.state.lives).toBe(0);
  expect(lose.state.status).toBe('lose');
});

test('stepBreakout 全部砖块消灭发出 win', () => {
  const state: BreakoutState = {
    ...createInitialState(),
    status: 'playing',
    launched: true,
    ballX: 400,
    ballY: 300,
    ballVx: 0,
    ballVy: 0,
    bricks: [
      {
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        alive: false,
        color: '#ef4444',
      },
    ],
  };
  const { state: next, events } = stepBreakout(state, 1);
  expect(next.status).toBe('win');
  expect(events).toContainEqual({ type: 'win' });
});
