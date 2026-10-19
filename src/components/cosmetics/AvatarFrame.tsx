import type { ReactNode } from 'react';
import woodFrame from '@/assets/cosmetics/avatar-frame-wood.webp';
import goldFrame from '@/assets/cosmetics/avatar-frame-gold.webp';
import sakuraFrame from '@/assets/cosmetics/avatar-frame-sakura.webp';
import rankFrame from '@/assets/cosmetics/avatar-frame-rank.webp';
import characterFrame from '@/assets/cosmetics/avatar-frame-character.webp';
import { useCosmetics } from '@/hooks/useCosmetics';
import { cn } from '@/lib/utils';

const frameArt: Record<string, string> = {
  'frame-wood': woodFrame,
  'frame-gold': goldFrame,
  'frame-sakura': sakuraFrame,
  'frame-rank-adept': rankFrame,
  'frame-rank-novice': rankFrame,
  'frame-rank-expert': rankFrame,
  'frame-rank-master': rankFrame,
  'frame-rank-saint': rankFrame,
  'frame-mio': characterFrame,
  'frame-koharu': characterFrame,
  'frame-rin': characterFrame,
  'frame-chitose': characterFrame,
  'frame-sora': characterFrame,
  'frame-aya': characterFrame,
  'frame-mahiru': characterFrame,
  'frame-yoru': characterFrame,
  'frame-tsubaki': characterFrame,
};

export function AvatarFrame({
  children,
  frame,
  className,
}: {
  children: ReactNode;
  frame?: string;
  className?: string;
}) {
  const cosmetics = useCosmetics();
  const selectedFrame = frame ?? cosmetics.equipped['avatar-frame'];
  return (
    <span
      className={cn('cosmetic-avatar-frame', className)}
      data-avatar-frame={selectedFrame}
    >
      {children}
      {frameArt[selectedFrame] && (
        <img
          className="cosmetic-avatar-frame-art"
          src={frameArt[selectedFrame]}
          alt=""
          aria-hidden="true"
        />
      )}
    </span>
  );
}
