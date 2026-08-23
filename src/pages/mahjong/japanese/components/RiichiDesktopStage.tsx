import type { ReactNode } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import type { RiichiThemeId } from '../constants';

type Props = {
  theme: RiichiThemeId;
  children: ReactNode;
};

export function RiichiDesktopStage({ theme, children }: Props) {
  const { t } = useLocale();

  return (
    <div
      data-testid="riichi-desktop-stage"
      data-riichi-theme={theme}
      className="riichi-desktop-shell"
      role="application"
      aria-label={t('game.mahjong.desktopStageAria')}
    >
      <div className="riichi-desktop-stage">{children}</div>
    </div>
  );
}
