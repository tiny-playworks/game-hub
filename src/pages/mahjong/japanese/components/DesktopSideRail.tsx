import {
  FileClock,
  Lightbulb,
  PanelRightClose,
  ReceiptText,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export type DesktopPanelId = 'hint' | 'settlement' | 'log';
export type ActiveDesktopPanel = DesktopPanelId | null;

type PanelDefinition = {
  id: DesktopPanelId;
  icon: typeof Lightbulb;
};

const PANELS: PanelDefinition[] = [
  { id: 'hint', icon: Lightbulb },
  { id: 'settlement', icon: ReceiptText },
  { id: 'log', icon: FileClock },
];

type Props = {
  activePanel: ActiveDesktopPanel;
  onPanelChange: (panel: ActiveDesktopPanel) => void;
  hasHint: boolean;
  hintContent: ReactNode;
  settlementContent: ReactNode;
  logContent: ReactNode;
};

export function DesktopSideRail({
  activePanel,
  onPanelChange,
  hasHint,
  hintContent,
  settlementContent,
  logContent,
}: Props) {
  const { t } = useLocale();
  const content =
    activePanel === 'hint'
      ? hintContent
      : activePanel === 'settlement'
        ? settlementContent
        : activePanel === 'log'
          ? logContent
          : null;

  return (
    <aside
      className={cn(
        'riichi-desktop-rail',
        activePanel && 'riichi-desktop-rail--open',
      )}
      aria-label={t('riichi.rail.label')}
    >
      <nav
        className="riichi-desktop-rail-nav"
        aria-label={t('riichi.rail.tools')}
      >
        {PANELS.map(({ id, icon: Icon }) => {
          const label = t(`riichi.rail.${id}`);
          const selected = activePanel === id;
          return (
            <button
              key={id}
              type="button"
              className={cn(
                'riichi-desktop-rail-button',
                selected && 'riichi-desktop-rail-button--active',
              )}
              onClick={() => onPanelChange(selected ? null : id)}
              aria-label={label}
              aria-pressed={selected}
              title={label}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              {id === 'hint' && hasHint && !selected && (
                <span
                  className="riichi-desktop-rail-dot"
                  role="img"
                  aria-label={t('riichi.rail.newHint')}
                />
              )}
            </button>
          );
        })}
      </nav>

      {activePanel && (
        <div className="riichi-desktop-panel">
          <header className="riichi-desktop-panel-header">
            <div>
              <p className="riichi-desktop-panel-kicker">RIICHI TRAINING</p>
              <h2>{t(`riichi.rail.${activePanel}`)}</h2>
            </div>
            <button
              type="button"
              onClick={() => onPanelChange(null)}
              className="riichi-desktop-panel-close"
              aria-label={t('riichi.rail.close')}
              title={t('riichi.rail.close')}
            >
              <PanelRightClose aria-hidden="true" size={20} />
            </button>
          </header>
          <div className="riichi-desktop-panel-body">{content}</div>
        </div>
      )}
    </aside>
  );
}
