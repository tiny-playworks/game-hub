import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Board,
  createInitialBoard,
  findKing,
  getLegalMoves,
  getPieceLabel,
  movePiece,
  type Side,
  XIANGQI_COLS,
  XIANGQI_ROWS,
} from '@/lib/xiangqi';

const GameXiangqi = () => {
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [redTurn, setRedTurn] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);

  const redKing = findKing(board, 'red');
  const blackKing = findKing(board, 'black');
  const winner: Side | null = !redKing ? 'black' : !blackKing ? 'red' : null;

  const handleCellClick = (row: number, col: number) => {
    if (winner) return;
    const piece = board[row][col];
    const side: Side = redTurn ? 'red' : 'black';

    if (selected) {
      const [sr, sc] = selected;
      const isLegal = legalMoves.some(([r, c]) => r === row && c === col);
      if (isLegal) {
        const next = movePiece(board, sr, sc, row, col);
        setBoard(next);
        setRedTurn(!redTurn);
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

  const restart = () => {
    setBoard(createInitialBoard());
    setRedTurn(true);
    setSelected(null);
    setLegalMoves([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 返回游戏列表
        </Link>
        <span className="text-sm text-muted-foreground">
          {winner
            ? `赢家: ${winner === 'red' ? '红方' : '黑方'}`
            : `下一位: ${redTurn ? '红' : '黑'}`}
        </span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          中国象棋：红先黑后，点击己方棋子选子，再点击合法格走子
        </p>
        <div
          className="inline-grid gap-0 rounded-lg border-2 border-amber-800 bg-amber-100 p-1"
          style={{
            gridTemplateColumns: `repeat(${XIANGQI_COLS}, 2rem)`,
            gridTemplateRows: `repeat(${XIANGQI_ROWS}, 2rem)`,
          }}
        >
          {board.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isSelected =
                selected?.[0] === rowIndex && selected?.[1] === colIndex;
              const legal = isLegalTarget(rowIndex, colIndex);
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={!!winner}
                  className={cn(
                    'flex items-center justify-center border border-amber-700/40 text-sm font-bold transition',
                    rowIndex === 4 && 'border-b-2 border-amber-800',
                    (rowIndex === 2 || rowIndex === 7) &&
                      (colIndex === 1 || colIndex === 7) &&
                      'bg-amber-200/50',
                    isSelected && 'ring-2 ring-primary bg-primary/20',
                    legal && 'bg-green-300/50',
                    cell?.side === 'red' && 'text-red-700',
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

export default GameXiangqi;
