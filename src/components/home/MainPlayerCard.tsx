import { ArrowRight, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PlayerAvatar } from '@/components/home/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import type { PlayerProfile } from '@/lib/playerProfile';
import { cn } from '@/lib/utils';

export type MainPlayerCardProps = {
  profile: PlayerProfile;
  titleLabel: string;
  totalPoints: number;
  unlockedAchievements: number;
  unlockedCharacterCount: number;
  className?: string;
};

export function MainPlayerCard({
  profile,
  titleLabel,
  totalPoints,
  unlockedAchievements,
  unlockedCharacterCount,
  className,
}: MainPlayerCardProps) {
  const { t } = useLocale();

  return (
    <article
      className={cn(
        'home-glass-panel home-hover-lift rounded-[26px] p-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both',
        className,
      )}
      style={{ animationDelay: '50ms' }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <PlayerAvatar profile={profile} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-emerald-700/80 uppercase">
              {t('home.mainPlayer.badge')}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">
              {profile.nickname}
            </h2>
            <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-emerald-300/60 bg-emerald-100/50 px-2.5 py-0.5 text-xs text-emerald-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] backdrop-blur-sm dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300 dark:shadow-none">
              <span className="mr-1 text-emerald-600 dark:text-emerald-400">✦</span>
              <span className="truncate">{titleLabel}</span>
            </div>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 border-slate-200/50 bg-white/50 backdrop-blur-sm transition-transform active:scale-95 dark:border-slate-700/50 dark:bg-slate-800/50"
        >
          <Link to="/profile" className="inline-flex items-center gap-1">
            <UserRound className="size-3.5" />
            {t('home.mainPlayer.openProfile')}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="group rounded-2xl border border-slate-100/50 bg-slate-50/50 px-3 py-2 transition-colors hover:bg-slate-100/80 dark:border-slate-800/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('home.hero.totalGrowthLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 transition-transform group-hover:scale-105 dark:text-slate-100">
            {totalPoints}
          </p>
        </div>
        <div className="group rounded-2xl border border-slate-100/50 bg-slate-50/50 px-3 py-2 transition-colors hover:bg-slate-100/80 dark:border-slate-800/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('home.hero.unlockedAchievementsLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 transition-transform group-hover:scale-105 dark:text-slate-100">
            {unlockedAchievements}
          </p>
        </div>
        <div className="group rounded-2xl border border-slate-100/50 bg-slate-50/50 px-3 py-2 transition-colors hover:bg-slate-100/80 dark:border-slate-800/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('home.hero.unlockedCharactersLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 transition-transform group-hover:scale-105 dark:text-slate-100">
            {unlockedCharacterCount}
          </p>
        </div>
      </div>
    </article>
  );
}
