import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import {
  type Board,
  CHESS_COLS,
  CHESS_ROWS,
  createInitialBoard,
  findKing,
  getLegalMoves,
  getPieceLabel,
  hasAnyLegalMove,
  isInCheck,
  movePiece,
  type Side,
} from '@/lib/chess';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const GameChess = () => {
  const { locale, t } = useLocale();
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [whiteTurn, setWhiteTurn] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);

  const whiteKing = findKing(board, 'white');
  const blackKing = findKing(board, 'black');
  const currentSide: Side = whiteTurn ? 'white' : 'black';
  const inCheck = isInCheck(board, currentSide);
  const noMoves = !hasAnyLegalMove(board, currentSide);
  const winner: Side | null = !whiteKing
    ? 'black'
    : !blackKing
      ? 'white'
      : null;
  const checkmate = !winner && inCheck && noMoves;
  const stalemate = !winner && !inCheck && noMoves;

  const handleCellClick = (row: number, col: number) => {
    if (winner || checkmate || stalemate) return;
    const piece = board[row][col];
    const side: Side = whiteTurn ? 'white' : 'black';

    if (selected) {
      const [sr, sc] = selected;
      const isLegal = legalMoves.some(([r, c]) => r === row && c === col);
      if (isLegal) {
        const next = movePiece(board, sr, sc, row, col);
        const wK = findKing(next, 'white');
        const bK = findKing(next, 'black');
        if (!wK || !bK) unlock('chess-first-win');
        setBoard(next);
        setWhiteTurn(!whiteTurn);
        setSelected(null);
        setLegalMoves([]);
        return;
      }
    }

    if (piece?.side === side) {
      setSelected([row, col]);
      setLegalMoves(getLegalMoves(board, row, col));
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  };

  const isLegalTarget = (row: number, col: number) =>
    legalMoves.some(([r, c]) => r === row && c === col);

  const isLight = (row: number, col: number) => (row + col) % 2 === 0;

  const restart = () => {
    setBoard(createInitialBoard());
    setWhiteTurn(true);
    setSelected(null);
    setLegalMoves([]);
  };

  const statusText = winner
    ? formatMessage(locale, 'game.chess.winner', {
        winner:
          winner === 'white' ? t('game.chess.white') : t('game.chess.black'),
      })
    : checkmate
      ? formatMessage(locale, 'game.chess.checkmate', {
          winner:
            currentSide === 'white'
              ? t('game.chess.black')
              : t('game.chess.white'),
        })
      : stalemate
        ? t('game.chess.stalemate')
        : inCheck
          ? formatMessage(locale, 'game.chess.checkNext', {
              next: whiteTurn
                ? t('game.chess.whiteShort')
                : t('game.chess.blackShort'),
            })
          : formatMessage(locale, 'game.chess.next', {
              next: whiteTurn
                ? t('game.chess.whiteShort')
                : t('game.chess.blackShort'),
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
          {t('game.chess.rules')}
        </p>
        <div
          className="inline-grid gap-0 rounded-lg border-2 border-stone-700 overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${CHESS_COLS}, 2.25rem)`,
            gridTemplateRows: `repeat(${CHESS_ROWS}, 2.25rem)`,
          }}
        >
          {board.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const selectedHere =
                selected?.[0] === rowIndex && selected?.[1] === colIndex;
              const legal = isLegalTarget(rowIndex, colIndex);
              const light = isLight(rowIndex, colIndex);
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={!!winner || checkmate || stalemate}
                  className={cn(
                    'flex items-center justify-center border border-stone-400/50 text-lg transition',
                    light ? 'bg-amber-100' : 'bg-amber-800/80',
                    selectedHere && 'ring-2 ring-primary bg-primary/30',
                    legal && (light ? 'bg-green-300/70' : 'bg-green-600/50'),
                    cell?.side === 'white' && 'text-stone-900',
                    cell?.side === 'black' && 'text-stone-900',
                  )}
                >
                  {cell ? getPieceLabel(cell) : legal ? '○' : ''}
                </button>
              );
            }),
          )}
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

export default GameChess;
