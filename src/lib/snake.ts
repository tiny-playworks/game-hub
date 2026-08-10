export interface SnakeCell {
  x: number;
  y: number;
}

export type SnakeDir = 'up' | 'down' | 'left' | 'right';
export type SnakeFoodType = 'normal' | 'golden';

export interface SnakeFood {
  x: number;
  y: number;
  type: SnakeFoodType;
  timer: number;
}

export interface SnakeLogicState {
  snake: SnakeCell[];
  dir: SnakeDir;
  nextDir: SnakeDir;
  food: SnakeFood;
  cols: number;
  rows: number;
}

export type SnakeStepResult =
  | { kind: 'ok'; state: SnakeLogicState; ate: false }
  | {
      kind: 'ok';
      state: SnakeLogicState;
      ate: true;
      foodType: SnakeFoodType;
      scoreDelta: number;
    }
  | { kind: 'dead'; reason: 'wall' | 'self' };

export function hitsSnakeBody(
  nextHead: SnakeCell,
  snake: SnakeCell[],
  willGrow: boolean,
): boolean {
  const body = willGrow ? snake : snake.slice(0, -1);
  return body.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
}

export function oppositeDir(dir: SnakeDir): SnakeDir {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function canSetDir(current: SnakeDir, next: SnakeDir): boolean {
  return next !== oppositeDir(current);
}

export function nextHead(head: SnakeCell, dir: SnakeDir): SnakeCell {
  switch (dir) {
    case 'up':
      return { x: head.x, y: head.y - 1 };
    case 'down':
      return { x: head.x, y: head.y + 1 };
    case 'left':
      return { x: head.x - 1, y: head.y };
    case 'right':
      return { x: head.x + 1, y: head.y };
  }
}

export function placeFood(
  snake: SnakeCell[],
  cols: number,
  rows: number,
  rng: () => number,
  options?: { goldenChance?: number; goldenTimerMs?: number },
): SnakeFood {
  const goldenChance = options?.goldenChance ?? 0.15;
  const goldenTimerMs = options?.goldenTimerMs ?? 3000;
  const body = new Set(snake.map((s) => `${s.x},${s.y}`));
  let x: number;
  let y: number;
  do {
    x = Math.floor(rng() * cols);
    y = Math.floor(rng() * rows);
  } while (body.has(`${x},${y}`));

  const isGolden = rng() < goldenChance;
  return {
    x,
    y,
    type: isGolden ? 'golden' : 'normal',
    timer: isGolden ? goldenTimerMs : 0,
  };
}

/** One logic tick: apply nextDir, move, collide, eat, grow. Does NOT handle particles/dt golden timer decay. */
export function stepSnake(
  state: SnakeLogicState,
  rng: () => number,
): SnakeStepResult {
  const dir = state.nextDir;
  const head = nextHead(state.snake[0], dir);

  if (
    head.x < 0 ||
    head.x >= state.cols ||
    head.y < 0 ||
    head.y >= state.rows
  ) {
    return { kind: 'dead', reason: 'wall' };
  }

  const willEat = head.x === state.food.x && head.y === state.food.y;

  if (hitsSnakeBody(head, state.snake, willEat)) {
    return { kind: 'dead', reason: 'self' };
  }

  const nextSnake = [head, ...state.snake];
  const oldTail = state.snake[state.snake.length - 1];

  if (willEat) {
    if (state.food.type === 'golden') {
      for (let i = 0; i < 3; i++) {
        nextSnake.push({ ...oldTail });
      }
    }

    const food = placeFood(nextSnake, state.cols, state.rows, rng);
    const nextState: SnakeLogicState = {
      ...state,
      dir,
      nextDir: dir,
      snake: nextSnake,
      food,
    };

    if (state.food.type === 'golden') {
      return {
        kind: 'ok',
        state: nextState,
        ate: true,
        foodType: 'golden',
        scoreDelta: 50,
      };
    }
    return {
      kind: 'ok',
      state: nextState,
      ate: true,
      foodType: 'normal',
      scoreDelta: 10,
    };
  }

  nextSnake.pop();
  return {
    kind: 'ok',
    state: {
      ...state,
      dir,
      nextDir: dir,
      snake: nextSnake,
    },
    ate: false,
  };
}
