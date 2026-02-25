import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

const W = 400;
const H = 400;
const CELL = 20;
const COLS = W / CELL;
const ROWS = H / CELL;

type Dir = 'up' | 'down' | 'left' | 'right';

const STORAGE_KEY = 'game-snake-best';

const GameSnake = () => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() =>
    Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10),
  );
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');

  const stateRef = useRef({
    snake: [{ x: COLS / 2, y: ROWS / 2 }],
    dir: 'right' as Dir,
    nextDir: 'right' as Dir,
    food: { x: 0, y: 0 },
    tickId: 0,
  });

  const placeFood = useCallback(() => {
    const body = new Set(stateRef.current.snake.map((s) => `${s.x},${s.y}`));
    let x: number;
    let y: number;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
    } while (body.has(`${x},${y}`));
    stateRef.current.food = { x, y };
  }, []);

  const reset = useCallback(() => {
    stateRef.current = {
      snake: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
      dir: 'right',
      nextDir: 'right',
      food: { x: 0, y: 0 },
      tickId: 0,
    };
    placeFood();
    setScore(0);
    setStatus('idle');
  }, [placeFood]);

  useEffect(() => {
    placeFood();
  }, [placeFood]);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      localStorage.setItem(STORAGE_KEY, String(score));
    }
  }, [score, best]);

  const start = useCallback(() => {
    if (stateRef.current.snake.length === 1) placeFood();
    setStatus('playing');
  }, [placeFood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let intervalId = 0;

    const tick = () => {
      const state = stateRef.current;
      if (status !== 'playing') return;
      state.dir = state.nextDir;
      const head = { ...state.snake[0] };
      switch (state.dir) {
        case 'up':
          head.y -= 1;
          break;
        case 'down':
          head.y += 1;
          break;
        case 'left':
          head.x -= 1;
          break;
        case 'right':
          head.x += 1;
          break;
      }
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        setStatus('over');
        return;
      }
      if (state.snake.some((s) => s.x === head.x && s.y === head.y)) {
        setStatus('over');
        return;
      }
      const nextSnake = [head, ...state.snake];
      if (head.x === state.food.x && head.y === state.food.y) {
        setScore((s) => s + 10);
        placeFood();
      } else {
        nextSnake.pop();
      }
      stateRef.current.snake = nextSnake;
    };

    const draw = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      const state = stateRef.current;
      state.snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#22c55e' : '#16a34a';
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(
        state.food.x * CELL + CELL / 2,
        state.food.y * CELL + CELL / 2,
        CELL / 2 - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    };

    const loop = () => {
      tick();
      draw();
    };

    if (status === 'playing') {
      intervalId = window.setInterval(loop, 150);
    } else {
      draw();
    }

    return () => clearInterval(intervalId);
  }, [status, placeFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (state.dir !== 'down') state.nextDir = 'up';
          if (status === 'idle') start();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (state.dir !== 'up') state.nextDir = 'down';
          if (status === 'idle') start();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (state.dir !== 'right') state.nextDir = 'left';
          if (status === 'idle') start();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (state.dir !== 'left') state.nextDir = 'right';
          if (status === 'idle') start();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, start]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">分数: {score}</span>
          <span className="text-sm text-muted-foreground">最高: {best}</span>
          <Button variant="outline" size="sm" onClick={reset}>
            {t('common.restart')}
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <div className="rounded-lg border-2 border-border bg-black">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block"
            style={{ width: W, height: H }}
          />
        </div>
        {(status === 'idle' || status === 'over') && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {status === 'idle' && (
              <p className="text-muted-foreground">
                {t('common.pressArrowToStart')}
              </p>
            )}
            {status === 'over' && (
              <p className="font-medium text-destructive">
                游戏结束，得分: {score}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={status === 'over' ? reset : start}>
                {status === 'over' ? t('common.playAgain') : t('common.start')}
              </Button>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  {t('common.backList')}
                </Button>
              </Link>
            </div>
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          方向键控制蛇头，吃到红色食物加分
        </p>
      </main>
    </div>
  );
};

export default GameSnake;
