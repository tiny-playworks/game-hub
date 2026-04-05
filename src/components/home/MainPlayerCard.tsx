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
        'rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]',
        className,
      )}
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
            <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-800">
              <span className="mr-1 text-emerald-600">✦</span>
              <span className="truncate">{titleLabel}</span>
            </div>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 border-slate-200"
        >
          <Link to="/profile" className="inline-flex items-center gap-1">
            <UserRound className="size-3.5" />
            {t('home.mainPlayer.openProfile')}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-2">
          <p className="text-[11px] text-slate-500">
            {t('home.hero.totalGrowthLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
            {totalPoints}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-2">
          <p className="text-[11px] text-slate-500">
            {t('home.hero.unlockedAchievementsLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
            {unlockedAchievements}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-2">
          <p className="text-[11px] text-slate-500">
            {t('home.hero.unlockedCharactersLabel')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
            {unlockedCharacterCount}
          </p>
        </div>
      </div>
    </article>
  );
}
