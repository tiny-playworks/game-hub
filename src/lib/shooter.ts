export const SHOOTER = {
  w: 400,
  h: 560,
  playerW: 36,
  playerH: 42,
  bulletW: 4,
  bulletH: 8,
  bulletSpeed: -10,
  enemySpeed: 2,
  enemyW: 32,
  enemyH: 36,
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
  shields?: number;
  invulnerableFrames?: number;
}

export interface ShooterInput {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export type ShooterEvent =
  | { type: 'enemy_destroyed'; scoreDelta: number; x: number; y: number }
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
    shields: 3,
    invulnerableFrames: 0,
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
  difficulty: string = 'normal',
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
  let shields = state.shields ?? 3;
  let invulnerableFrames = Math.max(0, (state.invulnerableFrames ?? 0) - dt);
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

  const wave = Math.floor(score / 100) + 1;
  const spawnInterval = Math.max(
    25,
    (difficulty === 'easy'
      ? 130
      : difficulty === 'hard'
        ? 50
        : SHOOTER.spawnInterval) -
      (wave - 1) * 5,
  );
  const enemySpeed =
    SHOOTER.enemySpeed *
    (difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.45 : 1) *
    (1 + Math.min(wave - 1, 14) * 0.07);
  spawnCounter += dt;
  if (spawnCounter >= spawnInterval) {
    spawnCounter -= spawnInterval;
    enemies.push({
      x: rng() * (SHOOTER.w - SHOOTER.enemyW),
      y: -SHOOTER.enemyH,
    });
  }

  enemies = enemies.map((e) => ({ ...e, y: e.y + enemySpeed * dt }));

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
      events.push({
        type: 'enemy_destroyed',
        scoreDelta: 10,
        x: enemy.x + SHOOTER.enemyW / 2,
        y: enemy.y + SHOOTER.enemyH / 2,
      });
      continue;
    }

    if (
      enemy.y > py + SHOOTER.playerH ||
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
      if (invulnerableFrames <= 0) {
        shields -= 1;
        invulnerableFrames = 90;
        if (shields <= 0) status = 'over';
        events.push({ type: 'player_hit' });
      }
      continue;
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
      shields,
      invulnerableFrames,
    },
    events,
  };
}
