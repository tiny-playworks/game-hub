import { ChevronLeft, Pause, Settings } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { WalletBadge } from '@/components/WalletBadge';
import { useOptionalArcade } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import {
  ARCADE_REALTIME,
  arcadeDifficulties,
  difficultyLabelKey,
} from '@/lib/arcade';
import { updatePlayerProfile } from '@/lib/playerProfile';
import { cn } from '@/lib/utils';
import { PersonalBest } from './PersonalBest';
import { SegmentedControl } from './SegmentedControl';

interface GameShellProps {
  gameId?: string;
  paused?: boolean;
  onPause?: (paused: boolean) => void;
  onRestart?: () => void;
  settings?: ReactNode;
  autoStart?: boolean;
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
  gameId,
  paused,
  onPause,
  onRestart,
  settings,
  autoStart = true,
}: GameShellProps) => {
  const { t } = useLocale();
  const arcade = useOptionalArcade();
  const profile = usePlayerProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const beforeSettings = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const id = gameId ?? arcade?.gameId;
  const isPaused = paused ?? arcade?.paused ?? false;
  const pause = useCallback(
    (value: boolean) => {
      arcade?.setPaused(value);
      onPause?.(value);
    },
    [arcade?.setPaused, onPause],
  );
  const restart = onRestart ?? arcade?.restart;
  useEffect(() => {
    if (autoStart) arcade?.start();
  }, [autoStart, arcade?.start]);
  useEffect(() => {
    if (!arcade && !onPause) return;
    const key = (event: KeyboardEvent) => {
      if (
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          )) ||
        settingsOpen ||
        arcade?.result
      )
        return;
      if (
        event.key === 'Escape' ||
        event.code === 'Escape' ||
        event.key.toLowerCase() === 'p' ||
        event.code === 'KeyP'
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pause(!isPaused);
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else root.current?.requestFullscreen().catch(() => {});
      }
    };
    const blur = () => {
      if (id && ARCADE_REALTIME.has(id) && !arcade?.result) pause(true);
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  });
  const openSettings = (open: boolean) => {
    if (open) {
      beforeSettings.current = isPaused;
      pause(true);
    } else pause(beforeSettings.current);
    setSettingsOpen(open);
  };

  return (
    <div
      ref={root}
      data-game-shell={id}
      className={cn('game-shell-ambient min-h-[100dvh]', className)}
    >
      <header className="game-shell-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link
            to="/"
            aria-label={t('common.backToList')}
            className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/15 text-wood transition hover:bg-gold/30 hover:text-foreground active:scale-95"
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

          <div className="flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1.5 sm:max-w-none">
            <WalletBadge />
            {status}
            {id && <PersonalBest gameId={id} difficulty={arcade?.difficulty} />}
            {(arcade || onPause) && (
              <Button
                variant="outline"
                size="icon"
                aria-label={t('arcade.pause')}
                onClick={() => pause(!isPaused)}
                disabled={!!arcade?.result}
              >
                <Pause className="size-4" />
              </Button>
            )}
            {(arcade || settings) && (
              <Button
                variant="outline"
                size="icon"
                aria-label={t('arcade.settings')}
                onClick={() => openSettings(true)}
              >
                <Settings className="size-4" />
              </Button>
            )}
          </div>
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
      <Dialog
        open={isPaused && !settingsOpen && !arcade?.result}
        onOpenChange={(open) => pause(open)}
      >
        <DialogContent
          className="paper-texture rounded-3xl"
          showCloseButton={false}
        >
          <DialogTitle>{t('arcade.paused')}</DialogTitle>
          <DialogDescription>{t('arcade.pauseHint')}</DialogDescription>
          <Button onClick={() => pause(false)}>{t('arcade.resume')}</Button>
          {restart && (
            <Button variant="outline" onClick={restart}>
              {t('common.restart')}
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/">{t('common.backHome')}</Link>
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={openSettings}>
        <DialogContent className="paper-texture rounded-3xl">
          <DialogTitle>{t('arcade.settings')}</DialogTitle>
          <DialogDescription>{t('arcade.difficultyRestart')}</DialogDescription>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t('arcade.sound')}</span>
            <input
              type="checkbox"
              checked={profile.audioVolumes.sfx > 0}
              onChange={(event) =>
                updatePlayerProfile({
                  audioVolumes: {
                    ...profile.audioVolumes,
                    sfx: event.target.checked ? 0.8 : 0,
                  },
                })
              }
            />
          </label>
          {arcade && (
            <div>
              <p className="mb-3 text-sm font-semibold">
                {t('common.difficulty')}
              </p>
              <SegmentedControl
                ariaLabel={t('common.difficulty')}
                value={arcade.difficulty}
                onChange={arcade.changeDifficulty}
                options={arcadeDifficulties(arcade.gameId).map((value) => ({
                  value,
                  label: t(difficultyLabelKey(arcade.gameId, value)),
                }))}
              />
              {arcade.settingsError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {t('save.failed')}
                </p>
              )}
            </div>
          )}
          {settings}
          <div className="rounded-xl bg-muted p-4 text-sm leading-6">
            <p>{subtitle}</p>
            <p className="mt-2 text-muted-foreground">{t('arcade.controls')}</p>
          </div>
          <Button onClick={() => openSettings(false)}>
            {t('arcade.resume')}
          </Button>
        </DialogContent>
      </Dialog>
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
  active: 'border-primary/40 bg-primary/10 text-primary',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  success: 'border-gold/40 bg-gold/15 text-wood',
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
