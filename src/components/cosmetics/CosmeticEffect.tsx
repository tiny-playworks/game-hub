import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getCosmeticMotion } from '@/lib/cosmeticMedia';
import { IllustratedCosmeticEffect } from './IllustratedCosmeticEffect';

/** All cosmetic effects share the painted-frame player in the shop and a match. */
export function CosmeticEffect({
  id,
  kind,
  still = false,
  onComplete,
}: {
  id: string;
  kind: 'riichi' | 'win';
  still?: boolean;
  onComplete?: () => void;
}) {
  const reduced = useReducedMotion();
  const motion = getCosmeticMotion(id) ?? getCosmeticMotion(`${kind}-default`);
  if (!motion) return null;
  return (
    <IllustratedCosmeticEffect
      key={id}
      asset={motion}
      id={id}
      kind={kind}
      still={still || reduced}
      onComplete={onComplete}
    />
  );
}
