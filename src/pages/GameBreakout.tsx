import { blocksArcadeShortcut } from '@/lib/arcadeInput';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VirtualController } from '@/components/common/VirtualController';
import { GameProgress } from '@/components/game/GameProgress';
import { GameReadyOverlay } from '@/components/game/GameReadyOverlay';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  BREAKOUT,
  type BreakoutState,
  clampPaddleX,
  createInitialState,
  stepBreakout,
} from '@/lib/breakout';

const { canvasW: W, canvasH: H, paddleH, ballR, paddleY } = BREAKOUT;
const GameBreakout = () => {
  const { t } = useLocale();
  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const paddleWidth =
    difficulty === 'easy' ? 150 : difficulty === 'hard' ? 70 : 100;
  const speed = difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.3 : 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const stateRef = useRef(createInitialState());
  const keys = useRef({ left: false, right: false });
  const [hud, setHud] = useState({ score: 0, lives: 3 });
  const [status, setStatus] = useState<BreakoutState['status']>('idle');
  const launch = useCallback(() => {
    const state = stateRef.current;
    if (pausedRef.current || state.status !== 'idle') return;
    state.launched = true;
    state.ballVx = 4 * speed;
    state.ballVy = -6 * speed;
    state.status = 'playing';
    setStatus('playing');
    arcade.start();
  }, [speed, arcade.start]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let last = 0;
    let trail: { x: number; y: number }[] = [];
    let flashes: {
      x: number;
      y: number;
      w: number;
      h: number;
      life: number;
    }[] = [];
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const palette = [
      '#cb6553',
      '#d28b56',
      '#d2ae62',
      '#7e9e74',
      '#568b8b',
      '#6b829d',
    ];
    const loop = (time: number) => {
      const dt = last ? Math.min(2, (time - last) / (1000 / 60)) : 1;
      last = time;
      const current = stateRef.current;
      if (
        !pausedRef.current &&
        (current.status === 'playing' || current.status === 'idle')
      ) {
        const direction =
          Number(keys.current.right) - Number(keys.current.left);
        current.paddleX = clampPaddleX(
          current.paddleX + direction * 9 * dt,
          paddleWidth,
        );
        if (!current.launched)
          current.ballX = current.paddleX + paddleWidth / 2;
      }
      if (current.status === 'playing' && !pausedRef.current) {
        let remaining = dt;
        while (remaining > 0 && stateRef.current.status === 'playing') {
          const step = Math.min(0.5, remaining);
          const previous = stateRef.current;
          const result = stepBreakout(previous, step, paddleWidth);
          stateRef.current = result.state;
          if (result.events.length) {
            setHud({ score: result.state.score, lives: result.state.lives });
            for (const event of result.events) {
              if (event.type === 'brick_hit' && !reducedMotion) {
                const brick = previous.bricks.find(
                  (item, index) =>
                    item.alive && !result.state.bricks[index].alive,
                );
                if (brick)
                  flashes.push({
                    x: brick.x,
                    y: brick.y,
                    w: brick.w,
                    h: brick.h,
                    life: 16,
                  });
              }
            }
            if (result.state.status !== 'playing') {
              setStatus(result.state.status);
              trail = [];
            }
          }
          remaining -= step;
        }
      }
      const state = stateRef.current;
      ctx.fillStyle = '#122b31';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#b9cfc40a';
      for (let x = 0; x <= W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      state.bricks.forEach((brick, index) => {
        if (!brick.alive) return;
        ctx.fillStyle = palette[Math.floor(index / BREAKOUT.brickCols)];
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff2e';
        ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 2);
      });
      if (state.launched && !pausedRef.current && !reducedMotion) {
        trail.push({ x: state.ballX, y: state.ballY });
        if (trail.length > 12) trail.shift();
      }
      trail.forEach((point, index) => {
        ctx.globalAlpha = (index / trail.length) * 0.35;
        ctx.fillStyle = '#e5c478';
        ctx.beginPath();
        ctx.arc(
          point.x,
          point.y,
          (ballR * index) / trail.length,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      flashes = flashes.filter((flash) => {
        if (!pausedRef.current) flash.life -= dt;
        if (flash.life <= 0) return false;
        ctx.globalAlpha = flash.life / 16;
        ctx.fillStyle = '#f4e4b8';
        ctx.beginPath();
        ctx.roundRect(
          flash.x - (16 - flash.life),
          flash.y - 2,
          flash.w + (16 - flash.life) * 2,
          flash.h + 4,
          6,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
      ctx.fillStyle = '#b9d7c0';
      ctx.beginPath();
      ctx.roundRect(state.paddleX, paddleY, paddleWidth, paddleH, 6);
      ctx.fill();
      ctx.fillStyle = '#e8c676';
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, ballR, 0, Math.PI * 2);
      ctx.fill();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [paddleWidth]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (pausedRef.current || arcade.result) return;
      if (blocksArcadeShortcut(event)) return;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        keys.current.left = true;
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        keys.current.right = true;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        launch();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA')
        keys.current.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD')
        keys.current.right = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [launch, arcade.result]);
  useEffect(() => {
    if (paused) keys.current = { left: false, right: false };
  }, [paused]);
  useEffect(() => {
    if (status === 'win' || status === 'lose')
      finish(status, hud.score, { lives: hud.lives });
  }, [status, hud.score, hud.lives, finish]);
  useArcadeSnapshot(() => ({
    ...stateRef.current,
    paddleWidth,
    ballSpeed: speed,
  }));
  const movePaddle = (clientX: number) => {
    if (pausedRef.current || arcade.result) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    stateRef.current.paddleX = clampPaddleX(
      ((clientX - rect.left) * W) / rect.width - paddleWidth / 2,
      paddleWidth,
    );
  };
  return (
    <GameShell
      autoStart={false}
      title={t('game.breakout.name')}
      subtitle={t('game.breakout.description')}
      status={
        <>
          <StatPill label={t('arcade.score')} value={hud.score} />
          <StatPill label={t('arcade.lives')} value={hud.lives} />
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={arcade.restart}>
          {t('common.restart')}
        </Button>
      }
    >
      <GameProgress
        label={t('arcade.bricks')}
        current={hud.score / 10}
        target={60}
      />
      <div className="arcade-canvas-frame" style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ width: '100%' }}
          aria-label={t('game.breakout.name')}
          onPointerMove={(event) => {
            event.preventDefault();
            movePaddle(event.clientX);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            movePaddle(event.clientX);
            launch();
          }}
        />
        {status === 'idle' && (
          <GameReadyOverlay
            title={
              hud.lives < 3 ? t('breakout.launchTip') : t('game.breakout.name')
            }
            description={t('arcade.breakoutReady')}
            onStart={launch}
            label={hud.lives < 3 ? t('common.startOrContinue') : undefined}
          />
        )}
        <GameResultOverlay
          open={status === 'win' || status === 'lose'}
          tone={status === 'win' ? 'win' : 'lose'}
          title={status === 'win' ? t('breakout.win') : t('breakout.gameOver')}
          description={`${hud.score} ${t('arcade.unit.points')}`}
          onRestart={arcade.restart}
        />
      </div>
      <VirtualController
        horizontalOnly
        showActions={false}
        onDirection={(direction) => {
          if (direction === 'LEFT') keys.current.left = true;
          if (direction === 'RIGHT') keys.current.right = true;
        }}
        onDirectionEnd={(direction) => {
          if (direction === 'LEFT') keys.current.left = false;
          if (direction === 'RIGHT') keys.current.right = false;
        }}
      />
    </GameShell>
  );
};
export default GameBreakout;
