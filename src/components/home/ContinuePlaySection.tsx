import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export type ContinuePlaySectionProps = {
  isRiichiActive: boolean;
  hasRecentMahjong: boolean;
  recentPlayedText: string;
  className?: string;
};

export function ContinuePlaySection({
  isRiichiActive,
  hasRecentMahjong,
  recentPlayedText,
  className,
}: ContinuePlaySectionProps) {
  const { t } = useLocale();

  const primaryHref = isRiichiActive
    ? '/game/mahjong-japanese'
    : '/game/mahjong-japanese?start=1';

  const primaryLabel = isRiichiActive
    ? t('home.continue.cta.active')
    : hasRecentMahjong
      ? t('home.continue.cta.resume')
      : t('home.continue.cta.start');

  const description = isRiichiActive
    ? t('home.continue.activeDescription')
    : hasRecentMahjong
      ? `${t('home.continue.lastPlayedPrefix')}${recentPlayedText}`
      : t('home.continue.emptyDescription');

  return (
    <article
      className={cn(
        'rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">
          {t('home.continue.title')}
        </p>
        <ArrowRight className="size-4 text-emerald-700" />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          asChild
          className="bg-emerald-900 text-white hover:bg-emerald-800"
        >
          <Link to={primaryHref}>{primaryLabel}</Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200">
          <Link to="/game/mahjong-japanese">{t('common.viewRules')}</Link>
        </Button>
        <Button asChild variant="ghost" className="px-0 text-slate-600">
          <Link to="/game/mahjong-japanese?start=1&guide=1">
            {t('common.beginnerGuide')}
          </Link>
        </Button>
      </div>
    </article>
  );
}
