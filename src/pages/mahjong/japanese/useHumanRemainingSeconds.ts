import { useEffect, useState } from 'react';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import { getPendingSeats } from './engine';
import { useRiichiStore } from './store/riichiMatchStore';

/** 仅由计时组件订阅，时钟跳动不触发牌桌重新渲染。 */
export function useHumanRemainingSeconds(): number | null {
  const clock = useRiichiStore((s) => s.decisionClock);
  const bank = useRiichiStore((s) => s.match?.round.timeBanks[0] ?? 0);
  const active = useRiichiStore((s) =>
    s.view === 'game' && !s.replay && s.match?.status === 'playing'
      ? getPendingSeats(s.match.round).includes(0)
      : false,
  );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || !clock) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, clock]);
  if (!active || !clock) return null;
  return Math.max(
    0,
    Math.ceil(
      getTurnTotalSeconds(bank) -
        (Math.max(now, clock.startedAt) - clock.startedAt) / 1000,
    ),
  );
}
