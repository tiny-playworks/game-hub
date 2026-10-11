import { useCallback, useEffect, useRef, useState } from 'react';
import { VirtualController } from '@/components/common/VirtualController';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  canSetDir,
  placeFood as placeFoodLogic,
  type SnakeDir,
  type SnakeFood,
  stepSnake,
} from '@/lib/snake';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import './snake.css';

const W = 400;
const H = 400;
const CELL = 20;
const COLS = W / CELL;
const ROWS = H / CELL;

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

  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');

  const stateRef = useRef({
    snake: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
    dir: 'right' as SnakeDir,
    nextDir: 'right' as SnakeDir,
    food: { x: 0, y: 0, type: 'normal', timer: 0 } as SnakeFood,
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
    stateRef.current.food = placeFoodLogic(
      stateRef.current.snake,
      COLS,
      ROWS,
      Math.random,
    );
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
    if (pausedRef.current) return;
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

      if (status === 'playing' && !pausedRef.current) {
        // Handle Golden Food Timer
        if (state.food.type === 'golden') {
          state.food.timer -= dt;
          if (state.food.timer <= 0) {
            placeFood(); // respawn as normal if missed
          }
        }

        // Logic Tick
        const currentSpeed = Math.max(
          35,
          (difficulty === 'easy' ? 210 : difficulty === 'hard' ? 85 : 150) -
            score * 0.2,
        ); // gets faster as score increases
        if (timestamp - state.lastTick > currentSpeed) {
          state.lastTick = timestamp;

          const result = stepSnake(
            {
              snake: state.snake,
              dir: state.dir,
              nextDir: state.nextDir,
              food: state.food,
              cols: COLS,
              rows: ROWS,
            },
            Math.random,
          );

          if (result.kind === 'dead') {
            setStatus('over');
            shake();
            return;
          }

          state.snake = result.state.snake;
          state.dir = result.state.dir;
          state.nextDir = result.state.nextDir;
          state.food = result.state.food;

          if (result.ate) {
            setScore((s) => s + result.scoreDelta);
            const head = result.state.snake[0];
            if (result.foodType === 'golden') {
              createParticles(head.x, head.y, '#eab308', 30);
            } else {
              createParticles(head.x, head.y, '#ef4444', 15);
            }
          }
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
  }, [status, score, placeFood, shake, createParticles, difficulty]);

  const handleDirection = useCallback(
    (dir: SnakeDir) => {
      if (pausedRef.current) return;
      const state = stateRef.current;
      if (status === 'idle') start();
      if (canSetDir(state.dir, dir)) state.nextDir = dir;
    },
    [status, start],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current || arcade.result) return;
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
  }, [handleDirection, arcade.result]);

  useArcadeSnapshot(() => ({
    status,
    score,
    snake: stateRef.current.snake,
    direction: stateRef.current.dir,
    food: stateRef.current.food,
    grid: [COLS, ROWS],
  }));
  useEffect(() => {
    if (status === 'playing') arcade.start();
    if (status === 'over') finish('lose', score);
  }, [status, score, arcade.start, finish]);
  return (
    <GameShell
      autoStart={false}
      title={t('game.snake.name')}
      subtitle={t('game.snake.description')}
      status={<StatPill label={t('arcade.unit.points')} value={score} />}
      toolbar={
        <Button variant="outline" size="sm" onClick={reset}>
          {t('common.restart')}
        </Button>
      }
    >
      <div className="flex w-full flex-col items-center justify-center pb-44 md:pb-4">
        <div
          className={cn(
            'responsive-canvas-wrapper snake-canvas-container rounded-xl overflow-hidden border border-cyan-900/50',
            status === 'over' && 'game-over border-red-500',
          )}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block" />

          <GameResultOverlay
            open={status === 'over'}
            tone="lose"
            title={t('snake.gameOver')}
            description={String(score) + ' ' + t('arcade.unit.points')}
            onRestart={reset}
          />
          {/* Overlays */}
          {status === 'idle' && (
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
            </div>
          )}
        </div>

        {/* Mobile Virtual Controller */}
        <VirtualController
          showActions={false}
          onDirection={(d) => handleDirection(d.toLowerCase() as SnakeDir)}
        />
      </div>
    </GameShell>
  );
};

export default GameSnake;
