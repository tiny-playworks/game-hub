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
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arcade = useArcade();
  const { difficulty, paused, finish } = arcade;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [status, setStatus] = useState<'idle' | 'playing' | 'win' | 'over'>(
    'idle',
  );
  const enemyCount = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 10 : 5;
  const [remainingEnemies, setRemainingEnemies] = useState(enemyCount);
  const remainingRef = useRef(enemyCount);
  const baseDamaged = useRef(false);

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
    enemySpawnQueue: enemyCount,
    enemySpawnTimer: 0,
  });

  const reset = arcade.restart;

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

      if (status === 'playing' && !pausedRef.current) {
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
          state.enemySpawnTimer >= (difficulty === 'hard' ? 120 : 180) &&
          state.enemies.length <
            (difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2)
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
          if (enemy.moveCounter >= (difficulty === 'hard' ? 15 : 30)) {
            enemy.moveCounter = 0;
            const allDirs: TankDir[] = ['up', 'down', 'left', 'right'];
            const tryDir =
              difficulty === 'hard' && Math.random() < 0.65
                ? Math.abs(player.x - enemy.x) > Math.abs(player.y - enemy.y)
                  ? player.x > enemy.x
                    ? 'right'
                    : 'left'
                  : player.y > enemy.y
                    ? 'down'
                    : 'up'
                : allDirs[Math.floor(Math.random() * 4)];
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
          if (
            Math.random() <
            (difficulty === 'easy' ? 0.01 : difficulty === 'hard' ? 0.04 : 0.02)
          ) {
            state.bullets.push(fireBullet(enemy));
          }
        });

        const nextBullets: TankBullet[] = [];
        for (const b of bullets) {
          const stepped = stepBullet(map, b);
          if (stepped.event === 'base') {
            baseDamaged.current = true;
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
  }, [status, t, difficulty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current || arcade.result) return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
        stateRef.current.keys[e.code] = true;
        if (status === 'idle' && e.code === 'Space') {
          setStatus('playing');
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
  }, [status, arcade.result]);

  const start = useCallback(() => {
    if (pausedRef.current) return;
    if (status === 'idle') {
      setStatus('playing');
    }
  }, [status]);

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

  useArcadeSnapshot(() => ({
    ...stateRef.current,
    status,
    remainingEnemies,
    enemyCount,
    baseDamaged: baseDamaged.current,
  }));
  useEffect(() => {
    if (paused) stateRef.current.keys = {};
  }, [paused]);
  useEffect(() => {
    if (status === 'playing') arcade.start();
    if (status === 'win' || status === 'over')
      finish(
        status === 'win' ? 'win' : 'lose',
        (enemyCount - remainingEnemies) * 100,
        { baseDamaged: baseDamaged.current, enemies: enemyCount },
      );
  }, [status, enemyCount, remainingEnemies, arcade.start, finish]);
  return (
    <GameShell
      autoStart={false}
      title={t('game.tank.name')}
      subtitle={t('game.tank.description')}
      status={<StatPill label={t('arcade.enemies')} value={remainingEnemies} />}
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
              width={W}
              height={H}
              className="block cursor-pointer"
              style={{
                width: 'min(calc(100vw - 2rem), 416px)',
                height: 'auto',
              }}
            />
          </button>
          <GameResultOverlay
            open={status === 'over' || status === 'win'}
            tone={status === 'win' ? 'win' : 'lose'}
            title={status === 'win' ? t('common.youWin') : t('common.youLose')}
            description={
              String((enemyCount - remainingEnemies) * 100) +
              ' ' +
              t('arcade.unit.points')
            }
            onRestart={reset}
          />
        </div>
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
      </div>
    </GameShell>
  );
};

export default GameTank;
