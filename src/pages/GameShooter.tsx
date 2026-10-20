import { blocksArcadeShortcut } from '@/lib/arcadeInput';
import { useCallback, useEffect, useRef, useState } from 'react';
import flightSprites from '@/assets/arcade/flight-sprites.png';
import {
  type Direction,
  VirtualController,
} from '@/components/common/VirtualController';
import { GameProgress } from '@/components/game/GameProgress';
import { GameReadyOverlay } from '@/components/game/GameReadyOverlay';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  createInitialShooterState,
  playerY,
  SHOOTER,
  stepShooter,
} from '@/lib/shooter';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
const GameShooter = () => {
  const { t } = useLocale();
  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [hud, setHud] = useState({ score: 0, shields: 3, seconds: 0 });
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');
  const statusRef = useRef(status);
  statusRef.current = status;
  const stateRef = useRef(createInitialShooterState());
  const keys = useRef({ left: false, right: false, fire: false });
  const elapsed = useRef(0);
  const sparks = useRef<Spark[]>([]);
  const drag = useRef<number | null>(null);
  const wave = Math.min(8, Math.floor(hud.score / 100) + 1);
  const start = useCallback(() => {
    if (pausedRef.current || statusRef.current !== 'idle') return;
    statusRef.current = 'playing';
    stateRef.current.status = 'playing';
    setStatus('playing');
    arcade.start();
  }, [arcade.start]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const sprite = new Image();
    sprite.src = flightSprites;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let frame = 0;
    let last = 0;
    let lastHud = '';
    const loop = (time: number) => {
      const dt = last === 0 ? 1 : Math.min(2, (time - last) / (1000 / 60));
      last = time;
      if (statusRef.current === 'playing' && !pausedRef.current) {
        elapsed.current += dt / 60;
        const result = stepShooter(
          stateRef.current,
          keys.current,
          dt,
          Math.random,
          difficulty,
        );
        stateRef.current = result.state;
        for (const event of result.events) {
          if (event.type === 'enemy_destroyed' && !reducedMotion) {
            for (let i = 0; i < 10; i++) {
              const angle = Math.random() * Math.PI * 2;
              sparks.current.push({
                x: event.x,
                y: event.y,
                vx: Math.cos(angle) * 2.3,
                vy: Math.sin(angle) * 2.3,
                life: 24,
              });
            }
          }
        }
        if (result.state.status === 'over') {
          statusRef.current = 'over';
          setStatus('over');
          keys.current = { left: false, right: false, fire: false };
        }
      }
      const state = stateRef.current;
      const nextHud = {
        score: state.score,
        shields: state.shields ?? 3,
        seconds: Math.floor(elapsed.current),
      };
      const fingerprint = `${nextHud.score}:${nextHud.shields}:${nextHud.seconds}`;
      if (fingerprint !== lastHud) {
        setHud(nextHud);
        lastHud = fingerprint;
      }
      ctx.fillStyle = '#10242e';
      ctx.fillRect(0, 0, SHOOTER.w, SHOOTER.h);
      for (let i = 0; i < 42; i++) {
        const x = (i * 97 + 31) % SHOOTER.w;
        const y =
          (i * 71 + (reducedMotion ? 0 : elapsed.current * (6 + (i % 4)))) %
          SHOOTER.h;
        ctx.fillStyle = i % 4 === 0 ? '#d1b76e' : '#54717e';
        ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }
      ctx.strokeStyle = '#6a8c7d66';
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(0, SHOOTER.h - 10);
      ctx.lineTo(SHOOTER.w, SHOOTER.h - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      const drawShip = (
        x: number,
        y: number,
        w: number,
        h: number,
        enemy: boolean,
      ) => {
        if (!sprite.complete || !sprite.naturalWidth) return;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        if (enemy) ctx.rotate(Math.PI);
        const sw = sprite.naturalWidth,
          sh = sprite.naturalHeight;
        ctx.drawImage(
          sprite,
          sw * (enemy ? 0.516 : 0.014),
          sh * 0.085,
          sw * (enemy ? 0.47 : 0.51),
          sh * 0.79,
          -w / 2,
          -h / 2,
          w,
          h,
        );
        ctx.restore();
      };
      if (
        (state.invulnerableFrames ?? 0) <= 0 ||
        reducedMotion ||
        Math.floor(time / 100) % 2 === 0
      ) {
        drawShip(
          state.playerX,
          playerY(),
          SHOOTER.playerW,
          SHOOTER.playerH,
          false,
        );
      }
      ctx.fillStyle = '#f0cd7f';
      for (const bullet of state.bullets) {
        ctx.beginPath();
        ctx.roundRect(bullet.x, bullet.y, SHOOTER.bulletW, SHOOTER.bulletH, 2);
        ctx.fill();
      }
      for (const enemy of state.enemies)
        drawShip(enemy.x, enemy.y, SHOOTER.enemyW, SHOOTER.enemyH, true);
      sparks.current = sparks.current.filter((spark) => {
        if (!pausedRef.current) {
          spark.x += spark.vx * dt;
          spark.y += spark.vy * dt;
          spark.life -= dt;
        }
        if (spark.life <= 0) return false;
        ctx.globalAlpha = spark.life / 24;
        ctx.fillStyle = '#ebad6a';
        ctx.fillRect(spark.x, spark.y, 3, 3);
        ctx.globalAlpha = 1;
        return true;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sprite.onload = null;
    };
  }, [difficulty]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (blocksArcadeShortcut(event)) return;
      if (pausedRef.current || statusRef.current === 'over') return;
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
        keys.current.fire = true;
        start();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA')
        keys.current.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD')
        keys.current.right = false;
      if (event.code === 'Space') keys.current.fire = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [start]);
  useEffect(() => {
    if (paused) {
      keys.current = { left: false, right: false, fire: false };
      drag.current = null;
    }
  }, [paused]);
  useEffect(() => {
    if (status === 'over')
      finish('lose', hud.score, {
        kills: hud.score / 10,
        survivalSeconds: elapsed.current,
      });
  }, [status, hud.score, finish]);
  useArcadeSnapshot(() => ({
    ...stateRef.current,
    status,
    elapsed: elapsed.current,
    wave,
  }));
  const setDirection = (direction: Direction, active: boolean) => {
    if (direction === 'LEFT') keys.current.left = active;
    if (direction === 'RIGHT') keys.current.right = active;
  };
  const pointPlayer = (clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    stateRef.current.playerX = Math.max(
      0,
      Math.min(
        SHOOTER.w - SHOOTER.playerW,
        ((clientX - rect.left) * SHOOTER.w) / rect.width - SHOOTER.playerW / 2,
      ),
    );
  };
  return (
    <GameShell
      autoStart={false}
      title={t('game.shooter.name')}
      subtitle={t('game.shooter.description')}
      status={
        <>
          <StatPill label={t('arcade.score')} value={hud.score} />
          <StatPill
            label={t('arcade.shooterShield')}
            value={`${hud.shields} / 3`}
            tone={hud.shields === 1 ? 'danger' : 'default'}
          />
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={arcade.restart}>
          {t('common.restart')}
        </Button>
      }
    >
      <GameProgress
        label={`${t('arcade.wave')} ${wave}`}
        current={hud.score % 100}
        target={100}
        value={`${hud.score % 100} / 100`}
        feedback={`${t('arcade.survival')} ${hud.seconds}s`}
      />
      <div className="arcade-canvas-frame" style={{ width: 400 }}>
        <canvas
          ref={canvasRef}
          width={SHOOTER.w}
          height={SHOOTER.h}
          style={{ width: '100%' }}
          aria-label={t('game.shooter.name')}
          onPointerDown={(event) => {
            if (pausedRef.current || statusRef.current !== 'playing') return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = event.pointerId;
            pointPlayer(event.clientX);
            keys.current.fire = true;
          }}
          onPointerMove={(event) => {
            if (drag.current === event.pointerId && !pausedRef.current)
              pointPlayer(event.clientX);
          }}
          onPointerUp={(event) => {
            if (drag.current === event.pointerId) {
              drag.current = null;
              keys.current.fire = false;
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            keys.current.fire = false;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            keys.current.fire = false;
          }}
        />
        {status === 'idle' && (
          <GameReadyOverlay
            title={t('game.shooter.name')}
            description={t('arcade.shooterReady')}
            onStart={start}
          />
        )}
        <GameResultOverlay
          open={status === 'over'}
          tone="lose"
          title={t('2048.gameOver')}
          description={`${hud.score} ${t('arcade.unit.points')} · ${t('arcade.wave')} ${wave}`}
          onRestart={arcade.restart}
        />
      </div>
      <VirtualController
        horizontalOnly
        actions={['A']}
        actionLabels={{ A: t('arcade.fire') }}
        onDirection={(direction) => setDirection(direction, true)}
        onDirectionEnd={(direction) => setDirection(direction, false)}
        onAction={() => {
          keys.current.fire = true;
          start();
        }}
        onActionEnd={() => {
          keys.current.fire = false;
        }}
      />
    </GameShell>
  );
};
export default GameShooter;
