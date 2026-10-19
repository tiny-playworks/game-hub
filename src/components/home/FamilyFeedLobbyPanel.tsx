import { ArrowRight, Award, Crown, Flame, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatFamilyFeedItem } from '@/lib/formatFamilyFeed';
import { fetchFamilyFeed } from '@/lib/household/api';
import type { FamilyFeedItem } from '../../../shared/contracts/leaderboard';

export function FamilyFeedLobbyPanel() {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const isOnlineMember = Boolean(
    household?.currentMember && household?.isServerAvailable,
  );
  const [items, setItems] = useState<FamilyFeedItem[]>([]);

  useEffect(() => {
    if (!isOnlineMember) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetchFamilyFeed(5)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnlineMember, household?.snapshot?.revision]);

  return (
    <section
      className="venue-task-panel venue-family-feed"
      data-testid="home-family-feed"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Trophy className="size-4 text-gold" />
          {t('leaderboard.feed.title')}
        </h3>
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {t('leaderboard.feed.viewAll')}
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {!isOnlineMember ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('leaderboard.memberOnly.title')}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('leaderboard.feed.empty')}
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0 text-gold">
                {item.kind === 'weekly-champion' ? (
                  <Award className="size-3.5" />
                ) : item.kind === 'family-cup' ? (
                  <Crown className="size-3.5" />
                ) : (
                  <Flame className="size-3.5" />
                )}
              </span>
              <span className="line-clamp-2 text-foreground/90">
                {formatFamilyFeedItem(item, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
