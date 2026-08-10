import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  allMatched,
  createInitialMemoryState,
  MEMORY,
  type MemoryAction,
  type MemoryEffect,
  memoryReducer,
} from '@/lib/memory';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import { useGameStore } from '../store/gameStore';
import './memory.css';

function defaultRng() {
  return Math.random();
}

const GameMemory = () => {
  const { locale, t } = useLocale();
  const shake = useScreenShake();
  const { stats, updateHighScore } = useGameStore();
  const gameStats = stats.memory || {
    highScore: 0,
    playCount: 0,
    maxCombo: 0,
  };

  const [state, setState] = useState(() =>
    createInitialMemoryState(defaultRng),
  );

  const stateRef = useRef(state);

  const errorTimerRef = useRef<number | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const highScoreRef = useRef(gameStats.highScore);
  highScoreRef.current = gameStats.highScore;

  const clearTimers = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    if (levelTimerRef.current) {
      clearTimeout(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  };

  const dispatchActionRef = useRef<(action: MemoryAction) => void>(() => {});

  const applyEffects = (effects: MemoryEffect[], score: number) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'mismatch_delay': {
          if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          const indices = effect.indices;
          errorTimerRef.current = window.setTimeout(() => {
            dispatchActionRef.current({ type: 'CLEAR_MISMATCH', indices });
          }, effect.ms);
          break;
        }
        case 'level_clear_delay': {
          if (levelTimerRef.current) clearTimeout(levelTimerRef.current);
          levelTimerRef.current = window.setTimeout(() => {
            dispatchActionRef.current({
              type: 'ADVANCE_LEVEL',
              rng: defaultRng,
            });
          }, effect.ms);
          break;
        }
        case 'shake':
          shake();
          break;
        case 'game_over':
          shake();
          if (score > highScoreRef.current) {
            updateHighScore('memory', score);
          }
          break;
      }
    }
  };

  const dispatchAction = (action: MemoryAction) => {
    const { state: next, effects } = memoryReducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
    applyEffects(effects, next.score);
  };
  dispatchActionRef.current = dispatchAction;

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (levelTimerRef.current) clearTimeout(levelTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'playing') return;

    const timer = window.setInterval(() => {
      dispatchActionRef.current({ type: 'TICK' });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.status]);

  const handleClick = (index: number) => {
    dispatchAction({ type: 'FLIP', index });
  };

  const restart = () => {
    clearTimers();
    dispatchAction({ type: 'RESTART', rng: defaultRng });
  };

  const { cards, level, score, moves, timeLeft, status } = state;
  const cleared = allMatched(cards) && status === 'playing';

  const timerColor =
    timeLeft > 10
      ? 'bg-green-500'
      : timeLeft > 5
        ? 'bg-orange-500'
        : 'bg-red-500';
  const timerWidth = `${Math.min(100, (timeLeft / MEMORY.initialTime) * 100)}%`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#0f172a] dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <Link
          to="/"
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          ← {t('common.backToList')}
        </Link>
        <div className="flex gap-4 font-semibold">
          <span className="text-blue-600 dark:text-blue-400">
            {formatMessage(locale, 'memory.level', { level })}
          </span>
          <span className="text-purple-600 dark:text-purple-400">
            {formatMessage(locale, 'memory.moves', { moves })}
          </span>
          <span className="text-green-600 dark:text-green-400">
            {formatMessage(locale, 'memory.score', { score })}
          </span>
          <span className="text-zinc-400 text-sm font-normal">
            {formatMessage(locale, 'memory.highScore', {
              score: gameStats.highScore,
            })}
          </span>
        </div>
      </header>

      <div className="w-full h-2 bg-zinc-200 dark:bg-slate-800">
        <div
          className={cn(
            'h-full timer-bar shadow-[0_0_10px_currentColor]',
            timerColor,
          )}
          style={{ width: timerWidth }}
        />
      </div>

      <main className="flex flex-col items-center justify-center p-4 py-8">
        <div className="relative">
          <div
            className="grid gap-3 sm:gap-4 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${MEMORY.cols}, 1fr)`,
            }}
          >
            {cards.map((card, i) => (
              <div
                key={card.id}
                className="memory-perspective w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] animate-fly-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <button
                  type="button"
                  onClick={() => handleClick(i)}
                  aria-label={
                    card.flipped || card.matched
                      ? card.emoji
                      : t('memory.faceDown')
                  }
                  className={cn(
                    'memory-card cursor-pointer border-0 bg-transparent p-0',
                    (card.flipped || card.matched) && 'flipped',
                    card.error && 'shake',
                  )}
                >
                  <div className="memory-face memory-back" />
                  <div
                    className={cn(
                      'memory-face memory-front',
                      card.matched && 'matched',
                      card.error && 'error',
                    )}
                  >
                    {card.flipped || card.matched ? card.emoji : ''}
                  </div>
                </button>
              </div>
            ))}
          </div>

          {status === 'lost' && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-6 text-center animate-fly-in border border-zinc-200 dark:border-slate-800 shadow-xl z-20">
              <h2 className="text-4xl font-black text-red-500 mb-2">
                {t('memory.timeOut')}
              </h2>
              <p className="text-lg font-medium mb-6">
                {formatMessage(locale, 'memory.scorePairs', { score })}
              </p>
              <div className="flex gap-4">
                <Button size="lg" onClick={restart} className="font-bold">
                  {t('common.playAgain')}
                </Button>
                <Link to="/">
                  <Button variant="outline" size="lg">
                    {t('common.backList')}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {cleared && (
            <div className="absolute inset-0 bg-green-500/10 backdrop-blur-md rounded-xl flex items-center justify-center z-20 animate-fly-in">
              <h2 className="text-4xl font-black text-green-500 drop-shadow-lg scale-150 animate-pulse">
                {formatMessage(locale, 'memory.bonusTime', {
                  seconds: MEMORY.bonusLevel,
                })}
              </h2>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GameMemory;
