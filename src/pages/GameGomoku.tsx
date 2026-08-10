import { Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import {
  IntersectionBoard,
  pointStyle,
} from '@/components/game/IntersectionBoard';
import { SegmentedControl } from '@/components/game/SegmentedControl';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import { GOMOKU_SIZE, type GomokuStone, getGomokuWin } from '@/lib/gomoku';
import { chooseGomokuMove, type GomokuDifficulty } from '@/lib/gomokuAi';
import { cn } from '@/lib/utils';

type Opponent = 'ai' | 'human';

const STAR_POINTS: [number, number][] = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7],
];

const emptyBoard = (): GomokuStone[] =>
  Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null);

/** 棋盘上的一颗子，也用于状态栏里的行棋方指示 */
const Stone = ({
  stone,
  className,
}: {
  stone: 'B' | 'W';
  className?: string;
}) => (
  <span
    className={cn(
      'block rounded-full',
      stone === 'B' ? 'stone-black' : 'stone-white',
      className,
    )}
  />
);

const GameGomoku = () => {
  const { t } = useLocale();
  const [board, setBoard] = useState<GomokuStone[]>(emptyBoard);
  const [history, setHistory] = useState<number[]>([]);
  const [opponent, setOpponent] = useState<Opponent>('ai');
  const [difficulty, setDifficulty] = useState<GomokuDifficulty>('normal');
  const [thinking, setThinking] = useState(false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const win = useMemo(() => getGomokuWin(board), [board]);
  const moveCount = history.length;
  const blackNext = moveCount % 2 === 0;
  /** 人机模式下玩家固定执黑先行 */
  const humanStone: 'B' | 'W' = 'B';
  const isHumanTurn =
    opponent === 'human' || (blackNext ? humanStone === 'B' : false);
  const winLine = useMemo(() => new Set(win?.line ?? []), [win]);
  const lastMove = history.length > 0 ? history[history.length - 1] : null;

  const place = useCallback((index: number, stone: 'B' | 'W') => {
    setBoard((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = stone;
      return next;
    });
    setHistory((prev) => [...prev, index]);
  }, []);

  const handlePoint = (row: number, col: number) => {
    const index = row * GOMOKU_SIZE + col;
    if (win || board[index] || thinking || !isHumanTurn) return;
    place(index, blackNext ? 'B' : 'W');
  };

  // 人机模式：玩家落子后让电脑跟一手
  useEffect(() => {
    if (opponent !== 'ai' || win) return;
    const aiStone: 'B' | 'W' = humanStone === 'B' ? 'W' : 'B';
    const aiToMove = blackNext ? aiStone === 'B' : aiStone === 'W';
    if (!aiToMove) return;

    setThinking(true);
    aiTimer.current = setTimeout(() => {
      const move = chooseGomokuMove(board, aiStone, difficulty);
      if (move !== null) place(move, aiStone);
      setThinking(false);
    }, 260);

    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      setThinking(false);
    };
  }, [board, blackNext, difficulty, opponent, place, win]);

  useEffect(() => {
    if (win && (opponent === 'human' || win.stone === humanStone)) {
      unlock('gomoku-first-win');
    }
  }, [win, opponent]);

  const restart = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    setBoard(emptyBoard());
    setHistory([]);
  }, []);

  /** 人机模式一次退两手，直接回到玩家可落子的局面 */
  const undo = () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    const steps = opponent === 'ai' ? Math.min(2, history.length) : 1;
    if (steps === 0) return;
    setHistory((prev) => {
      const next = prev.slice(0, prev.length - steps);
      setBoard(() => {
        const rebuilt = emptyBoard();
        next.forEach((index, i) => {
          rebuilt[index] = i % 2 === 0 ? 'B' : 'W';
        });
        return rebuilt;
      });
      return next;
    });
  };

  const changeOpponent = (value: Opponent) => {
    setOpponent(value);
    restart();
  };

  const turnLabel = blackNext ? t('game.gomoku.black') : t('game.gomoku.white');

  const resultTone = !win
    ? 'draw'
    : opponent === 'human'
      ? 'win'
      : win.stone === humanStone
        ? 'win'
        : 'lose';

  const resultTitle = !win
    ? ''
    : opponent === 'human'
      ? `${win.stone === 'B' ? t('game.gomoku.black') : t('game.gomoku.white')} ${t('common.wins')}`
      : win.stone === humanStone
        ? t('common.youWin')
        : t('common.youLose');

  return (
    <GameShell
      title={t('game.gomoku.name')}
      subtitle={t('game.gomoku.rules')}
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
            <span className="game-pill">
              <Stone
                stone={blackNext ? 'B' : 'W'}
                className="size-3.5 shrink-0"
              />
              <span className="font-semibold text-foreground">{turnLabel}</span>
            </span>
          )}
          <StatPill label={t('common.moves')} value={moveCount} />
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
              disabled={history.length === 0 || thinking}
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
      footer={t('game.gomoku.tip')}
    >
      <div className="relative">
        <IntersectionBoard
          cols={GOMOKU_SIZE}
          rows={GOMOKU_SIZE}
          cell="clamp(17px, min(5.7vw, 4.6vh), 34px)"
          onPointClick={handlePoint}
          isPointDisabled={(row, col) =>
            !!win ||
            !!board[row * GOMOKU_SIZE + col] ||
            thinking ||
            !isHumanTurn
          }
          pointLabel={(row, col) => {
            const stone = board[row * GOMOKU_SIZE + col];
            const position = `${col + 1},${row + 1}`;
            if (!stone) return `${position} ${t('game.gomoku.emptyPoint')}`;
            return `${position} ${stone === 'B' ? t('game.gomoku.black') : t('game.gomoku.white')}`;
          }}
          underlay={
            <rect
              x={0}
              y={0}
              width={GOMOKU_SIZE - 1}
              height={GOMOKU_SIZE - 1}
              fill="none"
              stroke="rgba(87, 52, 15, 0.75)"
              strokeWidth={0.055}
            />
          }
          decorations={STAR_POINTS.map(([row, col]) => (
            <span
              key={`star-${row}-${col}`}
              aria-hidden
              className="pointer-events-none size-[5px] rounded-full bg-amber-950/55"
              style={pointStyle(row, col)}
            />
          ))}
          overlay={
            win && win.line.length >= 2 ? (
              <line
                x1={win.line[0] % GOMOKU_SIZE}
                y1={Math.floor(win.line[0] / GOMOKU_SIZE)}
                x2={win.line[win.line.length - 1] % GOMOKU_SIZE}
                y2={Math.floor(win.line[win.line.length - 1] / GOMOKU_SIZE)}
                stroke="#dc2626"
                strokeWidth={0.14}
                strokeLinecap="round"
                className="animate-win-line"
                style={{ '--dash-len': 20 } as React.CSSProperties}
              />
            ) : null
          }
          renderPoint={(row, col) => {
            const index = row * GOMOKU_SIZE + col;
            const stone = board[index];
            if (!stone) {
              // 空点：只在悬停/聚焦时给一个淡淡的落点预览，不铺满整盘高亮
              return win || thinking || !isHumanTurn ? null : (
                <span
                  className={cn(
                    'pointer-events-none block size-[62%] rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
                    blackNext ? 'bg-stone-900/25' : 'bg-white/70',
                  )}
                />
              );
            }
            return (
              <span className="pointer-events-none relative block size-[88%]">
                <Stone
                  stone={stone}
                  className={cn(
                    'animate-stone-drop size-full',
                    winLine.has(index) && 'ring-2 ring-red-500 ring-offset-0',
                  )}
                />
                {index === lastMove && !win && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-1/2 top-1/2 size-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full',
                      stone === 'B' ? 'bg-red-400' : 'bg-red-500',
                    )}
                  />
                )}
              </span>
            );
          }}
        />

        <GameResultOverlay
          open={!!win}
          tone={resultTone}
          title={resultTitle}
          description={`${t('common.moves')} ${moveCount}`}
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};

export default GameGomoku;
