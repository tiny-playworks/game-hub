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
      if (paused || draw || winner) return;
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
    [
      currentPlayer,
      moves,
      shake,
      xNext,
      paused,
      draw,
      winner,
      turnCount,
      difficulty,
    ],
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
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        viewBox="0 0 300 300"
      >
        <title>{t('tictactoe.winLine')}</title>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={winner === 'X' ? '#3d8070' : '#c85542'}
          strokeWidth="10"
          strokeLinecap="round"
          className="animate-laser"
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
      status={
        <>
          <StatPill label={t('common.moves')} value={turnCount} />
          <StatPill
            label={t('tictactoe.nextPlayer')}
            value={winner ?? currentPlayer}
          />
        </>
      }
      toolbar={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setVsAI(!vsAI);
              restart();
            }}
          >
            {vsAI ? t('tictactoe.vsAI') : t('tictactoe.pvp')}
          </Button>
          <Button variant="outline" size="sm" onClick={restart}>
            {t('common.restart')}
          </Button>
        </>
      }
    >
      <div className="tic-stage">
        <div className="tic-turn" role="status">
          <span className={currentPlayer === 'X' ? 'tic-x' : 'tic-o'}>
            {currentPlayer}
          </span>
          <p>
            {vsAI && !xNext && !winner
              ? t('common.thinking')
              : `${t('tictactoe.nextPlayer')} · ${currentPlayer}`}
          </p>
        </div>
        <div className="tic-board">
          <div className="relative grid grid-cols-3 gap-2 aspect-square">
            {board.map((cell, index) => (
              <button
                key={index}
                type="button"
                data-tic-index={index}
                aria-label={`${index + 1} ${cell ?? ''}`}
                onClick={() => {
                  if (!vsAI || xNext) handlePlay(index);
                }}
                disabled={
                  paused || draw || !!winner || !!cell || (vsAI && !xNext)
                }
                className={cn(
                  'tic-cell',
                  cell === 'X' && 'tic-x',
                  cell === 'O' && 'tic-o',
                  fadingMoveIndex === index && 'tic-fading',
                )}
              >
                {cell ?? ''}
                {fadingMoveIndex === index && (
                  <span className="tic-fading-mark" aria-hidden="true">
                    ·
                  </span>
                )}
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
        <p className="tic-rules">
          {t(
            difficulty === 'hard'
              ? 'arcade.ticClassicRules'
              : 'tictactoe.rules',
          )}
        </p>
      </div>
    </GameShell>
  );
};
export default GameTictactoe;
