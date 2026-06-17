import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import { useGameStore } from '../store/gameStore';

const CANVAS_W = 800;
const CANVAS_H = 600;
const PADDLE_W = 100;
const PADDLE_H = 12;
const BALL_R = 8;
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_GAP = 4;
const BRICK_W = (CANVAS_W - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;
const BRICK_H = 24;

type GameStatus = 'idle' | 'playing' | 'paused' | 'win' | 'lose';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
}

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
];

function createBricks(): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_GAP + col * (BRICK_W + BRICK_GAP),
        y: 60 + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        alive: true,
        color: COLORS[row % COLORS.length],
      });
    }
  }
  return bricks;
}

const GameBreakout = () => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stats, updateHighScore } = useGameStore();
  const gameStats = stats.breakout || { highScore: 0 };
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<GameStatus>('idle');

  const stateRef = useRef({
    paddleX: (CANVAS_W - PADDLE_W) / 2,
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H - 50,
    ballVx: 0,
    ballVy: 0,
    bricks: createBricks(),
    launched: false,
    lastTime: 0,
  });

  const resetGame = useCallback(() => {
    stateRef.current = {
      paddleX: (CANVAS_W - PADDLE_W) / 2,
      ballX: CANVAS_W / 2,
      ballY: CANVAS_H - 50,
      ballVx: 0,
      ballVy: 0,
      bricks: createBricks(),
      launched: false,
      lastTime: 0,
    };
    setScore(0);
    setLives(3);
    setStatus('idle');
  }, []);

  const launch = useCallback(() => {
    if (status === 'idle' && !stateRef.current.launched) {
      stateRef.current.launched = true;
      stateRef.current.ballVx = 4;
      stateRef.current.ballVy = -6;
      setStatus('playing');
    } else if (status === 'paused') {
      setStatus('playing');
    }
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let mouseX = CANVAS_W / 2;

    const setPaddleFromClientX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      mouseX = (clientX - rect.left) * scaleX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      setPaddleFromClientX(e.clientX);
    };

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      setPaddleFromClientX(e.clientX);
      launch();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (status === 'idle' || status === 'paused') launch();
        else if (status === 'playing') setStatus('paused');
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    const gameLoop = (time: number) => {
      const state = stateRef.current;
      const dt = Math.min((time - state.lastTime) / 16, 4);
      state.lastTime = time;

      if (status === 'idle' || status === 'paused' || status === 'playing') {
        state.paddleX = mouseX - PADDLE_W / 2;
        state.paddleX = Math.max(
          0,
          Math.min(CANVAS_W - PADDLE_W, state.paddleX),
        );
      }

      if ((status === 'idle' || status === 'paused') && !state.launched) {
        state.ballX = state.paddleX + PADDLE_W / 2;
      }

      if (status === 'playing' && state.launched) {
        state.ballX += state.ballVx * dt;
        state.ballY += state.ballVy * dt;

        if (state.ballX - BALL_R <= 0 || state.ballX + BALL_R >= CANVAS_W)
          state.ballVx *= -1;
        if (state.ballY - BALL_R <= 0) state.ballVy *= -1;

        const paddleTop = CANVAS_H - PADDLE_H - 20;
        const paddleBottom = CANVAS_H - 20;
        if (
          state.ballVy > 0 &&
          state.ballY + BALL_R >= paddleTop &&
          state.ballY - BALL_R <= paddleBottom &&
          state.ballX >= state.paddleX &&
          state.ballX <= state.paddleX + PADDLE_W
        ) {
          const hitPos = (state.ballX - state.paddleX) / PADDLE_W;
          state.ballVy = -Math.abs(state.ballVy);
          state.ballVx = (hitPos - 0.5) * 10;
        }

        for (const brick of state.bricks) {
          if (!brick.alive) continue;
          const bx = brick.x;
          const by = brick.y;
          const bw = brick.w;
          const bh = brick.h;
          if (
            state.ballX + BALL_R >= bx &&
            state.ballX - BALL_R <= bx + bw &&
            state.ballY + BALL_R >= by &&
            state.ballY - BALL_R <= by + bh
          ) {
            brick.alive = false;
            setScore((s) => s + 10);
            state.ballVy *= -1;
            break;
          }
        }

        if (state.ballY - BALL_R > CANVAS_H) {
          state.ballX = CANVAS_W / 2;
          state.ballY = CANVAS_H - 50;
          state.ballVx = 0;
          state.ballVy = 0;
          state.launched = false;
          setLives((l) => {
            if (l <= 1) {
              setStatus('lose');
              return 0;
            }
            setStatus('idle');
            return l - 1;
          });
        }

        const aliveCount = state.bricks.filter((b) => b.alive).length;
        if (aliveCount === 0) setStatus('win');
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      state.bricks.forEach((b) => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      });

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(state.paddleX, CANVAS_H - PADDLE_H - 20, PADDLE_W, PADDLE_H);

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(gameLoop);
    };

    stateRef.current.lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, launch]);

  useEffect(() => {
    if (status === 'win') unlock('breakout-first-win');
    if (
      (status === 'win' || status === 'lose') &&
      score > gameStats.highScore
    ) {
      updateHighScore('breakout', score);
    }
  }, [status, score, gameStats.highScore, updateHighScore]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            最高分: {gameStats.highScore}
          </span>
          <span className="text-sm text-muted-foreground">分数: {score}</span>
          <span className="text-sm text-muted-foreground">生命: {lives}</span>
          <Button variant="outline" size="sm" onClick={resetGame}>
            {t('common.restart')}
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <div className="relative inline-block rounded-lg border-2 border-border bg-black shadow-xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block cursor-none"
            style={{
              width: 'min(100vw - 2rem, 800px)',
              height: 'auto',
              touchAction: 'none',
            }}
          />

          {(status === 'idle' || status === 'paused') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
              <p className="mb-4 text-lg text-white">
                {status === 'idle'
                  ? '点击画布或按空格发射小球'
                  : '已暂停，按空格继续'}
              </p>
              <Button onClick={launch}>{t('common.startOrContinue')}</Button>
            </div>
          )}

          {status === 'win' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/80 rounded-lg">
              <p className="mb-4 text-2xl font-bold text-white">通关！</p>
              <p className="mb-4 text-white">得分: {score}</p>
              <div className="flex gap-2">
                <Button onClick={resetGame}>{t('common.playAgain')}</Button>
                <Link to="/">
                  <Button variant="outline">{t('common.backList')}</Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'lose' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 rounded-lg">
              <p className="mb-4 text-2xl font-bold text-white">游戏结束</p>
              <p className="mb-4 text-white">得分: {score}</p>
              <div className="flex gap-2">
                <Button onClick={resetGame}>{t('common.playAgain')}</Button>
                <Link to="/">
                  <Button variant="outline">{t('common.backList')}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          鼠标/手指移动挡板 · 空格发射/暂停
        </p>
      </main>
    </div>
  );
};

export default GameBreakout;
