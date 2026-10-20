import { useEffect, useState } from 'react';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { getFamilyHeadToHead } from '@/lib/household/gameRoomClient';
import { formatMessage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { FamilyHeadToHead as Matchup } from '../../../shared/contracts/gameRoom';

export function FamilyHeadToHead({ revision = 0 }: { revision?: number }) {
  const household = useOptionalHousehold();
  const { t, locale } = useLocale();
  const [items, setItems] = useState<Matchup[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const memberId = household?.mode === 'member-online' ? household.currentMember?.id : undefined;
  useEffect(() => {
    let disposed = false;
    if (!memberId) { setItems([]); return; }
    void getFamilyHeadToHead().then((data) => { if (!disposed) { setItems(data); setFailed(false); } })
      .catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [memberId, revision, retry]);
  if (!memberId) return null;
  return <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <h2 className="mb-3 font-semibold">{t('gameRoom.headToHead')}</h2>
    {failed ? <div className="flex items-center justify-between gap-2 text-sm"><p>{t('gameRoom.error.NETWORK')}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>{t('family.lobby.retry')}</Button></div>
      : items.length === 0 ? <p className="text-sm text-muted-foreground">{t('gameRoom.noHistory')}</p>
        : <div className="divide-y divide-border">{items.map((item) => <div key={`${item.gameId}:${item.opponentId}:${item.relation}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <span><strong>{item.opponentNickname}</strong><span className="ml-2 text-muted-foreground">{t(`game.${item.gameId}.name`)}{item.relation !== 'duel' ? ` · ${t(item.relation === 'team' ? 'gameRoom.team' : 'gameRoom.opponentRelation')}` : ''}</span></span>
          <span className="font-mono tabular-nums">{formatMessage(locale, 'gameRoom.record', { wins: item.wins, losses: item.losses, draws: item.draws })}</span>
        </div>)}</div>}
  </section>;
}
