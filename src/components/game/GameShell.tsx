import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

interface GameShellProps {
  /** 游戏名，显示在标题栏 */
  title: string;
  /** 一句话玩法说明，移动端隐藏以节省高度 */
  subtitle?: string;
  /** 标题栏右侧的状态区，通常放 StatPill */
  status?: ReactNode;
  /** 标题栏下方的操作条（难度、悔棋、重开等） */
  toolbar?: ReactNode;
  /** 主区域下方的辅助信息（操作提示、图例等） */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 棋牌类游戏的统一页面外壳：吸顶标题栏 + 操作条 + 居中舞台。
 * 统一了返回入口、状态展示位置和留白，避免每个游戏各写一套 header。
 */
export const GameShell = ({
  title,
  subtitle,
  status,
  toolbar,
  footer,
  children,
  className,
}: GameShellProps) => {
  const { t } = useLocale();

  return (
    <div className={cn('game-shell-ambient min-h-[100dvh]', className)}>
      <header className="game-shell-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link
            to="/"
            aria-label={t('common.backToList')}
            className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {subtitle}
              </p>
            )}
          </div>

          {status && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {status}
            </div>
          )}
        </div>

        {toolbar && (
          <div className="mx-auto max-w-5xl px-3 pb-2.5 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-3 py-4 sm:px-4 sm:py-6">
        {children}
        {footer && (
          <div className="mt-4 w-full max-w-xl text-center text-xs leading-6 text-muted-foreground">
            {footer}
          </div>
        )}
      </main>
    </div>
  );
};

interface StatPillProps {
  label: string;
  value: ReactNode;
  /** 高亮当前回合/关键状态 */
  tone?: 'default' | 'active' | 'danger' | 'success';
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatPillProps['tone']>, string> = {
  default: 'text-muted-foreground',
  active: 'border-emerald-500/45 bg-emerald-50/90 text-emerald-700',
  danger: 'border-rose-500/45 bg-rose-50/90 text-rose-700',
  success: 'border-sky-500/45 bg-sky-50/90 text-sky-700',
};

/** 标题栏里的状态胶囊：左标签右数值，数字等宽避免跳动 */
export const StatPill = ({
  label,
  value,
  tone = 'default',
  className,
}: StatPillProps) => (
  <span className={cn('game-pill', TONE_CLASS[tone], className)}>
    <span className="opacity-70">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </span>
);
