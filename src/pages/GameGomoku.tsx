import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import { GOMOKU_SIZE, type GomokuStone, getGomokuWinner } from '@/lib/gomoku';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const GameGomoku = () => {
  const { locale, t } = useLocale();
  const [board, setBoard] = useState<GomokuStone[]>(
    Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null),
  );
  const [blackNext, setBlackNext] = useState(true);
  const winner = getGomokuWinner(board);

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = blackNext ? 'B' : 'W';
    setBoard(next);
    setBlackNext(!blackNext);
    if (getGomokuWinner(next)) unlock('gomoku-first-win');
  };

  const restart = () => {
    setBoard(Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null));
    setBlackNext(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <span className="text-sm text-muted-foreground">
          {winner
            ? formatMessage(locale, 'game.gomoku.winner', {
                winner:
                  winner === 'B'
                    ? t('game.gomoku.black')
                    : t('game.gomoku.white'),
              })
            : formatMessage(locale, 'game.gomoku.next', {
                next: blackNext
                  ? t('game.gomoku.black')
                  : t('game.gomoku.white'),
              })}
        </span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          {t('game.gomoku.rules')}
        </p>
        <div
          className="grid gap-0.5 rounded-lg bg-muted p-2"
          style={{ gridTemplateColumns: `repeat(${GOMOKU_SIZE}, 1fr)` }}
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
            {t('common.restart')}
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm">
              {t('common.backList')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GameGomoku;
