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
import {
  canPlace,
  createInitialState,
  GO_SIZE,
  type GoState,
  getScore,
  pass,
  placeStone,
} from '@/lib/go';
import { chooseGoMove, type GoDifficulty } from '@/lib/goAi';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Opponent = 'ai' | 'human';

const STAR_POINTS: [number, number][] = [
  [2, 2],
  [2, 6],
  [6, 2],
  [6, 6],
  [4, 4],
];

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

const GameGo = () => {
  const { locale, t } = useLocale();
  const [state, setState] = useState<GoState>(createInitialState);
  const [past, setPast] = useState<GoState[]>([]);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [opponent, setOpponent] = useState<Opponent>('ai');
  const [difficulty, setDifficulty] = useState<GoDifficulty>('normal');
  const [thinking, setThinking] = useState(false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 人机模式下玩家固定执黑 */
  const humanIsBlack = true;
  const isHumanTurn =
    opponent === 'human' || state.blackTurn === humanIsBlack || state.gameOver;

  const score = useMemo(() => getScore(state), [state]);

  const commit = useCallback(
    (next: GoState, move: [number, number] | null) => {
      setPast((prev) => [...prev, state]);
      setState(next);
      setLastMove(move);
    },
    [state],
  );

  const handlePoint = (row: number, col: number) => {
    if (state.gameOver || thinking || !isHumanTurn) return;
    if (!canPlace(state, row, col)) return;
    commit(placeStone(state, row, col), [row, col]);
  };

  const handlePass = () => {
    if (state.gameOver || thinking || !isHumanTurn) return;
    commit(pass(state), null);
  };

  // 人机模式：轮到电脑时算一手
  useEffect(() => {
    if (opponent !== 'ai' || state.gameOver) return;
    if (state.blackTurn === humanIsBlack) return;

    setThinking(true);
    aiTimer.current = setTimeout(() => {
      const move = chooseGoMove(state, difficulty);
      setPast((prev) => [...prev, state]);
      if (move.kind === 'pass') {
        setState(pass(state));
        setLastMove(null);
      } else {
        setState(placeStone(state, move.row, move.col));
        setLastMove([move.row, move.col]);
      }
      setThinking(false);
    }, 320);

    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      setThinking(false);
    };
  }, [state, difficulty, opponent]);

  const restart = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    setState(createInitialState());
    setPast([]);
    setLastMove(null);
  }, []);

  /** 人机模式一次退两手，回到玩家的回合 */
  const undo = () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setThinking(false);
    const steps = opponent === 'ai' ? Math.min(2, past.length) : 1;
    if (past.length === 0) return;
    const target = past.length - steps;
    setState(past[target]);
    setPast(past.slice(0, target));
    setLastMove(null);
  };

  const changeOpponent = (value: Opponent) => {
    setOpponent(value);
    restart();
  };

  const turnLabel = state.blackTurn
    ? t('game.go.status.black')
    : t('game.go.status.white');

  const humanWon = score.black > score.white;
  const resultTone = state.gameOver
    ? opponent === 'human'
      ? 'win'
      : humanWon
        ? 'win'
        : score.black === score.white
          ? 'draw'
          : 'lose'
    : 'draw';

  const resultTitle = !state.gameOver
    ? ''
    : score.black === score.white
      ? t('common.draw')
      : opponent === 'human'
        ? formatMessage(locale, 'game.go.winnerIs', {
            winner: humanWon
              ? t('game.go.status.black')
              : t('game.go.status.white'),
          })
        : humanWon
          ? t('common.youWin')
          : t('common.youLose');

  return (
    <GameShell
      title={t('game.go.name')}
      subtitle={t('game.go.rules')}
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
                stone={state.blackTurn ? 'B' : 'W'}
                className="size-3.5 shrink-0"
              />
              <span className="font-semibold text-foreground">{turnLabel}</span>
            </span>
          )}
          <StatPill
            label={t('game.go.captures')}
            value={`${state.blackCaptured} / ${state.whiteCaptured}`}
          />
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
              onClick={handlePass}
              disabled={state.gameOver || thinking || !isHumanTurn}
            >
              {t('game.go.pass')}
            </Button>
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
        state.lastPass && !state.gameOver
          ? t('game.go.opponentPassed')
          : t('game.go.tip')
      }
    >
      <div className="relative">
        <IntersectionBoard
          cols={GO_SIZE}
          rows={GO_SIZE}
          cell="clamp(28px, min(9.4vw, 7.2vh), 52px)"
          onPointClick={handlePoint}
          isPointDisabled={(row, col) =>
            state.gameOver ||
            thinking ||
            !isHumanTurn ||
            !canPlace(state, row, col)
          }
          pointLabel={(row, col) => {
            const cell = state.board[row][col];
            const position = `${col + 1},${row + 1}`;
            if (!cell) return `${position} ${t('game.go.emptyPoint')}`;
            return `${position} ${cell === 'B' ? t('game.go.status.black') : t('game.go.status.white')}`;
          }}
          underlay={
            <rect
              x={0}
              y={0}
              width={GO_SIZE - 1}
              height={GO_SIZE - 1}
              fill="none"
              stroke="rgba(87, 52, 15, 0.75)"
              strokeWidth={0.05}
            />
          }
          decorations={STAR_POINTS.map(([row, col]) => (
            <span
              key={`star-${row}-${col}`}
              aria-hidden
              className="pointer-events-none size-[6px] rounded-full bg-amber-950/60"
              style={pointStyle(row, col)}
            />
          ))}
          renderPoint={(row, col) => {
            const cell = state.board[row][col];
            if (!cell) {
              const playable =
                !state.gameOver &&
                !thinking &&
                isHumanTurn &&
                canPlace(state, row, col);
              if (!playable) return null;
              return (
                <span
                  className={cn(
                    'pointer-events-none block size-[70%] rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
                    state.blackTurn ? 'bg-stone-900/25' : 'bg-white/70',
                  )}
                />
              );
            }
            const isLast = lastMove?.[0] === row && lastMove?.[1] === col;
            return (
              <span className="pointer-events-none relative block size-[92%]">
                <Stone stone={cell} className="animate-stone-drop size-full" />
                {isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-1/2 top-1/2 size-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full',
                      cell === 'B' ? 'bg-red-400' : 'bg-red-500',
                    )}
                  />
                )}
              </span>
            );
          }}
        />

        <GameResultOverlay
          open={state.gameOver}
          tone={resultTone}
          title={resultTitle}
          description={formatMessage(locale, 'game.go.status.gameOver', {
            black: score.black,
            white: score.white,
          })}
          detail={
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs opacity-70">
                  {t('game.go.status.black')}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {score.black}
                </p>
              </div>
              <div>
                <p className="text-xs opacity-70">
                  {t('game.go.status.white')}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {score.white}
                </p>
              </div>
            </div>
          }
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};

export default GameGo;
