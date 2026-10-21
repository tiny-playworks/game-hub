import { useCallback, useEffect, useRef } from 'react';
import type { CosmeticMotionCue } from '@/lib/cosmeticMedia';
import { getPlayerProfile, subscribePlayerProfile } from '@/lib/playerProfile';
import { playCosmeticCue } from '@/lib/riichiAudio';

/** Each animation owns its sounds so skipping it never stops another player's announcement. */
export function useCosmeticAudio(id: string, enabled: boolean) {
  const stops = useRef<Array<() => void>>([]);
  const stop = useCallback(() => {
    for (const cancel of stops.current) cancel();
    stops.current = [];
  }, []);
  const cue = useCallback((marker: CosmeticMotionCue) => {
    if (!enabled) return;
    stops.current.push(playCosmeticCue(id, marker.phase, getPlayerProfile().audioVolumes.sfx));
  }, [id, enabled]);
  useEffect(() => {
    if (!enabled) { stop(); return; }
    const unsubscribe = subscribePlayerProfile(() => {
      if (getPlayerProfile().audioVolumes.sfx <= 0) stop();
    });
    return () => { unsubscribe(); stop(); };
  }, [id, enabled, stop]);
  return { cue, stop };
}
