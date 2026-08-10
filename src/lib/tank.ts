const TILE = 32;
const COLS = 13;
const ROWS = 13;

export const TANK = {
  tile: TILE,
  cols: COLS,
  rows: ROWS,
  w: COLS * TILE,
  h: ROWS * TILE,
  tankW: 28,
  tankH: 28,
  bulletSpeed: 6,
  tankSpeed: 2,
  bulletSize: 4,
} as const;

export type TankDir = 'up' | 'down' | 'left' | 'right';

export const DIR_DXY: Record<TankDir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export type TankEntity = {
  x: number;
  y: number;
  dir: TankDir;
  moveCounter: number;
  isPlayer: boolean;
};

export type TankBullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
};

export type TankMap = number[][];

/** 0 empty, 1 brick, 2 steel (optional), 3 base */
export const MAP_TEMPLATE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0],
];

export function cloneMap(template: number[][] = MAP_TEMPLATE): TankMap {
  return template.map((row) => [...row]);
}

export function createPlayerTank(): TankEntity {
  const { tile, tankW, tankH } = TANK;
  return {
    x: 6 * tile + (tile - tankW) / 2,
    y: 11 * tile + (tile - tankH) / 2,
    dir: 'up',
    moveCounter: 0,
    isPlayer: true,
  };
}

/** Spawn at top of given map column, facing down. */
export function createEnemyTank(col: number): TankEntity {
  const { tile, tankW } = TANK;
  return {
    x: col * tile + (tile - tankW) / 2,
    y: 0,
    dir: 'down',
    moveCounter: 0,
    isPlayer: false,
  };
}

function tileSolid(map: TankMap, px: number, py: number): boolean {
  const c = Math.floor(px / TANK.tile);
  const r = Math.floor(py / TANK.tile);
  if (r < 0 || r >= TANK.rows || c < 0 || c >= TANK.cols) return true;
  return map[r][c] >= 1;
}

/** True if tank corners would hit solid tiles / bounds after (dx, dy). */
export function isOffsetBlocked(
  map: TankMap,
  tank: TankEntity,
  dx: number,
  dy: number,
): boolean {
  const nx = tank.x + dx;
  const ny = tank.y + dy;
  const corners: [number, number][] = [
    [nx, ny],
    [nx + TANK.tankW - 1, ny],
    [nx, ny + TANK.tankH - 1],
    [nx + TANK.tankW - 1, ny + TANK.tankH - 1],
  ];
  return corners.some(([px, py]) => tileSolid(map, px, py));
}

export function canMoveTank(
  map: TankMap,
  tank: TankEntity,
  dir: TankDir,
): boolean {
  const [dx, dy] = DIR_DXY[dir];
  return !isOffsetBlocked(map, tank, dx * TANK.tankSpeed, dy * TANK.tankSpeed);
}

export function moveTank(
  map: TankMap,
  tank: TankEntity,
  dir: TankDir,
): TankEntity {
  const [dx, dy] = DIR_DXY[dir];
  if (!canMoveTank(map, tank, dir)) {
    return { ...tank, dir };
  }
  return {
    ...tank,
    dir,
    x: tank.x + dx * TANK.tankSpeed,
    y: tank.y + dy * TANK.tankSpeed,
  };
}

export function fireBullet(tank: TankEntity): TankBullet {
  const [dx, dy] = DIR_DXY[tank.dir];
  return {
    x: tank.x + TANK.tankW / 2 - 2,
    y: tank.y + TANK.tankH / 2 - 2,
    vx: dx * TANK.bulletSpeed,
    vy: dy * TANK.bulletSpeed,
    fromPlayer: tank.isPlayer,
  };
}

export type BulletStepEvent = 'brick' | 'base' | 'out' | 'steel';

export function stepBullet(
  map: TankMap,
  bullet: TankBullet,
): {
  bullet: TankBullet | null;
  map: TankMap;
  event?: BulletStepEvent;
} {
  const next: TankBullet = {
    ...bullet,
    x: bullet.x + bullet.vx,
    y: bullet.y + bullet.vy,
  };
  const { w, h } = TANK;

  if (next.x < -4 || next.x > w + 4 || next.y < -4 || next.y > h + 4) {
    return { bullet: null, map, event: 'out' };
  }

  const bc = Math.floor(next.x / TANK.tile);
  const br = Math.floor(next.y / TANK.tile);
  if (br >= 0 && br < TANK.rows && bc >= 0 && bc < TANK.cols) {
    const v = map[br][bc];
    if (v === 1) {
      map[br][bc] = 0;
      return { bullet: null, map, event: 'brick' };
    }
    if (v === 2) {
      return { bullet: null, map, event: 'steel' };
    }
    if (v === 3) {
      return { bullet: null, map, event: 'base' };
    }
  }

  return { bullet: next, map };
}

export function bulletHitsTank(bullet: TankBullet, tank: TankEntity): boolean {
  const size = TANK.bulletSize;
  return (
    bullet.x + size > tank.x &&
    bullet.x < tank.x + TANK.tankW &&
    bullet.y + size > tank.y &&
    bullet.y < tank.y + TANK.tankH
  );
}

export function tanksOverlap(a: TankEntity, b: TankEntity): boolean {
  return (
    a.x + TANK.tankW > b.x &&
    a.x < b.x + TANK.tankW &&
    a.y + TANK.tankH > b.y &&
    a.y < b.y + TANK.tankH
  );
}

export function countRemainingEnemies(
  spawnQueue: number,
  aliveEnemies: TankEntity[],
): number {
  return spawnQueue + aliveEnemies.length;
}
