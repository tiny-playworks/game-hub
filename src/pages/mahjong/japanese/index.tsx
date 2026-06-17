import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage, type Locale } from '@/lib/i18n';
import { getBaseTile, getTileLabel, isMenzhen } from '@/lib/mahjongRiichi';
import { markRecentMahjongPlayed } from '@/lib/recentMahjong';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import { getCurrentRiichiRoundProgressSummary } from '@/lib/riichiProgress';
import { cn } from '@/lib/utils';
import { CenterArea } from './components/CenterArea';
import { GameHeader } from './components/GameHeader';
import { GameInfoBar } from './components/GameInfoBar';
import { GuidePanel } from './components/GuidePanel';
import { MatchEndModal, RyuukyokuModal, WinModal } from './components/Modals';
import { OpponentSeat } from './components/OpponentSeat';
import { RiichiMobileStage } from './components/RiichiMobileStage';
import { RulesView } from './components/RulesView';
import { StatusPanel } from './components/StatusPanel';
import { getTileColorClass, RiichiTileFace } from './components/Tile';
import { TILE_ACTIVE, TILE_DISCARD, TILE_HAND } from './constants';
import { toMeldKeyedItems, toTileKeyedItems } from './helpers';
import type { RiichiGameState } from './types';
import { useRiichiGame } from './useRiichiGame';
import { useRiichiTheme } from './useRiichiTheme';

export { getNextRound } from './helpers';

type RiichiGameBag = ReturnType<typeof useRiichiGame>;

/** 吃牌：手牌两张 + 舍牌，排序后与提示一致 */
function formatChiTripleLabel(
  opt: [number, number],
  lastDiscard: number | null,
  locale?: 'zh' | 'en',
): string {
  const isEn = locale === 'en';
  if (lastDiscard === null) {
    return isEn
      ? `${getTileLabel(opt[0], 'en')}${getTileLabel(opt[1], 'en')}`
      : `${getTileLabel(opt[0])}${getTileLabel(opt[1])}`;
  }
  const tiles = [opt[0], opt[1], lastDiscard].sort(
    (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
  );
  return tiles.map((t) => getTileLabel(t, locale)).join(isEn ? ' ' : '');
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
};

type RiichiActionHandlers = {
  doRon: () => void;
  doChi: (opt: [number, number]) => void;
  doPeng: () => void;
  doMingang: () => void;
  passClaim: () => void;
  passRonOpportunity: () => void;
  doTsumo: () => void;
  doRiichi: () => void;
  doKyuushuKyuuhai: () => void;
  doAngang: (opt: number[]) => void;
  doKakan: (meldIndex: number) => void;
};

type RiichiActionPanelProps = {
  game: RiichiGameState;
  t: (key: string) => string;
  locale: string;
  state: RiichiActionState;
  handlers: RiichiActionHandlers;
};

function RiichiActionPanel({
  game,
  t,
  locale,
  state,
  handlers,
}: RiichiActionPanelProps) {
  const {
    isMyClaim,
    chiOptions,
    canPeng,
    canMingang,
    canRon,
    isMyTurn,
    canTsumo,
    canDeclareRiichi,
    canKyuushuKyuuhai,
    angangOptions,
    kakanOptions,
  } = state;
  const {
    doRon,
    doChi,
    doPeng,
    doMingang,
    passClaim,
    passRonOpportunity,
    doTsumo,
    doRiichi,
    doKyuushuKyuuhai,
    doAngang,
    doKakan,
  } = handlers;
  const claimActionsAvailable =
    canRon || (isMyClaim && (chiOptions.length > 0 || canPeng || canMingang));
  const myTurnActionsAvailable =
    isMyTurn &&
    (canTsumo ||
      canDeclareRiichi ||
      canKyuushuKyuuhai ||
      angangOptions.length > 0 ||
      kakanOptions.length > 0);

  if (!claimActionsAvailable && !myTurnActionsAvailable) return null;

  return (
    <div className="riichi-action-panel rounded-lg p-2 space-y-2">
      {claimActionsAvailable &&
        game.lastDiscard != null &&
        game.lastDiscardFrom != null && (
          <p className="text-center text-xs font-medium text-amber-100/95 leading-snug">
            {formatMessage(
              locale as 'zh' | 'en',
              'game.mahjong.discardFromOpponent',
              {
                tile: getTileLabel(game.lastDiscard, locale as 'zh' | 'en'),
                seat: t(`game.mahjong.seats.${game.lastDiscardFrom}`),
              },
            )}
          </p>
        )}
      <p className="text-center text-xs text-[#a8dadc]/90">
        {t('game.mahjong.actionsTitle')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {claimActionsAvailable && (
          <>
            {canRon && game.lastDiscard != null && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5"
                onClick={doRon}
                aria-label={formatMessage(
                  locale as 'zh' | 'en',
                  'game.mahjong.ronAria',
                  {
                    ron: t('riichi.ron'),
                    tile: getTileLabel(game.lastDiscard, locale as 'zh' | 'en'),
                  },
                )}
              >
                {t('riichi.ron')}
                <span className="ml-1 text-[11px] font-normal opacity-90">
                  (
                  {formatMessage(
                    locale as 'zh' | 'en',
                    'game.mahjong.discardTile',
                    {
                      tile: getTileLabel(
                        game.lastDiscard,
                        locale as 'zh' | 'en',
                      ),
                    },
                  )}
                  )
                </span>
              </Button>
            )}
            {canRon && game.lastDiscard === null && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5"
                onClick={doRon}
                aria-label={t('riichi.ron')}
              >
                {t('riichi.ron')}
              </Button>
            )}
            {isMyClaim &&
              chiOptions.map((opt) => {
                const ld = game.lastDiscard;
                const triple = formatChiTripleLabel(
                  opt,
                  ld ?? null,
                  locale as 'zh' | 'en',
                );
                const chiDetail =
                  ld != null
                    ? formatMessage(
                        locale as 'zh' | 'en',
                        'game.mahjong.chiFormat',
                        {
                          discard: getTileLabel(ld, locale as 'zh' | 'en'),
                          m: triple,
                        },
                      )
                    : triple;
                return (
                  <Button
                    key={opt.join('-')}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5"
                    onClick={() => doChi(opt)}
                    aria-label={`${t('riichi.chi')} ${chiDetail}`}
                  >
                    {t('riichi.chi')}({chiDetail})
                  </Button>
                );
              })}
            {isMyClaim && canPeng && game.lastDiscard != null && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5"
                onClick={doPeng}
                aria-label={formatMessage(
                  locale as 'zh' | 'en',
                  'game.mahjong.pengAria',
                  {
                    peng: t('riichi.peng'),
                    tile: getTileLabel(game.lastDiscard, locale as 'zh' | 'en'),
                  },
                )}
              >
                {t('riichi.peng')}
                <span className="ml-1 text-[11px] font-normal opacity-90">
                  (
                  {formatMessage(
                    locale as 'zh' | 'en',
                    'game.mahjong.discardTile',
                    {
                      tile: getTileLabel(
                        game.lastDiscard,
                        locale as 'zh' | 'en',
                      ),
                    },
                  )}
                  )
                </span>
              </Button>
            )}
            {isMyClaim && canPeng && game.lastDiscard === null && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5"
                onClick={doPeng}
                aria-label={t('riichi.peng')}
              >
                {t('riichi.peng')}
              </Button>
            )}
            {isMyClaim && canMingang && game.lastDiscard != null && (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5"
                onClick={doMingang}
                aria-label={formatMessage(
                  locale as 'zh' | 'en',
                  'game.mahjong.mingangAria',
                  {
                    mingang: t('riichi.mingang'),
                    tile: getTileLabel(game.lastDiscard, locale as 'zh' | 'en'),
                  },
                )}
              >
                {t('riichi.mingang')}
                <span className="ml-1 text-[11px] font-normal opacity-90">
                  (
                  {formatMessage(
                    locale as 'zh' | 'en',
                    'game.mahjong.discardTile',
                    {
                      tile: getTileLabel(
                        game.lastDiscard,
                        locale as 'zh' | 'en',
                      ),
                    },
                  )}
                  )
                </span>
              </Button>
            )}
            {isMyClaim && canMingang && game.lastDiscard === null && (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5"
                onClick={doMingang}
                aria-label={t('riichi.mingang')}
              >
                {t('riichi.mingang')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-2.5"
              onClick={isMyClaim ? passClaim : passRonOpportunity}
              aria-label={t('riichi.pass')}
            >
              {t('riichi.pass')}
            </Button>
          </>
        )}
        {myTurnActionsAvailable && (
          <>
            {canTsumo && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5"
                onClick={doTsumo}
                aria-label={t('riichi.tsumo')}
              >
                {t('riichi.tsumo')}
              </Button>
            )}
            {canDeclareRiichi && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-400 text-[#f1faee] hover:bg-red-600/40"
                onClick={doRiichi}
                aria-label={t('riichi.declareRiichi')}
              >
                {t('riichi.declareRiichi')}
              </Button>
            )}
            {canKyuushuKyuuhai && (
              <Button
                size="sm"
                variant="outline"
                className="border-purple-400 text-[#f1faee] hover:bg-purple-600/35"
                onClick={doKyuushuKyuuhai}
                aria-label={t('riichi.kyuushu')}
              >
                {t('riichi.kyuushu')}
              </Button>
            )}
            {angangOptions.map((opt) => (
              <Button
                key={opt.join('-')}
                size="sm"
                variant="outline"
                className="border-slate-400 text-[#f1faee] hover:bg-slate-600/40"
                onClick={() => doAngang(opt)}
                aria-label={`${t('riichi.angang')} ${getTileLabel(opt[0], locale as 'zh' | 'en')}`}
              >
                {t('riichi.angang')}(
                {getTileLabel(opt[0], locale as 'zh' | 'en')})
              </Button>
            ))}
            {kakanOptions.map((meldIndex) => (
              <Button
                key={meldIndex}
                size="sm"
                variant="outline"
                className="border-amber-400 text-[#f1faee] hover:bg-amber-600/40"
                onClick={() => doKakan(meldIndex)}
                aria-label={formatMessage(
                  locale as 'zh' | 'en',
                  'game.mahjong.kakanGroup',
                  { action: t('riichi.kakan'), index: meldIndex + 1 },
                )}
              >
                {formatMessage(
                  locale as 'zh' | 'en',
                  'game.mahjong.kakanGroupShort',
                  { action: t('riichi.kakan'), index: meldIndex + 1 },
                )}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function GuideDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-4"
      aria-labelledby="guide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label={t('game.mahjong.close')}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[#457b9d]/50 bg-[#1d3557] shadow-xl">
        <GuidePanel onClose={onClose} />
      </div>
    </dialog>
  );
}

type OpponentGridProps = {
  game: RiichiGameState;
  decisionSeat: number | null;
  decisionSeatRemainSeconds: number | null;
  timerTextClass: (seat: 0 | 1 | 2 | 3) => string;
};

function getOpponentTimerLabel(
  game: RiichiGameState,
  seat: 1 | 2 | 3,
  decisionSeat: number | null,
  decisionSeatRemainSeconds: number | null,
): string {
  const decisionText =
    decisionSeat === seat && decisionSeatRemainSeconds != null
      ? ` · 本巡 ${decisionSeatRemainSeconds}s`
      : '';
  return `时库 ${game.timeBanks[seat]}s${decisionText}`;
}

function OpponentGrid({
  game,
  decisionSeat,
  decisionSeatRemainSeconds,
  timerTextClass,
}: OpponentGridProps) {
  return (
    <div
      className="grid flex-1 min-h-0 items-stretch gap-1.5"
      style={{
        gridTemplateAreas:
          '"riichi-top riichi-top riichi-top" "riichi-left riichi-center riichi-right"',
        gridTemplateColumns:
          'minmax(48px, 0.58fr) minmax(0, 2.8fr) minmax(48px, 0.58fr)',
        gridTemplateRows: 'minmax(76px, auto) minmax(0, 1fr)',
      }}
    >
      <div className="min-w-0 [grid-area:riichi-top]">
        <OpponentSeat
          seat={2}
          game={game}
          timerLabel={getOpponentTimerLabel(
            game,
            2,
            decisionSeat,
            decisionSeatRemainSeconds,
          )}
          timerClassName={timerTextClass(2)}
          isCurrentTurn={game.currentPlayer === 2}
        />
      </div>
      <div className="flex min-h-0 min-w-0 justify-center overflow-visible [grid-area:riichi-left]">
        <OpponentSeat
          seat={3}
          game={game}
          timerLabel={getOpponentTimerLabel(
            game,
            3,
            decisionSeat,
            decisionSeatRemainSeconds,
          )}
          timerClassName={timerTextClass(3)}
          isCurrentTurn={game.currentPlayer === 3}
        />
      </div>
      <div className="min-h-0 min-w-0 [grid-area:riichi-center]">
        <CenterArea game={game} />
      </div>
      <div className="flex min-h-0 min-w-0 justify-center overflow-visible [grid-area:riichi-right]">
        <OpponentSeat
          seat={1}
          game={game}
          timerLabel={getOpponentTimerLabel(
            game,
            1,
            decisionSeat,
            decisionSeatRemainSeconds,
          )}
          timerClassName={timerTextClass(1)}
          isCurrentTurn={game.currentPlayer === 1}
        />
      </div>
    </div>
  );
}

function GameLogPanel({ gameLog }: { gameLog: string[] }) {
  const { t } = useLocale();
  return (
    <div className="rounded-xl bg-[#1a2e25]/90 border border-[#2d4a3c] p-3 mt-4 max-h-48 overflow-hidden flex flex-col">
      <p className="text-xs text-[#f1faee]/80 mb-2">
        {t('game.mahjong.debugLog')}
      </p>
      <pre className="text-[11px] text-[#e0e0e0] overflow-auto flex-1 font-mono whitespace-pre-wrap break-all">
        {gameLog.length === 0 ? t('game.mahjong.noLogs') : gameLog.join('\n')}
      </pre>
      <button
        type="button"
        onClick={() => {
          const text = gameLog.join('\n');
          navigator.clipboard?.writeText(text);
        }}
        className="mt-2 text-xs text-amber-300 hover:text-amber-200"
      >
        {t('game.mahjong.copyAll')}
      </button>
    </div>
  );
}

type SelfHandPanelProps = {
  game: RiichiGameState;
  t: (key: string) => string;
  locale: Locale;
  currentTurnRemainSeconds: number | null;
  decisionSeat: number | null;
  timerTextClass: (seat: 0 | 1 | 2 | 3) => string;
  tenpaiHint: RiichiGameBag['tenpaiHint'];
  actionState: RiichiActionState;
  actionHandlers: RiichiActionHandlers;
  discard: (seat: number, tile: number) => void;
};

function SelfHandPanel({
  game,
  t,
  locale,
  currentTurnRemainSeconds,
  decisionSeat,
  timerTextClass,
  tenpaiHint,
  actionState,
  actionHandlers,
  discard,
}: SelfHandPanelProps) {
  const handTiles = toTileKeyedItems(game.hands[0], 'self-hand');
  const drawnKey =
    game.drawnTile === null
      ? null
      : handTiles.find(({ tile }) => tile === game.drawnTile)?.key;
  const canDiscard = actionState.isMyTurn;

  return (
    <div className="riichi-hand-panel flex-shrink-0 rounded-xl p-2 space-y-1.5">
      <div className="text-center text-xs text-[#a8dadc]/90 space-y-1">
        <p>
          <span className={timerTextClass(0)}>
            {formatMessage(locale, 'game.mahjong.selfTimebank', {
              timebank: game.timeBanks[0],
            })}
          </span>
          {currentTurnRemainSeconds != null &&
            formatMessage(locale, 'game.mahjong.selfTurnRemaining', {
              seconds: currentTurnRemainSeconds,
            })}
          {decisionSeat !== null &&
            formatMessage(locale, 'game.mahjong.currentDecision', {
              seat: t(`game.mahjong.seats.${decisionSeat}`),
            })}
        </p>
        {currentTurnRemainSeconds != null && (
          <div className="mx-auto h-1.5 w-44 rounded bg-black/20 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                currentTurnRemainSeconds <= 3
                  ? 'bg-red-400'
                  : currentTurnRemainSeconds <= 8
                    ? 'bg-amber-400'
                    : 'bg-emerald-400',
              )}
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (currentTurnRemainSeconds /
                      getTurnTotalSeconds(game.timeBanks[0])) *
                      100,
                  ),
                )}%`,
              }}
            />
          </div>
        )}
      </div>
      <RiichiActionPanel
        game={game}
        t={t}
        locale={locale}
        state={actionState}
        handlers={actionHandlers}
      />
      {game.melds[0].length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {toMeldKeyedItems(game.melds[0], 'self-meld').map(
            ({ meld: m, key }) => (
              <span
                key={key}
                className={cn(
                  'flex flex-wrap items-center rounded-lg border-2 p-1 gap-0.5',
                  m.type === 'chi' && 'border-blue-400 bg-[#fff9e6]/90',
                  m.type === 'peng' && 'border-amber-500 bg-[#fff9e6]/90',
                  m.type === 'mingang' && 'border-orange-500 bg-[#fff9e6]/90',
                  m.type === 'angang' && 'border-slate-500 bg-slate-700/40',
                )}
              >
                {m.type === 'angang' && (
                  <span
                    className="text-[10px] text-slate-300 px-0.5"
                    title={t('game.mahjong.angangTooltip')}
                  >
                    {t('game.mahjong.dark')}
                  </span>
                )}
                {toTileKeyedItems(m.tiles, `${key}-tile`).map(
                  ({ tile, key }) => (
                    <span
                      key={key}
                      className={cn(
                        TILE_DISCARD,
                        'text-sm',
                        getTileColorClass(tile),
                      )}
                    >
                      <RiichiTileFace tile={tile} />
                    </span>
                  ),
                )}
              </span>
            ),
          )}
        </div>
      )}
      {tenpaiHint && (
        <div className="rounded-lg border border-[#457b9d]/50 bg-[#1d3557]/40 px-3 py-2">
          <p className="text-xs text-[#a8dadc]/90 mb-1.5">
            {t('game.mahjong.tenpaiHintTitle')}
          </p>
          {tenpaiHint.kind === 'current' ? (
            <p className="text-sm text-[#f1faee] font-medium">
              {tenpaiHint.line}
            </p>
          ) : (
            <ul className="space-y-1 text-sm text-[#f1faee]">
              {tenpaiHint.options.map((opt) => (
                <li key={opt.line}>{opt.line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {canDiscard && (
        <p className="text-center text-sm text-[#ffc107]/90">
          {t('game.mahjong.clickToDiscard')}
        </p>
      )}
      <div className="flex flex-wrap justify-center items-center gap-2.5">
        {handTiles.map(({ tile, key }) => {
          const isDrawn = key === drawnKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => canDiscard && discard(0, tile)}
              className={cn(
                TILE_HAND,
                getTileColorClass(tile),
                isDrawn && TILE_ACTIVE,
                isDrawn && 'animate-riichi-tile-drawn',
                canDiscard &&
                  'cursor-pointer hover:ring-2 hover:ring-[#ffc107]/60',
              )}
            >
              <RiichiTileFace tile={tile} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const GameMahjongJapanese = () => {
  const { t, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const didHandleEntryRef = useRef(false);
  const { theme, setTheme } = useRiichiTheme();
  const bag = useRiichiGame();
  const {
    view,
    setView,
    matchLength,
    setMatchLength,
    game,
    startGame,
    history,
    gameLog,
    logOpen,
    setLogOpen,
    winResult,
    showGuide,
    setShowGuide,
    matchEnd,
    undo,
    discard,
    doTsumo,
    doRon,
    doChi,
    doPeng,
    doMingang,
    doAngang,
    doRiichi,
    doKyuushuKyuuhai,
    passClaim,
    passRonOpportunity,
    proceedToNextRound,
    proceedAfterRyuukyoku,
    isClaimPhase,
    claimPlayer,
    isMyTurn,
    isMyClaim,
    chiOptions,
    canPeng,
    canMingang,
    canRon,
    hasAnyClaimOption,
    myFuritenReason,
    tenpaiHint,
    winSettlementPreview,
    drawSettlementPreview,
    winnerPaymentSummary,
    decisionSeat,
    decisionSeatRemainSeconds,
    currentTurnRemainSeconds,
    timerTextClass,
    angangOptions,
    kakanOptions,
    canKyuushuKyuuhai,
    getWaitingTilesRiichi,
    canTsumo,
    doKakan,
  } = bag;

  useEffect(() => {
    markRecentMahjongPlayed();
  }, []);

  useEffect(() => {
    if (didHandleEntryRef.current) return;
    const shouldAutoStart = searchParams.get('start') === '1';
    const shouldOpenGuide = searchParams.get('guide') === '1';
    if (!shouldAutoStart && !shouldOpenGuide) return;

    didHandleEntryRef.current = true;
    startGame();
    if (shouldOpenGuide) setShowGuide(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('start');
    nextParams.delete('guide');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, startGame, setShowGuide]);

  useEffect(() => {
    if (!showGuide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
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
          onStart={startGame}
        />
      </div>
    );
  }

  if (!game) return null;

  const canDeclareRiichi =
    !game.riichiDeclared[0] &&
    isMenzhen(game.melds[0]) &&
    getWaitingTilesRiichi(game.hands[0], game.melds[0], game, {
      seat: 0,
      isTsumo: false,
      treatAsRiichi: true,
    }).length > 0;
  const roundProgressSummary = getCurrentRiichiRoundProgressSummary();

  return (
    <RiichiMobileStage theme={theme}>
      <div className="riichi-stage-screen">
        <GameHeader
          game={game}
          logOpen={logOpen}
          historyLength={history.length}
          onStart={startGame}
          onUndo={undo}
          onToggleLog={() => setLogOpen((o) => !o)}
          onBackToRules={() => setView('rules')}
          returnRulesLabel={t('common.returnRules')}
          homeLabel={t('common.backHome')}
          theme={theme}
          onThemeChange={setTheme}
          onOpenGuide={() => setShowGuide(true)}
        />

        <main className="riichi-stage-main">
          <GameInfoBar game={game} />
          {/* 牌桌区撑满视口，无滚动条；手牌区固定底部 */}
          <div className="riichi-game-layout flex-1 min-h-0 flex flex-col gap-1.5 min-w-0">
            <div className="riichi-playfield-outer min-w-0">
              <div className="riichi-playfield-inner">
                <div
                  className="riichi-table-surface flex-1 min-h-0 overflow-visible rounded-2xl border-2 p-2 shadow-[0_16px_36px_rgba(0,0,0,0.45)] flex flex-col"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--riichi-border) 55%, transparent)',
                  }}
                >
                  {showGuide && (
                    <GuideDialog onClose={() => setShowGuide(false)} />
                  )}
                  <StatusPanel
                    isClaimPhase={isClaimPhase}
                    isMyClaim={isMyClaim}
                    hasAnyClaimOption={hasAnyClaimOption}
                    lastDiscardFrom={game.lastDiscardFrom}
                    lastDiscard={game.lastDiscard}
                    claimPlayer={claimPlayer}
                    isMyTurn={isMyTurn}
                    currentPlayer={game.currentPlayer}
                    lastClaimMsg={game.lastClaimMsg}
                    myFuritenReason={myFuritenReason}
                    riichiDeclared={game.riichiDeclared}
                  />
                  <OpponentGrid
                    game={game}
                    decisionSeat={decisionSeat}
                    decisionSeatRemainSeconds={decisionSeatRemainSeconds}
                    timerTextClass={timerTextClass}
                  />
                </div>
              </div>
            </div>
            <SelfHandPanel
              game={game}
              t={t}
              locale={locale}
              currentTurnRemainSeconds={currentTurnRemainSeconds}
              decisionSeat={decisionSeat}
              timerTextClass={timerTextClass}
              tenpaiHint={tenpaiHint}
              actionState={{
                isMyClaim,
                chiOptions,
                canPeng,
                canMingang,
                canRon,
                isMyTurn,
                canTsumo,
                canDeclareRiichi,
                canKyuushuKyuuhai,
                angangOptions,
                kakanOptions,
              }}
              actionHandlers={{
                doRon,
                doChi,
                doPeng,
                doMingang,
                passClaim,
                passRonOpportunity,
                doTsumo,
                doRiichi,
                doKyuushuKyuuhai,
                doAngang,
                doKakan,
              }}
              discard={discard}
            />
          </div>

          {logOpen && <GameLogPanel gameLog={gameLog} />}

          {winResult && (
            <WinModal
              winResult={winResult}
              winSettlementPreview={winSettlementPreview}
              winnerPaymentSummary={winnerPaymentSummary}
              roundProgressSummary={roundProgressSummary}
              timeoutEvents={game.timeoutEvents}
              onNext={proceedToNextRound}
            />
          )}

          {game.ryuukyoku && (
            <RyuukyokuModal
              ryuukyokuReason={game.ryuukyokuReason}
              drawSettlementPreview={drawSettlementPreview}
              roundProgressSummary={roundProgressSummary}
              timeoutEvents={game.timeoutEvents}
              onNext={proceedAfterRyuukyoku}
            />
          )}

          {matchEnd && (
            <MatchEndModal
              matchEnd={matchEnd}
              roundProgressSummary={roundProgressSummary}
              onRestart={startGame}
              homeLabel={t('common.backHome')}
            />
          )}
        </main>
      </div>
    </RiichiMobileStage>
  );
};

export default GameMahjongJapanese;
