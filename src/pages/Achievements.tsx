import { Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GPT_BANNER_ASSETS } from '@/assets/gptAssets';
import { VenueGameGlyph } from '@/components/home/VenueGameGlyph';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  checkAndUnlockFromStats,
  getAllAchievementProgresses,
  migrateLegacyArcadeStats,
} from '@/lib/achievements';
import { getGrowthOverview } from '@/lib/growth';

const Achievements = () => {
  const { t } = useLocale();
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    migrateLegacyArcadeStats();
    checkAndUnlockFromStats();
    setRefreshTick((tick) => tick + 1);
    const refresh = () => setRefreshTick((tick) => tick + 1);
    window.addEventListener(ACHIEVEMENT_UNLOCKED_EVENT, refresh);
    return () =>
      window.removeEventListener(ACHIEVEMENT_UNLOCKED_EVENT, refresh);
  }, []);

  const achievements = getAllAchievementProgresses();
  const growth = getGrowthOverview();

  return (
    <div className="venue-achievements lobby-page min-h-screen bg-background">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
        <section className="salon-page-banner salon-page-banner--achievements">
          {GPT_BANNER_ASSETS.leaderboard ? (
            <img
              src={GPT_BANNER_ASSETS.leaderboard}
              alt=""
              aria-hidden="true"
              className="salon-banner-art"
              fetchPriority="high"
              decoding="async"
            />
          ) : null}
          <div className="salon-banner-inner flex flex-wrap items-end justify-between gap-4">
            <div className="salon-banner-copy">
              <p className="play-eyebrow flex items-center gap-1.5">
                <Award className="size-3.5" />
                SALON HALL OF HONORS · 馆藏印鉴录
              </p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
                {t('achievements.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e8e3d5]">
                {t('achievements.subtitle')}
              </p>
            </div>
            <div className="salon-banner-actions flex items-center gap-2">
              <span className="salon-banner-pill">
                {growth.unlockedAchievements} / {growth.totalAchievements}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="salon-panel-card paper-texture rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              {t('achievements.totalPoints')}
            </p>
            <p className="mt-1.5 font-serif text-3xl font-semibold text-foreground tabular-nums">
              {growth.achievementPoints}
            </p>
          </div>
          <div className="salon-panel-card paper-texture rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              {t('achievements.taskPoints')}
            </p>
            <p className="mt-1.5 font-serif text-3xl font-semibold text-foreground tabular-nums">
              {growth.taskPoints}
            </p>
          </div>
          <div className="salon-panel-card paper-texture rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              {t('achievements.unlockedCount')}
            </p>
            <p className="mt-1.5 font-serif text-3xl font-semibold text-foreground tabular-nums">
              {growth.unlockedAchievements}/{growth.totalAchievements}
            </p>
          </div>
        </section>

        <div className="space-y-8">
          {(['riichi', 'mini', 'board', 'poker'] as const).map((group) => {
            const groupGames = games.filter((game) =>
              group === 'riichi'
                ? game.id === 'mahjong-japanese'
                : game.categoryId === group,
            );
            const entries = achievements.filter((achievement) =>
              groupGames.some((game) => game.id === achievement.gameId),
            );
            return (
              <section key={group} data-achievement-group={group}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {t(`arcade.group.${group}`)}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {
                      entries.filter((achievement) => achievement.unlocked)
                        .length
                    }
                    /{entries.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groupGames.map((game) => {
                    const own = entries.filter(
                      (achievement) => achievement.gameId === game.id,
                    );
                    return (
                      <details
                        key={game.id}
                        className="salon-panel-card paper-texture rounded-2xl border bg-card p-4"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold">
                          <span className="flex items-center gap-3 min-w-0">
                            <VenueGameGlyph
                              gameId={game.id}
                              className="salon-achievement-game-glyph"
                            />
                            <span className="truncate">
                              {t(`game.${game.id}.name`)}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full border border-[#cbb391]/55 bg-background/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                            {
                              own.filter((achievement) => achievement.unlocked)
                                .length
                            }
                            /{own.length}
                          </span>
                        </summary>
                        <ul className="mt-4 space-y-3">
                          {own.map((achievement) => {
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
                                      {t(
                                        `achievements.rarity.${achievement.rarity}`,
                                      )}
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
                                      style={{
                                        width: `${achievement.progressPercent}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <Link to="/" className="mt-8 block">
          <Button variant="outline">{t('common.backHome')}</Button>
        </Link>
      </main>
    </div>
  );
};

export default Achievements;
