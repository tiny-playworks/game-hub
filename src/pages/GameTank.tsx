import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type ActionType,
  type Direction,
  VirtualController,
} from '@/components/common/VirtualController';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  bulletHitsTank,
  cloneMap,
  countRemainingEnemies,
  createPlayerTank,
  DIR_DXY,
  fireBullet,
  isOffsetBlocked,
  moveTank,
  stepBullet,
  TANK,
  type TankBullet,
  type TankDir,
  type TankEntity,
} from '@/lib/tank';
import { useGameStore } from '../store/gameStore';

const {
  tile: TILE,
  cols: COLS,
  rows: ROWS,
  w: W,
  h: H,
  tankW: TANK_W,
  tankH: TANK_H,
} = TANK;

const GameTank = () => {
  const { locale, t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stats, incrementPlayCount } = useGameStore();
  const gameStats = stats.tank || { playCount: 0 };
  const [status, setStatus] = useState<'idle' | 'playing' | 'win' | 'over'>(
    'idle',
  );
  const [remainingEnemies, setRemainingEnemies] = useState(5);
  const remainingRef = useRef(5);

  const stateRef = useRef<{
    map: number[][];
    player: TankEntity;
    enemies: TankEntity[];
    bullets: TankBullet[];
    keys: Record<string, boolean>;
    playerCooldown: number;
    enemySpawnQueue: number;
    enemySpawnTimer: number;
  }>({
    map: cloneMap(),
    player: createPlayerTank(),
    enemies: [],
    bullets: [],
    keys: {},
    playerCooldown: 0,
    enemySpawnQueue: 5,
    enemySpawnTimer: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = {
      map: cloneMap(),
      player: createPlayerTank(),
      enemies: [],
      bullets: [],
      keys: {},
      playerCooldown: 0,
      enemySpawnQueue: 5,
      enemySpawnTimer: 120,
    };
    setStatus('idle');
    setRemainingEnemies(5);
    remainingRef.current = 5;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const loop = () => {
      const state = stateRef.current;
      const { map, player, enemies, bullets } = state;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = map[r][c];
          const x = c * TILE;
          const y = r * TILE;
          if (v === 1) {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            ctx.strokeStyle = '#92400e';
            ctx.strokeRect(x, y, TILE, TILE);
          } else if (v === 2) {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          } else if (v === 3) {
            ctx.fillStyle = '#eab308';
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          }
        }
      }

      if (status === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('tank.startPrompt'), W / 2, H / 2);
        ctx.fillText(t('tank.controlsPrompt'), W / 2, H / 2 + 24);
        ctx.fillText(t('tank.descriptionPrompt'), W / 2, H / 2 + 48);
      }

      if (status === 'playing') {
        const dirs: { key: string; dir: TankDir }[] = [
          { key: 'ArrowUp', dir: 'up' },
          { key: 'ArrowDown', dir: 'down' },
          { key: 'ArrowLeft', dir: 'left' },
          { key: 'ArrowRight', dir: 'right' },
        ];
        for (const { key, dir } of dirs) {
          if (state.keys[key]) {
            Object.assign(player, moveTank(map, player, dir));
          }
        }

        if (state.keys.Space && state.playerCooldown <= 0) {
          state.bullets.push(fireBullet(player));
          state.playerCooldown = 25;
        }
        if (state.playerCooldown > 0) state.playerCooldown--;

        state.enemySpawnTimer++;
        if (
          state.enemySpawnQueue > 0 &&
          state.enemySpawnTimer >= 180 &&
          state.enemies.length < 2
        ) {
          state.enemySpawnTimer = 0;
          state.enemySpawnQueue--;
          // Preserve exact spawn pixels from original game feel
          const spawns: [number, number][] = [
            [0, 0],
            [6 * TILE + (TILE - TANK_W) / 2, 0],
            [12 * TILE - TANK_W + (TILE - TANK_W) / 2, 0],
          ];
          const [sx, sy] = spawns[state.enemies.length % 3];
          state.enemies.push({
            x: sx,
            y: sy,
            dir: 'down',
            moveCounter: 0,
            isPlayer: false,
          });
        }

        enemies.forEach((enemy) => {
          enemy.moveCounter++;
          if (enemy.moveCounter >= 30) {
            enemy.moveCounter = 0;
            const allDirs: TankDir[] = ['up', 'down', 'left', 'right'];
            const tryDir = allDirs[Math.floor(Math.random() * 4)];
            const [tdx, tdy] = DIR_DXY[tryDir];
            if (!isOffsetBlocked(map, enemy, tdx * TILE, tdy * TILE)) {
              enemy.dir = tryDir;
            }
          }
          const [dx, dy] = DIR_DXY[enemy.dir];
          if (!isOffsetBlocked(map, enemy, dx * 2, dy * 2)) {
            enemy.x += dx * 2;
            enemy.y += dy * 2;
          }
          if (Math.random() < 0.02) {
            state.bullets.push(fireBullet(enemy));
          }
        });

        const nextBullets: TankBullet[] = [];
        for (const b of bullets) {
          const stepped = stepBullet(map, b);
          if (stepped.event === 'base') {
            setStatus('over');
            continue;
          }
          if (!stepped.bullet) continue;

          const bullet = stepped.bullet;
          if (bullet.fromPlayer) {
            const hitEnemy = state.enemies.find((e) =>
              bulletHitsTank(bullet, e),
            );
            if (hitEnemy) {
              state.enemies = state.enemies.filter((e) => e !== hitEnemy);
              continue;
            }
          } else if (bulletHitsTank(bullet, player)) {
            setStatus('over');
            continue;
          }
          nextBullets.push(bullet);
        }
        state.bullets = nextBullets;

        if (state.enemies.length === 0 && state.enemySpawnQueue <= 0) {
          setStatus('win');
        }

        const remaining = countRemainingEnemies(
          state.enemySpawnQueue,
          state.enemies,
        );
        if (remaining !== remainingRef.current) {
          remainingRef.current = remaining;
          setRemainingEnemies(remaining);
        }
      }

      const drawTank = (tank: TankEntity, color: string) => {
        ctx.save();
        ctx.translate(tank.x + TANK_W / 2, tank.y + TANK_H / 2);
        const angle =
          tank.dir === 'up'
            ? 0
            : tank.dir === 'down'
              ? Math.PI
              : tank.dir === 'left'
                ? -Math.PI / 2
                : Math.PI / 2;
        ctx.rotate(angle);
        ctx.translate(-TANK_W / 2, -TANK_H / 2);
        ctx.fillStyle = color;
        ctx.fillRect(2, 2, TANK_W - 4, TANK_H - 4);
        ctx.strokeStyle = '#0f172a';
        ctx.strokeRect(0, 0, TANK_W, TANK_H);
        ctx.restore();
      };

      drawTank(player, '#22c55e');
      enemies.forEach((e) => {
        drawTank(e, '#ef4444');
      });

      ctx.fillStyle = '#fbbf24';
      state.bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, 4, 4);
      });

      if (status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ef4444';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('2048.gameOver'), W / 2, H / 2 - 12);
        ctx.fillText(t('tank.losePrompt'), W / 2, H / 2 + 20);
      }
      if (status === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#22c55e';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('tank.winPrompt'), W / 2, H / 2);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
        stateRef.current.keys[e.code] = true;
        if (status === 'idle' && e.code === 'Space') {
          setStatus('playing');
          incrementPlayCount('tank');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.keys[e.code] !== undefined) {
        stateRef.current.keys[e.code] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [incrementPlayCount, status]);

  const start = useCallback(() => {
    if (status === 'idle') {
      setStatus('playing');
      incrementPlayCount('tank');
    }
  }, [status, incrementPlayCount]);

  const setVirtualDirection = useCallback((dir: Direction, active: boolean) => {
    const keyByDirection: Record<Direction, string> = {
      UP: 'ArrowUp',
      DOWN: 'ArrowDown',
      LEFT: 'ArrowLeft',
      RIGHT: 'ArrowRight',
    };
    stateRef.current.keys[keyByDirection[dir]] = active;
  }, []);

  const setVirtualAction = useCallback(
    (_action: ActionType, active: boolean) => {
      stateRef.current.keys.Space = active;
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
          <span className="text-sm text-muted-foreground">
            {formatMessage(locale, 'tank.playCount', {
              count: gameStats.playCount,
            })}
          </span>
          <span className="text-sm text-red-500 font-bold">
            {formatMessage(locale, 'tank.remainingEnemies', {
              count: remainingEnemies,
            })}
          </span>
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
            style={{ width: 'min(calc(100vw - 2rem), 416px)', height: 'auto' }}
          />
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('tank.footerControls')}
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

export default GameTank;
