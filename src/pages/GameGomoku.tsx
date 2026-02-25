import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SIZE = 15;
type Stone = 'B' | 'W' | null;
type Winner = 'B' | 'W' | null;

function getWinner(board: Stone[]): Winner {
  const at = (r: number, c: number) => board[r * SIZE + c];
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const stone = at(r, c);
      if (!stone) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        let nr = r + dr;
        let nc = c + dc;
        while (
          nr >= 0 &&
          nr < SIZE &&
          nc >= 0 &&
          nc < SIZE &&
          at(nr, nc) === stone
        ) {
          count++;
          nr += dr;
          nc += dc;
        }
        if (count >= 5) return stone;
      }
    }
  }
  return null;
}

const GameGomoku = () => {
  const [board, setBoard] = useState<Stone[]>(Array(SIZE * SIZE).fill(null));
  const [blackNext, setBlackNext] = useState(true);
  const winner = getWinner(board);

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = blackNext ? 'B' : 'W';
    setBoard(next);
    setBlackNext(!blackNext);
  };

  const restart = () => {
    setBoard(Array(SIZE * SIZE).fill(null));
    setBlackNext(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 返回游戏列表
        </Link>
        <span className="text-sm text-muted-foreground">
          {winner
            ? `赢家: ${winner === 'B' ? '黑' : '白'}`
            : `下一位: ${blackNext ? '黑' : '白'}`}
        </span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          五子连珠即胜，双人轮流落子
        </p>
        <div
          className="grid gap-0.5 rounded-lg bg-muted p-2"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
        >
          {board.map((stone, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(i)}
              disabled={!!winner}
              className={cn(
                'flex aspect-square min-w-[20px] max-w-[28px] items-center justify-center rounded-sm border border-border bg-background text-xs font-bold transition hover:bg-accent disabled:pointer-events-none sm:min-w-[24px] sm:max-w-[32px]',
                stone === 'B' && 'bg-stone-900 text-white',
                stone === 'W' && 'bg-white text-stone-900 border-stone-400',
              )}
            >
              {stone ?? ''}
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

export default GameGomoku;
