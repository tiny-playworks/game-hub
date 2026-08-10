import { expect, test } from '@rstest/core';
import {
  bulletHitsTank,
  canMoveTank,
  moveTank,
  stepBullet,
  TANK,
  type TankBullet,
  type TankEntity,
  type TankMap,
} from '../src/lib/tank.ts';

function emptyMap(): TankMap {
  return Array.from({ length: TANK.rows }, () =>
    Array.from({ length: TANK.cols }, () => 0),
  );
}

function tankAt(
  x: number,
  y: number,
  dir: TankEntity['dir'] = 'up',
): TankEntity {
  return { x, y, dir, moveCounter: 0, isPlayer: true };
}

test('canMoveTank blocked by brick', () => {
  const map = emptyMap();
  // tank at col 1, row 1 area; brick immediately above
  const tank = tankAt(TANK.tile, TANK.tile, 'up');
  const brickRow = Math.floor((tank.y - TANK.tankSpeed) / TANK.tile);
  const brickCol = Math.floor(tank.x / TANK.tile);
  map[brickRow][brickCol] = 1;
  expect(canMoveTank(map, tank, 'up')).toBe(false);
});

test('canMoveTank blocked by base', () => {
  const map = emptyMap();
  const tank = tankAt(TANK.tile, TANK.tile, 'down');
  const ny = tank.y + TANK.tankSpeed;
  const baseRow = Math.floor((ny + TANK.tankH - 1) / TANK.tile);
  const baseCol = Math.floor(tank.x / TANK.tile);
  map[baseRow][baseCol] = 3;
  expect(canMoveTank(map, tank, 'down')).toBe(false);
});

test('canMoveTank blocked out of bounds', () => {
  const map = emptyMap();
  const tank = tankAt(0, 0, 'up');
  expect(canMoveTank(map, tank, 'up')).toBe(false);
  expect(canMoveTank(map, tank, 'left')).toBe(false);
});

test('canMoveTank allowed on empty', () => {
  const map = emptyMap();
  const tank = tankAt(TANK.tile * 2, TANK.tile * 2, 'right');
  expect(canMoveTank(map, tank, 'right')).toBe(true);
  expect(canMoveTank(map, tank, 'up')).toBe(true);
});

test('stepBullet destroys brick and removes bullet', () => {
  const map = emptyMap();
  map[5][5] = 1;
  const bullet: TankBullet = {
    x: 5 * TANK.tile + 8,
    y: 5 * TANK.tile + 8 - TANK.bulletSpeed,
    vx: 0,
    vy: TANK.bulletSpeed,
    fromPlayer: true,
  };
  const result = stepBullet(map, bullet);
  expect(result.bullet).toBeNull();
  expect(result.event).toBe('brick');
  expect(result.map[5][5]).toBe(0);
});

test('stepBullet hitting base emits base event', () => {
  const map = emptyMap();
  map[8][6] = 3;
  const bullet: TankBullet = {
    x: 6 * TANK.tile + 8,
    y: 8 * TANK.tile + 8 - TANK.bulletSpeed,
    vx: 0,
    vy: TANK.bulletSpeed,
    fromPlayer: true,
  };
  const result = stepBullet(map, bullet);
  expect(result.bullet).toBeNull();
  expect(result.event).toBe('base');
});

test('stepBullet leaving map emits out', () => {
  const map = emptyMap();
  const bullet: TankBullet = {
    x: 10,
    y: -2,
    vx: 0,
    vy: -TANK.bulletSpeed,
    fromPlayer: true,
  };
  const result = stepBullet(map, bullet);
  expect(result.bullet).toBeNull();
  expect(result.event).toBe('out');
});

test('bulletHitsTank true when overlapping', () => {
  const tank = tankAt(100, 100);
  const bullet: TankBullet = {
    x: 110,
    y: 110,
    vx: 0,
    vy: 0,
    fromPlayer: false,
  };
  expect(bulletHitsTank(bullet, tank)).toBe(true);

  const miss: TankBullet = {
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    fromPlayer: false,
  };
  expect(bulletHitsTank(miss, tank)).toBe(false);
});

test('moveTank updates position by TANK_SPEED when clear', () => {
  const map = emptyMap();
  const tank = tankAt(TANK.tile * 3, TANK.tile * 3, 'up');
  const moved = moveTank(map, tank, 'right');
  expect(moved.dir).toBe('right');
  expect(moved.x).toBe(tank.x + TANK.tankSpeed);
  expect(moved.y).toBe(tank.y);

  // x=100: right edge 126 stays in col 3; after +2, edge 128 enters col 4
  const nearBrick = tankAt(100, TANK.tile * 3, 'up');
  const blockedMap = emptyMap();
  blockedMap[Math.floor(nearBrick.y / TANK.tile)][4] = 1;
  const stuck = moveTank(blockedMap, nearBrick, 'right');
  expect(stuck.dir).toBe('right');
  expect(stuck.x).toBe(nearBrick.x);
  expect(stuck.y).toBe(nearBrick.y);
});
