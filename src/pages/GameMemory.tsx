import { useEffect, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameReadyOverlay } from '@/components/game/GameReadyOverlay';
import { GameProgress } from '@/components/game/GameProgress';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  allMatched,
  createInitialMemoryState,
  type MemoryAction,
  memoryReducer,
} from '@/lib/memory';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import './memory.css';

const GameMemory = () => {
  const { t } = useLocale();
  const { difficulty, paused, result, finish, restart, start } = useArcade();
  const [phase, setPhase] = useState<'ready' | 'preview' | 'playing'>('ready');
  const [previewSeconds, setPreviewSeconds] = useState(3);
  const shake = useScreenShake();
  const rows = difficulty === 'hard' ? 6 : 4;
  const cols = difficulty === 'easy' ? 4 : 6;
  const [state, setState] = useState(() => ({
    ...createInitialMemoryState(Math.random, (rows * cols) / 2),
    timeLeft: difficulty === 'hard' ? 90 : 60,
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatch = (action: MemoryAction) => {
    const next = memoryReducer(stateRef.current, action);
    stateRef.current = next.state;
    setState(next.state);
    if (
      next.effects.some(
        (effect) => effect.type === 'shake' || effect.type === 'game_over',
      )
    )
      shake();
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const cleared = allMatched(state.cards);
  const pairsFound = state.cards.filter((card) => card.matched).length / 2;
  useEffect(() => {
    if (phase !== 'preview' || paused) return;
    if (previewSeconds <= 0) {
      setPhase('playing');
      start();
      return;
    }
    const timer = window.setTimeout(
      () => setPreviewSeconds((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [phase, paused, previewSeconds, start]);
  useEffect(() => {
    if (
      phase !== 'playing' ||
      paused ||
      result ||
      cleared ||
      state.status !== 'playing'
    )
      return;
    const timer = window.setInterval(
      () => dispatchRef.current({ type: 'TICK' }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [phase, paused, result, cleared, state.status]);
  useEffect(() => {
    if (paused || !state.lock || cleared) return;
    const errors = state.cards.flatMap((card, index) =>
      card.error ? [index] : [],
    );
    if (errors.length !== 2) return;
    const timer = window.setTimeout(
      () =>
        dispatchRef.current({
          type: 'CLEAR_MISMATCH',
          indices: [errors[0], errors[1]],
        }),
      600,
    );
    return () => window.clearTimeout(timer);
  }, [paused, state.lock, state.cards, cleared]);
  useEffect(() => {
    if (cleared || state.status === 'lost')
      finish(cleared ? 'win' : 'lose', state.moves, {
        rows,
        cols,
        pairs: (rows * cols) / 2,
        mistakes: state.moves - (rows * cols) / 2,
      });
  }, [cleared, state.status, state.moves, rows, cols, finish]);
  useArcadeSnapshot(() => ({
    rows,
    cols,
    status: state.status,
    phase,
    timeLeft: state.timeLeft,
    moves: state.moves,
    cards: state.cards.map((card) => ({
      ...card,
      emoji:
        phase === 'preview' || card.flipped || card.matched ? card.emoji : null,
    })),
  }));
  return (
    <GameShell
      autoStart={false}
      title={t('game.memory.name')}
      subtitle={t('game.memory.description')}
      status={
        <>
          <StatPill label={t('arcade.pairAttempts')} value={state.moves} />
          <StatPill label={t('arcade.timeLeft')} value={state.timeLeft} />
        </>
      }
    >
      <GameProgress
        label={t('arcade.matchedPairs')}
        current={pairsFound}
        target={(rows * cols) / 2}
        feedback={
          phase === 'preview'
            ? `${t('arcade.previewing')} · ${previewSeconds}`
            : pairsFound > 0 && !state.lock
              ? t('arcade.memoryBonus')
              : undefined
        }
      />
      <div className="memory-stage relative w-full max-w-xl rounded-2xl bg-zinc-50 p-3 text-zinc-900 dark:bg-[#0f172a] dark:text-zinc-100 sm:p-5">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-slate-800">
          <div
            className={cn(
              'h-full timer-bar',
              state.timeLeft <= 10 ? 'bg-red-500' : 'bg-green-500',
            )}
            style={{
              width: `${Math.min(100, (state.timeLeft / (difficulty === 'hard' ? 90 : 60)) * 100)}%`,
            }}
          />
        </div>
        <div
          className="grid gap-2 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {state.cards.map((card, index) => (
            <div
              key={card.id}
              className="memory-perspective aspect-square min-w-0 animate-fly-in"
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <button
                type="button"
                disabled={
                  phase !== 'playing' ||
                  paused ||
                  !!result ||
                  state.lock ||
                  card.matched
                }
                data-memory-index={index}
                onClick={() => dispatch({ type: 'FLIP', index })}
                aria-label={
                  phase === 'preview' || card.flipped || card.matched
                    ? card.emoji
                    : `${t('memory.faceDown')} ${index + 1}`
                }
                className={cn(
                  'memory-card cursor-pointer border-0 bg-transparent p-0',
                  (phase === 'preview' || card.flipped || card.matched) &&
                    'flipped',
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
                  {phase === 'preview' || card.flipped || card.matched
                    ? card.emoji
                    : ''}
                </div>
              </button>
            </div>
          ))}
        </div>
        {phase === 'ready' && (
          <GameReadyOverlay
            title={t('game.memory.name')}
            description={t('arcade.preview')}
            onStart={() => setPhase('preview')}
          />
        )}
        <GameResultOverlay
          open={!!result}
          tone={cleared ? 'win' : 'lose'}
          title={cleared ? t('common.youWin') : t('memory.timeOut')}
          description={`${state.moves} ${t('arcade.unit.moves')} · ${rows}×${cols}`}
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};
export default GameMemory;
