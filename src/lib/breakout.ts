export const BREAKOUT = {
  canvasW: 800,
  canvasH: 600,
  paddleW: 100,
  paddleH: 12,
  ballR: 8,
  brickRows: 6,
  brickCols: 10,
  brickGap: 4,
  brickW: (800 - (10 + 1) * 4) / 10,
  brickH: 24,
  paddleY: 600 - 12 - 20,
} as const;

const DEFAULT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
];

export interface BreakoutBrick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
}

export interface BreakoutState {
  paddleX: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  bricks: BreakoutBrick[];
  launched: boolean;
  lives: number;
  score: number;
  status: 'idle' | 'playing' | 'paused' | 'win' | 'lose';
}

export type BreakoutEvent =
  | { type: 'brick_hit'; scoreDelta: number }
  | { type: 'life_lost'; lives: number }
  | { type: 'lose' }
  | { type: 'win' };

export function createBricks(
  colors: string[] = DEFAULT_COLORS,
): BreakoutBrick[] {
  const { brickRows, brickCols, brickGap, brickW, brickH } = BREAKOUT;
  const bricks: BreakoutBrick[] = [];
  for (let row = 0; row < brickRows; row++) {
    for (let col = 0; col < brickCols; col++) {
      bricks.push({
        x: brickGap + col * (brickW + brickGap),
        y: 60 + row * (brickH + brickGap),
        w: brickW,
        h: brickH,
        alive: true,
        color: colors[row % colors.length],
      });
    }
  }
  return bricks;
}

export function createInitialState(): BreakoutState {
  const { canvasW, canvasH, paddleW } = BREAKOUT;
  return {
    paddleX: (canvasW - paddleW) / 2,
    ballX: canvasW / 2,
    ballY: canvasH - 50,
    ballVx: 0,
    ballVy: 0,
    bricks: createBricks(),
    launched: false,
    lives: 3,
    score: 0,
    status: 'idle',
  };
}

export function clampPaddleX(x: number): number {
  const { canvasW, paddleW } = BREAKOUT;
  return Math.max(0, Math.min(canvasW - paddleW, x));
}

/**
 * Circle vs AABB overlap response.
 * Compares penetration depths: smaller horizontal penetration → flip vx; else flip vy.
 * Returns null if no overlap.
 */
export function resolveCircleRectBounce(
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  r: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
): { ballX: number; ballY: number; ballVx: number; ballVy: number } | null {
  const closestX = Math.max(rectX, Math.min(ballX, rectX + rectW));
  const closestY = Math.max(rectY, Math.min(ballY, rectY + rectH));
  const dx = ballX - closestX;
  const dy = ballY - closestY;
  if (dx * dx + dy * dy > r * r) return null;

  // Overlap depths along each axis (how far circle AABB penetrates rect AABB)
  const overlapLeft = ballX + r - rectX;
  const overlapRight = rectX + rectW - (ballX - r);
  const overlapTop = ballY + r - rectY;
  const overlapBottom = rectY + rectH - (ballY - r);

  const overlapX = Math.min(overlapLeft, overlapRight);
  const overlapY = Math.min(overlapTop, overlapBottom);

  let nextVx = ballVx;
  let nextVy = ballVy;
  let nextX = ballX;
  let nextY = ballY;

  if (overlapX < overlapY) {
    nextVx = -ballVx;
    // Push out along the side with smaller penetration
    if (overlapLeft < overlapRight) {
      nextX = rectX - r;
    } else {
      nextX = rectX + rectW + r;
    }
  } else {
    nextVy = -ballVy;
    if (overlapTop < overlapBottom) {
      nextY = rectY - r;
    } else {
      nextY = rectY + rectH + r;
    }
  }

  return { ballX: nextX, ballY: nextY, ballVx: nextVx, ballVy: nextVy };
}

export function bounceOffPaddle(
  ballX: number,
  _ballY: number,
  _ballVx: number,
  ballVy: number,
  paddleX: number,
): { ballVx: number; ballVy: number } {
  const hitPos = (ballX - paddleX) / BREAKOUT.paddleW;
  return {
    ballVy: -Math.abs(ballVy),
    ballVx: (hitPos - 0.5) * 10,
  };
}

function overlapsPaddle(
  ballX: number,
  ballY: number,
  paddleX: number,
): boolean {
  const { paddleW, paddleY, ballR, canvasH } = BREAKOUT;
  const paddleBottom = canvasH - 20;
  return (
    ballY + ballR >= paddleY &&
    ballY - ballR <= paddleBottom &&
    ballX >= paddleX &&
    ballX <= paddleX + paddleW
  );
}

export function stepBreakout(
  state: BreakoutState,
  dt: number,
): { state: BreakoutState; events: BreakoutEvent[] } {
  const events: BreakoutEvent[] = [];
  const { canvasW, canvasH, ballR, paddleW } = BREAKOUT;

  let ballX = state.ballX + state.ballVx * dt;
  let ballY = state.ballY + state.ballVy * dt;
  let ballVx = state.ballVx;
  let ballVy = state.ballVy;
  let bricks = state.bricks;
  let score = state.score;
  let lives = state.lives;
  let launched = state.launched;
  let status = state.status;
  const paddleX = state.paddleX;

  // Walls
  if (ballX - ballR <= 0) {
    ballVx = Math.abs(ballVx);
    ballX = ballR;
  } else if (ballX + ballR >= canvasW) {
    ballVx = -Math.abs(ballVx);
    ballX = canvasW - ballR;
  }
  if (ballY - ballR <= 0) {
    ballVy = Math.abs(ballVy);
    ballY = ballR;
  }

  // Paddle
  if (ballVy > 0 && overlapsPaddle(ballX, ballY, paddleX)) {
    const bounced = bounceOffPaddle(ballX, ballY, ballVx, ballVy, paddleX);
    ballVx = bounced.ballVx;
    ballVy = bounced.ballVy;
  }

  // Bricks — at most one per step
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i];
    if (!brick.alive) continue;
    const resolved = resolveCircleRectBounce(
      ballX,
      ballY,
      ballVx,
      ballVy,
      ballR,
      brick.x,
      brick.y,
      brick.w,
      brick.h,
    );
    if (!resolved) continue;
    bricks = bricks.map((b, idx) => (idx === i ? { ...b, alive: false } : b));
    score += 10;
    ballX = resolved.ballX;
    ballY = resolved.ballY;
    ballVx = resolved.ballVx;
    ballVy = resolved.ballVy;
    events.push({ type: 'brick_hit', scoreDelta: 10 });
    break;
  }

  // Fall below canvas
  if (ballY - ballR > canvasH) {
    lives -= 1;
    launched = false;
    ballVx = 0;
    ballVy = 0;
    ballX = paddleX + paddleW / 2;
    ballY = canvasH - 50;
    if (lives <= 0) {
      lives = 0;
      status = 'lose';
      events.push({ type: 'lose' });
    } else {
      status = 'idle';
      events.push({ type: 'life_lost', lives });
    }
  }

  // Win: no alive bricks remaining
  if (status !== 'lose' && status !== 'idle' && bricks.every((b) => !b.alive)) {
    status = 'win';
    events.push({ type: 'win' });
  }

  return {
    state: {
      paddleX,
      ballX,
      ballY,
      ballVx,
      ballVy,
      bricks,
      launched,
      lives,
      score,
      status,
    },
    events,
  };
}
