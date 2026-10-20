import { useCallback, useEffect, useRef, useState } from 'react';
import { GameProgress } from '@/components/game/GameProgress';
import { GameReadyOverlay } from '@/components/game/GameReadyOverlay';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import './guess-number.css';

const MIN = 1;
const INITIAL_TIME = 60;
const PENALTY_TIME = 5;

interface GuessHistory {
  guess: number;
  distance: number;
  heat: 'hot' | 'warm' | 'cool' | 'cold' | 'correct';
  message: string;
}

const getHeat = (
  distance: number,
  isLarger: boolean,
  t: (key: string) => string,
): { heat: GuessHistory['heat']; message: string } => {
  if (distance === 0) return { heat: 'correct', message: t('guess.correct') };
  const dir = isLarger ? t('guess.larger') : t('guess.smaller');
  if (distance <= 5)
    return { heat: 'hot', message: `${dir} ${t('guess.heat.hot')}` };
  if (distance <= 15)
    return { heat: 'warm', message: `${dir} ${t('guess.heat.warm')}` };
  if (distance <= 30)
    return { heat: 'cool', message: `${dir} ${t('guess.heat.cool')}` };
  return { heat: 'cold', message: `${dir} ${t('guess.heat.cold')}` };
};

const getHeatColor = (heat: GuessHistory['heat']) => {
  switch (heat) {
    case 'hot':
      return 'text-red-500 font-bold';
    case 'warm':
      return 'text-orange-400';
    case 'cool':
      return 'text-cyan-400';
    case 'cold':
      return 'text-blue-600';
    case 'correct':
      return 'text-green-500 font-extrabold animate-pulse';
  }
};

const GameGuessNumber = () => {
  const { locale, t } = useLocale();
  const shake = useScreenShake();
  const { difficulty, paused, finish, restart, start } = useArcade();
  const MAX = difficulty === 'easy' ? 100 : difficulty === 'hard' ? 1000 : 500;
  const [answer] = useState(
    () => Math.floor(Math.random() * (MAX - MIN + 1)) + MIN,
  );
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [status, setStatus] = useState<'ready' | 'playing' | 'won' | 'lost'>(
    'ready',
  );
  const [history, setHistory] = useState<GuessHistory[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [bounds, setBounds] = useState({ min: MIN, max: MAX });
  const [inputError, setInputError] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  // Timer logic
  useEffect(() => {
    if (paused || status !== 'playing') return;

    if (timeLeft <= 0) {
      setStatus('lost');
      shake();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, status, shake, paused]);

  // Scroll log to bottom on new history
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  });

  const handleInput = useCallback(
    (char: string) => {
      if (paused || status !== 'playing') return;
      if (currentGuess.length >= String(MAX).length) return; // max 3 digits
      setCurrentGuess((prev) => prev + char);
    },
    [currentGuess.length, status, MAX, paused],
  );

  const handleBackspace = useCallback(() => {
    if (paused || status !== 'playing') return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [status, paused]);

  const submitGuess = useCallback(() => {
    if (paused || status !== 'playing' || !currentGuess) return;

    const n = Number.parseInt(currentGuess, 10);
    if (Number.isNaN(n) || n < bounds.min || n > bounds.max) {
      shake();
      setInputError(true);
      setCurrentGuess('');
      return;
    }

    setInputError(false);
    const distance = Math.abs(answer - n);
    const { heat, message } = getHeat(distance, n > answer, t);

    const newEntry: GuessHistory = { guess: n, distance, heat, message };
    setHistory((prev) => [...prev, newEntry]);

    if (distance === 0) {
      setStatus('won');
    } else {
      setBounds((previous) =>
        n > answer ? { ...previous, max: n - 1 } : { ...previous, min: n + 1 },
      );
      setTimeLeft((prev) => Math.max(0, prev - PENALTY_TIME));
    }

    setCurrentGuess('');
  }, [answer, currentGuess, shake, status, t, paused, bounds]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (paused || status !== 'playing') return;
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, button')
      )
        return;
      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        submitGuess();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackspace, handleInput, status, submitGuess, paused]);

  useArcadeSnapshot(() => ({
    status,
    range: [MIN, MAX],
    remainingRange: [bounds.min, bounds.max],
    timeLeft,
    attempts: history.length,
    history,
    input: currentGuess,
  }));
  useEffect(() => {
    if (status === 'won' || status === 'lost')
      finish(status === 'won' ? 'win' : 'lose', history.length, {
        range: MAX,
        guesses: history.length,
      });
  }, [status, history.length, MAX, finish]);

  // Numpad layout
  const padKeys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'C',
    '0',
    'SUBMIT',
  ] as const;

  return (
    <GameShell
      autoStart={false}
      title={t('game.guess-number.name')}
      subtitle={formatMessage(locale, 'guess.range', { min: MIN, max: MAX })}
      status={
        <>
          <StatPill label={t('arcade.attempts')} value={history.length} />
          <StatPill
            label={t('arcade.timeLeft')}
            value={timeLeft}
            tone={timeLeft <= 10 ? 'danger' : 'default'}
          />
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={restart}>
          {t('common.restart')}
        </Button>
      }
    >
      <GameProgress
        label={t('arcade.possibleRange')}
        value={`${bounds.min} – ${bounds.max}`}
        current={MAX - (bounds.max - bounds.min) - 1}
        target={MAX - 1}
      />
      <div className="guess-console">
        <div className="guess-console-top">
          <span>{t('arcade.guessClue')}</span>
          <strong className={timeLeft <= 10 ? 'text-red-300' : ''}>
            {Math.floor(timeLeft / 60)
              .toString()
              .padStart(2, '0')}
            :{(timeLeft % 60).toString().padStart(2, '0')}
          </strong>
        </div>
        <div ref={logRef} className="guess-history" aria-live="polite">
          {history.length === 0 && <p>{t('guess.waitingInput')}</p>}
          {history.map((entry, index) => (
            <div key={index}>
              <span>
                #{index + 1} · <strong>{entry.guess}</strong>
              </span>
              <span className={getHeatColor(entry.heat)}>{entry.message}</span>
            </div>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitGuess();
          }}
        >
          <label className="sr-only" htmlFor="guess-code">
            {t('guess.waitingInput')}
          </label>
          <input
            id="guess-code"
            className="guess-input"
            inputMode="numeric"
            autoComplete="off"
            value={currentGuess}
            disabled={paused || status !== 'playing'}
            placeholder={'_'.repeat(String(MAX).length)}
            onChange={(event) => {
              setInputError(false);
              setCurrentGuess(
                event.target.value
                  .replace(/[^0-9]/g, '')
                  .slice(0, String(MAX).length),
              );
            }}
          />
          <p className="guess-input-hint" role="status">
            {inputError
              ? t('arcade.outsideRange')
              : `${bounds.min} – ${bounds.max}`}
          </p>
          <div className="guess-keypad">
            {padKeys.map((key) => (
              <Button
                key={key}
                type="button"
                disabled={paused || status !== 'playing'}
                onClick={() => {
                  if (key === 'C') handleBackspace();
                  else if (key === 'SUBMIT') submitGuess();
                  else handleInput(key);
                }}
                className={cn(key === 'SUBMIT' && 'guess-confirm')}
              >
                {key === 'SUBMIT' ? t('guess.btn') : key === 'C' ? '⌫' : key}
              </Button>
            ))}
          </div>
        </form>
        {status === 'ready' && (
          <GameReadyOverlay
            title={t('game.guess-number.name')}
            description={t('arcade.guessReady')}
            onStart={() => {
              setStatus('playing');
              start();
            }}
          />
        )}
        <GameResultOverlay
          open={status === 'won' || status === 'lost'}
          tone={status === 'won' ? 'win' : 'lose'}
          title={status === 'won' ? t('guess.won') : t('guess.lost')}
          description={formatMessage(
            locale,
            status === 'won' ? 'guess.wonDesc' : 'guess.lostDesc',
            { answer, timeLeft },
          )}
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};
export default GameGuessNumber;
