import type { ReactNode } from 'react';
import { useCosmetics } from '@/hooks/useCosmetics';
import { cn } from '@/lib/utils';

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
  return (
    <span
      className={cn('cosmetic-avatar-frame', className)}
      data-avatar-frame={frame ?? cosmetics.equipped['avatar-frame']}
    >
      {children}
    </span>
  );
}
