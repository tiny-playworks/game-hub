import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  applyMove,
  boardFromMoves,
  chooseTicDifficultyMove,
  fadingIndex,
  getWinner,
  getWinningLine,
  type TicMove,
  type TicPlayer,
} from '@/lib/tictactoe';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import './tictactoe.css';

const GameTictactoe = () => {
  const { t } = useLocale();
  const shake = useScreenShake();
  const { difficulty, paused, finish, newRound, start } = useArcade();
  const [turnCount, setTurnCount] = useState(0);
  const [draw, setDraw] = useState(false);
  const repetitions = useRef(new Map<string, number>());

  const [moves, setMoves] = useState<TicMove[]>([]);
  const [xNext, setXNext] = useState(true);
  const [vsAI, setVsAI] = useState(true); // Default to playing against AI

  const currentPlayer: TicPlayer = xNext ? 'X' : 'O';
  const winningLine = getWinningLine(moves);
  const winner = getWinner(moves);

  const board = useMemo(() => boardFromMoves(moves), [moves]);

  const fadingMoveIndex =
    difficulty === 'hard' ? null : fadingIndex(moves, currentPlayer);

  const handlePlay = useCallback(
    (i: number) => {
      if (paused || draw) return;
      const nextMoves = applyMove(
        moves,
        currentPlayer,
        i,
        difficulty === 'hard' ? 'classic' : 'fading',
      );
      if (!nextMoves) return;

      setMoves(nextMoves);
      setTurnCount((value) => value + 1);
      const key =
        (!xNext ? 'X' : 'O') +
        nextMoves.map((move) => move.player + move.index).join('');
      const seen = (repetitions.current.get(key) ?? 0) + 1;
      repetitions.current.set(key, seen);
      if (
        seen >= 3 ||
        turnCount >= 79 ||
        (difficulty === 'hard' &&
          nextMoves.length === 9 &&
          !getWinner(nextMoves))
      )
        setDraw(true);

      if (getWinningLine(nextMoves) !== null) {
        shake();
      }

      setXNext(!xNext);
    },
    [currentPlayer, moves, shake, xNext, paused, draw, turnCount, difficulty],
  );

  useEffect(() => {
    if (!paused && !draw && vsAI && !xNext && !winner) {
      const timer = setTimeout(() => {
        const bestMove = chooseTicDifficultyMove(moves, 'O', difficulty);
        if (bestMove !== null) {
          handlePlay(bestMove);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [xNext, vsAI, winner, moves, handlePlay, difficulty, paused, draw]);

  const restart = () => {
    newRound();
    start();
    setTurnCount(0);
    setDraw(false);
    repetitions.current.clear();
    setMoves([]);
    setXNext(true);
  };

  useArcadeSnapshot(() => ({
    board,
    moves,
    turn: currentPlayer,
    turnCount,
    winner,
    draw,
    vsAI,
  }));
  useEffect(() => {
    if (winner || draw)
      finish(draw ? 'draw' : !vsAI || winner === 'X' ? 'win' : 'lose', 0, {
        opponent: vsAI ? 'ai' : 'human',
        moves: turnCount,
      });
  }, [winner, draw, vsAI, turnCount, finish]);

  // SVG Line overlay
  const renderWinningLine = () => {
    if (!winningLine) return null;
    const [a, , c] = winningLine;
    // Maps index 0-8 to x,y coordinates (0-2)
    const getCoord = (idx: number) => ({
      x: (idx % 3) * 100 + 50,
      y: Math.floor(idx / 3) * 100 + 50,
    });

    const start = getCoord(a);
    const end = getCoord(c);

    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10 drop-shadow-[0_0_10px_#fff]"
        viewBox="0 0 300 300"
      >
        <title>{t('tictactoe.winLine')}</title>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={winner === 'X' ? '#0ff' : '#f0f'}
          strokeWidth="10"
          strokeLinecap="round"
          className="animate-laser drop-shadow-[0_0_15px_currentColor]"
        />
      </svg>
    );
  };

  return (
    <GameShell
      title={t('game.tictactoe.name')}
      subtitle={t(
        difficulty === 'hard' ? 'arcade.ticClassicRules' : 'tictactoe.rules',
      )}
      onRestart={restart}
      status={<StatPill label={t('common.moves')} value={turnCount} />}
      toolbar={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setVsAI(!vsAI);
            restart();
          }}
          className="bg-transparent border-purple-900/50 hover:bg-purple-900/20 text-purple-400"
        >
          {vsAI ? t('tictactoe.vsAI') : t('tictactoe.pvp')}
        </Button>
      }
    >
      <div className="flex flex-col items-center justify-center py-4 text-white">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-[0.2em] mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            {t('tictactoe.title')}
          </h1>
          <p className="text-sm text-zinc-400">
            {winner ? (
              <span>
                {t('tictactoe.winner')}:{' '}
                <span
                  className={
                    winner === 'X' ? 'neon-x font-bold' : 'neon-o font-bold'
                  }
                >
                  {winner}
                </span>
              </span>
            ) : (
              <span>
                {t('tictactoe.nextPlayer')}:{' '}
                <span
                  className={xNext ? 'neon-x font-bold' : 'neon-o font-bold'}
                >
                  {currentPlayer}
                </span>
              </span>
            )}
          </p>
        </div>

        <div className="relative p-3 rounded-2xl bg-[#0a0a0a] neon-grid border-4">
          <div className="grid grid-cols-3 gap-3 relative w-[min(76vw,300px)] aspect-square sm:w-[360px] sm:h-[360px]">
            {board.map((cell, i) => (
              <button
                key={i}
                type="button"
                data-tic-index={i}
                aria-label={`${i + 1} ${cell ?? ''}`}
                onClick={() => {
                  if (!vsAI || xNext) handlePlay(i);
                }}
                disabled={
                  paused || draw || !!winner || !!cell || (vsAI && !xNext)
                }
                className={cn(
                  'relative flex items-center justify-center rounded-xl bg-black border-2 text-6xl font-black font-sans transition-all neon-cell disabled:opacity-100',
                  cell === 'X' && 'neon-x animate-pop-in',
                  cell === 'O' && 'neon-o animate-pop-in',
                  fadingMoveIndex === i && 'animate-fading',
                )}
              >
                {cell ?? ''}
              </button>
            ))}
            {renderWinningLine()}
            <GameResultOverlay
              open={!!winner || draw}
              tone={draw ? 'draw' : !vsAI || winner === 'X' ? 'win' : 'lose'}
              title={
                draw
                  ? t('arcade.draw')
                  : !vsAI || winner === 'X'
                    ? t('common.youWin')
                    : t('common.youLose')
              }
              onRestart={restart}
            />
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-6 max-w-sm text-center px-4 leading-relaxed font-mono">
          {t(
            difficulty === 'hard'
              ? 'arcade.ticClassicRules'
              : 'tictactoe.rules',
          )}
        </p>

        <div className="mt-12 flex gap-4">
          <Button
            size="lg"
            onClick={restart}
            className="bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white font-bold tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            {t('common.restart')}
          </Button>
        </div>
      </div>
    </GameShell>
  );
};

export default GameTictactoe;
