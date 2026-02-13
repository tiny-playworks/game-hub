import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TILE_LABELS, SEAT_NAMES, getAngangOptions, getJiagangOptions } from '@/lib/mahjong';
import { useMahjongGame } from '@/hooks/useMahjongGame';
import { cn } from '@/lib/utils';

/** 字牌 27-33，万0-8 条9-17 筒18-26 */
function getTileStyle(tile: number): string {
  if (tile >= 27) return 'border-2 border-amber-400 bg-amber-50 text-amber-900 font-medium';
  if (tile < 9) return 'border-2 border-red-300 bg-red-50 text-red-900';
  if (tile < 18) return 'border-2 border-emerald-400 bg-emerald-50 text-emerald-900';
  return 'border-2 border-sky-400 bg-sky-50 text-sky-900';
}

const GameMahjongChinese = () => {
  const {
    state,
    startGame,
    discard,
    passClaim,
    doHu,
    doPeng,
    doGang,
    doChi,
    doJiagang,
    doAngang,
    doZiMo,
    runAiTurn,
    needAiDiscard,
    needPassClaim,
  } = useMahjongGame();

  useEffect(() => {
    if (!needAiDiscard) return;
    const t = setTimeout(runAiTurn, 600);
    return () => clearTimeout(t);
  }, [needAiDiscard, runAiTurn]);

  useEffect(() => {
    if (!needPassClaim) return;
    const t = setTimeout(passClaim, 400);
    return () => clearTimeout(t);
  }, [needPassClaim, passClaim]);

  const isMyTurn =
    state?.phase === 'discard' && state.currentPlayer === 0 && state.winner === null;
  const isClaimPhase = state?.phase === 'claim' && state.lastDiscard !== null;
  const canZiMo =
    state?.phase === 'discard' &&
    state?.currentPlayer === 0 &&
    state?.winner === null &&
    state &&
    state.hands[0].length === 14;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link
          to="/category/mahjong"
          className="text-muted-foreground hover:text-foreground"
        >
          ← 返回麻将分类
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            牌墙: {state?.deck.length ?? 0}
          </span>
          <span className="text-sm font-medium text-foreground">
            {state?.isDraw
              ? '流局'
              : state && state.winner !== null
                ? `${SEAT_NAMES[state.winner]} 胡牌`
                : isClaimPhase
                  ? '有人出牌，可选择吃/碰/杠/胡或过'
                  : isMyTurn
                    ? '轮到你出牌'
                    : '等待其他玩家'}
          </span>
          {state && (state.dealer ?? 0) >= 0 && (
            <span className="text-xs font-medium text-foreground">庄: {SEAT_NAMES[state.dealer ?? 0]}</span>
          )}
          {state?.scores && state.scores.length === 4 && (
            <span className="text-xs font-medium text-foreground">
              分数: {SEAT_NAMES.map((name, i) => `${name} ${state.scores[i] ?? 0}`).join(' · ')}
            </span>
          )}
          {state?.lastWinResult && (
            <span className="text-xs font-medium text-foreground">
              番: {state.lastWinResult.fans.map((f) => `${f.name} ${f.fan}`).join(' ')} 共 {state.lastWinResult.totalFan} 番
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={startGame} className="border border-border font-medium text-foreground shadow-sm">
            重开
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {!state ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">中国通用麻将</h2>
            <div className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
              <p>· 四人局，你为「自家」，逆时针为下家、对家、上家。庄家 14 张先出，其余 13 张。</p>
              <p>· 轮到你时摸一张（14 张），可<strong>自摸</strong>胡或打出一张；他人打出的牌可<strong>吃</strong>（仅上家）、<strong>碰</strong>、<strong>杠</strong>、<strong>胡</strong>；胡优先于杠/碰/吃。</p>
              <p>· <strong>吃</strong>：上家打的牌与你手中两张组成顺子（仅万/条/筒）。<strong>碰</strong>：任意一家打的牌与你手中两张相同组成刻子。<strong>杠</strong>：明杠/暗杠/加杠，杠后从牌墙末尾补一张。</p>
              <p>· 胡牌：基础型 4 组（顺/刻）+ 1 对将；特殊型：七小对(4番)、龙七对(6番)、十三幺(8番)。</p>
              <p>· 番种：屁胡1、自摸1、杠上开花1、海底捞月1、门清1、对对胡2、混一色2、清一色4等，可叠加。</p>
            </div>
            <Button className="mt-6" onClick={startGame}>
              开始
            </Button>
          </div>
        ) : (
          <>
            {/* 局终结算明细 */}
            {state?.lastSettlement && state.lastSettlement.payments.length > 0 && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="mb-2 text-sm font-medium text-foreground">本局结算</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {state.lastSettlement.payments.map((p, i) => (
                    <li key={i}>
                      {SEAT_NAMES[p.from]} 付 {SEAT_NAMES[p.to]} {p.amount} 分
                      {p.reason === 'hu' ? ' (胡牌)' : ' (杠牌)'}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  当前分数: {SEAT_NAMES.map((name, i) => `${name} ${state.lastSettlement!.newScores[i]}`).join(' · ')}
                </p>
              </div>
            )}

            {/* 对家 / 上家 / 下家 手牌数 + 弃牌 */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((seat) => (
                <div
                  key={seat}
                  className="rounded border border-border bg-muted/30 px-3 py-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">{SEAT_NAMES[seat]}</p>
                  <p className="text-sm">
                    手牌 {state.hands[seat].length} 张 · 明牌 {state.melds[seat].length} 组
                  </p>
                  {state.discardPiles[seat].length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {state.discardPiles[seat].slice(-6).map((t, i) => (
                        <span key={i} className={cn('rounded px-1.5 py-0.5 text-xs', getTileStyle(t))}>
                          {TILE_LABELS[t]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 自家明牌组 */}
            {state.melds[0].length > 0 && (
              <div className="mb-2 rounded border border-border bg-muted/30 p-2">
                <p className="mb-1 text-xs font-medium text-foreground">自家 明牌</p>
                <div className="flex flex-wrap gap-2">
                  {state.melds[0].map((m, i) => (
                    <span key={i} className="flex flex-wrap items-center gap-0.5 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-sm">
                      {m.tiles.map((t, j) => (
                        <span key={j} className={cn('rounded px-1', getTileStyle(t))}>
                          {TILE_LABELS[t]}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">({m.type})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 自家手牌：有刚摸牌时单独展示，出牌后合并 */}
            {(() => {
              const hand = state.hands[0];
              const drawn = state.lastDrawnTile ?? null;
              const drawnIndex = drawn !== null ? hand.indexOf(drawn) : -1;
              const restHand = drawnIndex >= 0 ? hand.filter((_, i) => i !== drawnIndex) : hand;
              const restIndices = drawnIndex >= 0 ? hand.map((_, i) => i).filter((i) => i !== drawnIndex) : hand.map((_, i) => i);
              return (
                <div className="rounded-lg border-2 border-border bg-card p-4">
                  <p className="mb-2 text-sm text-foreground">
                    手牌 {hand.length} 张
                    {isMyTurn && ' · 点击一张打出'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {restHand.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {restHand.map((tile, i) => (
                          <button
                            key={`rest-${i}-${tile}`}
                            type="button"
                            onClick={() => isMyTurn && state.winner === null && discard(0, restIndices[i])}
                            disabled={!isMyTurn || state.winner !== null}
                            className={cn(
                              'rounded px-2.5 py-2 text-sm shadow-sm',
                              getTileStyle(tile),
                              isMyTurn && state.winner === null
                                ? 'cursor-pointer hover:opacity-90'
                                : 'cursor-default opacity-90',
                            )}
                          >
                            {TILE_LABELS[tile]}
                          </button>
                        ))}
                      </div>
                    )}
                    {drawn !== null && (
                      <>
                        <span className="text-xs font-medium text-muted-foreground">刚摸</span>
                        <button
                          type="button"
                          onClick={() => isMyTurn && state.winner === null && discard(0, drawnIndex)}
                          disabled={!isMyTurn || state.winner !== null}
                          className={cn(
                            'rounded px-2.5 py-2 text-sm shadow-md ring-2 ring-primary ring-offset-2',
                            getTileStyle(drawn),
                            isMyTurn && state.winner === null ? 'cursor-pointer hover:opacity-90' : 'cursor-default',
                          )}
                        >
                          {TILE_LABELS[drawn]}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 自家弃牌 */}
            {state.discardPiles[0].length > 0 && (
              <div className="mt-2 rounded border border-border bg-muted/30 p-2">
                <p className="text-xs font-medium text-foreground">自家 弃牌</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {state.discardPiles[0].map((t, i) => (
                    <span key={i} className={cn('rounded px-2 py-1 text-sm', getTileStyle(t))}>
                      {TILE_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 操作区：自摸 / 暗杠 / 吃碰杠胡 或 过 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canZiMo && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={doZiMo}
                >
                  自摸
                </Button>
              )}
              {isMyTurn &&
                state &&
                state.winner === null &&
                state.hands[0].length === 14 &&
                getJiagangOptions(state.hands[0], state.melds[0]).length > 0 && (
                  <>
                    {getJiagangOptions(state.hands[0], state.melds[0]).map((meldIdx) => (
                      <Button
                        key={meldIdx}
                        variant="outline"
                        size="sm"
                        onClick={() => doJiagang(meldIdx)}
                      >
                        加杠 {TILE_LABELS[state.melds[0][meldIdx].tiles[0]]}
                      </Button>
                    ))}
                  </>
                )}
              {isMyTurn &&
                state &&
                state.winner === null &&
                state.hands[0].length === 14 &&
                getAngangOptions(state.hands[0]).length > 0 && (
                  <>
                    {getAngangOptions(state.hands[0]).map((t) => (
                      <Button
                        key={t}
                        variant="outline"
                        size="sm"
                        onClick={() => doAngang(t)}
                      >
                        暗杠 {TILE_LABELS[t]}
                      </Button>
                    ))}
                  </>
                )}
              {isClaimPhase && state.claimOption && (
                <>
                  {state.claimOption.hu && (
                    <Button variant="default" size="sm" onClick={doHu}>
                      胡
                    </Button>
                  )}
                  {state.claimOption.gang && (
                    <Button variant="secondary" size="sm" onClick={doGang}>
                      杠
                    </Button>
                  )}
                  {state.claimOption.peng && (
                    <Button variant="secondary" size="sm" onClick={doPeng}>
                      碰
                    </Button>
                  )}
                  {state.claimOption.chi &&
                    state.claimOption.chi.map((opt, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => doChi(opt)}
                      >
                        吃 {TILE_LABELS[opt[0]]} {TILE_LABELS[opt[1]]}
                      </Button>
                    ))}
                  <Button variant="ghost" size="sm" onClick={passClaim}>
                    过
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default GameMahjongChinese;
