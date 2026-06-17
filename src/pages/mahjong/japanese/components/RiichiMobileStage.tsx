import type { ReactNode } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import type { RiichiThemeId } from '../constants';

type Props = {
  theme: RiichiThemeId;
  children: ReactNode;
};

export function RiichiMobileStage({ theme, children }: Props) {
  const { t } = useLocale();
  return (
    <div
      data-testid="riichi-mobile-stage"
      data-riichi-theme={theme}
      className="riichi-mobile-shell"
      role="application"
      aria-label={t('game.mahjong.mobileStageAria')}
    >
      <div className="riichi-phone-frame">
        <div className="riichi-safe-stage">{children}</div>
      </div>
    </div>
  );
}
