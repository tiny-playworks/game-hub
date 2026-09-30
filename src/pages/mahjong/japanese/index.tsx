import { ArrowRight, Copy, Info, TimerReset } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { formatMessage, type Locale } from '@/lib/i18n';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import { markRecentMahjongPlayed } from '@/lib/recentMahjong';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import { getCurrentRiichiRoundProgressSummary } from '@/lib/riichiProgress';
import { preloadRiichiRules } from '@/lib/riichiRules';
import { cn } from '@/lib/utils';
import { CenterArea } from './components/CenterArea';
import {
  type ActiveDesktopPanel,
  DesktopSideRail,
} from './components/DesktopSideRail';
import { GameHeader } from './components/GameHeader';
import { GuidePanel } from './components/GuidePanel';
import { MeldTiles } from './components/MeldTiles';
import { MatchEndModal, RyuukyokuModal, WinModal } from './components/Modals';
import { OpponentSeat } from './components/OpponentSeat';
import { ReplayViewer } from './components/ReplayViewer';
import { RiichiDesktopStage } from './components/RiichiDesktopStage';
import { RulesView } from './components/RulesView';
import { StatusPanel } from './components/StatusPanel';
import { TableContextPanel } from './components/TableContextPanel';
import { RiichiTile } from './components/Tile';
import {
  isReplayFile,
  type RiichiEvent,
  restoreMatch,
  toReplayFile,
} from './engine';
import { dangerFor, threatOf, visibleCountsFor } from './engine/ai';
import {
  formatLogEntry,
  formatPoints,
  getSeatWind,
  toMeldKeyedItems,
  toTileKeyedItems,
} from './helpers';
import { loadLastReplay } from './store/persistence';
import { hasResumableMatch, useRiichiStore } from './store/riichiMatchStore';
import type { ClaimResponse, RiichiGameState } from './types';
import { useHumanRemainingSeconds } from './useHumanRemainingSeconds';
import {
  humanDecisionKey,
  useRiichiAutomation,
  withElapsed,
} from './useRiichiAutomation';
import { useRiichiDialogFocus } from './useRiichiDialogFocus';
import { useRiichiEffectSounds } from './useRiichiEffectSounds';
import { useRiichiTheme } from './useRiichiTheme';
import { useRiichiViewModel } from './useRiichiViewModel';

export { getNextRound } from './helpers';

type RiichiGameBag = ReturnType<typeof useRiichiViewModel>;

function formatChiTripleLabel(
  option: [number, number],
  lastDiscard: number | null,
  locale: Locale,
): string {
  if (lastDiscard === null) {
    return option.map((tile) => getTileLabel(tile, locale)).join(' ');
  }
  return [...option, lastDiscard]
    .sort(
      (left, right) => getBaseTile(left) - getBaseTile(right) || left - right,
    )
    .map((tile) => getTileLabel(tile, locale))
    .join(' ');
}

type RiichiActionState = {
  isMyClaim: boolean;
  chiOptions: [number, number][];
  canPeng: boolean | null;
  canMingang: boolean | null;
  canRon: boolean | null;
  isMyTurn: boolean;
  canTsumo: boolean | null;
  canDeclareRiichi: boolean;
  canKyuushuKyuuhai: boolean;
  angangOptions: number[][];
  kakanOptions: number[];
  riichiSelecting: boolean;
  discardable: number[];
  pendingCall: string | null;
};

type RiichiActionHandlers = {
  doRon: () => void;
  doChi: (option: [number, number]) => void;
  doPeng: () => void;
  doMingang: () => void;
  passClaim: () => void;
  doTsumo: () => void;
  doRiichi: () => void;
  doKyuushuKyuuhai: () => void;
  doAngang: (option: number[]) => void;
  doKakan: (meldIndex: number) => void;
};

type RiichiActionPanelProps = {
  game: RiichiGameState;
  locale: Locale;
  state: RiichiActionState;
  handlers: RiichiActionHandlers;
};

function RiichiActionPanel({
  game,
  locale,
  state,
  handlers,
}: RiichiActionPanelProps) {
  const { t } = useLocale();
  const claimActionsAvailable =
    state.canRon ||
    (state.isMyClaim &&
      (state.chiOptions.length > 0 || state.canPeng || state.canMingang));
  const turnActionsAvailable =
    state.isMyTurn &&
    (state.canTsumo ||
      state.canDeclareRiichi ||
      state.canKyuushuKyuuhai ||
      state.angangOptions.length > 0 ||
      state.kakanOptions.length > 0);

  if (!claimActionsAvailable && !turnActionsAvailable) return null;

  return (
    <div
      className="riichi-action-dock"
      role="toolbar"
      aria-label={t('riichi.action.available')}
    >
      {claimActionsAvailable && game.claim != null && (
        <div className="riichi-action-target">
          <RiichiTile tile={game.claim.tile} variant="river" />
          <span>
            {t(`game.mahjong.seats.${game.claim.from}`)} ·{' '}
            {t(
              game.claim.kind === 'discard'
                ? 'riichi.action.discard'
                : 'riichi.action.chankan',
            )}
          </span>
        </div>
      )}
      <div className="riichi-action-buttons">
        {claimActionsAvailable && (
          <>
            {state.canRon && (
              <button
                type="button"
                className="riichi-action-button is-primary"
                onClick={handlers.doRon}
              >
                {t('riichi.ron')}
              </button>
            )}
            {state.isMyClaim &&
              state.chiOptions.map((option) => (
                <button
                  type="button"
                  className="riichi-action-button is-secondary"
                  key={option.join('-')}
                  onClick={() => handlers.doChi(option)}
                >
                  {t('riichi.chi')}
                  <small>
                    {formatChiTripleLabel(
                      option,
                      game.claim?.tile ?? null,
                      locale,
                    )}
                  </small>
                </button>
              ))}
            {state.isMyClaim && state.canPeng && (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                onClick={handlers.doPeng}
              >
                {t('riichi.peng')}
              </button>
            )}
            {state.isMyClaim && state.canMingang && (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                onClick={handlers.doMingang}
              >
                {t('riichi.mingang')}
              </button>
            )}
            <button
              type="button"
              className="riichi-action-button is-pass"
              onClick={handlers.passClaim}
            >
              {t('riichi.pass')}
            </button>
          </>
        )}

        {turnActionsAvailable && (
          <>
            {state.canTsumo && (
              <button
                type="button"
                className="riichi-action-button is-primary"
                onClick={handlers.doTsumo}
              >
                {t('riichi.tsumo')}
              </button>
            )}
            {state.canDeclareRiichi && (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                onClick={handlers.doRiichi}
                aria-pressed={state.riichiSelecting}
              >
                {t(
                  state.riichiSelecting
                    ? 'riichi.action.cancelRiichi'
                    : 'riichi.declareRiichi',
                )}
              </button>
            )}
            {state.canKyuushuKyuuhai && (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                onClick={handlers.doKyuushuKyuuhai}
              >
                {t('riichi.kyuushu')}
              </button>
            )}
            {state.angangOptions.map((option) => (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                key={option.join('-')}
                onClick={() => handlers.doAngang(option)}
              >
                {t('riichi.angang')}
                <small>{getTileLabel(option[0], locale)}</small>
              </button>
            ))}
            {state.kakanOptions.map((meldIndex) => (
              <button
                type="button"
                className="riichi-action-button is-secondary"
                key={meldIndex}
                onClick={() => handlers.doKakan(meldIndex)}
              >
                {t('riichi.kakan')}
                <small>
                  {formatMessage(locale, 'riichi.action.meldGroup', {
                    index: meldIndex + 1,
                  })}
                </small>
              </button>
            ))}
          </>
        )}
      </div>
      {state.pendingCall && (
        <p role="status">{t('riichi.action.confirmCall')}</p>
      )}
    </div>
  );
}

function GuideDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const restoreFocus = useRiichiDialogFocus();
  const container = document.querySelector<HTMLElement>('[data-riichi-theme]');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        onCloseAutoFocus={restoreFocus}
        className="riichi-guide-dialog-content !w-[min(1120px,calc(100vw-40px))] !max-w-none"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('riichi.guide.title')}</DialogTitle>
        <GuidePanel onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function HumanTurnTimer({ timeBank }: { timeBank: number }) {
  const { t } = useLocale();
  const seconds = useHumanRemainingSeconds();
  if (seconds === null) return null;
  return (
    <div className="riichi-self-clock">
      <div
        className="riichi-self-timer"
        role="progressbar"
        aria-label={t('riichi.action.remainingTime')}
        aria-valuemin={0}
        aria-valuemax={getTurnTotalSeconds(timeBank)}
        aria-valuenow={seconds}
      >
        <span
          className={
            seconds <= 3
              ? 'is-critical'
              : seconds <= 8
                ? 'is-warning'
                : 'is-safe'
          }
          style={{
            width: `${Math.min(100, (seconds / getTurnTotalSeconds(timeBank)) * 100)}%`,
          }}
        />
      </div>
      <span>
        {t('riichi.action.remainingTime')} {seconds}s
      </span>
    </div>
  );
}

type SelfSeatProps = {
  game: RiichiGameState;
  locale: Locale;
  decisionSeat: number | null;
  myFuritenReason: string | null;
  actionState: RiichiActionState;
  actionHandlers: RiichiActionHandlers;
  discard: (seat: number, tile: number) => void;
  highlightedBase: number | null;
  onHighlight: (base: number | null) => void;
  dangerHint: boolean;
};

function SelfSeat({
  game,
  locale,
  decisionSeat,
  myFuritenReason,
  actionState,
  actionHandlers,
  discard,
  highlightedBase,
  onHighlight,
  dangerHint,
}: SelfSeatProps) {
  const { t } = useLocale();
  const handItems = toTileKeyedItems(game.hands[0], 'self-hand');
  let drawnIndex = -1;
  if (actionState.isMyTurn && game.drawnTile != null) {
    for (let index = handItems.length - 1; index >= 0; index--) {
      if (handItems[index].tile === game.drawnTile) {
        drawnIndex = index;
        break;
      }
    }
  }
  const concealedItems = handItems.filter((_, index) => index !== drawnIndex);
  const drawnItem = drawnIndex >= 0 ? handItems[drawnIndex] : null;
  const seatWind = getSeatWind(game.roundWind, 0, game.dealer);
  const canDiscard = actionState.isMyTurn;
  const visible = visibleCountsFor(game, 0);
  const hasThreat = [1, 2, 3].some((seat) => threatOf(game, seat) > 0);
  const dangerOf = (tile: number): 'safe' | 'medium' | 'high' | undefined => {
    if (!dangerHint || !hasThreat) return undefined;
    const score = dangerFor(game, 0, tile, visible);
    return score < 0.2 ? 'safe' : score < 0.8 ? 'medium' : 'high';
  };

  const renderHandTile = (
    item: { tile: number; key: string },
    drawn: boolean,
  ) => {
    const danger = dangerOf(item.tile);
    return (
      <RiichiTile
        key={item.key}
        tile={item.tile}
        variant="hand"
        state={
          !actionState.discardable.includes(item.tile)
            ? 'disabled'
            : drawn
              ? 'drawn'
              : 'normal'
        }
        onClick={canDiscard ? () => discard(0, item.tile) : undefined}
        onFocus={() => onHighlight(getBaseTile(item.tile))}
        onBlur={() => onHighlight(null)}
        onPointerEnter={() => onHighlight(getBaseTile(item.tile))}
        onPointerLeave={() => onHighlight(null)}
        highlighted={getBaseTile(item.tile) === highlightedBase}
        danger={danger}
        title={danger ? t(`riichi.danger.${danger}`) : undefined}
      />
    );
  };

  return (
    <section
      className={cn(
        'riichi-seat riichi-seat--self',
        game.currentPlayer === 0 && 'riichi-seat--active',
      )}
    >
      <RiichiActionPanel
        game={game}
        locale={locale}
        state={actionState}
        handlers={actionHandlers}
      />

      <div className="riichi-self-meta">
        <div className="riichi-seat-card-main">
          <span className="riichi-seat-wind">
            {t(`game.mahjong.winds.${seatWind}`)}
          </span>
          <span className="riichi-seat-name">{t('game.mahjong.seats.0')}</span>
          <strong>{formatPoints(game.scores[0], locale)}</strong>
        </div>
        <div className="riichi-seat-card-meta">
          <span>
            {formatMessage(locale, 'riichi.table.timeBank', {
              seconds: game.timeBanks[0],
            })}
          </span>
          {game.currentPlayer === 0 && (
            <span className="riichi-seat-action">
              {t('riichi.context.live')}
            </span>
          )}
          {decisionSeat !== null && decisionSeat !== 0 && (
            <span>
              {formatMessage(locale, 'riichi.table.waiting', {
                seat: t(`game.mahjong.seats.${decisionSeat}`),
              })}
            </span>
          )}
          {game.riichiDeclared[0] && (
            <span className="riichi-seat-riichi">
              {t('riichi.state.riichi')}
            </span>
          )}
          {myFuritenReason && (
            <span className="riichi-seat-warning">{myFuritenReason}</span>
          )}
        </div>
      </div>

      <HumanTurnTimer timeBank={game.timeBanks[0]} />

      <div className="riichi-self-play-row">
        <div className="riichi-self-melds">
          {toMeldKeyedItems(game.melds[0], 'self-meld').map(({ meld, key }) => (
            <span className="riichi-seat-meld" key={key}>
              {meld.fromPlayer !== undefined && (
                <small className="riichi-meld-source">
                  {t(`game.mahjong.seats.${meld.fromPlayer}`)}
                </small>
              )}
              <MeldTiles
                meld={meld}
                seat={0}
                highlightedBase={highlightedBase}
              />
            </span>
          ))}
        </div>
        <div className="riichi-self-hand">
          <div className="riichi-self-concealed">
            {concealedItems.map((item) => renderHandTile(item, false))}
          </div>
          {drawnItem && (
            <div className="riichi-self-drawn">
              {renderHandTile(drawnItem, true)}
            </div>
          )}
        </div>
      </div>
      {canDiscard && (
        <p className="riichi-self-instruction">
          {t(
            actionState.riichiSelecting
              ? 'riichi.action.chooseRiichiDiscard'
              : 'riichi.action.chooseDiscard',
          )}
        </p>
      )}
    </section>
  );
}

type RiichiTableProps = {
  game: RiichiGameState;
  bag: RiichiGameBag;
  locale: Locale;
  actionState: RiichiActionState;
  actionHandlers: RiichiActionHandlers;
  discard: (seat: number, tile: number) => void;
  dangerHint: boolean;
};

function RiichiTable({
  game,
  bag,
  locale,
  actionState,
  actionHandlers,
  discard,
  dangerHint,
}: RiichiTableProps) {
  const [highlightedBase, setHighlightedBase] = useState<number | null>(null);
  const opponent = (seat: 1 | 2 | 3) => (
    <OpponentSeat
      seat={seat}
      game={game}
      timerLabel={formatMessage(locale, 'riichi.table.timeBank', {
        seconds: game.timeBanks[seat],
      })}
      timerClassName=""
      isCurrentTurn={bag.decisionSeat === seat}
      highlightedBase={highlightedBase}
    />
  );

  return (
    <div className="riichi-table-surface">
      <StatusPanel
        roundEnded={game.phase === 'end'}
        isClaimPhase={bag.isClaimPhase}
        isMyClaim={bag.isMyClaim}
        hasAnyClaimOption={bag.hasAnyClaimOption}
        lastDiscardFrom={game.claim?.from ?? game.lastDiscardFrom}
        lastDiscard={game.claim?.tile ?? game.lastDiscard}
        claimPlayer={bag.claimPlayer}
        isMyTurn={bag.isMyTurn}
        currentPlayer={game.currentPlayer}
        lastClaimMsg={
          game.lastAction ? formatLogEntry(game.lastAction, locale) : null
        }
        myFuritenReason={bag.myFuritenReason}
        riichiDeclared={game.riichiDeclared}
      />
      <div className="riichi-table-grid">
        <div className="riichi-table-seat-top">{opponent(2)}</div>
        <div className="riichi-table-seat-left">{opponent(3)}</div>
        <div className="riichi-table-center">
          <CenterArea game={game} highlightedBase={highlightedBase} />
        </div>
        <div className="riichi-table-seat-right">{opponent(1)}</div>
        <div className="riichi-table-seat-self">
          <SelfSeat
            game={game}
            locale={locale}
            decisionSeat={bag.decisionSeat}
            myFuritenReason={bag.myFuritenReason}
            actionState={actionState}
            actionHandlers={actionHandlers}
            discard={discard}
            highlightedBase={highlightedBase}
            onHighlight={setHighlightedBase}
            dangerHint={dangerHint}
          />
        </div>
      </div>
    </div>
  );
}

function HintPanel({ hint }: { hint: RiichiGameBag['tenpaiHint'] }) {
  const { t, locale } = useLocale();
  if (!hint) {
    return (
      <div className="riichi-panel-empty">
        <Info aria-hidden="true" size={22} />
        <strong>{t('riichi.hint.emptyTitle')}</strong>
        <p>{t('riichi.hint.emptyDesc')}</p>
      </div>
    );
  }

  if (hint.kind === 'current') {
    return (
      <div className="riichi-hint-content">
        <p className="riichi-panel-description">
          {t('riichi.hint.currentWaits')}
        </p>
        <div className="riichi-wait-list">
          {hint.waiting.map((tile) => (
            <div className="riichi-wait-item" key={tile}>
              <RiichiTile tile={tile} variant="indicator" />
              <span>
                {formatMessage(locale, 'riichi.hint.remaining', {
                  count: hint.remaining(tile),
                })}
              </span>
            </div>
          ))}
        </div>
        <p className="riichi-hint-line">{hint.line}</p>
      </div>
    );
  }

  return (
    <div className="riichi-hint-content">
      <p className="riichi-panel-description">
        {t('riichi.hint.discardCandidates')}
      </p>
      <div className="riichi-discard-candidates">
        {hint.options.map((option) => (
          <article key={`${option.discardTile}-${option.line}`}>
            <div className="riichi-candidate-discard">
              <span>{t('riichi.hint.discard')}</span>
              <RiichiTile tile={option.discardTile} variant="indicator" />
              <ArrowRight aria-hidden="true" size={16} />
            </div>
            <div className="riichi-candidate-waits">
              {option.waiting.map((tile) => (
                <div key={tile}>
                  <RiichiTile tile={tile} variant="indicator" />
                  <small>
                    {formatMessage(locale, 'riichi.hint.remaining', {
                      count: hint.remaining(tile),
                    })}
                  </small>
                </div>
              ))}
            </div>
            <p>{option.line}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SettlementPanel({ game }: { game: RiichiGameState }) {
  const { t, locale } = useLocale();
  const settlement = game.lastSettlement;
  if (!settlement) {
    return (
      <div className="riichi-panel-empty">
        <TimerReset aria-hidden="true" size={22} />
        <strong>{t('riichi.settlement.emptyTitle')}</strong>
        <p>{t('riichi.settlement.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="riichi-settlement-panel">
      <div className="riichi-settlement-score-list">
        {[0, 1, 2, 3].map((seat) => (
          <div key={seat}>
            <span>{t(`game.mahjong.seats.${seat}`)}</span>
            <strong>{formatPoints(settlement.newScores[seat], locale)}</strong>
            <em className={settlement.deltas[seat] >= 0 ? 'is-up' : 'is-down'}>
              {settlement.deltas[seat] >= 0 ? '+' : ''}
              {settlement.deltas[seat]}
            </em>
          </div>
        ))}
      </div>
      {settlement.tenpaiSeats && (
        <p className="riichi-settlement-tenpai">
          {t('riichi.settlement.tenpai')}
          {settlement.tenpaiSeats.length > 0
            ? settlement.tenpaiSeats
                .map((seat) => t(`game.mahjong.seats.${seat}`))
                .join(t('riichi.listSeparator'))
            : t('riichi.none')}
        </p>
      )}
      {settlement.payments.length > 0 && (
        <div className="riichi-payment-list">
          <p>{t('riichi.settlement.payments')}</p>
          {settlement.payments.map((payment, index) => (
            <div key={`${payment.from}-${payment.to}-${index}`}>
              <span>
                {payment.from >= 0
                  ? t(`game.mahjong.seats.${payment.from}`)
                  : t('riichi.context.riichiSticks')}
                {' → '}
                {t(`game.mahjong.seats.${payment.to}`)}
              </span>
              <strong>{payment.amount}</strong>
              <small>{payment.reason}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameLogPanel({ gameLog }: { gameLog: string[] }) {
  const { t } = useLocale();
  return (
    <div className="riichi-log-panel">
      <pre>
        {gameLog.length === 0 ? t('game.mahjong.noLogs') : gameLog.join('\n')}
      </pre>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(gameLog.join('\n'))}
      >
        <Copy aria-hidden="true" size={15} />
        {t('game.mahjong.copyAll')}
      </button>
    </div>
  );
}

function RiichiKeyboardShortcuts({
  state,
  handlers,
  enabled,
}: {
  state: RiichiActionState;
  handlers: RiichiActionHandlers;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input,select,textarea,[contenteditable="true"],[role="dialog"]',
        ) ||
        document.querySelector('.riichi-menu-drawer')
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'arrowright') {
        if (!state.isMyTurn) return;
        const tiles = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '.riichi-self-hand button:not(:disabled)',
          ),
        );
        if (tiles.length === 0) return;
        const current = tiles.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          current < 0
            ? 0
            : (current + (key === 'arrowright' ? 1 : tiles.length - 1)) %
              tiles.length;
        tiles[next].focus();
        event.preventDefault();
        return;
      }
      const shortcut = (() => {
        if (key === 'r' && state.canDeclareRiichi) return handlers.doRiichi;
        if (key === 't' && state.canTsumo) return handlers.doTsumo;
        if (key === 'c' && state.chiOptions.length > 0)
          return () => handlers.doChi(state.chiOptions[0]);
        if (key === 'p' && state.canPeng) return handlers.doPeng;
        if (key === 'k') {
          if (state.canMingang) return handlers.doMingang;
          if (state.angangOptions.length > 0)
            return () => handlers.doAngang(state.angangOptions[0]);
          if (state.kakanOptions.length > 0)
            return () => handlers.doKakan(state.kakanOptions[0]);
        }
        if (key === 'escape') {
          if (state.isMyClaim) return handlers.passClaim;
          if (state.riichiSelecting) return handlers.doRiichi;
        }
        return null;
      })();
      if (shortcut) {
        event.preventDefault();
        shortcut();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, state, handlers]);
  return null;
}

const GameMahjongJapanese = () => {
  const { t, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<ActiveDesktopPanel>(null);
  const [loadError, setLoadError] = useState(false);
  const didHandleEntryRef = useRef(false);
  const { theme, setTheme } = useRiichiTheme();
  const match = useRiichiStore((s) => s.match);
  const view = useRiichiStore((s) => s.view);
  const setView = useRiichiStore((s) => s.setView);
  const matchLength = useRiichiStore((s) => s.matchLength);
  const setMatchLength = useRiichiStore((s) => s.setMatchLength);
  const showGuide = useRiichiStore((s) => s.showGuide);
  const setShowGuide = useRiichiStore((s) => s.setShowGuide);
  const startGame = useRiichiStore((s) => s.startMatch);
  const dispatch = useRiichiStore((s) => s.dispatch);
  const undo = useRiichiStore((s) => s.undo);
  const resumeSaved = useRiichiStore((s) => s.resumeSaved);
  const replay = useRiichiStore((s) => s.replay);
  const openReplay = useRiichiStore((s) => s.openReplay);
  const { riichiSettings } = usePlayerProfile();
  useRiichiAutomation(riichiSettings);
  useRiichiEffectSounds();
  const game = match?.round ?? null;
  const bag = useRiichiViewModel(game, activePanel === 'hint', locale);
  const { turn, claim, tenpaiHint } = bag;
  const [riichiSelection, setRiichiSelection] = useState<string | null>(null);
  const [callConfirmation, setCallConfirmation] = useState<{
    key: string;
    response: string;
  } | null>(null);
  const decisionKey = match ? `${match.seed}:${match.turn}` : null;
  const riichiSelecting =
    decisionKey !== null && riichiSelection === decisionKey;
  const claimKey = game ? humanDecisionKey(game) : null;
  const pendingCall =
    claimKey !== null && callConfirmation?.key === claimKey
      ? callConfirmation.response
      : null;
  const act = (event: RiichiEvent) => {
    if (dispatch(withElapsed(event))) {
      setRiichiSelection(null);
      setCallConfirmation(null);
    }
  };
  const callOrConfirm = (response: ClaimResponse) => {
    const serialized = JSON.stringify(response);
    if (
      !riichiSettings.callConfirm ||
      !claimKey ||
      pendingCall === serialized
    ) {
      act({ type: 'claim', seat: 0, response });
      return;
    }
    setCallConfirmation({ key: claimKey, response: serialized });
  };
  const discard = (seat: number, tile: number) =>
    act({
      type: riichiSelecting ? 'riichi' : 'discard',
      seat,
      tile,
    });
  const startDesktopGame = async () => {
    setActivePanel(null);
    setRiichiSelection(null);
    try {
      await preloadRiichiRules();
      setLoadError(false);
      startGame({ rules: { aiLevel: riichiSettings.aiLevel } });
    } catch {
      setLoadError(true);
    }
  };
  const resumeDesktopGame = async () => {
    try {
      await preloadRiichiRules();
      setLoadError(!resumeSaved());
    } catch {
      setLoadError(true);
    }
  };
  const importReplay = async (file: File): Promise<boolean> => {
    try {
      await preloadRiichiRules();
      const parsed: unknown = JSON.parse(await file.text());
      if (!isReplayFile(parsed) || !restoreMatch(parsed)) return false;
      openReplay(parsed);
      return true;
    } catch {
      return false;
    }
  };
  const openCurrentReplay = () => {
    if (match) openReplay(toReplayFile(match));
  };
  const openLastReplay = async () => {
    try {
      await preloadRiichiRules();
      const saved = loadLastReplay();
      if (!saved || !restoreMatch(saved)) {
        setLoadError(true);
        return;
      }
      openReplay(saved);
    } catch {
      setLoadError(true);
    }
  };
  const returnToLobby = () => {
    setActivePanel(null);
    setRiichiSelection(null);
    setView('rules');
  };

  useEffect(() => {
    markRecentMahjongPlayed();
    void preloadRiichiRules().catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (didHandleEntryRef.current) return;
    const shouldAutoStart = searchParams.get('start') === '1';
    const shouldResume = searchParams.get('resume') === '1';
    const shouldOpenGuide = searchParams.get('guide') === '1';
    if (!shouldAutoStart && !shouldResume && !shouldOpenGuide) return;

    didHandleEntryRef.current = true;
    void preloadRiichiRules()
      .then(() => {
        if (shouldResume) setLoadError(!resumeSaved());
        else startGame({ rules: { aiLevel: riichiSettings.aiLevel } });
      })
      .catch(() => setLoadError(true));
    if (shouldOpenGuide) setShowGuide(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('start');
    nextParams.delete('resume');
    nextParams.delete('guide');
    setSearchParams(nextParams, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    startGame,
    resumeSaved,
    setShowGuide,
    riichiSettings.aiLevel,
  ]);

  useEffect(() => {
    if (!showGuide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowGuide(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showGuide, setShowGuide]);

  if (view === 'rules') {
    return (
      <div data-riichi-theme={theme}>
        <RulesView
          matchLength={matchLength}
          onMatchLengthChange={setMatchLength}
          theme={theme}
          onThemeChange={setTheme}
          onStart={startDesktopGame}
          loadError={loadError}
          hasSaved={hasResumableMatch()}
          hasReplay={loadLastReplay() !== null}
          onResume={resumeDesktopGame}
          onOpenReplay={openLastReplay}
          onImportReplay={importReplay}
        />
        {replay && (
          <ReplayViewer file={replay} onClose={() => openReplay(null)} />
        )}
      </div>
    );
  }

  if (!game) return null;

  const roundProgressSummary = getCurrentRiichiRoundProgressSummary();
  const actionState: RiichiActionState = {
    isMyClaim: Boolean(claim),
    chiOptions: claim?.chi ?? [],
    canPeng: claim?.pon ?? false,
    canMingang: claim?.minkan ?? false,
    canRon: claim?.ron ?? false,
    isMyTurn: Boolean(turn),
    canTsumo: turn?.tsumo ?? false,
    canDeclareRiichi: Boolean(turn?.riichiDiscards.length),
    canKyuushuKyuuhai: turn?.kyuushu ?? false,
    angangOptions: turn?.ankan ?? [],
    kakanOptions: turn?.kakan.map((option) => option.meldIndex) ?? [],
    riichiSelecting,
    discardable:
      (riichiSelecting ? turn?.riichiDiscards : turn?.discardable) ?? [],
    pendingCall,
  };
  const actionHandlers: RiichiActionHandlers = {
    doRon: () => act({ type: 'claim', seat: 0, response: { type: 'ron' } }),
    doChi: (tiles) => callOrConfirm({ type: 'chi', tiles }),
    doPeng: () => callOrConfirm({ type: 'pon' }),
    doMingang: () => callOrConfirm({ type: 'minkan' }),
    passClaim: () =>
      act({ type: 'claim', seat: 0, response: { type: 'pass' } }),
    doTsumo: () => act({ type: 'tsumo', seat: 0 }),
    doRiichi: () => setRiichiSelection(riichiSelecting ? null : decisionKey),
    doKyuushuKyuuhai: () => act({ type: 'kyuushu', seat: 0 }),
    doAngang: (tiles) => act({ type: 'ankan', seat: 0, tiles }),
    doKakan: (meldIndex) => {
      const option = turn?.kakan.find((item) => item.meldIndex === meldIndex);
      if (option) act({ type: 'kakan', seat: 0, ...option });
    },
  };
  const result = game.result;

  return (
    <RiichiDesktopStage theme={theme}>
      <div className="riichi-stage-screen">
        <RiichiKeyboardShortcuts
          state={actionState}
          handlers={actionHandlers}
          enabled={match?.status === 'playing' && !showGuide && !replay}
        />
        <GameHeader
          game={game}
          historyLength={
            match?.events
              .slice(match.roundStart.eventIndex)
              .filter((event) => 'seat' in event && event.seat === 0).length ??
            0
          }
          onStart={startDesktopGame}
          onUndo={() => {
            setRiichiSelection(null);
            undo();
          }}
          onOpenLog={() => setActivePanel('log')}
          onBackToRules={returnToLobby}
          returnRulesLabel={t('common.returnRules')}
          theme={theme}
          onThemeChange={setTheme}
          onOpenGuide={() => setShowGuide(true)}
          onOpenReplay={openCurrentReplay}
        />

        <main className="riichi-desktop-workspace">
          <TableContextPanel game={game} />
          <div className="riichi-table-zone">
            <RiichiTable
              game={game}
              bag={bag}
              locale={locale}
              actionState={actionState}
              actionHandlers={actionHandlers}
              discard={discard}
              dangerHint={riichiSettings.dangerHint}
            />
          </div>
          <DesktopSideRail
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            hasHint={Boolean(tenpaiHint)}
            hintContent={<HintPanel hint={tenpaiHint} />}
            settlementContent={<SettlementPanel game={game} />}
            logContent={
              <GameLogPanel
                gameLog={
                  match?.log.map((entry) => formatLogEntry(entry, locale)) ?? []
                }
              />
            }
          />
        </main>

        {showGuide && <GuideDialog onClose={() => setShowGuide(false)} />}

        {match?.status === 'roundEnd' && result?.type === 'win' && (
          <WinModal
            result={result}
            roundProgressSummary={roundProgressSummary}
            timeoutEvents={game.timeoutEvents.map((entry) =>
              formatLogEntry(entry, locale),
            )}
            onNext={() => act({ type: 'nextRound' })}
          />
        )}
        {match?.status === 'roundEnd' && result?.type === 'draw' && (
          <RyuukyokuModal
            result={result}
            roundProgressSummary={roundProgressSummary}
            timeoutEvents={game.timeoutEvents.map((entry) =>
              formatLogEntry(entry, locale),
            )}
            onNext={() => act({ type: 'nextRound' })}
          />
        )}
        {match?.status === 'matchEnd' && match.matchEnd && (
          <MatchEndModal
            matchEnd={match.matchEnd}
            roundProgressSummary={roundProgressSummary}
            onRestart={startDesktopGame}
            homeLabel={t('common.backHome')}
          />
        )}
        {replay && (
          <ReplayViewer file={replay} onClose={() => openReplay(null)} />
        )}
      </div>
    </RiichiDesktopStage>
  );
};

export default GameMahjongJapanese;
