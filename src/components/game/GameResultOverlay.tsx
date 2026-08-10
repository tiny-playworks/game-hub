import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export type ResultTone = 'win' | 'lose' | 'draw';

interface GameResultOverlayProps {
  open: boolean;
  tone: ResultTone;
  title: string;
  /** 副标题，例如比分、用时、步数 */
  description?: ReactNode;
  /** 结算明细，例如提子数、剩余牌数 */
  detail?: ReactNode;
  onRestart: () => void;
  restartLabel?: string;
  /** 额外操作，例如「复盘」 */
  extraAction?: ReactNode;
}

const TONE_STYLE: Record<ResultTone, { ring: string; badge: string }> = {
  win: {
    ring: 'ring-emerald-400/60',
    badge: 'bg-emerald-500/12 text-emerald-700',
  },
  lose: { ring: 'ring-rose-400/60', badge: 'bg-rose-500/12 text-rose-700' },
  draw: { ring: 'ring-slate-400/60', badge: 'bg-slate-500/12 text-slate-700' },
};

/**
 * 统一的对局结算弹层：覆盖在棋盘/牌桌上方，而不是只把结果塞进标题栏。
 * 用 `absolute inset-0`，所以父容器必须是 `relative`。
 */
export const GameResultOverlay = ({
  open,
  tone,
  title,
  description,
  detail,
  onRestart,
  restartLabel,
  extraAction,
}: GameResultOverlayProps) => {
  const { t } = useLocale();
  if (!open) return null;

  const style = TONE_STYLE[tone];

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="animate-overlay-in absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-slate-950/45 p-4 backdrop-blur-[3px]"
    >
      <div
        className={cn(
          'animate-overlay-card-in w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl ring-4',
          style.ring,
        )}
      >
        <p
          className={cn(
            'mx-auto mb-3 inline-flex rounded-full px-3 py-1 text-xs font-medium',
            style.badge,
          )}
        >
          {t('common.gameResult')}
        </p>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-slate-600">{description}</p>
        )}
        {detail && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-left text-sm text-slate-600">
            {detail}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={onRestart} className="w-full">
            {restartLabel ?? t('common.playAgain')}
          </Button>
          {extraAction}
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/">{t('common.backList')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
