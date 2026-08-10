import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import {
  BREAKOUT,
  type BreakoutState,
  clampPaddleX,
  createBricks,
  createInitialState,
  stepBreakout,
} from '@/lib/breakout';
import { formatMessage } from '@/lib/i18n';
import { useGameStore } from '../store/gameStore';

const {
  canvasW: CANVAS_W,
  canvasH: CANVAS_H,
  paddleW: PADDLE_W,
  paddleH: PADDLE_H,
  ballR: BALL_R,
  paddleY,
} = BREAKOUT;

type GameStatus = BreakoutState['status'];

const GameBreakout = () => {
  const { locale, t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stats, updateHighScore } = useGameStore();
  const gameStats = stats.breakout || { highScore: 0 };
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<GameStatus>('idle');

  const stateRef = useRef({
    ...createInitialState(),
    lastTime: 0,
  });

  const resetGame = useCallback(() => {
    stateRef.current = {
      ...createInitialState(),
      bricks: createBricks(),
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
      stateRef.current.status = 'playing';
      setStatus('playing');
    } else if (status === 'paused') {
      stateRef.current.status = 'playing';
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
        state.paddleX = clampPaddleX(mouseX - PADDLE_W / 2);
      }

      if ((status === 'idle' || status === 'paused') && !state.launched) {
        state.ballX = state.paddleX + PADDLE_W / 2;
      }

      if (status === 'playing' && state.launched) {
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
            {formatMessage(locale, 'breakout.highScore', {
              score: gameStats.highScore,
            })}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatMessage(locale, 'breakout.score', { score })}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatMessage(locale, 'breakout.lives', { lives })}
          </span>
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
                  ? t('breakout.launchTip')
                  : t('breakout.pausedTip')}
              </p>
              <Button onClick={launch}>{t('common.startOrContinue')}</Button>
            </div>
          )}

          {status === 'win' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/80 rounded-lg">
              <p className="mb-4 text-2xl font-bold text-white">
                {t('breakout.win')}
              </p>
              <p className="mb-4 text-white">
                {formatMessage(locale, 'breakout.finalScore', { score })}
              </p>
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
              <p className="mb-4 text-2xl font-bold text-white">
                {t('breakout.gameOver')}
              </p>
              <p className="mb-4 text-white">
                {formatMessage(locale, 'breakout.finalScore', { score })}
              </p>
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
          {t('breakout.controls')}
        </p>
      </main>
    </div>
  );
};

export default GameBreakout;
