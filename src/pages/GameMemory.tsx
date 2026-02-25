import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
const ROWS = 4;
const COLS = 4;

type CardState = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const GameMemory = () => {
  const { t } = useLocale();
  const [cards, setCards] = useState<CardState[]>(() => {
    const pairs = EMOJIS.slice(0, (ROWS * COLS) / 2);
    const list = [...pairs, ...pairs].map((emoji, i) => ({
      id: i,
      emoji,
      flipped: false,
      matched: false,
    }));
    return shuffle(list);
  });
  const [moves, setMoves] = useState(0);
  const [lastFlipped, setLastFlipped] = useState<number | null>(null);
  const [lock, setLock] = useState(false);

  const allMatched = cards.every((c) => c.matched);

  const handleClick = useCallback(
    (index: number) => {
      if (lock || cards[index].flipped || cards[index].matched) return;
      const next = cards.map((c, i) =>
        i === index ? { ...c, flipped: true } : c,
      );
      setCards(next);
      setMoves((m) => m + 1);

      if (lastFlipped === null) {
        setLastFlipped(index);
        return;
      }
      const first = cards[lastFlipped];
      if (first.emoji === cards[index].emoji) {
        setCards((prev) =>
          prev.map((c, i) =>
            i === index || i === lastFlipped ? { ...c, matched: true } : c,
          ),
        );
      } else {
        setLock(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === index || i === lastFlipped ? { ...c, flipped: false } : c,
            ),
          );
          setLock(false);
        }, 600);
      }
      setLastFlipped(null);
    },
    [cards, lastFlipped, lock],
  );

  const restart = () => {
    const pairs = EMOJIS.slice(0, (ROWS * COLS) / 2);
    const list = [...pairs, ...pairs].map((emoji, i) => ({
      id: i,
      emoji,
      flipped: false,
      matched: false,
    }));
    setCards(shuffle(list));
    setMoves(0);
    setLastFlipped(null);
    setLock(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <span className="text-sm text-muted-foreground">步数: {moves}</span>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <div
          className="grid gap-2 rounded-lg bg-muted p-4"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {cards.map((card, i) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleClick(i)}
              disabled={lock || card.matched}
              className={cn(
                'flex aspect-square max-w-[72px] items-center justify-center rounded-lg border-2 border-border bg-background text-3xl transition hover:bg-accent disabled:pointer-events-none sm:max-w-[84px]',
                (card.flipped || card.matched) &&
                  'bg-primary/10 border-primary',
              )}
            >
              {card.flipped || card.matched ? card.emoji : '?'}
            </button>
          ))}
        </div>
        {allMatched && (
          <p className="mt-4 text-lg font-medium text-primary">
            全部配对完成！共 {moves} 步
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" onClick={restart}>
            {t('common.restart')}
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm">
              {t('common.backList')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GameMemory;
