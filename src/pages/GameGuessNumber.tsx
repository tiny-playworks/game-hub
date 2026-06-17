import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import { useGameStore } from '../store/gameStore';
import './guess-number.css';

const MIN = 1;
const MAX = 100;
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
  const { stats, updateHighScore } = useGameStore();

  const gameStats = stats['guess-number'] || {
    highScore: 0,
    playCount: 0,
    maxCombo: 0,
  };

  const [answer, setAnswer] = useState(
    () => Math.floor(Math.random() * (MAX - MIN + 1)) + MIN,
  );
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [history, setHistory] = useState<GuessHistory[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');

  const logRef = useRef<HTMLDivElement>(null);

  // Timer logic
  useEffect(() => {
    if (status !== 'playing') return;

    if (timeLeft <= 0) {
      setStatus('lost');
      shake();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, status, shake]);

  // Scroll log to bottom on new history
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  });

  const handleInput = useCallback(
    (char: string) => {
      if (status !== 'playing') return;
      if (currentGuess.length >= 3) return; // max 3 digits
      setCurrentGuess((prev) => prev + char);
    },
    [currentGuess.length, status],
  );

  const handleBackspace = useCallback(() => {
    if (status !== 'playing') return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [status]);

  const submitGuess = useCallback(() => {
    if (status !== 'playing' || !currentGuess) return;

    const n = Number.parseInt(currentGuess, 10);
    if (Number.isNaN(n) || n < MIN || n > MAX) {
      shake();
      setCurrentGuess('');
      return;
    }

    const distance = Math.abs(answer - n);
    const { heat, message } = getHeat(distance, n > answer, t);

    const newEntry: GuessHistory = { guess: n, distance, heat, message };
    setHistory((prev) => [...prev, newEntry]);

    if (distance === 0) {
      setStatus('won');
      if (timeLeft > gameStats.highScore) {
        updateHighScore('guess-number', timeLeft);
      }
    } else {
      shake();
      setTimeLeft((prev) => Math.max(0, prev - PENALTY_TIME));
    }

    setCurrentGuess('');
  }, [
    answer,
    currentGuess,
    gameStats.highScore,
    shake,
    status,
    timeLeft,
    t,
    updateHighScore,
  ]);

  const restart = () => {
    setAnswer(Math.floor(Math.random() * (MAX - MIN + 1)) + MIN);
    setTimeLeft(INITIAL_TIME);
    setStatus('playing');
    setHistory([]);
    setCurrentGuess('');
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'playing') return;
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
  }, [handleBackspace, handleInput, status, submitGuess]);

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
    <div className="min-h-screen bg-[#111] text-zinc-300 font-sans selection:bg-red-900/50">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-4 py-3 sticky top-0 z-10">
        <Link
          to="/"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← {t('common.backToList')}
        </Link>
        <div className="flex gap-4 text-sm font-led text-red-500">
          <span>
            {formatMessage(locale, 'guess.highScore', {
              score: gameStats.highScore,
            })}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-sm px-4 py-8 flex flex-col items-center">
        {/* Header Title */}
        <div className="text-center mb-6">
          <p className="text-xs text-zinc-500 font-mono">DEFUSE</p>
          <h1 className="text-3xl font-black text-red-600 tracking-widest font-led mb-1">
            {t('game.guess-number.name')}
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            {formatMessage(locale, 'guess.range', { min: MIN, max: MAX })}
          </p>
        </div>

        {/* Timer Display */}
        <div
          className={cn(
            'w-full bg-[#050505] border-2 rounded-lg p-6 mb-6 flex justify-center items-center relative overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.15)]',
            status === 'lost'
              ? 'border-red-600 animate-glitch'
              : status === 'won'
                ? 'border-green-500'
                : timeLeft <= 10
                  ? 'border-red-500 animate-blink-red'
                  : 'border-zinc-800',
          )}
        >
          {/* Glare effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

          <div
            className={cn(
              'text-6xl font-led font-black tabular-nums tracking-widest',
              status === 'won'
                ? 'text-green-500 text-shadow-none'
                : timeLeft <= 10
                  ? 'text-red-500 animate-pulse'
                  : 'text-red-500',
            )}
          >
            00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        {/* History Log Display */}
        <div
          ref={logRef}
          className="w-full h-40 bg-[#0a0a0a] border border-zinc-800 rounded mb-6 p-3 overflow-y-auto font-mono text-sm space-y-2 flex flex-col shadow-inner"
        >
          {history.length === 0 && (
            <div className="text-zinc-600 italic text-center mt-auto mb-auto">
              {t('guess.waitingInput')}
            </div>
          )}
          {history.map((h, i) => (
            <div
              key={i}
              className="flex justify-between items-center bg-zinc-900/50 px-2 py-1.5 rounded animate-slide-up-fade border border-zinc-800/50"
            >
              <span className="text-zinc-400">
                #{i + 1} &gt; {h.guess}
              </span>
              <span
                className={cn(
                  'uppercase text-xs tracking-wider',
                  getHeatColor(h.heat),
                )}
              >
                {h.message}
              </span>
            </div>
          ))}
        </div>

        {/* Current Input */}
        <div className="w-full bg-zinc-900 border-t-2 border-b-2 border-zinc-800 py-3 mb-6 flex justify-center items-center h-16">
          <div className="text-4xl font-led text-red-500 tracking-[0.2em]">
            {currentGuess.padEnd(3, '_')}
          </div>
        </div>

        {/* Numpad */}
        <div className="w-full grid grid-cols-3 gap-3 mb-8">
          {padKeys.map((k) => (
            <Button
              key={k}
              variant="outline"
              disabled={status !== 'playing'}
              onClick={() => {
                if (k === 'C') handleBackspace();
                else if (k === 'SUBMIT') submitGuess();
                else handleInput(k);
              }}
              className={cn(
                'h-14 text-xl font-bold rounded-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all',
                k === 'SUBMIT'
                  ? 'bg-red-900/20 text-red-500 border-red-900 hover:bg-red-900/40'
                  : k === 'C'
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-900 hover:bg-zinc-700'
                    : 'bg-zinc-800 text-white border-zinc-900 hover:bg-zinc-700 hover:text-white',
              )}
            >
              {k === 'SUBMIT' ? t('guess.btn') : k}
            </Button>
          ))}
        </div>

        {/* End Game Overlay overlay elements are handled above or inline, but let's add a restart button */}
        {status !== 'playing' && (
          <div className="animate-slide-up-fade w-full text-center">
            <h2
              className={cn(
                'text-3xl font-black mb-4 uppercase',
                status === 'won' ? 'text-green-500' : 'text-red-500',
              )}
            >
              {status === 'won' ? t('guess.won') : t('guess.lost')}
            </h2>
            <p className="text-zinc-400 mb-6 font-mono text-sm">
              {status === 'won'
                ? formatMessage(locale, 'guess.wonDesc', { answer, timeLeft })
                : formatMessage(locale, 'guess.lostDesc', { answer })}
            </p>
            <Button
              size="lg"
              onClick={restart}
              className="w-full bg-white text-black hover:bg-zinc-200 font-bold tracking-widest uppercase"
            >
              {t('common.restartGame')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default GameGuessNumber;
