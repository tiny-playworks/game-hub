import { Flag, Trophy } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOptionalArcade } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { arcadeGuides } from '@/lib/arcadeGuide';

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
  isNewBest?: boolean;
  previousBest?: number | null;
}

const TONE_STYLE: Record<ResultTone, { ring: string; badge: string }> = {
  win: {
    ring: 'ring-gold/60',
    badge: 'bg-gold/20 text-foreground',
  },
  lose: {
    ring: 'ring-destructive/60',
    badge: 'bg-destructive/15 text-destructive',
  },
  draw: { ring: 'ring-wood/60', badge: 'bg-wood/15 text-foreground' },
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
  isNewBest,
  previousBest,
}: GameResultOverlayProps) => {
  const { t, locale } = useLocale();
  const arcade = useOptionalArcade();
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    card.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;

  const style = TONE_STYLE[tone];
  const game = games.find((item) => item.id === arcade?.gameId);
  const unitLabel = t(
    game?.bestMetric === 'wins'
      ? 'arcade.unit.streak'
      : (game?.bestUnitKey ?? 'arcade.unit.points'),
  );
  const standing = arcade?.result?.leaderboard;
  const guide = arcade?.gameId ? arcadeGuides[arcade.gameId] : undefined;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = card.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href]',
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="animate-overlay-in absolute inset-0 z-40 flex items-center justify-center rounded-[inherit] bg-slate-950/45 p-4 backdrop-blur-[3px]"
    >
      <div
        ref={card}
        className={cn(
          'game-result-card animate-overlay-card-in w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-2xl bg-card p-6 text-center shadow-2xl ring-1',
          style.ring,
        )}
      >
        <div className="game-result-emblem" aria-hidden="true">
          {tone === 'win' ? <Trophy /> : <Flag />}
        </div>
        <p
          className={cn(
            'mx-auto mb-3 inline-flex rounded-full px-3 py-1 text-xs font-medium',
            style.badge,
          )}
        >
          {t('common.gameResult')}
        </p>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {(isNewBest ?? arcade?.result?.isNewBest) && (
          <div className="mt-3 rounded-xl border border-gold bg-gold/15 p-3 text-sm">
            <strong className="text-gold">{t('arcade.newBest')}</strong>
            <p className="mt-1 text-muted-foreground">
              {previousBest ?? arcade?.result?.previousBest ?? '—'} →{' '}
              {arcade?.result?.currentBest ?? '—'} {unitLabel}
            </p>
          </div>
        )}
        {standing &&
          (standing.allTimeRank !== null || standing.weekRank !== null) && (
            <div
              data-testid="overlay-family-standing"
              className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs"
            >
              {standing.isFamilyRecord && (
                <p className="mb-1 font-semibold text-gold">
                  ★ {t('leaderboard.overlay.familyRecord')}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 font-medium text-foreground">
                {standing.allTimeRank !== null && (
                  <span>
                    {formatMessage(locale, 'leaderboard.overlay.allTimeRank', {
                      rank: standing.allTimeRank,
                    })}
                  </span>
                )}
                {standing.allTimeRank !== null &&
                  standing.weekRank !== null && (
                    <span className="text-muted-foreground">·</span>
                  )}
                {standing.weekRank !== null && (
                  <span>
                    {formatMessage(locale, 'leaderboard.overlay.weekRank', {
                      rank: standing.weekRank,
                    })}
                  </span>
                )}
              </div>
              {(standing.allTimeGapToPrevious !== null ||
                standing.weekGapToPrevious !== null) && (
                <p className="mt-1 text-muted-foreground">
                  {formatMessage(locale, 'leaderboard.overlay.gapToPrev', {
                    gap:
                      standing.weekGapToPrevious ??
                      standing.allTimeGapToPrevious ??
                      0,
                    unit: unitLabel,
                  })}
                </p>
              )}
              {arcade?.gameId && (
                <Link
                  to={`/leaderboard?game=${encodeURIComponent(arcade.gameId)}&difficulty=${encodeURIComponent(arcade.difficulty)}`}
                  className="mt-1.5 inline-block text-primary underline-offset-4 hover:underline"
                >
                  {t('leaderboard.overlay.viewBoard')}
                </Link>
              )}
            </div>
          )}
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
        {detail && (
          <div className="mt-4 rounded-xl bg-muted/40 p-3 text-left text-sm text-muted-foreground">
            {detail}
          </div>
        )}
        {guide && (
          <p className="game-result-tip">{t(`arcade.tip.${guide.tip}`)}</p>
        )}
        {arcade?.result?.settlementFailed && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {t('arcade.settlementFailed')}
          </p>
        )}
        {arcade?.result?.settlementPending && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('arcade.settlementPending')}
          </p>
        )}
        {arcade?.result &&
          !arcade.result.settlementFailed &&
          !arcade.result.settlementPending && (
            <p className="mt-3 text-sm text-primary">
              +{arcade.result.coinsEarned} {t('wallet.coins')}
              {arcade.result.capReached && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('arcade.capReached')}
                </span>
              )}
            </p>
          )}
        <div className="mt-5 flex flex-col gap-2">
          {arcade?.result?.settlementFailed && (
            <Button
              onClick={arcade.retrySettlement}
              disabled={arcade.settlementRetrying}
              className="w-full"
            >
              {t('arcade.retrySettlement')}
            </Button>
          )}
          <Button
            onClick={onRestart}
            disabled={arcade?.result?.settlementFailed}
            className="w-full"
          >
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
