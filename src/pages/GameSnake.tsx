import { useCallback, useEffect, useRef, useState } from 'react';
import { VirtualController } from '@/components/common/VirtualController';
import { GameProgress } from '@/components/game/GameProgress';
import { GameReadyOverlay } from '@/components/game/GameReadyOverlay';
import { useSwipeControls } from '@/hooks/useSwipeControls';
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

const W = 480;
const H = 480;
const CELL = 24;
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
  const [length, setLength] = useState(3);
  const turns = useRef<SnakeDir[]>([]);
  const [status, setStatus] = useState<'idle' | 'playing' | 'over' | 'win'>(
    'idle',
  );

  const stateRef = useRef({
    snake: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ],
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

  const reset = arcade.restart;

  const start = useCallback(() => {
    if (pausedRef.current) return;
    if (status !== 'idle') return;
    placeFood();
    setStatus('playing');
    stateRef.current.lastTick = performance.now();
  }, [placeFood, status]);

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
      ctx.fillStyle = '#122b31';
      ctx.fillRect(0, 0, W, H);

      // Draw grid
      ctx.strokeStyle = 'rgba(171,202,185,0.055)';
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
          difficulty === 'hard' ? 55 : 75,
          (difficulty === 'easy' ? 210 : difficulty === 'hard' ? 85 : 150) -
            Math.floor(score / 50) * 6,
        ); // gets faster as score increases
        if (timestamp - state.lastTick > currentSpeed) {
          state.lastTick = timestamp;

          state.nextDir = turns.current.shift() ?? state.dir;
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
            setLength(result.state.snake.length);
            if (result.state.food.x < 0) setStatus('win');
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
      state.particles = state.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) {
          return false;
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
        return true;
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
        const pct = Math.max(0, state.food.timer / 6000);
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
        const r = Math.floor(116 - pct * 62);
        const g = Math.floor(190 - pct * 75);
        const b = Math.floor(155 - pct * 50);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        if (i === 0) {
          // Head glows
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#91c6a4'; // cyan-400
        } else {
          ctx.shadowBlur = 0;
        }

        // Draw slightly rounded rect
        const pad = i === 0 ? 0 : 1;
        ctx.beginPath();
        ctx.roundRect(
          s.x * CELL + pad,
          s.y * CELL + pad,
          CELL - pad * 2,
          CELL - pad * 2,
          5,
        );
        ctx.fill();
        if (i === 0) {
          ctx.fillStyle = '#122b31';
          const horizontal = state.dir === 'left' || state.dir === 'right';
          const front = state.dir === 'right' || state.dir === 'down' ? 16 : 7;
          for (const eye of [7, 16]) {
            ctx.beginPath();
            ctx.arc(
              s.x * CELL + (horizontal ? front : eye),
              s.y * CELL + (horizontal ? eye : front),
              2,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      });
      ctx.shadowBlur = 0;
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [status, score, placeFood, shake, createParticles, difficulty]);

  const handleDirection = useCallback(
    (dir: SnakeDir) => {
      if (
        pausedRef.current ||
        arcade.result ||
        (status !== 'idle' && status !== 'playing')
      )
        return;
      const state = stateRef.current;
      if (status === 'idle') start();
      const previous = turns.current.at(-1) ?? state.dir;
      if (
        dir !== previous &&
        canSetDir(previous, dir) &&
        turns.current.length < 2
      )
        turns.current.push(dir);
    },
    [status, start, arcade.result],
  );

  const swipe = useSwipeControls(handleDirection, true);
  useEffect(() => {
    stateRef.current.lastTick = performance.now();
  }, [paused]);

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
    if (status === 'over' || status === 'win')
      finish(status === 'win' ? 'win' : 'lose', score);
  }, [status, score, arcade.start, finish]);
  return (
    <GameShell
      autoStart={false}
      title={t('game.snake.name')}
      subtitle={t('game.snake.description')}
      status={
        <>
          <StatPill label={t('arcade.score')} value={score} />
          <StatPill label={t('arcade.snakeLength')} value={length} />
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={reset}>
          {t('common.restart')}
        </Button>
      }
    >
      <GameProgress
        label={t('arcade.nextTarget')}
        current={score}
        target={(Math.floor(score / 100) + 1) * 100}
      />
      <div className="flex w-full flex-col items-center justify-center">
        <div
          className={cn(
            'responsive-canvas-wrapper snake-canvas-container arcade-canvas-frame',
            status === 'over' && 'game-over border-red-500',
          )}
          {...swipe}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block" />

          <GameResultOverlay
            open={status === 'over' || status === 'win'}
            tone={status === 'win' ? 'win' : 'lose'}
            title={status === 'win' ? t('common.youWin') : t('snake.gameOver')}
            description={String(score) + ' ' + t('arcade.unit.points')}
            onRestart={reset}
          />
          {status === 'idle' && (
            <GameReadyOverlay
              title={t('game.snake.name')}
              description={t('arcade.snakeReady')}
              onStart={start}
            />
          )}
        </div>

        <p className="arcade-session-note">{t('arcade.snakeGolden')}</p>
        <VirtualController
          showActions={false}
          onDirection={(d) => handleDirection(d.toLowerCase() as SnakeDir)}
        />
      </div>
    </GameShell>
  );
};

export default GameSnake;
