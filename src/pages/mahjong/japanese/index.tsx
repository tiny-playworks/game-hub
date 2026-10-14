import { Copy, TimerReset } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { AvatarFrame } from '@/components/cosmetics/AvatarFrame';
import { RankedResult } from '@/components/ranked/RankedResult';
import { confirmRankedExit } from '@/components/ranked/RankedStartButton';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useRankedState } from '@/hooks/useRankedState';
import { formatMessage, type Locale } from '@/lib/i18n';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import {
  type CharacterDef,
  getCharacterById,
  getPlayerCharacterState,
} from '@/lib/playerCharacters';
import { markRecentMahjongPlayed } from '@/lib/recentMahjong';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import { getCurrentRiichiRoundProgressSummary } from '@/lib/riichiProgress';
import { preloadRiichiRules } from '@/lib/riichiRules';
import { cn } from '@/lib/utils';
import type { CharacterMoment } from './characterMoments';
import { useRiichiChatter } from './chatter';
import { CenterArea } from './components/CenterArea';
import { CharacterCutIn } from './components/CharacterCutIn';
import {
  type ActiveDesktopPanel,
  DesktopSideRail,
} from './components/DesktopSideRail';
import { GameHeader } from './components/GameHeader';
import { GuidePanel } from './components/GuidePanel';
import { MeldTiles } from './components/MeldTiles';
import { MatchEndModal, RyuukyokuModal } from './components/Modals';
import { OpponentSeat } from './components/OpponentSeat';
import { ReplayViewer } from './components/ReplayViewer';
import { RiichiDesktopStage } from './components/RiichiDesktopStage';
import { RulesView } from './components/RulesView';
import { SpeechBubble } from './components/SpeechBubble';
import { StatusPanel } from './components/StatusPanel';
import { TableContextPanel } from './components/TableContextPanel';
import { RiichiTile } from './components/Tile';
import { TrainingPanel } from './components/TrainingPanel';
import { WinPresentation } from './components/WinPresentation';
import {
  isReplayFile,
  type OpponentSelection,
  type RiichiEvent,
  type RiichiSeatCharacters,
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
import {
  useRiichiDialogContainer,
  useRiichiDialogFocus,
} from './useRiichiDialogFocus';
import { useRiichiEffectSounds } from './useRiichiEffectSounds';
import { useRiichiTheme } from './useRiichiTheme';
import { useRiichiViewModel } from './useRiichiViewModel';
import {
  NoviceControlsGuide,
  SelectedTileBar,
  TableActionToast,
} from './components/TableFeedback';
import { useTileInteraction } from './useTileInteraction';
import './characters.css';
import './table-feedback.css';

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
  const container = useRiichiDialogContainer();
  if (!container) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        onCloseAutoFocus={restoreFocus}
        className="riichi-guide-dialog-content w-[min(1120px,calc(100vw-40px))]! max-w-none!"
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
  character: CharacterDef;
  moment?: CharacterMoment;
  game: RiichiGameState;
  locale: Locale;
  decisionSeat: number | null;
  myFuritenReason: string | null;
  actionState: RiichiActionState;
  actionHandlers: RiichiActionHandlers;
  highlightedBase: number | null;
  onHighlight: (base: number | null) => void;
  dangerHint: boolean;
  selectedKey: string | null;
  selectedTile: number | null;
  onSelectTile: (key: string, tile: number) => void;
  onConfirmDiscard: () => void;
  onCancelSelection: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent, key: string, tile: number) => void;
};

function SelfSeat({
  character,
  moment,
  game,
  locale,
  decisionSeat,
  myFuritenReason,
  actionState,
  actionHandlers,
  highlightedBase,
  onHighlight,
  dangerHint,
  selectedKey,
  selectedTile,
  onSelectTile,
  onConfirmDiscard,
  onCancelSelection,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
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
    const isSelected = selectedKey === item.key;
    const isDiscardable = actionState.discardable.includes(item.tile);
    return (
      <RiichiTile
        key={item.key}
        tileKey={item.key}
        tile={item.tile}
        variant="hand"
        selected={isSelected}
        state={
          !isDiscardable
            ? 'disabled'
            : drawn
              ? 'drawn'
              : 'normal'
        }
        onClick={
          canDiscard && isDiscardable
            ? () => onSelectTile(item.key, item.tile)
            : undefined
        }
        onTouchStart={
          canDiscard && isDiscardable ? onTouchStart : undefined
        }
        onTouchMove={
          canDiscard && isDiscardable ? onTouchMove : undefined
        }
        onTouchEnd={
          canDiscard && isDiscardable
            ? (e) => onTouchEnd?.(e, item.key, item.tile)
            : undefined
        }
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
          <AvatarFrame>
            <CharacterPortraitSlot
              character={character}
              size="sm"
              label={t(character.nameKey)}
              className={cn(
                'riichi-character-avatar',
                (actionState.isMyTurn || actionState.isMyClaim) && 'is-acting',
              )}
            />
          </AvatarFrame>
          <span className="riichi-seat-wind">
            {t(`game.mahjong.winds.${seatWind}`)}
          </span>
          <span className="riichi-seat-name">{t(character.nameKey)}</span>
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
      <SpeechBubble moment={moment} />

      <HumanTurnTimer timeBank={game.timeBanks[0]} />

      <SelectedTileBar
        selectedTile={selectedTile}
        canDiscard={canDiscard}
        riichiSelecting={actionState.riichiSelecting}
        onConfirmDiscard={onConfirmDiscard}
        onCancelSelection={onCancelSelection}
      />

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
  seatCharacters: RiichiSeatCharacters;
  playerCharacterId: string;
  moments: CharacterMoment[];
  game: RiichiGameState;
  bag: RiichiGameBag;
  locale: Locale;
  actionState: RiichiActionState;
  actionHandlers: RiichiActionHandlers;
  dangerHint: boolean;
  previewBase: number | null;
  selectedKey: string | null;
  selectedTile: number | null;
  onSelectTile: (key: string, tile: number) => void;
  onConfirmDiscard: () => void;
  onCancelSelection: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent, key: string, tile: number) => void;
};

function RiichiTable({
  seatCharacters,
  playerCharacterId,
  moments,
  game,
  bag,
  locale,
  actionState,
  actionHandlers,
  dangerHint,
  previewBase,
  selectedKey,
  selectedTile,
  onSelectTile,
  onConfirmDiscard,
  onCancelSelection,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: RiichiTableProps) {
  const [hoveredBase, setHighlightedBase] = useState<number | null>(null);
  const highlightedBase = hoveredBase ?? previewBase;
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
      character={getCharacterById(seatCharacters[seat])}
      moment={moments.find((moment) => moment.seat === seat)}
    />
  );

  return (
    <div className="riichi-table-surface">
      <TableActionToast />
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
            character={getCharacterById(playerCharacterId)}
            moment={moments.find((moment) => moment.seat === 0)}
            game={game}
            locale={locale}
            decisionSeat={bag.decisionSeat}
            myFuritenReason={bag.myFuritenReason}
            actionState={actionState}
            actionHandlers={actionHandlers}
            highlightedBase={highlightedBase}
            onHighlight={setHighlightedBase}
            dangerHint={dangerHint}
            selectedKey={selectedKey}
            selectedTile={selectedTile}
            onSelectTile={onSelectTile}
            onConfirmDiscard={onConfirmDiscard}
            onCancelSelection={onCancelSelection}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        </div>
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



const GameMahjongJapanese = () => {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const memberOnline = household?.mode === 'member-online';
  const navigate = useNavigate();
  const rankedState = useRankedState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<ActiveDesktopPanel>(() =>
    window.matchMedia('(min-width: 1100px)').matches ? 'hint' : null,
  );
  const [loadError, setLoadError] = useState(false);
  const didHandleEntryRef = useRef(false);
  const { theme, setTheme } = useRiichiTheme();
  const match = useRiichiStore((s) => s.match);
  const onlinePending = useRiichiStore((s) => s.onlinePending);
  const isRanked = Boolean(match?.ranked);
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
  const playerCharacterId = useRiichiStore((s) => s.playerCharacterId);
  const moments = useRiichiStore((s) => s.moments);
  const presenting = useRiichiStore((s) => s.cutIns.length > 0);
  const [opponents, setOpponents] = useState<OpponentSelection>([
    null,
    null,
    null,
  ]);
  const { riichiSettings } = usePlayerProfile();
  useRiichiAutomation(riichiSettings);
  useRiichiEffectSounds();
  useRiichiChatter(riichiSettings.chatter);
  const game = match?.round ?? null;
  const [trainingPreview, setTrainingPreview] = useState<{
    key: string | null;
    base: number | null;
  } | null>(null);
  const [riichiSelection, setRiichiSelection] = useState<string | null>(null);
  const [callConfirmation, setCallConfirmation] = useState<{
    key: string;
    response: string;
  } | null>(null);
  const decisionKey = match ? `${match.seed}:${match.turn}` : null;
  const riichiSelecting =
    decisionKey !== null && riichiSelection === decisionKey;
  const bag = useRiichiViewModel(
    game,
    activePanel === 'hint' && !isRanked,
    locale,
    riichiSelecting,
  );
  const { turn, claim, tenpaiHint, trainingAdvice } = bag;
  const claimKey = game ? humanDecisionKey(game) : null;
  const pendingCall =
    claimKey !== null && callConfirmation?.key === claimKey
      ? callConfirmation.response
      : null;
  const act = async (event: RiichiEvent) => {
    if (useRiichiStore.getState().cutIns.length > 0) return;
    if (await dispatch(withElapsed(event))) {
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

  const selfHandItems = game
    ? toTileKeyedItems(game.hands[0], 'self-hand')
    : [];

  const {
    selectedKey,
    selectedTile,
    selectTile,
    confirmDiscard,
    cancelSelection,
    touchHandlers,
  } = useTileInteraction({
    handItems: selfHandItems,
    discardable: actionState.discardable,
    canDiscard: actionState.isMyTurn,
    riichiSelecting,
    isMyClaim: actionState.isMyClaim,
    enabled:
      view === 'game' &&
      match?.status === 'playing' &&
      !showGuide &&
      !replay &&
      !presenting &&
      !onlinePending,
    onDiscard: (tile) => discard(0, tile),
    onCancelRiichi: () => setRiichiSelection(null),
    onPassClaim: actionHandlers.passClaim,
    onActionShortcut: (key) => {
      if (key === 'r' && actionState.canDeclareRiichi) {
        actionHandlers.doRiichi();
        return true;
      }
      if (key === 't' && actionState.canTsumo) {
        actionHandlers.doTsumo();
        return true;
      }
      if (key === 'c' && actionState.chiOptions.length > 0) {
        actionHandlers.doChi(actionState.chiOptions[0]);
        return true;
      }
      if (key === 'p' && actionState.canPeng) {
        actionHandlers.doPeng();
        return true;
      }
      if (key === 'k') {
        if (actionState.canMingang) {
          actionHandlers.doMingang();
          return true;
        }
        if (actionState.angangOptions.length > 0) {
          actionHandlers.doAngang(actionState.angangOptions[0]);
          return true;
        }
        if (actionState.kakanOptions.length > 0) {
          actionHandlers.doKakan(actionState.kakanOptions[0]);
          return true;
        }
      }
      return false;
    },
  });

  const startDesktopGame = async () => {
    if (!await confirmRankedExit(t)) return;
    if (isRanked) {
      navigate('/');
      return;
    }
    setActivePanel(
      window.matchMedia('(min-width: 1100px)').matches ? 'hint' : null,
    );
    setRiichiSelection(null);
    try {
      await preloadRiichiRules();
      setLoadError(false);
      await startGame({
        rules: { aiLevel: riichiSettings.aiLevel },
        opponentSelection: opponents,
      });
    } catch {
      setLoadError(true);
    }
  };
  const resumeDesktopGame = async () => {
    try {
      await preloadRiichiRules();
      setLoadError(!await resumeSaved());
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
    if (match && !isRanked) openReplay(toReplayFile(match));
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
  const returnToLobby = async () => {
    if (!await confirmRankedExit(t)) return;
    setActivePanel(null);
    setRiichiSelection(null);
    setView('rules');
    if (isRanked) navigate('/');
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
      .then(async () => {
        if (shouldResume) setLoadError(!await resumeSaved());
        else if (await confirmRankedExit(t))
          await startGame({ rules: { aiLevel: riichiSettings.aiLevel } });
        else await resumeSaved();
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
    t,
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
          mainCharacterId={getPlayerCharacterState().activeCharacterId}
          opponents={opponents}
          onOpponentsChange={setOpponents}
        />
        {replay && (
          <ReplayViewer file={replay} onClose={() => openReplay(null)} />
        )}
      </div>
    );
  }

  if (!game || !match) return null;

  const rankedResult =
    isRanked && match.status === 'matchEnd'
      ? rankedState.history.find((entry) => entry.id === match.ranked?.id)
      : null;
  if (rankedResult && !presenting)
    return <RankedResult key={rankedResult.id} result={rankedResult} />;

  const roundProgressSummary = getCurrentRiichiRoundProgressSummary();
  const result = game.result;

  return (
    <RiichiDesktopStage theme={theme}>
      <div className="riichi-stage-screen">
        <GameHeader
          ranked={isRanked}
          game={game}
          historyLength={
            memberOnline ? 0 : match?.events
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
          returnRulesLabel={t(
            isRanked ? 'common.backHome' : 'common.returnRules',
          )}
          theme={theme}
          onThemeChange={setTheme}
          onOpenGuide={() => setShowGuide(true)}
          onOpenReplay={openCurrentReplay}
        />

        <main className="riichi-desktop-workspace">
          <TableContextPanel game={game} />
          <div className="riichi-table-zone">
            <NoviceControlsGuide />
            <RiichiTable
              seatCharacters={match.seatCharacters}
              playerCharacterId={playerCharacterId}
              moments={moments}
              game={game}
              bag={bag}
              locale={locale}
              actionState={actionState}
              actionHandlers={actionHandlers}
              dangerHint={!isRanked && riichiSettings.dangerHint}
              previewBase={
                !isRanked &&
                activePanel === 'hint' &&
                trainingPreview?.key === decisionKey
                  ? trainingPreview.base
                  : null
              }
              selectedKey={selectedKey}
              selectedTile={selectedTile}
              onSelectTile={selectTile}
              onConfirmDiscard={confirmDiscard}
              onCancelSelection={cancelSelection}
              onTouchStart={touchHandlers.onTouchStart}
              onTouchMove={touchHandlers.onTouchMove}
              onTouchEnd={touchHandlers.onTouchEnd}
            />
          </div>
          <DesktopSideRail
            ranked={isRanked}
            activePanel={
              isRanked && activePanel === 'hint' ? null : activePanel
            }
            onPanelChange={setActivePanel}
            hasHint={Boolean(turn)}
            hintContent={
              <TrainingPanel
                advice={trainingAdvice}
                hint={tenpaiHint}
                dangerEnabled={riichiSettings.dangerHint}
                onPreview={(base) =>
                  setTrainingPreview({ key: decisionKey, base })
                }
              />
            }
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

        {match?.status === 'roundEnd' &&
          result?.type === 'win' &&
          !presenting && (
            <WinPresentation
              key={game.roundId}
              result={result}
              doraIndicators={game.doraIndicators}
              mode={riichiSettings.presentation}
              moments={moments}
              roundProgressSummary={roundProgressSummary}
              timeoutEvents={game.timeoutEvents.map((entry) =>
                formatLogEntry(entry, locale),
              )}
              onNext={() => act({ type: 'nextRound' })}
            />
          )}
        {match?.status === 'roundEnd' &&
          result?.type === 'draw' &&
          !presenting && (
            <RyuukyokuModal
              result={result}
              game={game}
              moments={moments}
              roundProgressSummary={roundProgressSummary}
              timeoutEvents={game.timeoutEvents.map((entry) =>
                formatLogEntry(entry, locale),
              )}
              onNext={() => act({ type: 'nextRound' })}
            />
          )}
        {!isRanked &&
          match?.status === 'matchEnd' &&
          match.matchEnd &&
          !presenting && (
            <MatchEndModal
              matchEnd={match.matchEnd}
              moments={moments}
              roundProgressSummary={roundProgressSummary}
              onRestart={startDesktopGame}
              homeLabel={t('common.backHome')}
              replayFile={toReplayFile(match)}
            />
          )}
        {replay && (
          <ReplayViewer file={replay} onClose={() => openReplay(null)} />
        )}
        <CharacterCutIn mode={riichiSettings.presentation} />
      </div>
    </RiichiDesktopStage>
  );
};

export default GameMahjongJapanese;
