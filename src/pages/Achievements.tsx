import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  checkAndUnlockFromStats,
  getAllAchievementProgresses,
} from '@/lib/achievements';
import { getGrowthOverview } from '@/lib/growth';

const Achievements = () => {
  const { t } = useLocale();
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    checkAndUnlockFromStats();
    setRefreshTick((tick) => tick + 1);
  }, []);

  const achievements = getAllAchievementProgresses();
  const growth = getGrowthOverview();

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
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t('achievements.totalPoints')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {growth.achievementPoints}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t('achievements.taskPoints')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {growth.taskPoints}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t('achievements.unlockedCount')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {growth.unlockedAchievements}/{growth.totalAchievements}
            </p>
          </div>
        </section>

        <ul className="space-y-3">
          {achievements.map((achievement) => {
            const unlocked = achievement.unlocked;
            return (
              <li
                key={achievement.id}
                className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${unlocked ? 'opacity-100' : 'opacity-70'}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                  aria-hidden
                >
                  {unlocked ? '✓' : '🔒'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {t(achievement.nameKey)}
                    </p>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t(`achievements.rarity.${achievement.rarity}`)}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {t('achievements.pointsLabel')}
                      {achievement.points}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(achievement.descKey)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('achievements.progressLabel')}
                    {achievement.current}/{achievement.target}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-600 transition-[width]"
                      style={{ width: `${achievement.progressPercent}%` }}
                    />
                  </div>
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
