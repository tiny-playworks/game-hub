import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { VirtualController } from '@/components/common/VirtualController';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { hitsSnakeBody } from '@/lib/snake';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import { useGameStore } from '../store/gameStore';
import './snake.css';

const W = 400;
const H = 400;
const CELL = 20;
const COLS = W / CELL;
const ROWS = H / CELL;

type Dir = 'up' | 'down' | 'left' | 'right';
type FoodType = 'normal' | 'golden';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

const GameSnake = () => {
  const { t } = useLocale();
  const shake = useScreenShake();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { stats, updateHighScore } = useGameStore();
  const gameStats = stats.snake || { highScore: 0 };

  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');

  const stateRef = useRef({
    snake: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
    dir: 'right' as Dir,
    nextDir: 'right' as Dir,
    food: { x: 0, y: 0, type: 'normal' as FoodType, timer: 0 },
    particles: [] as Particle[],
    lastTick: 0,
  });

  const createParticles = useCallback(
    (x: number, y: number, color: string, count: number) => {
      const px = x * CELL + CELL / 2;
      const py = y * CELL + CELL / 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        stateRef.current.particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: Math.random() * 20 + 20, // frames
          color,
        });
      }
    },
    [],
  );

  const placeFood = useCallback(() => {
    const body = new Set(stateRef.current.snake.map((s) => `${s.x},${s.y}`));
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
    } while (body.has(`${x},${y}`));

    const isGolden = Math.random() < 0.15; // 15% chance for golden
    stateRef.current.food = {
      x,
      y,
      type: isGolden ? 'golden' : 'normal',
      timer: isGolden ? 3000 : 0, // 3 seconds in golden mode (tracked via exact time diff ideally, but we'll use frames/dt in loop)
    };
  }, []);

  const reset = useCallback(() => {
    stateRef.current = {
      snake: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
      dir: 'right',
      nextDir: 'right',
      food: { x: 0, y: 0, type: 'normal', timer: 0 },
      particles: [],
      lastTick: performance.now(),
    };
    placeFood();
    setScore(0);
    setStatus('idle');
  }, [placeFood]);

  const start = useCallback(() => {
    if (stateRef.current.snake.length === 1) placeFood();
    setStatus('playing');
    stateRef.current.lastTick = performance.now();
  }, [placeFood]);

  useEffect(() => {
    placeFood();
  }, [placeFood]);

  // Main Game Loop via requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let reqId: number;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      reqId = requestAnimationFrame(loop);

      const dt = timestamp - lastTime;
      lastTime = timestamp;

      const state = stateRef.current;

      // Draw background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, W, H);

      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= W; i += CELL) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(W, i);
        ctx.stroke();
      }

      if (status === 'playing') {
        // Handle Golden Food Timer
        if (state.food.type === 'golden') {
          state.food.timer -= dt;
          if (state.food.timer <= 0) {
            placeFood(); // respawn as normal if missed
          }
        }

        // Logic Tick
        const currentSpeed = Math.max(50, 150 - score * 0.2); // gets faster as score increases
        if (timestamp - state.lastTick > currentSpeed) {
          state.lastTick = timestamp;

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

          // Wall collision
          if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            setStatus('over');
            shake();
            if (score > gameStats.highScore) updateHighScore('snake', score);
            return;
          }
          const willEat = head.x === state.food.x && head.y === state.food.y;

          // Self collision. Moving into the current tail is legal when the
          // snake is not growing because that cell leaves this tick.
          if (hitsSnakeBody(head, state.snake, willEat)) {
            setStatus('over');
            shake();
            if (score > gameStats.highScore) updateHighScore('snake', score);
            return;
          }

          const nextSnake = [head, ...state.snake];

          // Eat food
          if (willEat) {
            if (state.food.type === 'golden') {
              setScore((s) => s + 50);
              createParticles(head.x, head.y, '#eab308', 30); // yellow particles
              // add extra length
              for (let i = 0; i < 3; i++)
                nextSnake.push({ ...state.snake[state.snake.length - 1] });
            } else {
              setScore((s) => s + 10);
              createParticles(head.x, head.y, '#ef4444', 15); // red particles
            }
            placeFood();
          } else {
            nextSnake.pop();
          }
          state.snake = nextSnake;
        }
      }

      // Draw Particles
      state.particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) {
          state.particles.splice(i, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      // Draw Food
      ctx.shadowBlur = 15;
      if (state.food.type === 'golden') {
        ctx.shadowColor = '#facc15';
        ctx.fillStyle = '#facc15';
        // pulse effect
        const pulse = Math.sin(timestamp / 100) * 2;
        ctx.beginPath();
        ctx.arc(
          state.food.x * CELL + CELL / 2,
          state.food.y * CELL + CELL / 2,
          CELL / 2 - 2 + pulse,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        // draw timer arc
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pct = Math.max(0, state.food.timer / 3000);
        ctx.arc(
          state.food.x * CELL + CELL / 2,
          state.food.y * CELL + CELL / 2,
          CELL / 2 + 4,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * pct,
        );
        ctx.stroke();
      } else {
        ctx.shadowColor = '#ef4444';
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
      }
      ctx.shadowBlur = 0; // reset

      // Draw Snake
      state.snake.forEach((s, i) => {
        const pct = i / state.snake.length;
        // Gradient from bright cyan to deep blue
        const r = Math.floor(6 + pct * (15 - 6));
        const g = Math.floor(182 - pct * (182 - 23));
        const b = Math.floor(212 - pct * (212 - 42));

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        if (i === 0) {
          // Head glows
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22d3ee'; // cyan-400
        } else {
          ctx.shadowBlur = 0;
        }

        // Draw slightly rounded rect
        const pad = i === 0 ? 0 : 1;
        ctx.fillRect(
          s.x * CELL + pad,
          s.y * CELL + pad,
          CELL - pad * 2,
          CELL - pad * 2,
        );
      });
      ctx.shadowBlur = 0;
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [
    status,
    score,
    gameStats.highScore,
    placeFood,
    shake,
    updateHighScore,
    createParticles,
  ]);

  const handleDirection = useCallback(
    (dir: Dir) => {
      const state = stateRef.current;
      if (status === 'idle') start();

      switch (dir) {
        case 'up':
          if (state.dir !== 'down') state.nextDir = 'up';
          break;
        case 'down':
          if (state.dir !== 'up') state.nextDir = 'down';
          break;
        case 'left':
          if (state.dir !== 'right') state.nextDir = 'left';
          break;
        case 'right':
          if (state.dir !== 'left') state.nextDir = 'right';
          break;
      }
    },
    [status, start],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          handleDirection('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          handleDirection('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          handleDirection('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          handleDirection('right');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirection]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-900/50">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/30 bg-[#050505]/80 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className="shrink-0 text-zinc-500 transition-colors hover:text-cyan-400"
        >
          ← {t('common.backToList')}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs font-mono sm:gap-4 sm:text-sm">
          <span className="text-cyan-400">
            {t('snake.score')}: {score.toString().padStart(4, '0')}
          </span>
          <span className="text-zinc-500">
            {t('snake.best')}: {gameStats.highScore.toString().padStart(4, '0')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="bg-transparent border-cyan-900/50 text-cyan-400 hover:bg-cyan-900/30"
          >
            {t('common.restart')}
          </Button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] pb-24 md:pb-4">
        <div
          className={cn(
            'responsive-canvas-wrapper snake-canvas-container rounded-xl overflow-hidden border border-cyan-900/50',
            status === 'over' && 'game-over border-red-500',
          )}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block" />

          {/* Overlays */}
          {(status === 'idle' || status === 'over') && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              {status === 'idle' && (
                <>
                  <h2 className="text-3xl font-black text-cyan-400 mb-2 tracking-widest">
                    {t('game.snake.name')}
                  </h2>
                  <p className="text-zinc-400 font-mono text-sm mb-6 max-w-[250px]">
                    {t('common.pressArrowToStart')} <br />
                    {t('snake.goldenFoodTip')}
                  </p>
                  <Button
                    onClick={start}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  >
                    {t('common.start')}
                  </Button>
                </>
              )}
              {status === 'over' && (
                <>
                  <h2 className="text-4xl font-black text-red-500 mb-2 tracking-widest animate-pulse">
                    {t('snake.gameOver')}
                  </h2>
                  <p className="text-zinc-300 font-mono text-lg mb-6">
                    {t('snake.finalScore')}:{' '}
                    <span className="text-cyan-400 font-bold">{score}</span>
                  </p>
                  <Button
                    onClick={reset}
                    className="bg-white hover:bg-zinc-200 text-black font-bold px-8"
                  >
                    {t('common.playAgain')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mobile Virtual Controller */}
        <VirtualController
          showActions={false}
          onDirection={(d) => handleDirection(d.toLowerCase() as Dir)}
        />
      </main>
    </div>
  );
};

export default GameSnake;
