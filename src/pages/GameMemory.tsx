import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import { useGameStore } from '../store/gameStore';
import './memory.css';

const EMOJIS = [
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐸',
  '🐙',
  '🦋',
  '🦄',
];
const ROWS = 4;
const COLS = 4;
const INITIAL_TIME = 30;
const BONUS_MATCH = 3;
const BONUS_LEVEL = 10;

type CardState = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
  error: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateCards(level: number): CardState[] {
  // Use different emojis based on level to keep it fresh
  const offset = (level - 1) % (EMOJIS.length / 8);
  const pairs = EMOJIS.slice(offset * 8, offset * 8 + (ROWS * COLS) / 2);
  const list = [...pairs, ...pairs].map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
    error: false,
  }));
  return shuffle(list);
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

  const [cards, setCards] = useState<CardState[]>(() => generateCards(1));
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [status, setStatus] = useState<'playing' | 'lost'>('playing');

  const [lastFlipped, setLastFlipped] = useState<number | null>(null);
  const [lock, setLock] = useState(false);

  const errorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (status !== 'playing') return;

    if (timeLeft <= 0) {
      setStatus('lost');
      shake();
      if (score > gameStats.highScore) {
        updateHighScore('memory', score);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, status, score, shake, updateHighScore, gameStats.highScore]);

  const allMatched = cards.length > 0 && cards.every((c) => c.matched);

  // Level up logic
  useEffect(() => {
    if (allMatched && status === 'playing') {
      setLock(true);
      const timer = setTimeout(() => {
        setLevel((l) => l + 1);
        setTimeLeft((t) => t + BONUS_LEVEL);
        setCards(generateCards(level + 1));
        setLock(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [allMatched, status, level]);

  const handleClick = useCallback(
    (index: number) => {
      if (
        status !== 'playing' ||
        lock ||
        cards[index].flipped ||
        cards[index].matched
      )
        return;

      const next = cards.map((c, i) =>
        i === index ? { ...c, flipped: true } : c,
      );
      setCards(next);

      if (lastFlipped === null) {
        setLastFlipped(index);
        return;
      }
      setMoves((m) => m + 1);

      const first = cards[lastFlipped];
      if (first.emoji === cards[index].emoji) {
        // Match!
        setCards((prev) =>
          prev.map((c, i) =>
            i === index || i === lastFlipped ? { ...c, matched: true } : c,
          ),
        );
        setScore((s) => s + 1);
        setTimeLeft((t) => t + BONUS_MATCH);
      } else {
        // No match
        setLock(true);
        shake();
        setCards((prev) =>
          prev.map((c, i) =>
            i === index || i === lastFlipped ? { ...c, error: true } : c,
          ),
        );

        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === index || i === lastFlipped
                ? { ...c, flipped: false, error: false }
                : c,
            ),
          );
          setLock(false);
        }, 600);
      }
      setLastFlipped(null);
    },
    [cards, lastFlipped, lock, status, shake],
  );

  const restart = () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setLevel(1);
    setScore(0);
    setMoves(0);
    setTimeLeft(INITIAL_TIME);
    setStatus('playing');
    setCards(generateCards(1));
    setLastFlipped(null);
    setLock(false);
  };

  const timerColor =
    timeLeft > 10
      ? 'bg-green-500'
      : timeLeft > 5
        ? 'bg-orange-500'
        : 'bg-red-500';
  const timerWidth = `${Math.min(100, (timeLeft / INITIAL_TIME) * 100)}%`;

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
          <span className="text-blue-600 dark:text-blue-400">Lv.{level}</span>
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

      {/* Timer Bar */}
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
        {/* Game Area */}
        <div className="relative">
          <div
            className="grid gap-3 sm:gap-4 mx-auto"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
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

          {/* Overlays */}
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

          {allMatched && status === 'playing' && (
            <div className="absolute inset-0 bg-green-500/10 backdrop-blur-md rounded-xl flex items-center justify-center z-20 animate-fly-in">
              <h2 className="text-4xl font-black text-green-500 drop-shadow-lg scale-150 animate-pulse">
                +10 SEC
              </h2>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GameMemory;
