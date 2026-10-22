import { Undo2 } from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { ChessPiece } from '@/components/game/ChessPiece';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { SegmentedControl } from '@/components/game/SegmentedControl';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
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
  type Piece,
  type PieceType,
  type Side,
} from '@/lib/chess';
import { chooseChessMove } from '@/lib/chessAi';
import { cn } from '@/lib/utils';

type Opponent = 'ai' | 'human';

interface Snapshot {
  board: Board;
  whiteTurn: boolean;
  lastMove: [number, number, number, number] | null;
  captured: Piece[];
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_VALUE: Record<PieceType, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
};

const GameChess = () => {
  const { t } = useLocale();
  const arcade = useArcade();
  const {
    difficulty,
    changeDifficulty: setDifficulty,
    paused,
    finish,
    newRound,
    start,
  } = arcade;
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [whiteTurn, setWhiteTurn] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [lastMove, setLastMove] = useState<
    [number, number, number, number] | null
  >(null);
  const [captured, setCaptured] = useState<Piece[]>([]);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [opponent, setOpponent] = useState<Opponent>('ai');
  const [thinking, setThinking] = useState(false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 人机模式下玩家固定执白先行 */
  const humanSide: Side = 'white';
  const sideToMove: Side = whiteTurn ? 'white' : 'black';
  const isHumanTurn = opponent === 'human' || sideToMove === humanSide;

  const inCheck = useMemo(
    () => isInCheck(board, sideToMove),
    [board, sideToMove],
  );
  const noMoves = useMemo(
    () => !hasAnyLegalMove(board, sideToMove),
    [board, sideToMove],
  );
  const checkmate = noMoves && inCheck;
  const stalemate = noMoves && !inCheck;
  const finished = checkmate || stalemate;
  const checkedKing = useMemo(
    () => (inCheck ? findKing(board, sideToMove) : null),
    [board, sideToMove, inCheck],
  );

  const legalTargets = useMemo(() => {
    if (!selected || finished) return [];
    return getLegalMoves(board, selected[0], selected[1]);
  }, [board, selected, finished]);

  const applyMove = useCallback(
    (fromR: number, fromC: number, toR: number, toC: number) => {
      setPast((prev) => [...prev, { board, whiteTurn, lastMove, captured }]);
      const target = board[toR][toC];
      setBoard(movePiece(board, fromR, fromC, toR, toC));
      setWhiteTurn((prev) => !prev);
      setLastMove([fromR, fromC, toR, toC]);
      setSelected(null);
      if (target) setCaptured((prev) => [...prev, target]);
    },
    [board, whiteTurn, lastMove, captured],
  );

  const handleSquare = (row: number, col: number) => {
    if (paused || finished || thinking || !isHumanTurn) return;
    const piece = board[row][col];

    if (selected) {
      if (legalTargets.some(([r, c]) => r === row && c === col)) {
        applyMove(selected[0], selected[1], row, col);
        return;
      }
      if (selected[0] === row && selected[1] === col) {
        setSelected(null);
        return;
      }
    }

    if (piece?.side === sideToMove) setSelected([row, col]);
    else setSelected(null);
  };

  useEffect(() => {
    if (paused || opponent !== 'ai' || finished) return;
    if (sideToMove === humanSide) return;

    setThinking(true);
    aiTimer.current = setTimeout(() => {
      const move = chooseChessMove(board, sideToMove, difficulty);
      if (move) applyMove(move.from[0], move.from[1], move.to[0], move.to[1]);
      setThinking(false);
    }, 300);

    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      setThinking(false);
    };
  }, [board, sideToMove, difficulty, opponent, finished, applyMove, paused]);

  const restart = useCallback(() => {
    newRound();
    start();
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    setBoard(createInitialBoard());
    setWhiteTurn(true);
    setSelected(null);
    setLastMove(null);
    setCaptured([]);
    setPast([]);
  }, [newRound, start]);

  const undo = () => {
    if (arcade.mode === 'challenge' || paused) return;
    if (paused || arcade.result) return;
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    if (past.length === 0) return;
    const steps = opponent === 'ai' ? Math.min(2, past.length) : 1;
    const snapshot = past[past.length - steps];
    setBoard(snapshot.board);
    setWhiteTurn(snapshot.whiteTurn);
    setLastMove(snapshot.lastMove);
    setCaptured(snapshot.captured);
    setPast(past.slice(0, past.length - steps));
    setSelected(null);
  };

  const changeOpponent = (value: Opponent) => {
    setOpponent(value);
    restart();
  };

  const sideLabel = (side: Side) =>
    side === 'white' ? t('game.chess.white') : t('game.chess.black');

  const winner: Side | null = checkmate
    ? sideToMove === 'white'
      ? 'black'
      : 'white'
    : null;

  const resultTone = stalemate
    ? 'draw'
    : opponent === 'human'
      ? 'win'
      : winner === humanSide
        ? 'win'
        : 'lose';

  const resultTitle = stalemate
    ? t('game.chess.stalemate')
    : !winner
      ? ''
      : opponent === 'human'
        ? `${sideLabel(winner)} ${t('common.wins')}`
        : winner === humanSide
          ? t('common.youWin')
          : t('common.youLose');

  /** 子力差：正数代表白方领先 */
  const materialDiff = captured.reduce(
    (sum, piece) =>
      sum +
      (piece.side === 'black'
        ? PIECE_VALUE[piece.type]
        : -PIECE_VALUE[piece.type]),
    0,
  );

  const squareSize = {
    '--sq':
      'min(clamp(30px, min(10.6vw, 7.6vh), 58px), calc((100cqw - 24px) / 8))',
  } as CSSProperties;

  useArcadeSnapshot(() => ({
    board,
    sideToMove,
    selected,
    thinking,
    opponent,
    moves: past.length,
  }));
  useEffect(() => {
    if (finished) finish(resultTone, 0, { moves: past.length, opponent });
  }, [finished, resultTone, past.length, finish, opponent]);

  return (
    <GameShell
      onRestart={restart}
      title={t('game.chess.name')}
      subtitle={t('game.chess.rules')}
      status={
        <>
          {thinking ? (
            <StatPill
              label=""
              value={t('common.thinking')}
              tone="active"
              className="animate-pulse"
            />
          ) : (
            <StatPill label={t('common.turn')} value={sideLabel(sideToMove)} />
          )}
          {inCheck && !finished && (
            <StatPill
              label=""
              value={t('game.chess.check')}
              tone="danger"
              className="animate-pulse font-semibold"
            />
          )}
        </>
      }
      toolbar={
        <>
          <SegmentedControl
            ariaLabel={t('common.opponent')}
            value={opponent}
            onChange={changeOpponent}
            options={[
              { value: 'ai', label: t('common.modeAI') },
              { value: 'human', label: t('common.modePvp') },
            ]}
          />
          {opponent === 'ai' && (
            <SegmentedControl
              ariaLabel={t('common.difficulty')}
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'easy', label: t('common.difficulty.easy') },
                { value: 'normal', label: t('common.difficulty.normal') },
                { value: 'hard', label: t('common.difficulty.hard') },
              ]}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={
                past.length === 0 || thinking || arcade.mode === 'challenge'
              }
            >
              <Undo2 className="size-3.5" />
              {t('common.undo')}
            </Button>
            <Button variant="outline" size="sm" onClick={restart}>
              {t('common.restart')}
            </Button>
          </div>
        </>
      }
      footer={t('game.chess.tip')}
    >
      {/* 上方是黑方阵营，陈列黑方吃掉的白子 */}
      <CapturedRow
        pieces={captured.filter((p) => p.side === 'white')}
        advantage={materialDiff < 0 ? -materialDiff : 0}
        label={t('game.chess.black')}
      />

      <div className="chess-frame relative my-2 p-2 sm:p-3">
        <div
          className="chess-board grid overflow-hidden rounded-md"
          style={{
            ...squareSize,
            gridTemplateColumns: `repeat(${CHESS_COLS}, var(--sq))`,
            gridTemplateRows: `repeat(${CHESS_ROWS}, var(--sq))`,
          }}
        >
          {board.flatMap((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const light = (rowIndex + colIndex) % 2 === 0;
              const isSelected =
                selected?.[0] === rowIndex && selected?.[1] === colIndex;
              const isTarget = legalTargets.some(
                ([r, c]) => r === rowIndex && c === colIndex,
              );
              const isLast =
                (lastMove?.[0] === rowIndex && lastMove?.[1] === colIndex) ||
                (lastMove?.[2] === rowIndex && lastMove?.[3] === colIndex);
              const isCheckedKing =
                checkedKing?.[0] === rowIndex && checkedKing?.[1] === colIndex;

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  disabled={finished || thinking || !isHumanTurn}
                  onClick={() => handleSquare(rowIndex, colIndex)}
                  aria-label={`${FILES[colIndex]}${CHESS_ROWS - rowIndex}${
                    piece
                      ? ` ${sideLabel(piece.side)} ${getPieceLabel(piece)}`
                      : ''
                  }`}
                  data-square-color={light ? 'light' : 'dark'}
                  data-selected={isSelected}
                  data-last-move={isLast}
                  data-check={isCheckedKing}
                  className={cn(
                    'chess-square relative flex items-center justify-center outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500',
                  )}
                >
                  {/* 坐标只画在最下一行和最左一列，不干扰棋子 */}
                  {colIndex === 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0.5 top-0 text-[9px] font-semibold',
                        light ? 'text-amber-900/60' : 'text-amber-50/70',
                      )}
                    >
                      {CHESS_ROWS - rowIndex}
                    </span>
                  )}
                  {rowIndex === CHESS_ROWS - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute bottom-0 right-0.5 text-[9px] font-semibold',
                        light ? 'text-amber-900/60' : 'text-amber-50/70',
                      )}
                    >
                      {FILES[colIndex]}
                    </span>
                  )}

                  {piece && (
                    <ChessPiece
                      piece={piece}
                      className={cn(isSelected && 'scale-110')}
                    />
                  )}

                  {isTarget && !piece && (
                    <span className="animate-stone-drop pointer-events-none absolute size-[28%] rounded-full bg-emerald-900/45" />
                  )}
                  {isTarget && piece && (
                    <span className="pointer-events-none absolute inset-[6%] rounded-full ring-4 ring-rose-500/70" />
                  )}
                </button>
              );
            }),
          )}
        </div>

        <GameResultOverlay
          open={finished}
          tone={resultTone}
          title={resultTitle}
          description={
            checkmate
              ? t('game.chess.byCheckmate')
              : t('game.chess.byStalemate')
          }
          onRestart={restart}
        />
      </div>

      <CapturedRow
        pieces={captured.filter((p) => p.side === 'black')}
        advantage={materialDiff > 0 ? materialDiff : 0}
        label={t('game.chess.white')}
      />
    </GameShell>
  );
};

/** 被吃子与子力优势 */
const CapturedRow = ({
  pieces,
  advantage,
  label,
}: {
  pieces: Piece[];
  advantage: number;
  label: string;
}) => (
  <div className="flex min-h-7 w-full max-w-115 items-center gap-2 px-1">
    <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
    <div className="flex flex-wrap items-center gap-px">
      {pieces.map((piece, index) => (
        <ChessPiece
          key={`${piece.type}-${index}`}
          piece={piece}
          className="chess-piece-captured"
        />
      ))}
    </div>
    {advantage > 0 && (
      <span className="text-[11px] font-semibold text-emerald-700">
        +{advantage}
      </span>
    )}
  </div>
);

export default GameChess;
