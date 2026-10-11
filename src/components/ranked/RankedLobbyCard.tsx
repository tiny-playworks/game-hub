import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { useRankedState } from '@/hooks/useRankedState';
import type { MatchLength } from '@/lib/ranked';
import { RankBadge, RankProgress } from './RankBadge';
import { RankedStartButton } from './RankedStartButton';
export function RankedLobbyCard() {
  const { t } = useLocale();
  const rank = useRankedState();
  const [length, setLength] = useState<MatchLength>('east');
  return <article className="ranked-lobby paper-texture flex flex-1 flex-col rounded-[28px] border border-wood/25 bg-card p-6 sm:p-8">
    <p className="text-xs tracking-[0.16em] text-muted-foreground">{t('lobby.rankedLabel')}</p>
    <div className="my-6 flex flex-1 flex-col items-center justify-center text-center"><RankBadge rank={rank} large /><p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{t('ranked.description')}</p></div>
    <RankProgress rank={rank} />
    <fieldset className="ranked-length" aria-label={t('riichi.lobby.matchLength')}>{(['east','south'] as const).map((value) => <button type="button" key={value} aria-pressed={length === value} onClick={() => setLength(value)}>{t(`ranked.length.${value}`)}</button>)}</fieldset>
    <RankedStartButton matchLength={length} />
    {rank.activeMatchId && <Link className="mt-3 text-center text-sm text-primary underline" to="/game/mahjong-japanese?resume=1">{t('ranked.resume')}</Link>}
  </article>;
}
