import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type ActionType,
  type Direction,
  VirtualController,
} from '@/components/common/VirtualController';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

const W = 400;
const H = 560;
const PLAYER_W = 36;
const PLAYER_H = 28;
const BULLET_SPEED = -10;
const ENEMY_SPEED = 2;
const ENEMY_W = 32;
const ENEMY_H = 24;
const SPAWN_INTERVAL = 90;

const GameShooter = () => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');

  const stateRef = useRef({
    playerX: (W - PLAYER_W) / 2,
    bullets: [] as { x: number; y: number }[],
    enemies: [] as { x: number; y: number }[],
    spawnCounter: 0,
    keys: { left: false, right: false, fire: false },
    fireCooldown: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = {
      playerX: (W - PLAYER_W) / 2,
      bullets: [],
      enemies: [],
      spawnCounter: 0,
      keys: { left: false, right: false, fire: false },
      fireCooldown: 0,
    };
    setScore(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const loop = () => {
      const state = stateRef.current;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      if (status === 'idle') {
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按 空格 或 点击 开始', W / 2, H / 2);
        ctx.fillText('方向键移动 · 空格射击', W / 2, H / 2 + 24);
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (status === 'playing') {
        const playerY = H - PLAYER_H - 20;
        const speed = 5;
        if (state.keys.left) state.playerX = Math.max(0, state.playerX - speed);
        if (state.keys.right)
          state.playerX = Math.min(W - PLAYER_W, state.playerX + speed);

        if (state.keys.fire && state.fireCooldown <= 0) {
          state.bullets.push({
            x: state.playerX + PLAYER_W / 2 - 2,
            y: playerY,
          });
          state.fireCooldown = 8;
        }
        if (state.fireCooldown > 0) state.fireCooldown--;

        state.bullets = state.bullets.filter((b) => {
          b.y += BULLET_SPEED;
          return b.y > -4;
        });

        state.spawnCounter++;
        if (state.spawnCounter >= SPAWN_INTERVAL) {
          state.spawnCounter = 0;
          state.enemies.push({
            x: Math.random() * (W - ENEMY_W),
            y: -ENEMY_H,
          });
        }

        state.enemies = state.enemies.filter((e) => {
          e.y += ENEMY_SPEED;
          const hit = state.bullets.some(
            (b) =>
              b.x + 4 > e.x &&
              b.x < e.x + ENEMY_W &&
              b.y < e.y + ENEMY_H &&
              b.y + 4 > e.y,
          );
          if (hit) {
            state.bullets = state.bullets.filter(
              (b) =>
                !(
                  b.x + 4 > e.x &&
                  b.x < e.x + ENEMY_W &&
                  b.y < e.y + ENEMY_H &&
                  b.y + 4 > e.y
                ),
            );
            setScore((s) => s + 10);
            return false;
          }
          if (e.y + ENEMY_H > playerY && e.y < playerY + PLAYER_H) {
            if (
              e.x + ENEMY_W > state.playerX &&
              e.x < state.playerX + PLAYER_W
            ) {
              setStatus('over');
            }
          }
          return e.y < H + ENEMY_H;
        });
      }

      const playerY = H - PLAYER_H - 20;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(state.playerX + PLAYER_W / 2, playerY);
      ctx.lineTo(state.playerX, playerY + PLAYER_H);
      ctx.lineTo(state.playerX + PLAYER_W, playerY + PLAYER_H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#16a34a';
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      state.bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, 4, 8);
      });

      ctx.fillStyle = '#ef4444';
      state.enemies.forEach((e) => {
        ctx.fillRect(e.x, e.y, ENEMY_W, ENEMY_H);
        ctx.strokeStyle = '#b91c1c';
        ctx.strokeRect(e.x, e.y, ENEMY_W, ENEMY_H);
      });

      if (status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束', W / 2, H / 2 - 12);
        ctx.fillText(`得分: ${score}`, W / 2, H / 2 + 20);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status, score]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        k.left = true;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        k.right = true;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        k.fire = true;
        if (status === 'idle') setStatus('playing');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.code === 'ArrowLeft') k.left = false;
      if (e.code === 'ArrowRight') k.right = false;
      if (e.code === 'Space') k.fire = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status]);

  const start = useCallback(() => {
    if (status === 'idle') setStatus('playing');
  }, [status]);

  const setVirtualDirection = useCallback((dir: Direction, active: boolean) => {
    const keys = stateRef.current.keys;
    if (dir === 'LEFT') keys.left = active;
    if (dir === 'RIGHT') keys.right = active;
  }, []);

  const setVirtualAction = useCallback(
    (_action: ActionType, active: boolean) => {
      stateRef.current.keys.fire = active;
      if (active) start();
    },
    [start],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">得分: {score}</span>
          <Button variant="outline" size="sm" onClick={reset}>
            {t('common.restart')}
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4 pb-44 md:pb-4">
        <button
          type="button"
          className="rounded-lg border-2 border-border bg-black block"
          onClick={start}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block cursor-pointer"
            style={{ width: 'min(calc(100vw - 2rem), 400px)', height: 'auto' }}
          />
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          方向键移动 · 空格射击 · 击落敌机得分
        </p>
        <VirtualController
          tone="dark"
          onDirection={(dir) => setVirtualDirection(dir, true)}
          onDirectionEnd={(dir) => setVirtualDirection(dir, false)}
          onAction={(action) => setVirtualAction(action, true)}
          onActionEnd={(action) => setVirtualAction(action, false)}
        />
      </main>
    </div>
  );
};

export default GameShooter;
