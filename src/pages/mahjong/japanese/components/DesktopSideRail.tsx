import type { ReactNode } from 'react';
import {
  FileClock,
  Lightbulb,
  PanelRightClose,
  ReceiptText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type DesktopPanelId = 'hint' | 'settlement' | 'log';
export type ActiveDesktopPanel = DesktopPanelId | null;

type PanelDefinition = {
  id: DesktopPanelId;
  label: string;
  icon: typeof Lightbulb;
};

const PANELS: PanelDefinition[] = [
  { id: 'hint', label: '训练提示', icon: Lightbulb },
  { id: 'settlement', label: '上一局', icon: ReceiptText },
  { id: 'log', label: '牌局记录', icon: FileClock },
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
      aria-label="训练侧栏"
    >
      <nav className="riichi-desktop-rail-nav" aria-label="训练工具">
        {PANELS.map(({ id, label, icon: Icon }) => {
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
                  aria-label="有新提示"
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
              <h2>{PANELS.find((panel) => panel.id === activePanel)?.label}</h2>
            </div>
            <button
              type="button"
              onClick={() => onPanelChange(null)}
              className="riichi-desktop-panel-close"
              aria-label="收起侧栏"
              title="收起侧栏"
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
