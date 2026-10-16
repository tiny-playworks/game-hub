import { useEffect, useState } from 'react';
import type { RiichiTurnTimeLimit } from '@/lib/playerProfile';
import { getDecisionTotalSeconds } from '@/lib/riichiClock';
import { getPendingSeats } from './engine';
import { useRiichiStore } from './store/riichiMatchStore';

/** 仅由计时组件订阅，时钟跳动不触发牌桌重新渲染。 */
export function useHumanRemainingSeconds(
  turnTimeLimit: RiichiTurnTimeLimit = 'standard',
): number | null {
  const clock = useRiichiStore((s) => s.decisionClock);
  const bank = useRiichiStore((s) => s.match?.round.timeBanks[0] ?? 0);
  const phase = useRiichiStore((s) => s.match?.round.phase ?? 'discard');
  const active = useRiichiStore((s) =>
    s.view === 'game' &&
    !s.replay &&
    !s.showGuide &&
    !s.showMenu &&
    s.cutIns.length === 0 &&
    s.match?.status === 'playing'
      ? getPendingSeats(s.match.round).includes(0)
      : false,
  );
  const totalSeconds = getDecisionTotalSeconds(bank, phase, turnTimeLimit);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || !clock || totalSeconds === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, clock, totalSeconds]);
  if (!active || !clock || totalSeconds === null) return null;
  return Math.max(
    0,
    Math.ceil(
      totalSeconds - (Math.max(now, clock.startedAt) - clock.startedAt) / 1000,
    ),
  );
}
