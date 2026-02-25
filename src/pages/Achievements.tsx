import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  ACHIEVEMENTS,
  checkAndUnlockFromStats,
  isUnlocked,
} from '@/lib/achievements';

const Achievements = () => {
  const { t } = useLocale();

  useEffect(() => {
    checkAndUnlockFromStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t('common.backHome')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {t('achievements.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('achievements.subtitle')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <ul className="space-y-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = isUnlocked(a.id);
            return (
              <li
                key={a.id}
                className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${unlocked ? 'opacity-100' : 'opacity-70'}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                  aria-hidden
                >
                  {unlocked ? '✓' : '🔒'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{t(a.nameKey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(a.descKey)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <Link to="/" className="mt-8 block">
          <Button variant="outline">{t('common.backHome')}</Button>
        </Link>
      </main>
    </div>
  );
};

export default Achievements;
