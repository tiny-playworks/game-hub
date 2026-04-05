import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { getTileLabel } from '@/lib/mahjongRiichi';
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
import { RulesView } from './components/RulesView';
import { StatusPanel } from './components/StatusPanel';
import { getTileColorClass, RiichiTileFace } from './components/Tile';
import { SEAT_NAMES, TILE_ACTIVE, TILE_DISCARD, TILE_HAND } from './constants';
import { useRiichiGame } from './useRiichiGame';
import { useRiichiTheme } from './useRiichiTheme';

export { getNextRound } from './helpers';

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
    game.melds[0].every((m) => m.type === 'angang') &&
    getWaitingTilesRiichi(game.hands[0], game.melds[0], game, {
      seat: 0,
      isTsumo: false,
      treatAsRiichi: true,
    }).length > 0;
  const roundProgressSummary = getCurrentRiichiRoundProgressSummary();
  const claimActionsAvailable =
    !!canRon ||
    (!!isMyClaim && (chiOptions.length > 0 || !!canPeng || !!canMingang));
  const myTurnActionsAvailable =
    isMyTurn &&
    (canTsumo ||
      canDeclareRiichi ||
      canKyuushuKyuuhai ||
      angangOptions.length > 0 ||
      kakanOptions.length > 0);
  const showActionBar = claimActionsAvailable || myTurnActionsAvailable;

  return (
    <div
      data-riichi-theme={theme}
      className="flex flex-col h-screen min-h-0"
      style={{
        background: `linear-gradient(to bottom, var(--riichi-bg), var(--riichi-bg-to))`,
        color: 'var(--riichi-text)',
      }}
    >
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

      <main className="mx-auto max-w-[1400px] w-full p-2 md:p-3 flex flex-col flex-1 min-h-0">
        <GameInfoBar game={game} />
        {/* 牌桌区撑满视口，无滚动条；手牌区固定底部 */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5 min-w-0">
          <div className="riichi-playfield-outer min-w-0">
            <div className="riichi-playfield-inner">
              <div
                className="flex-1 min-h-0 overflow-visible rounded-2xl border-2 p-2 md:p-3 shadow-[0_16px_36px_rgba(0,0,0,0.45)] flex flex-col min-h-0"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--riichi-border) 55%, transparent)',
                  backgroundColor: 'var(--riichi-table)',
                }}
              >
                {showGuide && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="guide-title"
                  >
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/60"
                      onClick={() => setShowGuide(false)}
                      aria-label="关闭"
                    />
                    <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[#457b9d]/50 bg-[#1d3557] shadow-xl">
                      <GuidePanel onClose={() => setShowGuide(false)} />
                    </div>
                  </div>
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
                <div
                  className="flex flex-1 min-h-0 flex-col gap-2 md:grid md:min-h-0 md:items-stretch md:gap-2"
                  style={{
                    // md+ 使用命名网格：上行对家跨三列，下行左/中/右；左右列有最小宽度，避免侧家牌被压扁；行高上 auto、下吃满剩余
                    gridTemplateAreas:
                      '"riichi-top riichi-top riichi-top" "riichi-left riichi-center riichi-right"',
                    gridTemplateColumns:
                      'minmax(88px, 1fr) minmax(0, 2.6fr) minmax(88px, 1fr)',
                    gridTemplateRows: 'auto minmax(0, 1fr)',
                  }}
                >
                  <div className="order-1 min-w-0 md:order-none md:[grid-area:riichi-top]">
                    <OpponentSeat
                      seat={2}
                      game={game}
                      timerLabel={`时库 ${game.timeBanks[2]}s${decisionSeat === 2 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                      timerClassName={timerTextClass(2)}
                      isCurrentTurn={game.currentPlayer === 2}
                    />
                  </div>
                  <div className="order-2 flex min-h-0 min-w-0 justify-center overflow-visible md:order-none md:[grid-area:riichi-left]">
                    <OpponentSeat
                      seat={3}
                      game={game}
                      timerLabel={`时库 ${game.timeBanks[3]}s${decisionSeat === 3 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                      timerClassName={timerTextClass(3)}
                      isCurrentTurn={game.currentPlayer === 3}
                    />
                  </div>
                  <div className="order-3 min-h-[100px] min-w-0 md:order-none md:[grid-area:riichi-center] md:min-h-0">
                    <CenterArea game={game} />
                  </div>
                  <div className="order-4 flex min-h-0 min-w-0 justify-center overflow-visible md:order-none md:[grid-area:riichi-right]">
                    <OpponentSeat
                      seat={1}
                      game={game}
                      timerLabel={`时库 ${game.timeBanks[1]}s${decisionSeat === 1 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                      timerClassName={timerTextClass(1)}
                      isCurrentTurn={game.currentPlayer === 1}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* 手牌区：始终在视口底部，无需滚动 */}
          <div
            className="flex-shrink-0 rounded-xl p-2.5 md:p-3 space-y-2"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--riichi-table) 86%, transparent)',
            }}
          >
            <div className="text-center text-xs text-[#a8dadc]/90 space-y-1">
              <p>
                <span className={timerTextClass(0)}>
                  自家时库 {game.timeBanks[0]}s
                </span>
                {currentTurnRemainSeconds != null &&
                  ` · 本巡剩余 ${currentTurnRemainSeconds}s`}
                {decisionSeat !== null &&
                  ` · 当前决策 ${SEAT_NAMES[decisionSeat]}`}
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
            {showActionBar && (
              <div className="rounded-lg border border-[#d4b886]/25 bg-[#1a2e25]/55 p-2 md:p-3 space-y-2">
                <p className="text-center text-xs text-[#a8dadc]/90">
                  可执行操作
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {claimActionsAvailable && (
                    <>
                      {canRon && (
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
                        chiOptions.map((opt, i) => (
                          <Button
                            key={i}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5"
                            onClick={() => doChi(opt)}
                            aria-label={`${t('riichi.chi')} ${getTileLabel(opt[0])} ${getTileLabel(opt[1])}`}
                          >
                            {t('riichi.chi')}({getTileLabel(opt[0])}
                            {getTileLabel(opt[1])})
                          </Button>
                        ))}
                      {isMyClaim && canPeng && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5"
                          onClick={doPeng}
                          aria-label={t('riichi.peng')}
                        >
                          {t('riichi.peng')}
                        </Button>
                      )}
                      {isMyClaim && canMingang && (
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
                      {angangOptions.map((opt, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant="outline"
                          className="border-slate-400 text-[#f1faee] hover:bg-slate-600/40"
                          onClick={() => doAngang(opt)}
                          aria-label={`${t('riichi.angang')} ${getTileLabel(opt[0])}`}
                        >
                          {t('riichi.angang')}({getTileLabel(opt[0])})
                        </Button>
                      ))}
                      {kakanOptions.map((meldIndex) => (
                        <Button
                          key={meldIndex}
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-[#f1faee] hover:bg-amber-600/40"
                          onClick={() => doKakan(meldIndex)}
                          aria-label={
                            locale === 'zh'
                              ? `${t('riichi.kakan')} 第${meldIndex + 1}组碰`
                              : `${t('riichi.kakan')} (Group ${meldIndex + 1})`
                          }
                        >
                          {locale === 'zh'
                            ? `${t('riichi.kakan')}(第${meldIndex + 1}组碰)`
                            : `${t('riichi.kakan')} (Group ${meldIndex + 1})`}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
            {game.melds[0].length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {game.melds[0].map((m, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex flex-wrap items-center rounded-lg border-2 p-1 gap-0.5',
                      m.type === 'chi' && 'border-blue-400 bg-[#fff9e6]/90',
                      m.type === 'peng' && 'border-amber-500 bg-[#fff9e6]/90',
                      m.type === 'mingang' &&
                        'border-orange-500 bg-[#fff9e6]/90',
                      m.type === 'angang' && 'border-slate-500 bg-slate-700/40',
                    )}
                  >
                    {m.type === 'angang' && (
                      <span
                        className="text-[10px] text-slate-300 px-0.5"
                        title="暗杠不算副露"
                      >
                        暗
                      </span>
                    )}
                    {m.tiles.map((t, j) => (
                      <span
                        key={j}
                        className={cn(
                          TILE_DISCARD,
                          'text-sm',
                          getTileColorClass(t),
                        )}
                      >
                        <RiichiTileFace tile={t} />
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            )}
            {tenpaiHint && (
              <div className="rounded-lg border border-[#457b9d]/50 bg-[#1d3557]/40 px-3 py-2">
                <p className="text-xs text-[#a8dadc]/90 mb-1.5">
                  听牌提示（按可见信息估算）
                </p>
                {tenpaiHint.kind === 'current' ? (
                  <p className="text-sm text-[#f1faee] font-medium">
                    {tenpaiHint.line}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-[#f1faee]">
                    {tenpaiHint.options.map((opt, i) => (
                      <li key={i}>{opt.line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {isMyTurn && (
              <p className="text-center text-sm text-[#ffc107]/90">
                点击手牌出牌
              </p>
            )}
            {(() => {
              const hand = game.hands[0];
              const drawn = game.drawnTile;
              const canDiscard = isMyTurn;
              return (
                <div className="flex flex-wrap justify-center items-center gap-2.5">
                  {hand.map((tile, i) => {
                    const isDrawn = drawn !== null && hand.indexOf(drawn) === i;
                    return (
                      <button
                        key={`${i}-${tile}`}
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
              );
            })()}
          </div>
        </div>

        {game && logOpen && (
          <div className="rounded-xl bg-[#1a2e25]/90 border border-[#2d4a3c] p-3 mt-4 max-h-48 overflow-hidden flex flex-col">
            <p className="text-xs text-[#f1faee]/80 mb-2">
              游戏日志（调试信息）
            </p>
            <pre className="text-[11px] text-[#e0e0e0] overflow-auto flex-1 font-mono whitespace-pre-wrap break-all">
              {gameLog.length === 0 ? '（暂无）' : gameLog.join('\n')}
            </pre>
            <button
              type="button"
              onClick={() => {
                const text = gameLog.join('\n');
                navigator.clipboard?.writeText(text);
              }}
              className="mt-2 text-xs text-amber-300 hover:text-amber-200"
            >
              复制全部
            </button>
          </div>
        )}

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
  );
};

export default GameMahjongJapanese;
