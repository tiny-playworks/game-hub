import { useEffect } from 'react';
import { useRiichiSounds } from '@/hooks/useRiichiSounds';
import type { RiichiSound } from './engine';
import { subscribeRiichiEffects } from './store/riichiMatchStore';

export function useRiichiEffectSounds(): void {
  const sounds = useRiichiSounds();
  useEffect(() => {
    const players: Record<RiichiSound, () => void> = {
      discard: sounds.playDiscard,
      draw: sounds.playDraw,
      riichi: sounds.playRiichi,
      chi: sounds.playChi,
      pon: sounds.playPon,
      kan: sounds.playKan,
      tsumo: sounds.playTsumo,
      ron: sounds.playRon,
      ryuukyoku: sounds.playRyuukyoku,
    };
    return subscribeRiichiEffects((effects) => {
      for (const effect of effects) {
        if (effect.type === 'sound') players[effect.sound]();
      }
    });
  }, [sounds]);
}
