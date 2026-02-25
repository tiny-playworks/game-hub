import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SIZE = 4;
type Dir = 'up' | 'down' | 'left' | 'right';

function emptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(grid: number[][]): number[][] {
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideAndMerge(line: number[]): { line: number[]; score: number } {
  const filtered = line.filter((n) => n !== 0);
  const merged: number[] = [];
  let score = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      merged.push(filtered[i] * 2);
      score += filtered[i] * 2;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { line: merged, score };
}

function moveGrid(
  grid: number[][],
  dir: Dir,
): { grid: number[][]; score: number } {
  const next = emptyGrid();
  let totalScore = 0;
  if (dir === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { line, score } = slideAndMerge(grid[r]);
      next[r] = line;
      totalScore += score;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { line, score } = slideAndMerge([...grid[r]].reverse());
      next[r] = line.reverse();
      totalScore += score;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = grid.map((row) => row[c]);
      const { line, score } = slideAndMerge(col);
      for (let r = 0; r < SIZE; r++) next[r][c] = line[r];
      totalScore += score;
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const col = grid.map((row) => row[c]).reverse();
      const { line, score } = slideAndMerge(col);
      const rev = line.reverse();
      for (let r = 0; r < SIZE; r++) next[r][c] = rev[r];
      totalScore += score;
    }
  }
  return { grid: next, score: totalScore };
}

function sameGrid(a: number[][], b: number[][]): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (a[r][c] !== b[r][c]) return false;
  return true;
}

function canMove(grid: number[][]): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
    }
  return false;
}

const STORAGE_KEY = 'game-2048-best';

const Game2048 = () => {
  const [grid, setGrid] = useState<number[][]>(() =>
    addRandom(addRandom(emptyGrid())),
  );
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() =>
    Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10),
  );
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      localStorage.setItem(STORAGE_KEY, String(score));
    }
  }, [score, best]);

  const tryMove = useCallback((dir: Dir) => {
    setGrid((prev) => {
      const { grid: next, score: add } = moveGrid(prev, dir);
      if (sameGrid(prev, next)) return prev;
      setScore((s) => s + add);
      const withNew = addRandom(next);
      if (!canMove(withNew)) setGameOver(true);
      return withNew;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          tryMove('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          tryMove('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          tryMove('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          tryMove('down');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, tryMove]);

  const restart = () => {
    setGrid(addRandom(addRandom(emptyGrid())));
    setScore(0);
    setGameOver(false);
  };

  const colors: Record<number, string> = {
    0: 'bg-muted',
    2: 'bg-amber-100 text-amber-900',
    4: 'bg-amber-200 text-amber-900',
    8: 'bg-orange-300 text-orange-900',
    16: 'bg-orange-400 text-orange-900',
    32: 'bg-red-400 text-red-900',
    64: 'bg-red-500 text-white',
    128: 'bg-yellow-300 text-yellow-900',
    256: 'bg-yellow-400 text-yellow-900',
    512: 'bg-yellow-500 text-white',
    1024: 'bg-yellow-600 text-white',
    2048: 'bg-amber-600 text-white',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 返回游戏列表
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">分数: {score}</span>
          <span className="text-sm text-muted-foreground">最高: {best}</span>
          <Button variant="outline" size="sm" onClick={restart}>
            重开
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          方向键移动，相同数字合并
        </p>
        <div className="rounded-lg bg-muted p-2">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          >
            {grid.flat().map((val, i) => (
              <div
                key={i}
                className={cn(
                  'flex aspect-square max-w-[72px] items-center justify-center rounded-lg text-xl font-bold sm:max-w-[84px]',
                  colors[val] ?? 'bg-gray-400 text-white',
                )}
              >
                {val || ''}
              </div>
            ))}
          </div>
        </div>
        {gameOver && (
          <p className="mt-4 text-lg font-medium text-destructive">
            无法移动，游戏结束
          </p>
        )}
        <Link to="/" className="mt-6">
          <Button variant="ghost" size="sm">
            返回列表
          </Button>
        </Link>
      </main>
    </div>
  );
};

export default Game2048;
