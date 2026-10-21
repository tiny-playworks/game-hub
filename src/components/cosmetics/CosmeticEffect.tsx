import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useCosmeticAudio } from '@/hooks/useCosmeticAudio';
import { getCosmeticMotion, type CosmeticMotionCue } from '@/lib/cosmeticMedia';
import { IllustratedCosmeticEffect } from './IllustratedCosmeticEffect';

/** All cosmetic effects share the painted-frame player in the shop and a match. */
export function CosmeticEffect({
  id,
  kind,
  still = false,
  onComplete,
  audible = false,
  onCue,
}: {
  id: string;
  kind: 'riichi' | 'win';
  still?: boolean;
  onComplete?: () => void;
  audible?: boolean;
  onCue?: (cue: CosmeticMotionCue) => void;
}) {
  const reduced = useReducedMotion();
  const motion = getCosmeticMotion(id) ?? getCosmeticMotion(`${kind}-default`);
  const audio = useCosmeticAudio(id, audible && !still && !reduced);
  if (!motion) return null;
  return (
    <IllustratedCosmeticEffect
      key={id}
      asset={motion}
      id={id}
      kind={kind}
      still={still || reduced}
      onComplete={onComplete}
      onCue={(marker) => { audio.cue(marker); onCue?.(marker); }}
      onPlaybackStop={audio.stop}
    />
  );
}
