import { expect, test } from '@rstest/core';
import {
  aabbOverlap,
  createInitialShooterState,
  type ShooterInput,
  type ShooterState,
  stepShooter,
} from '../src/lib/shooter';

const idleInput: ShooterInput = { left: false, right: false, fire: false };

function withEntities(
  partial: Partial<ShooterState> &
    Pick<ShooterState, 'bullets' | 'enemies' | 'playerX'>,
): ShooterState {
  return {
    ...createInitialShooterState(),
    ...partial,
  };
}

test('aabbOverlap 检测矩形相交', () => {
  expect(aabbOverlap(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  expect(aabbOverlap(0, 0, 10, 10, 11, 0, 10, 10)).toBe(false);
});

test('stepShooter 按 dt 向左移动玩家并夹紧', () => {
  const state = withEntities({
    playerX: 10,
    bullets: [],
    enemies: [],
    status: 'playing',
  });
  const next = stepShooter(state, { ...idleInput, left: true }, 1, () => 0);
  expect(next.state.playerX).toBe(5);
  const clamped = stepShooter(
    withEntities({ playerX: 0, bullets: [], enemies: [], status: 'playing' }),
    { ...idleInput, left: true },
    1,
    () => 0,
  );
  expect(clamped.state.playerX).toBe(0);
});

test('stepShooter 开火产生子弹并进入冷却', () => {
  const state = { ...createInitialShooterState(), status: 'playing' as const };
  const next = stepShooter(state, { ...idleInput, fire: true }, 1, () => 0);
  expect(next.state.bullets).toHaveLength(1);
  expect(next.state.fireCooldown).toBeGreaterThan(0);
  const again = stepShooter(
    next.state,
    { ...idleInput, fire: true },
    1,
    () => 0,
  );
  expect(again.state.bullets).toHaveLength(1);
});

test('stepShooter 子弹命中敌机得分并移除双方', () => {
  const state = withEntities({
    playerX: 100,
    bullets: [{ x: 50, y: 100 }],
    enemies: [{ x: 48, y: 96 }],
    score: 0,
    status: 'playing',
  });
  const next = stepShooter(state, idleInput, 0, () => 0);
  expect(next.state.enemies).toHaveLength(0);
  expect(next.state.bullets).toHaveLength(0);
  expect(next.state.score).toBe(10);
  expect(next.events).toContainEqual({
    type: 'enemy_destroyed',
    scoreDelta: 10,
  });
});

test('stepShooter 敌机撞玩家触发 player_hit', () => {
  const state = withEntities({
    playerX: 100,
    bullets: [],
    enemies: [{ x: 100, y: 560 - 28 - 20 - 10 }],
    status: 'playing',
  });
  const next = stepShooter(state, idleInput, 0, () => 0);
  expect(next.events).toContainEqual({ type: 'player_hit' });
  expect(next.state.status).toBe('over');
});

test('stepShooter 用固定 rng 在冷却累计后刷敌', () => {
  let state = { ...createInitialShooterState(), status: 'playing' as const };
  const rng = () => 0.5;
  for (let i = 0; i < 90; i++) {
    const r = stepShooter(state, idleInput, 1, rng);
    state = r.state;
  }
  expect(state.enemies.length).toBeGreaterThanOrEqual(1);
  expect(state.enemies[0].x).toBeCloseTo(0.5 * (400 - 32), 5);
});
