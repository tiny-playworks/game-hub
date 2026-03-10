import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
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
import { SEAT_NAMES, TILE_ACTIVE, TILE_HAND, TILE_DISCARD } from './constants';
import { useRiichiGame } from './useRiichiGame';
import { useRiichiTheme } from './useRiichiTheme';

export { getNextRound } from './helpers';

const GameMahjongJapanese = () => {
  const { t, locale } = useLocale();
  const [showExtraActions, setShowExtraActions] = useState(false);
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
    hasNonRonClaimOption,
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
        theme={theme}
        onThemeChange={setTheme}
        onOpenGuide={() => setShowGuide(true)}
      />

      <main className="mx-auto max-w-6xl w-full p-3 md:p-4 flex flex-col flex-1 min-h-0">
        <GameInfoBar game={game} />
        {/* 牌桌区撑满视口，无滚动条；手牌区固定底部 */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div
            className="flex-1 min-h-0 overflow-hidden rounded-2xl border-2 p-3 md:p-4 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col"
            style={{
              borderColor:
                'color-mix(in srgb, var(--riichi-border) 50%, transparent)',
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
              canRon={canRon}
              hasNonRonClaimOption={hasNonRonClaimOption}
              chiOptionsLength={chiOptions.length}
              canPeng={canPeng}
              canMingang={canMingang}
              lastClaimMsg={game.lastClaimMsg}
              myFuritenReason={myFuritenReason}
              riichiDeclared={game.riichiDeclared}
            />
            <div className="flex-1 min-h-0 flex flex-col gap-2 md:grid md:grid-cols-[1fr_2fr_1fr] md:grid-rows-[1fr_auto] md:gap-2 md:min-h-0">
              <div className="order-1 md:order-none hidden md:block" />
              <div className="order-1 md:order-none">
                <OpponentSeat
                  seat={2}
                  game={game}
                  timerLabel={`时库 ${game.timeBanks[2]}s${decisionSeat === 2 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                  timerClassName={timerTextClass(2)}
                  isCurrentTurn={game.currentPlayer === 2}
                />
              </div>
              <div className="order-2 md:order-none hidden md:block" />
              <div className="order-2 md:order-none">
                <OpponentSeat
                  seat={3}
                  game={game}
                  timerLabel={`时库 ${game.timeBanks[3]}s${decisionSeat === 3 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                  timerClassName={timerTextClass(3)}
                  isCurrentTurn={game.currentPlayer === 3}
                />
              </div>
              <div className="order-3 md:order-none min-h-[100px]">
                <CenterArea game={game} />
              </div>
              <div className="order-4 md:order-none">
                <OpponentSeat
                  seat={1}
                  game={game}
                  timerLabel={`时库 ${game.timeBanks[1]}s${decisionSeat === 1 && decisionSeatRemainSeconds != null ? ` · 本巡 ${decisionSeatRemainSeconds}s` : ''}`}
                  timerClassName={timerTextClass(1)}
                  isCurrentTurn={game.currentPlayer === 1}
                />
              </div>
              <div className="order-5 md:order-none hidden md:block" />
            </div>
          </div>
          {/* 手牌区：始终在视口底部，无需滚动 */}
          <div
            className="flex-shrink-0 rounded-xl p-3 md:p-4 space-y-2"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--riichi-table) 80%, transparent)',
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
            {canTsumo && (
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-sm text-[#f1faee]/90 bg-[#1d3557]/50 rounded-lg py-2 px-4 inline-block">
                    🎉 恭喜！你可以自摸胡牌了！
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 text-lg"
                    onClick={doTsumo}
                    aria-label={t('riichi.tsumo')}
                  >
                    🏆 {t('riichi.tsumo')}
                  </Button>
                </div>
              </div>
            )}
            {(canRon || (isMyClaim && hasNonRonClaimOption)) && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-[#f1faee]/90 bg-[#1d3557]/50 rounded-lg py-2 px-4 inline-block">
                    ⚠️ {canRon ? '你可以荣和，是否和牌？' : '请选择你要的操作：'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {canRon && (
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3"
                      onClick={doRon}
                      aria-label={t('riichi.ron')}
                    >
                      🎉 {t('riichi.ron')}
                    </Button>
                  )}
                  {isMyClaim &&
                    chiOptions.map((opt, i) => (
                      <Button
                        key={i}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3"
                        onClick={() => doChi(opt)}
                        aria-label={`${t('riichi.chi')} ${getTileLabel(opt[0])} ${getTileLabel(opt[1])}`}
                      >
                        🍣 {t('riichi.chi')}({getTileLabel(opt[0])}
                        {getTileLabel(opt[1])})
                      </Button>
                    ))}
                  {isMyClaim && canPeng && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3"
                      onClick={doPeng}
                      aria-label={t('riichi.peng')}
                    >
                      🔨 {t('riichi.peng')}
                    </Button>
                  )}
                  {isMyClaim && canMingang && (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3"
                      onClick={doMingang}
                      aria-label={t('riichi.mingang')}
                    >
                      ⚡ {t('riichi.mingang')}
                    </Button>
                  )}
                  {isMyClaim ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-3"
                      onClick={passClaim}
                      aria-label={t('riichi.pass')}
                    >
                      ❌ {t('riichi.pass')}
                    </Button>
                  ) : (
                    canRon && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-3"
                        onClick={passRonOpportunity}
                        aria-label={t('riichi.passRon')}
                      >
                        ❌ {t('riichi.passRon')}
                      </Button>
                    )
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#a8dadc]/80">
                    💡 提示：胡牌 {'>'} 杠 {'>'} 碰 {'>'} 吃 {'>'} 过
                  </p>
                </div>
              </div>
            )}
            {isMyTurn && (
              <div className="space-y-3">
                {(canKyuushuKyuuhai ||
                  !game.riichiDeclared[0] ||
                  angangOptions.length > 0 ||
                  kakanOptions.length > 0) && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#a8dadc]/50 text-[#f1faee]/90 hover:bg-[#2d4a3c]/60"
                      onClick={() => setShowExtraActions((v) => !v)}
                      aria-expanded={showExtraActions}
                      aria-label={
                        showExtraActions ? '收起更多操作' : '展开更多操作'
                      }
                    >
                      {showExtraActions ? '收起 ▲' : '更多操作 ▼'}
                    </Button>
                  </div>
                )}
                {showExtraActions && (
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-[#d4b886]/20 bg-[#1a2e25]/50 p-2">
                    {canKyuushuKyuuhai && (
                      <div className="flex items-center gap-2 bg-purple-900/30 rounded-lg px-3 py-2 border border-purple-400/40">
                        <span className="text-xs text-[#f1faee]/85">
                          九种九牌：
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-400 text-[#f1faee] hover:bg-purple-600/40"
                          onClick={doKyuushuKyuuhai}
                          aria-label={t('riichi.kyuushu')}
                        >
                          🀄 {t('riichi.kyuushu')}
                        </Button>
                      </div>
                    )}
                    {!game.riichiDeclared[0] && (
                      <div className="flex items-center gap-2 bg-[#1d3557]/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#f1faee]/80">
                          立直：
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-400 text-[#f1faee] hover:bg-red-600/50"
                          onClick={doRiichi}
                          aria-label={t('riichi.declareRiichi')}
                          disabled={
                            game.riichiDeclared[0] ||
                            !game.melds[0].every((m) => m.type === 'angang') ||
                            getWaitingTilesRiichi(
                              game.hands[0],
                              game.melds[0],
                              game,
                              {
                                seat: 0,
                                isTsumo: false,
                                treatAsRiichi: true,
                              },
                            ).length === 0
                          }
                        >
                          🎯 {t('riichi.declareRiichi')}
                        </Button>
                      </div>
                    )}
                    {angangOptions.length > 0 && (
                      <div className="flex items-center gap-2 bg-[#2d4a3c]/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#f1faee]/80">
                          暗杠：
                        </span>
                        {angangOptions.map((opt, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="outline"
                            className="border-slate-400 text-[#f1faee] hover:bg-slate-600/50"
                            onClick={() => doAngang(opt)}
                            aria-label={`${t('riichi.angang')} ${getTileLabel(opt[0])}`}
                          >
                            ⚡ {t('riichi.angang')}({getTileLabel(opt[0])})
                          </Button>
                        ))}
                      </div>
                    )}
                    {kakanOptions.length > 0 && (
                      <div className="flex items-center gap-2 bg-[#2d4a3c]/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#f1faee]/80">
                          加杠：
                        </span>
                        {kakanOptions.map((meldIndex) => (
                          <Button
                            key={meldIndex}
                            size="sm"
                            variant="outline"
                            className="border-amber-400 text-[#f1faee] hover:bg-amber-600/50"
                            onClick={() => doKakan(meldIndex)}
                            aria-label={
                              locale === 'zh'
                                ? `${t('riichi.kakan')} 第${meldIndex + 1}组碰`
                                : `${t('riichi.kakan')} (Group ${meldIndex + 1})`
                            }
                          >
                            📎{' '}
                            {locale === 'zh'
                              ? `${t('riichi.kakan')}(第${meldIndex + 1}组碰)`
                              : `${t('riichi.kakan')} (Group ${meldIndex + 1})`}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm text-[#ffc107]/90 flex items-center justify-center gap-2">
                    🎮 点击下方手牌出牌
                    <span className="text-xs text-[#f1faee]/70">
                      (刚摸的牌会有金色高亮)
                    </span>
                  </p>
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
                          'w-[44px] h-[60px] text-lg',
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
                  🎯 听牌提示（可见区推算剩余，含他家手牌未现）
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
                          'max-sm:w-[56px] max-sm:h-[76px] max-sm:text-xl',
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
              游戏日志（便于排查问题，可复制到控制台）
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
            timeoutEvents={game.timeoutEvents}
            onNext={proceedToNextRound}
          />
        )}

        {game.ryuukyoku && (
          <RyuukyokuModal
            ryuukyokuReason={game.ryuukyokuReason}
            drawSettlementPreview={drawSettlementPreview}
            timeoutEvents={game.timeoutEvents}
            onNext={proceedAfterRyuukyoku}
          />
        )}

        {matchEnd && (
          <MatchEndModal matchEnd={matchEnd} onRestart={startGame} />
        )}
      </main>
    </div>
  );
};

export default GameMahjongJapanese;
