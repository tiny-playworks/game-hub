import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/contexts/LocaleContext';

const MIN = 1;
const MAX = 100;

const GameGuessNumber = () => {
  const { t } = useLocale();
  const [answer, setAnswer] = useState(
    () => Math.floor(Math.random() * (MAX - MIN + 1)) + MIN,
  );
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);
  const [ended, setEnded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(guess, 10);
    if (Number.isNaN(n) || n < MIN || n > MAX) {
      setMessage(`请输入 ${MIN}～${MAX} 之间的整数`);
      return;
    }
    setCount((c) => c + 1);
    if (n === answer) {
      setMessage(`猜对了！用了 ${count + 1} 次`);
      setEnded(true);
    } else if (n < answer) {
      setMessage('小了');
    } else {
      setMessage('大了');
    }
    setGuess('');
  };

  const restart = () => {
    setAnswer(Math.floor(Math.random() * (MAX - MIN + 1)) + MIN);
    setGuess('');
    setMessage('');
    setCount(0);
    setEnded(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <span className="text-sm text-muted-foreground">猜数字</span>
      </header>

      <main className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>猜数字</CardTitle>
            <p className="text-sm text-muted-foreground">
              我想了一个 {MIN}～{MAX} 之间的整数，你来猜
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="number"
                min={MIN}
                max={MAX}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={`${MIN}～${MAX}`}
                disabled={ended}
                className="text-center"
              />
              <Button type="submit" disabled={ended}>
                猜
              </Button>
            </form>
            {message && (
              <p
                className={
                  ended
                    ? 'text-lg font-medium text-primary'
                    : 'text-muted-foreground'
                }
              >
                {message}
              </p>
            )}
            {!ended && count > 0 && (
              <p className="text-sm text-muted-foreground">已猜 {count} 次</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={restart}>
                {t('common.restartGame')}
              </Button>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  {t('common.backList')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default GameGuessNumber;
