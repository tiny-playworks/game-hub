import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ActionType,
  type Direction,
  VirtualController,
} from '@/components/common/VirtualController';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  createInitialShooterState,
  playerY,
  SHOOTER,
  stepShooter,
} from '@/lib/shooter';

const GameShooter = () => {
  const { locale, t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'over'>(
    'idle',
  );

  const elapsed = useRef(0);
  const stateRef = useRef({
    ...createInitialShooterState(),
    keys: { left: false, right: false, fire: false },
    lastTime: 0,
  });

  const reset = arcade.restart;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const loop = (time: number) => {
      const state = stateRef.current;
      const rawDt =
        state.lastTime === 0 ? 1 : Math.min((time - state.lastTime) / 16, 4);
      state.lastTime = time;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, SHOOTER.w, SHOOTER.h);

      if (status === 'idle') {
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('shooter.startPrompt'), SHOOTER.w / 2, SHOOTER.h / 2);
        ctx.fillText(
          t('shooter.controlsPrompt'),
          SHOOTER.w / 2,
          SHOOTER.h / 2 + 24,
        );
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (status === 'playing' && !pausedRef.current) {
        elapsed.current += (rawDt * 16) / 1000;
        const result = stepShooter(
          {
            playerX: state.playerX,
            bullets: state.bullets,
            enemies: state.enemies,
            spawnCounter: state.spawnCounter,
            fireCooldown: state.fireCooldown,
            score: state.score,
            status: 'playing',
          },
          state.keys,
          rawDt,
          Math.random,
          difficulty,
        );
        state.playerX = result.state.playerX;
        state.bullets = result.state.bullets;
        state.enemies = result.state.enemies;
        state.spawnCounter = result.state.spawnCounter;
        state.fireCooldown = result.state.fireCooldown;
        state.score = result.state.score;
        if (result.state.score !== score) setScore(result.state.score);
        if (result.state.status === 'over') setStatus('over');
      }

      const py = playerY();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(state.playerX + SHOOTER.playerW / 2, py);
      ctx.lineTo(state.playerX, py + SHOOTER.playerH);
      ctx.lineTo(state.playerX + SHOOTER.playerW, py + SHOOTER.playerH);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#16a34a';
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      state.bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, SHOOTER.bulletW, SHOOTER.bulletH);
      });

      ctx.fillStyle = '#ef4444';
      state.enemies.forEach((e) => {
        ctx.fillRect(e.x, e.y, SHOOTER.enemyW, SHOOTER.enemyH);
        ctx.strokeStyle = '#b91c1c';
        ctx.strokeRect(e.x, e.y, SHOOTER.enemyW, SHOOTER.enemyH);
      });

      if (status === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, SHOOTER.w, SHOOTER.h);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('shooter.paused'), SHOOTER.w / 2, SHOOTER.h / 2);
        ctx.font = '16px sans-serif';
        ctx.fillText(
          t('shooter.resumePrompt'),
          SHOOTER.w / 2,
          SHOOTER.h / 2 + 30,
        );
      }

      if (status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, SHOOTER.w, SHOOTER.h);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('2048.gameOver'), SHOOTER.w / 2, SHOOTER.h / 2 - 12);
        ctx.fillText(
          formatMessage(locale, 'shooter.scoreDisplay', { score }),
          SHOOTER.w / 2,
          SHOOTER.h / 2 + 20,
        );
        ctx.font = '16px sans-serif';
        ctx.fillText(
          t('shooter.restartPrompt'),
          SHOOTER.w / 2,
          SHOOTER.h / 2 + 50,
        );
      }

      rafId = requestAnimationFrame(loop);
    };

    stateRef.current.lastTime = 0;
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status, score, locale, t, difficulty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current || arcade.result) return;
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
        if (status === 'idle' || status === 'paused') setStatus('playing');
        else if (status === 'over') reset();
      }
      if (e.code === 'KeyP') {
        e.preventDefault();
        if (status === 'playing') arcade.setPaused(true);
        else if (status === 'paused') setStatus('playing');
      }
      if (e.code === 'KeyR' && status === 'over') {
        e.preventDefault();
        reset();
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
  }, [status, reset, arcade.result, arcade.setPaused]);

  const start = useCallback(() => {
    if (pausedRef.current) return;
    if (status === 'idle' || status === 'paused') setStatus('playing');
    else if (status === 'over') reset();
  }, [status, reset]);

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

  useArcadeSnapshot(() => ({
    ...stateRef.current,
    status,
    score,
    elapsed: elapsed.current,
  }));
  useEffect(() => {
    if (paused)
      stateRef.current.keys = { left: false, right: false, fire: false };
  }, [paused]);
  useEffect(() => {
    if (status === 'playing') arcade.start();
    if (status === 'over')
      finish('lose', score, {
        kills: score / 10,
        survivalSeconds: elapsed.current,
      });
  }, [status, score, arcade.start, finish]);
  return (
    <GameShell
      autoStart={false}
      title={t('game.shooter.name')}
      subtitle={t('game.shooter.description')}
      status={<StatPill label={t('arcade.unit.points')} value={score} />}
      toolbar={
        <Button variant="outline" size="sm" onClick={reset}>
          {t('common.restart')}
        </Button>
      }
    >
      <div className="flex w-full flex-col items-center justify-center pb-44 md:pb-4">
        <div className="relative">
          <button
            type="button"
            className="rounded-lg border-2 border-border bg-black block"
            onClick={start}
          >
            <canvas
              ref={canvasRef}
              width={SHOOTER.w}
              height={SHOOTER.h}
              className="block cursor-pointer"
              style={{
                width: 'min(calc(100vw - 2rem), 400px)',
                height: 'auto',
              }}
            />
          </button>
          <GameResultOverlay
            open={status === 'over'}
            tone={'lose'}
            title={t('2048.gameOver')}
            description={String(score) + ' ' + t('arcade.unit.points')}
            onRestart={reset}
          />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('shooter.footerControls')}
        </p>
        <VirtualController
          tone="dark"
          onDirection={(dir) => setVirtualDirection(dir, true)}
          onDirectionEnd={(dir) => setVirtualDirection(dir, false)}
          onAction={(action) => setVirtualAction(action, true)}
          onActionEnd={(action) => setVirtualAction(action, false)}
        />
      </div>
    </GameShell>
  );
};

export default GameShooter;
