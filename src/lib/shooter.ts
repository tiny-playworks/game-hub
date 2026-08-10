export const SHOOTER = {
  w: 400,
  h: 560,
  playerW: 36,
  playerH: 28,
  bulletW: 4,
  bulletH: 8,
  bulletSpeed: -10,
  enemySpeed: 2,
  enemyW: 32,
  enemyH: 24,
  spawnInterval: 90,
  playerSpeed: 5,
  fireCooldownFrames: 8,
} as const;

export interface ShooterBullet {
  x: number;
  y: number;
}

export interface ShooterEnemy {
  x: number;
  y: number;
}

export type ShooterStatus = 'idle' | 'playing' | 'paused' | 'over';

export interface ShooterState {
  playerX: number;
  bullets: ShooterBullet[];
  enemies: ShooterEnemy[];
  spawnCounter: number;
  fireCooldown: number;
  score: number;
  status: ShooterStatus;
}

export interface ShooterInput {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export type ShooterEvent =
  | { type: 'enemy_destroyed'; scoreDelta: number }
  | { type: 'player_hit' };

export function playerY(): number {
  return SHOOTER.h - SHOOTER.playerH - 20;
}

export function createInitialShooterState(): ShooterState {
  return {
    playerX: (SHOOTER.w - SHOOTER.playerW) / 2,
    bullets: [],
    enemies: [],
    spawnCounter: 0,
    fireCooldown: 0,
    score: 0,
    status: 'idle',
  };
}

export function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax + aw > bx && ax < bx + bw && ay + ah > by && ay < by + bh;
}

export function stepShooter(
  state: ShooterState,
  input: ShooterInput,
  dt: number,
  rng: () => number,
): { state: ShooterState; events: ShooterEvent[] } {
  if (state.status !== 'playing') {
    return { state, events: [] };
  }

  const events: ShooterEvent[] = [];
  let playerX = state.playerX;
  let fireCooldown = state.fireCooldown;
  let spawnCounter = state.spawnCounter;
  let score = state.score;
  let status: ShooterStatus = state.status;
  let bullets = state.bullets.map((b) => ({ ...b }));
  let enemies = state.enemies.map((e) => ({ ...e }));

  const py = playerY();

  if (input.left) {
    playerX = Math.max(0, playerX - SHOOTER.playerSpeed * dt);
  }
  if (input.right) {
    playerX = Math.min(
      SHOOTER.w - SHOOTER.playerW,
      playerX + SHOOTER.playerSpeed * dt,
    );
  }

  if (input.fire && fireCooldown <= 0) {
    bullets.push({
      x: playerX + SHOOTER.playerW / 2 - SHOOTER.bulletW / 2,
      y: py,
    });
    fireCooldown = SHOOTER.fireCooldownFrames;
  }
  if (fireCooldown > 0) {
    fireCooldown = Math.max(0, fireCooldown - dt);
  }

  bullets = bullets
    .map((b) => ({ ...b, y: b.y + SHOOTER.bulletSpeed * dt }))
    .filter((b) => b.y > -SHOOTER.bulletH);

  spawnCounter += dt;
  if (spawnCounter >= SHOOTER.spawnInterval) {
    spawnCounter -= SHOOTER.spawnInterval;
    enemies.push({
      x: rng() * (SHOOTER.w - SHOOTER.enemyW),
      y: -SHOOTER.enemyH,
    });
  }

  enemies = enemies
    .map((e) => ({ ...e, y: e.y + SHOOTER.enemySpeed * dt }))
    .filter((e) => e.y < SHOOTER.h + SHOOTER.enemyH);

  const survivingEnemies: ShooterEnemy[] = [];
  for (const enemy of enemies) {
    const hitBulletIndex = bullets.findIndex((b) =>
      aabbOverlap(
        b.x,
        b.y,
        SHOOTER.bulletW,
        SHOOTER.bulletH,
        enemy.x,
        enemy.y,
        SHOOTER.enemyW,
        SHOOTER.enemyH,
      ),
    );
    if (hitBulletIndex >= 0) {
      bullets = bullets.filter((_, i) => i !== hitBulletIndex);
      score += 10;
      events.push({ type: 'enemy_destroyed', scoreDelta: 10 });
      continue;
    }

    if (
      aabbOverlap(
        enemy.x,
        enemy.y,
        SHOOTER.enemyW,
        SHOOTER.enemyH,
        playerX,
        py,
        SHOOTER.playerW,
        SHOOTER.playerH,
      )
    ) {
      status = 'over';
      events.push({ type: 'player_hit' });
    }
    survivingEnemies.push(enemy);
  }

  return {
    state: {
      playerX,
      bullets,
      enemies: survivingEnemies,
      spawnCounter,
      fireCooldown,
      score,
      status,
    },
    events,
  };
}
