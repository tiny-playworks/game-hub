import type { ReactNode } from 'react';
import type { RiichiThemeId } from '../constants';

type Props = {
  theme: RiichiThemeId;
  children: ReactNode;
};

export function RiichiMobileStage({ theme, children }: Props) {
  return (
    <div
      data-testid="riichi-mobile-stage"
      data-riichi-theme={theme}
      className="riichi-mobile-shell"
      role="application"
      aria-label="日本立直麻将游戏舞台"
    >
      <div className="riichi-phone-frame">
        <div className="riichi-safe-stage">{children}</div>
      </div>
    </div>
  );
}
