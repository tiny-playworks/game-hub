import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Cell = 'X' | 'O' | null;
type Winner = 'X' | 'O' | 'draw' | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function getWinner(cells: Cell[]): Winner {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c])
      return cells[a];
  }
  if (cells.every((c) => c !== null)) return 'draw';
  return null;
}

const GameTictactoe = () => {
  const [cells, setCells] = useState<Cell[]>(Array(9).fill(null));
  const [xNext, setXNext] = useState(true);
  const winner = getWinner(cells);

  const handleClick = (i: number) => {
    if (cells[i] || winner) return;
    const next = [...cells];
    next[i] = xNext ? 'X' : 'O';
    setCells(next);
    setXNext(!xNext);
  };

  const restart = () => {
    setCells(Array(9).fill(null));
    setXNext(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 返回游戏列表
        </Link>
        <span className="text-sm text-muted-foreground">
          {winner
            ? winner === 'draw'
              ? '平局'
              : `赢家: ${winner}`
            : `下一位: ${xNext ? 'X' : 'O'}`}
        </span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <div className="grid grid-cols-3 gap-2 bg-muted p-2 rounded-lg">
          {cells.map((cell, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(i)}
              disabled={!!winner}
              className={cn(
                'flex size-20 sm:size-24 items-center justify-center rounded-lg border-2 border-border bg-background text-2xl font-bold transition hover:bg-accent disabled:pointer-events-none',
                cell === 'X' && 'text-primary',
                cell === 'O' && 'text-destructive',
              )}
            >
              {cell ?? ''}
            </button>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" onClick={restart}>
            重开
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm">
              返回列表
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GameTictactoe;
