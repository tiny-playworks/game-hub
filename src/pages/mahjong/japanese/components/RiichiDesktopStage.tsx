import type { ReactNode } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import type { RiichiThemeId } from '../constants';

type Props = {
  theme: RiichiThemeId;
  children: ReactNode;
};

export function RiichiDesktopStage({ theme, children }: Props) {
  const { t } = useLocale();
  const { equipped } = useCosmetics();

  return (
    <div
      data-testid="riichi-desktop-stage"
      data-riichi-theme={theme}
      data-tile-back={equipped['tile-back']}
      data-table-felt={equipped['table-felt']}
      className="riichi-desktop-shell"
      role="application"
      aria-label={t('game.mahjong.desktopStageAria')}
    >
      <div className="riichi-desktop-stage">{children}</div>
    </div>
  );
}
