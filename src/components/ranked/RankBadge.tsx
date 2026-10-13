import { Crown, Gem, Leaf, Sparkles, Sun } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { rankLimits, type Rank, type RankPoints } from '@/lib/ranked';
import './ranked.css';
const ICONS = {
  novice: Leaf,
  adept: Sparkles,
  expert: Gem,
  master: Crown,
  saint: Sun,
};
export function RankBadge({
  rank,
  large = false,
}: {
  rank: Rank;
  large?: boolean;
}) {
  const { locale, t } = useLocale();
  const Icon = ICONS[rank.band];
  return (
    <div
      className={`ranked-badge ${large ? 'ranked-badge--large' : ''}`}
      data-band={rank.band}
    >
      <span className="ranked-badge-icon">
        <Icon aria-hidden="true" />
        <span>{'◆'.repeat(rank.level)}</span>
      </span>
      <strong>
        {formatMessage(locale, 'ranked.rankName', {
          band: t(`character.rank.${rank.band}`),
          level: rank.level,
        })}
      </strong>
    </div>
  );
}
export function RankProgress({ rank }: { rank: RankPoints }) {
  const { t } = useLocale();
  const max = rankLimits(rank).max;
  const percent = Number.isFinite(max)
    ? Math.min(100, (rank.pt / max) * 100)
    : 100;
  return (
    <div className="ranked-progress">
      <div>
        <span>{t('ranked.points')}</span>
        <strong>
          {rank.pt.toLocaleString()} /{' '}
          {Number.isFinite(max) ? max.toLocaleString() : '∞'} pt
        </strong>
      </div>
      <div
        className="ranked-progress-track"
        role="progressbar"
        aria-label={t('ranked.points')}
        aria-valuenow={rank.pt}
        aria-valuemin={0}
        {...(Number.isFinite(max) ? { 'aria-valuemax': max } : {})}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
