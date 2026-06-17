import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  canPlace,
  createInitialState,
  GO_SIZE,
  type GoState,
  getScore,
  pass,
  placeStone,
} from '@/lib/go';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const GameGo = () => {
  const { locale, t } = useLocale();
  const [state, setState] = useState<GoState>(createInitialState);

  const handleCellClick = (row: number, col: number) => {
    if (state.gameOver) return;
    if (!canPlace(state, row, col)) return;
    setState(placeStone(state, row, col));
  };

  const handlePass = () => {
    if (state.gameOver) return;
    setState(pass(state));
  };

  const restart = () => {
    setState(createInitialState());
  };

  const score = state.gameOver ? getScore(state) : null;
  const statusText = state.gameOver
    ? formatMessage(locale, 'game.go.status.gameOver', {
        black: score?.black ?? 0,
        white: score?.white ?? 0,
      })
    : formatMessage(locale, 'game.go.status.next', {
        next: state.blackTurn
          ? t('game.go.status.black')
          : t('game.go.status.white'),
      });

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <span className="text-sm text-muted-foreground">{statusText}</span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          {t('game.go.rules')}
        </p>
        <div
          className="inline-grid gap-0 rounded-lg border-2 border-amber-800 bg-amber-100 p-1"
          style={{
            gridTemplateColumns: `repeat(${GO_SIZE}, 2rem)`,
            gridTemplateRows: `repeat(${GO_SIZE}, 2rem)`,
          }}
        >
          {state.board.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const legal = canPlace(state, rowIndex, colIndex);
              const isStar =
                [2, 4, 6].includes(rowIndex) && [2, 4, 6].includes(colIndex);
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={state.gameOver}
                  className={cn(
                    'relative flex items-center justify-center border border-amber-700/50 text-sm transition',
                    legal && 'bg-green-200/60 hover:bg-green-300/70',
                    cell === 'B' && 'rounded-full bg-stone-900 shadow-inner',
                    cell === 'W' &&
                      'rounded-full bg-white border border-stone-400 shadow-inner',
                  )}
                >
                  {cell ? null : legal ? '○' : null}
                  {!cell && isStar && (
                    <span
                      className="pointer-events-none absolute size-1 rounded-full bg-amber-800"
                      aria-hidden
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>
        <div className="mt-4 flex gap-2">
          {!state.gameOver && (
            <Button variant="outline" size="sm" onClick={handlePass}>
              {t('game.go.pass')}
            </Button>
          )}
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

export default GameGo;
