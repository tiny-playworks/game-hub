import { Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { IntersectionBoard } from '@/components/game/IntersectionBoard';
import { SegmentedControl } from '@/components/game/SegmentedControl';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import { cn } from '@/lib/utils';
import {
  type Board,
  createInitialBoard,
  getPieceLabel,
  getSafeMoves,
  getXiangqiResult,
  isInCheck,
  movePiece,
  type Piece,
  type Side,
  toChineseMoveNotation,
  XIANGQI_COLS,
  XIANGQI_ROWS,
} from '@/lib/xiangqi';
import { chooseXiangqiMove, type XiangqiDifficulty } from '@/lib/xiangqiAi';

type Opponent = 'ai' | 'human';

interface Snapshot {
  board: Board;
  redTurn: boolean;
  lastMove: [number, number, number, number] | null;
  captured: Piece[];
  notation: string[];
}

const LINE = 'rgba(87, 52, 15, 0.7)';

/** 兵/炮位上的角标记 */
const MARK_POINTS: [number, number][] = [
  [3, 0],
  [3, 2],
  [3, 4],
  [3, 6],
  [3, 8],
  [6, 0],
  [6, 2],
  [6, 4],
  [6, 6],
  [6, 8],
  [2, 1],
  [2, 7],
  [7, 1],
  [7, 7],
];

const PositionMark = ({ row, col }: { row: number; col: number }) => {
  const arms: [number, number][] = [];
  if (col > 0) arms.push([-1, -1], [-1, 1]);
  if (col < XIANGQI_COLS - 1) arms.push([1, -1], [1, 1]);
  const d = 0.11;
  const gap = 0.09;
  return (
    <g stroke={LINE} strokeWidth={0.028} fill="none">
      {arms.map(([sx, sy]) => (
        <path
          key={`${sx}-${sy}`}
          d={`M ${col + sx * (gap + d)} ${row + sy * gap} L ${col + sx * gap} ${row + sy * gap} L ${col + sx * gap} ${row + sy * (gap + d)}`}
        />
      ))}
    </g>
  );
};

const GameXiangqi = () => {
  const { t } = useLocale();
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [redTurn, setRedTurn] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [lastMove, setLastMove] = useState<
    [number, number, number, number] | null
  >(null);
  const [captured, setCaptured] = useState<Piece[]>([]);
  const [notation, setNotation] = useState<string[]>([]);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [opponent, setOpponent] = useState<Opponent>('ai');
  const [difficulty, setDifficulty] = useState<XiangqiDifficulty>('normal');
  const [thinking, setThinking] = useState(false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 人机模式下玩家固定执红先行 */
  const humanSide: Side = 'red';
  const sideToMove: Side = redTurn ? 'red' : 'black';
  const isHumanTurn = opponent === 'human' || sideToMove === humanSide;

  const result = useMemo(
    () => getXiangqiResult(board, sideToMove),
    [board, sideToMove],
  );
  const inCheck = useMemo(
    () => !result && isInCheck(board, sideToMove),
    [board, sideToMove, result],
  );

  const legalTargets = useMemo(() => {
    if (!selected || result) return [];
    return getSafeMoves(board, selected[0], selected[1]);
  }, [board, selected, result]);

  const applyMove = useCallback(
    (fromR: number, fromC: number, toR: number, toC: number) => {
      setPast((prev) => [
        ...prev,
        { board, redTurn, lastMove, captured, notation },
      ]);
      const target = board[toR][toC];
      const text = toChineseMoveNotation(board, {
        from: [fromR, fromC],
        to: [toR, toC],
      });
      setBoard(movePiece(board, fromR, fromC, toR, toC));
      setRedTurn((prev) => !prev);
      setLastMove([fromR, fromC, toR, toC]);
      setSelected(null);
      setNotation((prev) => [...prev, text]);
      if (target) setCaptured((prev) => [...prev, target]);
    },
    [board, redTurn, lastMove, captured, notation],
  );

  const handlePoint = (row: number, col: number) => {
    if (result || thinking || !isHumanTurn) return;
    const piece = board[row][col];

    if (selected) {
      const isTarget = legalTargets.some(([r, c]) => r === row && c === col);
      if (isTarget) {
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

  // 人机模式：轮到电脑就算一手
  useEffect(() => {
    if (opponent !== 'ai' || result) return;
    if (sideToMove === humanSide) return;

    setThinking(true);
    aiTimer.current = setTimeout(() => {
      const move = chooseXiangqiMove(board, sideToMove, difficulty);
      if (move) {
        applyMove(move.from[0], move.from[1], move.to[0], move.to[1]);
      }
      setThinking(false);
    }, 300);

    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      setThinking(false);
    };
  }, [board, sideToMove, difficulty, opponent, result, applyMove]);

  useEffect(() => {
    if (!result) return;
    if (opponent === 'human' || result.winner === humanSide) {
      unlock('xiangqi-first-win');
    }
  }, [result, opponent]);

  const restart = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    setBoard(createInitialBoard());
    setRedTurn(true);
    setSelected(null);
    setLastMove(null);
    setCaptured([]);
    setNotation([]);
    setPast([]);
  }, []);

  const undo = () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    if (past.length === 0) return;
    const steps = opponent === 'ai' ? Math.min(2, past.length) : 1;
    const snapshot = past[past.length - steps];
    setBoard(snapshot.board);
    setRedTurn(snapshot.redTurn);
    setLastMove(snapshot.lastMove);
    setCaptured(snapshot.captured);
    setNotation(snapshot.notation);
    setPast(past.slice(0, past.length - steps));
    setSelected(null);
  };

  const changeOpponent = (value: Opponent) => {
    setOpponent(value);
    restart();
  };

  const sideLabel = (side: Side) =>
    side === 'red' ? t('game.xiangqi.red') : t('game.xiangqi.black');

  const resultTone = !result
    ? 'draw'
    : opponent === 'human'
      ? 'win'
      : result.winner === humanSide
        ? 'win'
        : 'lose';

  const resultTitle = !result
    ? ''
    : opponent === 'human'
      ? `${sideLabel(result.winner)} ${t('common.wins')}`
      : result.winner === humanSide
        ? t('common.youWin')
        : t('common.youLose');

  const resultReason = !result
    ? ''
    : result.kind === 'checkmate'
      ? t('game.xiangqi.byCheckmate')
      : t('game.xiangqi.byStalemate');

  /** 某一方已经损失的棋子，陈列在该方一侧 */
  const lostPieces = (side: Side) => captured.filter((p) => p.side === side);

  return (
    <GameShell
      title={t('game.xiangqi.name')}
      subtitle={t('game.xiangqi.rules')}
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
            <StatPill
              label={t('common.turn')}
              value={sideLabel(sideToMove)}
              tone={sideToMove === 'red' ? 'danger' : 'default'}
            />
          )}
          {inCheck && (
            <StatPill
              label=""
              value={t('game.xiangqi.check')}
              tone="danger"
              className="animate-pulse font-semibold"
            />
          )}
          <StatPill label={t('common.moves')} value={notation.length} />
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
              disabled={past.length === 0 || thinking}
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
      footer={
        notation.length > 0
          ? `${t('game.xiangqi.lastMove')} ${notation[notation.length - 1]}`
          : t('game.xiangqi.tip')
      }
    >
      <CapturedTray
        pieces={lostPieces('black')}
        label={t('game.xiangqi.black')}
      />

      <div className="relative my-2">
        <IntersectionBoard
          cols={XIANGQI_COLS}
          rows={XIANGQI_ROWS}
          cell="clamp(26px, min(9.6vw, 6.4vh), 46px)"
          showGridLines={false}
          onPointClick={handlePoint}
          isPointDisabled={() => !!result || thinking || !isHumanTurn}
          pointLabel={(row, col) => {
            const piece = board[row][col];
            const position = `${col + 1},${row + 1}`;
            return piece
              ? `${position} ${sideLabel(piece.side)}${getPieceLabel(piece)}`
              : `${position} ${t('game.xiangqi.emptyPoint')}`;
          }}
          underlay={
            <g>
              {/* 横线：十条通到底 */}
              {Array.from({ length: XIANGQI_ROWS }, (_, row) => (
                <line
                  key={`h-${row}`}
                  x1={0}
                  y1={row}
                  x2={XIANGQI_COLS - 1}
                  y2={row}
                  stroke={LINE}
                  strokeWidth={0.032}
                />
              ))}
              {/* 竖线：中间七条在河界处断开 */}
              {Array.from({ length: XIANGQI_COLS }, (_, col) => {
                const edge = col === 0 || col === XIANGQI_COLS - 1;
                if (edge) {
                  return (
                    <line
                      key={`v-${col}`}
                      x1={col}
                      y1={0}
                      x2={col}
                      y2={XIANGQI_ROWS - 1}
                      stroke={LINE}
                      strokeWidth={0.032}
                    />
                  );
                }
                return (
                  <g key={`v-${col}`}>
                    <line
                      x1={col}
                      y1={0}
                      x2={col}
                      y2={4}
                      stroke={LINE}
                      strokeWidth={0.032}
                    />
                    <line
                      x1={col}
                      y1={5}
                      x2={col}
                      y2={XIANGQI_ROWS - 1}
                      stroke={LINE}
                      strokeWidth={0.032}
                    />
                  </g>
                );
              })}
              {/* 九宫斜线 */}
              {[0, 7].map((top) => (
                <g key={`palace-${top}`}>
                  <line
                    x1={3}
                    y1={top}
                    x2={5}
                    y2={top + 2}
                    stroke={LINE}
                    strokeWidth={0.032}
                  />
                  <line
                    x1={5}
                    y1={top}
                    x2={3}
                    y2={top + 2}
                    stroke={LINE}
                    strokeWidth={0.032}
                  />
                </g>
              ))}
              {MARK_POINTS.map(([row, col]) => (
                <PositionMark key={`mark-${row}-${col}`} row={row} col={col} />
              ))}
            </g>
          }
          decorations={
            <div
              aria-hidden
              className="pointer-events-none absolute flex items-center justify-around font-serif text-amber-950/45"
              style={{
                left: 0,
                top: 'calc(4 * var(--cell))',
                width: `calc(${XIANGQI_COLS - 1} * var(--cell))`,
                height: 'var(--cell)',
                fontSize: 'calc(var(--cell) * 0.44)',
                letterSpacing: '0.35em',
              }}
            >
              <span>楚河</span>
              <span>漢界</span>
            </div>
          }
          renderPoint={(row, col) => {
            const piece = board[row][col];
            const isSelected =
              selected?.[0] === row && selected?.[1] === col && !!piece;
            const isTarget = legalTargets.some(
              ([r, c]) => r === row && c === col,
            );
            const isLastFrom = lastMove?.[0] === row && lastMove?.[1] === col;
            const isLastTo = lastMove?.[2] === row && lastMove?.[3] === col;

            if (!piece) {
              return isTarget ? (
                <span className="animate-stone-drop pointer-events-none block size-[30%] rounded-full bg-emerald-600/70 shadow" />
              ) : isLastFrom ? (
                <span className="pointer-events-none block size-[24%] rounded-full bg-sky-600/40" />
              ) : null;
            }

            return (
              <span
                className={cn(
                  'xq-piece pointer-events-none flex size-[88%] items-center justify-center rounded-full border-2 font-bold transition-transform',
                  piece.side === 'red'
                    ? 'border-red-700/70 text-red-700'
                    : 'border-stone-800/70 text-stone-900',
                  isSelected && '-translate-y-[6%] ring-2 ring-sky-500',
                  isTarget && 'ring-2 ring-rose-500',
                  isLastTo && !isSelected && 'ring-2 ring-sky-400/70',
                )}
                style={{ fontSize: 'calc(var(--cell) * 0.5)' }}
              >
                {getPieceLabel(piece)}
              </span>
            );
          }}
        />

        <GameResultOverlay
          open={!!result}
          tone={resultTone}
          title={resultTitle}
          description={resultReason}
          onRestart={restart}
        />
      </div>

      <CapturedTray pieces={lostPieces('red')} label={t('game.xiangqi.red')} />
    </GameShell>
  );
};

/** 被吃子陈列区：让玩家一眼看出双方交换了什么 */
const CapturedTray = ({
  pieces,
  label,
}: {
  pieces: Piece[];
  label: string;
}) => (
  <div className="flex min-h-7 w-full max-w-[420px] items-center gap-1.5 px-1">
    <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
    <div className="flex flex-wrap gap-1">
      {pieces.map((piece, index) => (
        <span
          key={`${piece.side}-${piece.type}-${index}`}
          className={cn(
            'flex size-5 items-center justify-center rounded-full border bg-white/70 text-[10px] font-semibold',
            piece.side === 'red'
              ? 'border-red-600/40 text-red-700'
              : 'border-stone-700/40 text-stone-800',
          )}
        >
          {getPieceLabel(piece)}
        </span>
      ))}
    </div>
  </div>
);

export default GameXiangqi;
