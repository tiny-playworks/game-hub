import { Play } from 'lucide-react';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/home/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import type { CosmeticDef } from '@/lib/cosmetics';
import { getPlayerProfile } from '@/lib/playerProfile';
import { AvatarFrame } from './AvatarFrame';
import { CosmeticEffect } from './CosmeticEffect';

export function CosmeticPreview({
  item,
  compact = false,
}: {
  item: CosmeticDef;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const cosmetics = useCosmetics();
  const [play, setPlay] = useState(0);
  const back =
    item.category === 'tile-back' ? item.id : cosmetics.equipped['tile-back'];
  const felt =
    item.category === 'table-felt' ? item.id : cosmetics.equipped['table-felt'];
  const effect =
    item.category === 'riichi-effect' || item.category === 'win-effect';
  return (
    <div
      className={compact ? 'cosmetic-preview is-compact' : 'cosmetic-preview'}
      data-tile-back={back}
      data-table-felt={felt}
    >
      <div className="cosmetic-mini-table">
        {item.category === 'avatar-frame' ? (
          <AvatarFrame frame={item.id}>
            <PlayerAvatar
              profile={getPlayerProfile()}
              size={compact ? 'sm' : 'lg'}
              framed={false}
            />
          </AvatarFrame>
        ) : (
          <>
            {!effect && <span className="cosmetic-mini-center">東</span>}
            <div className="cosmetic-mini-hand">
              {Array.from({ length: compact ? 3 : 5 }, (_, index) => (
                <span className="cosmetic-sample-back" key={index}>
                  <i />
                </span>
              ))}
            </div>
          </>
        )}
        {effect && (
          <CosmeticEffect
            key={`${item.id}:${play}`}
            id={item.id}
            kind={item.category === 'riichi-effect' ? 'riichi' : 'win'}
            still={compact}
          />
        )}
      </div>
      {effect && !compact && (
        <Button
          className="mt-4 w-full"
          variant="outline"
          onClick={() => setPlay((value) => value + 1)}
        >
          <Play className="size-4" />
          {t('shop.playPreview')}
        </Button>
      )}
    </div>
  );
}
