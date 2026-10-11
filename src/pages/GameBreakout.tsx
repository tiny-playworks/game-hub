import { useCallback, useEffect, useRef, useState } from 'react';
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
import { formatMessage } from '@/lib/i18n';

const {
  canvasW: CANVAS_W,
  canvasH: CANVAS_H,
  paddleH: PADDLE_H,
  ballR: BALL_R,
  paddleY,
} = BREAKOUT;

type GameStatus = BreakoutState['status'];

const GameBreakout = () => {
  const { locale, t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const PADDLE_W =
    difficulty === 'easy' ? 150 : difficulty === 'hard' ? 70 : 100;
  const ballSpeed =
    difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.3 : 1;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<GameStatus>('idle');

  const stateRef = useRef({
    ...createInitialState(),
    lastTime: 0,
  });

  const resetGame = arcade.restart;

  const launch = useCallback(() => {
    if (pausedRef.current) return;
    if (status === 'idle' && !stateRef.current.launched) {
      stateRef.current.launched = true;
      stateRef.current.ballVx = 4 * ballSpeed;
      stateRef.current.ballVy = -6 * ballSpeed;
      stateRef.current.status = 'playing';
      setStatus('playing');
    } else if (status === 'paused') {
      stateRef.current.status = 'playing';
      setStatus('playing');
    }
  }, [status, ballSpeed]);

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
      if (pausedRef.current || arcade.result) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (status === 'idle' || status === 'paused') launch();
        else if (status === 'playing') arcade.setPaused(true);
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
        state.paddleX = clampPaddleX(mouseX - PADDLE_W / 2, PADDLE_W);
      }

      if ((status === 'idle' || status === 'paused') && !state.launched) {
        state.ballX = state.paddleX + PADDLE_W / 2;
      }

      if (status === 'playing' && state.launched && !pausedRef.current) {
        const { state: next, events } = stepBreakout(
          {
            paddleX: state.paddleX,
            ballX: state.ballX,
            ballY: state.ballY,
            ballVx: state.ballVx,
            ballVy: state.ballVy,
            bricks: state.bricks,
            launched: state.launched,
            lives: state.lives,
            score: state.score,
            status: 'playing',
          },
          dt,
          PADDLE_W,
        );

        state.ballX = next.ballX;
        state.ballY = next.ballY;
        state.ballVx = next.ballVx;
        state.ballVy = next.ballVy;
        state.bricks = next.bricks;
        state.launched = next.launched;
        state.lives = next.lives;
        state.score = next.score;
        state.status = next.status;

        for (const event of events) {
          if (event.type === 'brick_hit') {
            setScore(next.score);
          } else if (event.type === 'life_lost') {
            setLives(event.lives);
            setStatus('idle');
          } else if (event.type === 'lose') {
            setLives(0);
            setStatus('lose');
          } else if (event.type === 'win') {
            setStatus('win');
          }
        }
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
      ctx.fillRect(state.paddleX, paddleY, PADDLE_W, PADDLE_H);

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
  }, [status, launch, PADDLE_W, arcade.setPaused, arcade.result]);

  useArcadeSnapshot(() => ({
    ...stateRef.current,
    status,
    paddleWidth: PADDLE_W,
    ballSpeed,
  }));
  useEffect(() => {
    if (status === 'playing') arcade.start();
    if (status === 'win' || status === 'lose') finish(status, score, { lives });
  }, [status, score, lives, arcade.start, finish]);
  return (
    <GameShell
      autoStart={false}
      title={t('game.breakout.name')}
      subtitle={t('breakout.controls')}
      status={
        <>
          <StatPill label={t('arcade.unit.points')} value={score} />
          <StatPill label={t('arcade.lives')} value={lives} />
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={resetGame}>
          {t('common.restart')}
        </Button>
      }
    >
      <div className="flex w-full flex-col items-center justify-center pb-44 md:pb-4">
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
                  ? t('breakout.launchTip')
                  : t('breakout.pausedTip')}
              </p>
              <Button onClick={launch}>{t('common.startOrContinue')}</Button>
            </div>
          )}

          <GameResultOverlay
            open={status === 'win' || status === 'lose'}
            tone={status === 'win' ? 'win' : 'lose'}
            title={
              status === 'win' ? t('breakout.win') : t('breakout.gameOver')
            }
            description={formatMessage(locale, 'breakout.finalScore', {
              score,
            })}
            onRestart={resetGame}
          />
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('breakout.controls')}
        </p>
      </div>
    </GameShell>
  );
};

export default GameBreakout;
