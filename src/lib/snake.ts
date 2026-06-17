export interface SnakeCell {
  x: number;
  y: number;
}

export function hitsSnakeBody(
  nextHead: SnakeCell,
  snake: SnakeCell[],
  willGrow: boolean,
): boolean {
  const body = willGrow ? snake : snake.slice(0, -1);
  return body.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
}
