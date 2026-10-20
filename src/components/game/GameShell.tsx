import {
  ChevronLeft,
  Expand,
  Gamepad2,
  Lightbulb,
  Pause,
  Play,
  Settings,
  Target,
} from 'lucide-react';
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
import { useOptionalArcade } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import {
  ARCADE_REALTIME,
  arcadeDifficulties,
  difficultyLabelKey,
} from '@/lib/arcade';
import { updatePlayerProfile } from '@/lib/playerProfile';
import { arcadeGuides } from '@/lib/arcadeGuide';
import { cn } from '@/lib/utils';
import { PersonalBest } from './PersonalBest';
import { FamilyStandingPill } from './FamilyStandingPill';
import { SegmentedControl } from './SegmentedControl';
import './game-shell.css';

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
  const [guideExpanded, setGuideExpanded] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  );
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
  const guide = id ? arcadeGuides[id] : undefined;
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setGuideExpanded(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => {});
  };
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
      if (event.key.toLowerCase() === 'f' && !event.repeat) {
        event.preventDefault();
        toggleFullscreen();
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
      className={cn('game-shell-ambient game-shell min-h-[100dvh]', className)}
    >
      <header className="game-shell-header sticky top-0 z-30">
        <div className="game-shell-topbar">
          <Link
            to="/"
            aria-label={t('common.backToList')}
            className="game-shell-back"
          >
            <ChevronLeft className="size-5" />
            <span>{t('arcade.corner')}</span>
          </Link>

          <div className="game-shell-heading">
            <h1>{title}</h1>
          </div>

          <div className="game-shell-tools">
            {arcade && (
              <button
                type="button"
                className="game-shell-difficulty"
                onClick={() => openSettings(true)}
              >
                {t(difficultyLabelKey(arcade.gameId, arcade.difficulty))}
                <Settings className="size-3.5" />
              </button>
            )}
            {(arcade || onPause) && (
              <Button
                variant="outline"
                size="icon"
                aria-label={t(isPaused ? 'arcade.resume' : 'arcade.pause')}
                onClick={() => pause(!isPaused)}
                disabled={!!arcade?.result}
              >
                {isPaused ? (
                  <Play className="size-4" />
                ) : (
                  <Pause className="size-4" />
                )}
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
            <Button
              variant="ghost"
              size="icon"
              className="game-shell-fullscreen"
              aria-label={t('arcade.fullscreen')}
              onClick={toggleFullscreen}
            >
              <Expand className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className={cn('game-workspace', !guide && 'game-workspace-wide')}>
        <section className="game-play-column" aria-label={title}>
          <div className="game-session-bar">
            <div className="game-scoreboard">
              {status}
              {id && (
                <PersonalBest gameId={id} difficulty={arcade?.difficulty} />
              )}
            </div>
            {toolbar && <div className="game-session-actions">{toolbar}</div>}
          </div>
          <div className="game-stage">{children}</div>
          {footer && <div className="game-shell-footer">{footer}</div>}
        </section>
        {guide && (
          <aside className="game-guide">
            <div className="game-guide-goal">
              <p>
                <Target className="size-4" />
                {t('arcade.thisRound')}
              </p>
              <h2>{t(`arcade.goal.${guide.goal}`)}</h2>
            </div>
            <details
              className="game-guide-details"
              open={guideExpanded}
              onToggle={(event) => setGuideExpanded(event.currentTarget.open)}
            >
              <summary>
                <Gamepad2 className="size-4" />
                {t('arcade.howToPlay')}
              </summary>
              <div className="game-guide-content">
                <p>{subtitle}</p>
                <h3>{t('arcade.operation')}</h3>
                <p className="game-guide-inputs">
                  {t(`arcade.input.${guide.controls}`)}
                </p>
                <h3>
                  <Lightbulb className="size-4" />
                  {t('arcade.tip')}
                </h3>
                <p>{t(`arcade.tip.${guide.tip}`)}</p>
                <p className="game-guide-shortcuts">{t('arcade.controls')}</p>
                {id && (
                  <FamilyStandingPill
                    gameId={id}
                    difficulty={arcade?.difficulty}
                    standing={arcade?.result?.leaderboard}
                  />
                )}
              </div>
            </details>
          </aside>
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
  <span
    data-stat-tone={tone}
    className={cn('game-pill', TONE_CLASS[tone], className)}
  >
    <span className="opacity-70">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </span>
);
