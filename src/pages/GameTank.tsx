import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

const TILE = 32;
const COLS = 13;
const ROWS = 13;
const W = COLS * TILE;
const H = ROWS * TILE;
const TANK_W = 28;
const TANK_H = 28;
const BULLET_SPEED = 6;
const TANK_SPEED = 2;

type Dir = 'up' | 'down' | 'left' | 'right';
const DIR_DXY: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const MAP_TEMPLATE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0],
];

interface Tank {
  x: number;
  y: number;
  dir: Dir;
  moveCounter: number;
  isPlayer: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
}

function mapClone(): number[][] {
  return MAP_TEMPLATE.map((row) => [...row]);
}

const GameTank = () => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'win' | 'over'>(
    'idle',
  );

  const stateRef = useRef<{
    map: number[][];
    player: Tank;
    enemies: Tank[];
    bullets: Bullet[];
    keys: Record<string, boolean>;
    playerCooldown: number;
    enemySpawnQueue: number;
    enemySpawnTimer: number;
  }>({
    map: mapClone(),
    player: {
      x: 6 * TILE + (TILE - TANK_W) / 2,
      y: 11 * TILE + (TILE - TANK_H) / 2,
      dir: 'up',
      moveCounter: 0,
      isPlayer: true,
    },
    enemies: [],
    bullets: [],
    keys: {},
    playerCooldown: 0,
    enemySpawnQueue: 5,
    enemySpawnTimer: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = {
      map: mapClone(),
      player: {
        x: 6 * TILE + (TILE - TANK_W) / 2,
        y: 11 * TILE + (TILE - TANK_H) / 2,
        dir: 'up',
        moveCounter: 0,
        isPlayer: true,
      },
      enemies: [],
      bullets: [],
      keys: {},
      playerCooldown: 0,
      enemySpawnQueue: 5,
      enemySpawnTimer: 120,
    };
    setStatus('idle');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const tileSolid = (map: number[][], px: number, py: number): boolean => {
      const c = Math.floor(px / TILE);
      const r = Math.floor(py / TILE);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
      return map[r][c] >= 1;
    };

    const tankBlocked = (
      tank: Tank,
      dx: number,
      dy: number,
      map: number[][],
    ): boolean => {
      const nx = tank.x + dx;
      const ny = tank.y + dy;
      const corners = [
        [nx, ny],
        [nx + TANK_W - 1, ny],
        [nx, ny + TANK_H - 1],
        [nx + TANK_W - 1, ny + TANK_H - 1],
      ];
      return corners.some(([px, py]) => tileSolid(map, px, py));
    };

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
        ctx.fillText('按 空格 开始', W / 2, H / 2);
        ctx.fillText('方向键移动 · 空格射击', W / 2, H / 2 + 24);
        ctx.fillText('保护黄色基地，消灭所有敌方坦克', W / 2, H / 2 + 48);
      }

      if (status === 'playing') {
        const [_dx, _dy] = DIR_DXY[player.dir];
        if (state.keys.ArrowUp) {
          player.dir = 'up';
          if (!tankBlocked(player, 0, -TANK_SPEED, map))
            player.y = Math.max(0, player.y - TANK_SPEED);
        }
        if (state.keys.ArrowDown) {
          player.dir = 'down';
          if (!tankBlocked(player, 0, TANK_SPEED, map))
            player.y = Math.min(H - TANK_H, player.y + TANK_SPEED);
        }
        if (state.keys.ArrowLeft) {
          player.dir = 'left';
          if (!tankBlocked(player, -TANK_SPEED, 0, map))
            player.x = Math.max(0, player.x - TANK_SPEED);
        }
        if (state.keys.ArrowRight) {
          player.dir = 'right';
          if (!tankBlocked(player, TANK_SPEED, 0, map))
            player.x = Math.min(W - TANK_W, player.x + TANK_SPEED);
        }

        if (state.keys.Space && state.playerCooldown <= 0) {
          const [dx, dy] = DIR_DXY[player.dir];
          state.bullets.push({
            x: player.x + TANK_W / 2 - 2,
            y: player.y + TANK_H / 2 - 2,
            vx: dx * BULLET_SPEED,
            vy: dy * BULLET_SPEED,
            fromPlayer: true,
          });
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
          const spawns = [
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

        enemies.forEach((enemy, _ei) => {
          enemy.moveCounter++;
          if (enemy.moveCounter >= 30) {
            enemy.moveCounter = 0;
            const dirs: Dir[] = ['up', 'down', 'left', 'right'];
            const [_dx, _dy] = DIR_DXY[enemy.dir];
            const tryDir = dirs[Math.floor(Math.random() * 4)];
            const [tdx, tdy] = DIR_DXY[tryDir];
            if (!tankBlocked(enemy, tdx * TILE, tdy * TILE, map)) {
              enemy.dir = tryDir;
            }
          }
          const [dx, dy] = DIR_DXY[enemy.dir];
          if (!tankBlocked(enemy, dx * 2, dy * 2, map)) {
            enemy.x += dx * 2;
            enemy.y += dy * 2;
          }
          if (Math.random() < 0.02) {
            state.bullets.push({
              x: enemy.x + TANK_W / 2 - 2,
              y: enemy.y + TANK_H / 2 - 2,
              vx: dx * BULLET_SPEED,
              vy: dy * BULLET_SPEED,
              fromPlayer: false,
            });
          }
        });

        state.bullets = bullets.filter((b) => {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < -4 || b.x > W + 4 || b.y < -4 || b.y > H + 4) return false;
          const bc = Math.floor(b.x / TILE);
          const br = Math.floor(b.y / TILE);
          if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
            const v = map[br][bc];
            if (v === 1) {
              map[br][bc] = 0;
              return false;
            }
            if (v === 2) return false;
            if (v === 3) {
              setStatus('over');
              return false;
            }
          }
          if (b.fromPlayer) {
            const hit = enemies.some(
              (e) =>
                b.x + 4 > e.x &&
                b.x < e.x + TANK_W &&
                b.y + 4 > e.y &&
                b.y < e.y + TANK_H,
            );
            if (hit) {
              state.enemies = enemies.filter(
                (e) =>
                  !(
                    b.x + 4 > e.x &&
                    b.x < e.x + TANK_W &&
                    b.y + 4 > e.y &&
                    b.y < e.y + TANK_H
                  ),
              );
              return false;
            }
          } else {
            const hit =
              b.x + 4 > player.x &&
              b.x < player.x + TANK_W &&
              b.y + 4 > player.y &&
              b.y < player.y + TANK_H;
            if (hit) {
              setStatus('over');
              return false;
            }
            const br = Math.floor(b.y / TILE);
            const bc = Math.floor(b.x / TILE);
            if (
              br >= 0 &&
              br < ROWS &&
              bc >= 0 &&
              bc < COLS &&
              map[br][bc] === 3
            ) {
              map[br][bc] = 0;
              setStatus('over');
              return false;
            }
          }
          return true;
        });

        if (state.enemies.length === 0 && state.enemySpawnQueue <= 0) {
          setStatus('win');
        }
      }

      const drawTank = (t: Tank, color: string) => {
        ctx.save();
        ctx.translate(t.x + TANK_W / 2, t.y + TANK_H / 2);
        const angle =
          t.dir === 'up'
            ? 0
            : t.dir === 'down'
              ? Math.PI
              : t.dir === 'left'
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
      bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, 4, 4);
      });

      if (status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ef4444';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束', W / 2, H / 2 - 12);
        ctx.fillText('基地被毁或你被击中', W / 2, H / 2 + 20);
      }
      if (status === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#22c55e';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('胜利！', W / 2, H / 2);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
        stateRef.current.keys[e.code] = true;
        if (status === 'idle' && e.code === 'Space') setStatus('playing');
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
  }, [status]);

  const start = () => {
    if (status === 'idle') setStatus('playing');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <Button variant="outline" size="sm" onClick={reset}>
          {t('common.restart')}
        </Button>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
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
            style={{ width: W, height: H }}
          />
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          方向键移动 · 空格射击 · 保护黄色基地 · 消灭全部敌坦
        </p>
      </main>
    </div>
  );
};

export default GameTank;
