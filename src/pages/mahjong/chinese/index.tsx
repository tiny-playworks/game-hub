import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { useMahjongGame } from '@/hooks/useMahjongGame';
import { useMahjongSounds } from '@/hooks/useMahjongSounds';
import {
  checkWin,
  getAngangOptions,
  getJiagangOptions,
  SEAT_NAMES,
  TILE_LABELS,
} from '@/lib/mahjong';
import { cn } from '@/lib/utils';

const WAN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const ZI_LABELS = ['东', '南', '西', '北', '中', '发', '白'];

/** 手牌 70×96、粗黑体；弃牌区放大以便看清 */
const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
const TILE_SMALL =
  'w-[42px] h-[58px] rounded-[4px] border bg-[#fff9e6] flex items-center justify-center shrink-0 font-bold text-xs';
/** 刚摸的牌：上浮 + 阴影 + 粗边框高亮 + 脉动动画 */
const TILE_ACTIVE =
  'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60 animate-riichi-active-pulse';
const TILE_GAP = 'gap-2.5'; /* 10px */

/** 万红 / 条绿 / 筒黄 / 字深，边框与底色区分明显 */
function getTileColorClass(tile: number): string {
  if (tile >= 27) {
    if (tile === 31) return 'text-red-700 bg-red-50 border-red-400';
    if (tile === 32) return 'text-green-800 bg-emerald-50 border-emerald-500';
    if (tile === 33) return 'text-stone-700 bg-stone-200 border-stone-500';
    return 'text-stone-900 bg-stone-100 border-stone-600';
  }
  if (tile < 9) return 'text-red-800 bg-red-50 border-red-400';
  if (tile < 18) return 'text-green-800 bg-green-50 border-green-500';
  return 'text-amber-800 bg-amber-50 border-amber-500';
}

/** 筒子 1-9：中式琥珀色圆点 */
function TileDots({ n }: { n: number }) {
  const layouts: Record<number, number[]> = {
    1: [1],
    2: [1, 1],
    3: [1, 1, 1],
    4: [2, 2],
    5: [2, 1, 2],
    6: [3, 3],
    7: [2, 3, 2],
    8: [4, 4],
    9: [3, 3, 3],
  };
  const rows: number[] = layouts[n] ?? [1];
  let i = 0;
  return (
    <span className="inline-flex flex-col items-center justify-center gap-0.5">
      {rows.map((cols: number, ri: number) => (
        <span key={ri} className="flex gap-0.5">
          {Array.from({ length: cols }).map(() => {
            i += 1;
            return (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-amber-700"
                aria-hidden
              />
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** 条子 1-9：竹节墨绿色 */
function TileBamboo({ n }: { n: number }) {
  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    rows.push(Math.min(3, left));
    left -= 3;
  }
  rows.sort((a, b) => a - b);
  return (
    <span className="inline-flex flex-col items-center justify-center gap-0.5">
      {rows.map((count, ri) => (
        <span key={ri} className="flex items-center justify-center gap-px">
          {Array.from({ length: count }).map((_, i) => (
            <span
              key={i}
              className="rounded-sm bg-emerald-800 shrink-0"
              style={{ width: 4, height: 12 }}
              aria-hidden
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/** 万子：数字黑 + 「万」红，粗黑体 */
function TileWan({ tile }: { tile: number }) {
  const num = WAN_NUM[tile] ?? '';
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-stone-900">{num}</span>
      <span className="text-red-700 text-[0.65em]">万</span>
    </span>
  );
}

/** 牌面内容：字牌用字+颜色，万用数字+万，条用竹条，筒用圆点 */
function TileFace({ tile, className }: { tile: number; className?: string }) {
  if (tile >= 27) {
    const label = ZI_LABELS[tile - 27] ?? '';
    return <span className={className}>{label}</span>;
  }
  if (tile < 9) return <TileWan tile={tile} />;
  if (tile < 18) return <TileBamboo n={tile - 9 + 1} />;
  return <TileDots n={tile - 18 + 1} />;
}

const GameMahjongChinese = () => {
  const { t } = useLocale();
  const sounds = useMahjongSounds();
  const {
    state,
    startGame,
    discard,
    passClaim,
    runAiClaim,
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
  const prevHandLenRef = useRef<number>(0);
  const didPlayRyuukyokuRef = useRef(false);

  useEffect(() => {
    if (!needAiDiscard) return;
    const tid = setTimeout(runAiTurn, 600);
    return () => clearTimeout(tid);
  }, [needAiDiscard, runAiTurn]);

  useEffect(() => {
    if (!needPassClaim) return;
    const tid = setTimeout(runAiClaim, 400);
    return () => clearTimeout(tid);
  }, [needPassClaim, runAiClaim]);

  useEffect(() => {
    if (!state || state.phase !== 'discard' || state.currentPlayer !== 0)
      return;
    const len = state.hands[0].length;
    if (prevHandLenRef.current === 13 && len === 14) sounds.playDraw();
    prevHandLenRef.current = len;
  }, [
    state?.hands[0].length,
    state?.phase,
    state?.currentPlayer,
    state,
    sounds,
  ]);

  useEffect(() => {
    if (!state) return;
    if (!state.isDraw) {
      didPlayRyuukyokuRef.current = false;
      return;
    }
    if (didPlayRyuukyokuRef.current) return;
    didPlayRyuukyokuRef.current = true;
    sounds.playRyuukyoku();
  }, [state?.isDraw, state, sounds]);

  const isMyTurn =
    state?.phase === 'discard' &&
    state.currentPlayer === 0 &&
    state.winner === null;
  const isClaimPhase = state?.phase === 'claim' && state.lastDiscard !== null;
  const canZiMo =
    state?.phase === 'discard' &&
    state?.currentPlayer === 0 &&
    state?.winner === null &&
    state &&
    state.hands[0].length === 14 &&
    checkWin(state.hands[0], state.melds[0]);

  return (
    <div className="min-h-screen bg-[#1a2e25] text-[#f1faee] bg-gradient-to-b from-[#1a2e25] to-[#152019]">
      <header className="flex items-center justify-between border-b border-[#2d4a3c] bg-[#1a2e25] px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            to="/category/mahjong"
            className="text-[#f1faee]/80 hover:text-[#f1faee] text-sm"
          >
            ← {t('common.backToCategory')}
          </Link>
          <span className="text-[#f1faee] text-sm">
            {state ? `局 · 庄 ${SEAT_NAMES[state.dealer ?? 0]}` : '中国麻将'}
          </span>
          <button
            type="button"
            onClick={startGame}
            className="rounded-lg border border-[#d4b886] px-3 py-1.5 text-sm text-[#f1faee] hover:bg-[#2d4a3c]"
          >
            {t('common.restart')}
          </button>
        </div>
        {state?.scores && state.scores.length === 4 && (
          <span className="text-sm">
            {SEAT_NAMES.map((name, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {name}{' '}
                <span className="font-bold text-[#ffd700]">
                  {state.scores[i] ?? 0}
                </span>
              </span>
            ))}
          </span>
        )}
      </header>

      <main
        className="mx-auto max-w-6xl p-4 md:p-6 min-[400px]:p-4"
        style={{
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
        }}
      >
        {!state ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">中国通用麻将</h2>
            <div className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
              <p>
                ·
                四人局俯视牌桌：你在下方（自家），上方对家、左侧上家、右侧下家。庄家
                14 张先出，其余 13 张。
              </p>
              <p>
                · 轮到你时摸一张（14 张），可<strong>自摸</strong>
                胡或打出一张；他人打出的牌可<strong>吃</strong>（仅上家）、
                <strong>碰</strong>、<strong>杠</strong>、<strong>胡</strong>
                ；胡优先于杠/碰/吃。
              </p>
              <p>
                · <strong>吃</strong>
                ：上家打的牌与你手中两张组成顺子（仅万/条/筒）。
                <strong>碰</strong>：任意一家打的牌与你手中两张相同组成刻子。
                <strong>杠</strong>：明杠/暗杠/加杠，杠后从牌墙末尾补一张。
              </p>
              <p>
                · 胡牌：基础型 4 组（顺/刻）+ 1
                对将；特殊型：七小对(4番)、龙七对(6番)、十三幺(8番)。
              </p>
              <p>
                ·
                番种：屁胡1、自摸1、杠上开花1、海底捞月1、门清1、对对胡2、混一色2、清一色4等，可叠加。
              </p>
            </div>
            <button
              type="button"
              onClick={startGame}
              className="mt-6 h-11 rounded-lg px-6 font-semibold text-white bg-[#2d4a3c] hover:bg-[#3d5a4c] border border-[#d4b886]"
            >
              {t('common.start')}
            </button>
          </div>
        ) : (
          <>
            {state?.lastSettlement &&
              state.lastSettlement.payments.length > 0 && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    本局结算
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {state.lastSettlement.payments.map((p, i) => (
                      <li key={i}>
                        {SEAT_NAMES[p.from]} 付 {SEAT_NAMES[p.to]} {p.amount} 分
                        {p.reason === 'hu' ? ' (胡牌)' : ' (杠牌)'}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    当前分数:{' '}
                    {SEAT_NAMES.map(
                      (name, i) =>
                        `${name} ${state.lastSettlement?.newScores[i] ?? 0}`,
                    ).join(' · ')}
                  </p>
                </div>
              )}

            {state.winner !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in">
                <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {SEAT_NAMES[state.winner]} 胡牌
                  </p>
                  <p className="text-xs text-muted-foreground">
                    当前分数:{' '}
                    {SEAT_NAMES.map(
                      (name, i) => `${name} ${state.scores[i] ?? 0}`,
                    ).join(' · ')}
                  </p>
                </div>
              </div>
            )}
            {state.isDraw && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in">
                <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in">
                  <p className="text-sm font-medium text-foreground">流局</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-[#2d4a3c] p-4 md:p-6 mb-4 min-h-[520px] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              <p className="text-center text-sm text-[#f1faee]/90 mb-3">
                {state.isDraw
                  ? '流局'
                  : state.winner !== null
                    ? `${SEAT_NAMES[state.winner]} 胡牌`
                    : isClaimPhase
                      ? state.claimPlayer === 0
                        ? '轮到你：吃/碰/杠/胡 或 过'
                        : '等待要牌'
                      : isMyTurn
                        ? '轮到你出牌'
                        : '等待其他玩家'}
              </p>
              <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-3">
                <div />
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 flex flex-col items-center justify-center min-h-[64px] transition-colors',
                    state.currentPlayer === 2 &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[2].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1 flex items-center gap-1">
                    {SEAT_NAMES[2]}
                    {state.currentPlayer === 2 && state.winner === null && (
                      <span className="text-[10px] text-[#ffc107]">⏳出牌</span>
                    )}
                  </p>
                  <span className="text-xs font-bold text-[#ffd700]">
                    {state.scores?.[2] ?? 0} 分
                  </span>
                  {state.discardPiles[2].length > 0 && (
                    <div
                      className={cn(
                        'flex flex-wrap justify-center mt-1',
                        TILE_GAP,
                      )}
                    >
                      {state.discardPiles[2].slice(-4).map((t, i) => (
                        <span
                          key={i}
                          className={cn(TILE_SMALL, getTileColorClass(t))}
                        >
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div />
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 flex flex-col items-center justify-center transition-colors',
                    state.currentPlayer === 3 &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[3].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1 flex items-center gap-1">
                    {SEAT_NAMES[3]}
                    {state.currentPlayer === 3 && state.winner === null && (
                      <span className="text-[10px] text-[#ffc107]">⏳出牌</span>
                    )}
                  </p>
                  <span className="text-xs font-bold text-[#ffd700]">
                    {state.scores?.[3] ?? 0} 分
                  </span>
                  {state.discardPiles[3].length > 0 && (
                    <div className={cn('flex flex-col mt-1', TILE_GAP)}>
                      {state.discardPiles[3].slice(-3).map((t, i) => (
                        <span
                          key={i}
                          className={cn(TILE_SMALL, getTileColorClass(t))}
                        >
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-[#1a2e25]/50 flex flex-col p-3 min-h-[120px]">
                  <p className="text-center text-3xl font-extrabold text-[#ffd700] tabular-nums mb-2">
                    剩余 {state.deck.length}
                  </p>
                  <div className="flex flex-col gap-2 overflow-auto">
                    {([0, 1, 2, 3] as const).map((seat) => (
                      <div
                        key={seat}
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <span className="text-[10px] text-[#f1faee]/70 w-6 shrink-0">
                          {SEAT_NAMES[seat]}
                        </span>
                        {state.discardPiles[seat].slice(-8).map((t, i) => (
                          <span
                            key={`${seat}-${i}`}
                            className={cn(TILE_DISCARD, getTileColorClass(t))}
                          >
                            <TileFace tile={t} />
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 flex flex-col items-center justify-center transition-colors',
                    state.currentPlayer === 1 &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[1].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1 flex items-center gap-1">
                    {SEAT_NAMES[1]}
                    {state.currentPlayer === 1 && state.winner === null && (
                      <span className="text-[10px] text-[#ffc107]">⏳出牌</span>
                    )}
                  </p>
                  <span className="text-xs font-bold text-[#ffd700]">
                    {state.scores?.[1] ?? 0} 分
                  </span>
                  {state.discardPiles[1].length > 0 && (
                    <div className={cn('flex flex-col mt-1', TILE_GAP)}>
                      {state.discardPiles[1].slice(-3).map((t, i) => (
                        <span
                          key={i}
                          className={cn(TILE_SMALL, getTileColorClass(t))}
                        >
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div />
                <div className="col-span-3 rounded-xl bg-[#2d4a3c]/80 p-4 space-y-3">
                  {isMyTurn && state.winner === null && (
                    <p className="text-center text-sm text-[#ffc107]/90">
                      点击手牌出牌
                    </p>
                  )}
                  {state.melds[0].length > 0 && (
                    <div
                      className={cn('flex flex-wrap justify-center', TILE_GAP)}
                    >
                      {state.melds[0].map((m, i) => (
                        <span
                          key={i}
                          className={cn(
                            'flex flex-wrap rounded-lg border border-[#d4b886] bg-[#fff9e6]/90 p-1',
                            TILE_GAP,
                          )}
                        >
                          {m.tiles.map((t, j) => (
                            <span
                              key={j}
                              className={cn(TILE_HAND, getTileColorClass(t))}
                            >
                              <TileFace tile={t} />
                            </span>
                          ))}
                        </span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const hand = state.hands[0];
                    const drawn = state.lastDrawnTile ?? null;
                    const drawnIndex =
                      drawn !== null ? hand.indexOf(drawn) : -1;
                    const restHand =
                      drawnIndex >= 0
                        ? hand.filter((_, i) => i !== drawnIndex)
                        : hand;
                    const restIndices =
                      drawnIndex >= 0
                        ? hand.map((_, i) => i).filter((i) => i !== drawnIndex)
                        : hand.map((_, i) => i);
                    const canDiscard = isMyTurn && state.winner === null;
                    return (
                      <div
                        className={cn(
                          'flex flex-wrap justify-center items-center',
                          TILE_GAP,
                        )}
                      >
                        {restHand.length > 0 &&
                          restHand.map((tile, i) => (
                            <button
                              key={`rest-${i}-${tile}`}
                              type="button"
                              onClick={() => {
                                if (canDiscard) {
                                  sounds.playDiscard();
                                  discard(0, restIndices[i]);
                                }
                              }}
                              disabled={!canDiscard}
                              className={cn(
                                TILE_HAND,
                                getTileColorClass(tile),
                                canDiscard &&
                                  'cursor-pointer hover:border-[#ffc107] hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]',
                                !canDiscard && 'cursor-default opacity-90',
                              )}
                            >
                              <TileFace tile={tile} />
                            </button>
                          ))}
                        {drawn !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              if (canDiscard) {
                                sounds.playDiscard();
                                discard(0, drawnIndex);
                              }
                            }}
                            disabled={!canDiscard}
                            className={cn(
                              TILE_HAND,
                              getTileColorClass(drawn),
                              TILE_ACTIVE,
                              'animate-riichi-tile-drawn',
                              canDiscard &&
                                'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                              !canDiscard && 'cursor-default',
                            )}
                          >
                            <TileFace tile={drawn} />
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-2 py-3 px-4">
              {canZiMo && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTsumo();
                    doZiMo();
                  }}
                  className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#e63946] hover:bg-[#d62839] active:scale-[0.98] transition-all"
                >
                  自摸
                </button>
              )}
              {isMyTurn &&
                state?.winner === null &&
                state.hands[0].length === 14 &&
                getJiagangOptions(state.hands[0], state.melds[0]).length > 0 &&
                getJiagangOptions(state.hands[0], state.melds[0]).map(
                  (meldIdx) => (
                    <button
                      key={meldIdx}
                      type="button"
                      onClick={() => {
                        sounds.playKan();
                        doJiagang(meldIdx);
                      }}
                      className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98] transition-all"
                    >
                      加杠 {TILE_LABELS[state.melds[0][meldIdx].tiles[0]]}
                    </button>
                  ),
                )}
              {isMyTurn &&
                state?.winner === null &&
                state.hands[0].length === 14 &&
                getAngangOptions(state.hands[0]).length > 0 &&
                getAngangOptions(state.hands[0]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      sounds.playKan();
                      doAngang(t);
                    }}
                    className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98] transition-all"
                  >
                    暗杠 {TILE_LABELS[t]}
                  </button>
                ))}
              {isClaimPhase && state.claimPlayer === 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.claimOption?.hu) {
                        sounds.playRon();
                        doHu();
                      }
                    }}
                    disabled={!state.claimOption?.hu}
                    className={cn(
                      'h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white transition-all',
                      state.claimOption?.hu
                        ? 'bg-[#e63946] hover:bg-[#d62839] active:scale-[0.98]'
                        : 'bg-[#6b7280]/50 cursor-not-allowed opacity-60',
                    )}
                  >
                    胡
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.claimOption?.gang) {
                        sounds.playKan();
                        doGang();
                      }
                    }}
                    disabled={!state.claimOption?.gang}
                    className={cn(
                      'h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white transition-all',
                      state.claimOption?.gang
                        ? 'bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98]'
                        : 'bg-[#6b7280]/50 cursor-not-allowed opacity-60',
                    )}
                  >
                    杠
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.claimOption?.peng) {
                        sounds.playPon();
                        doPeng();
                      }
                    }}
                    disabled={!state.claimOption?.peng}
                    className={cn(
                      'h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white transition-all',
                      state.claimOption?.peng
                        ? 'bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98]'
                        : 'bg-[#6b7280]/50 cursor-not-allowed opacity-60',
                    )}
                  >
                    碰
                  </button>
                  {state.claimOption?.chi &&
                  state.claimOption.chi.length > 0 ? (
                    state.claimOption.chi.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          sounds.playChi();
                          doChi(opt);
                        }}
                        className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#457b9d] hover:bg-[#3d6b8a] active:scale-[0.98] transition-all"
                      >
                        吃 {TILE_LABELS[opt[0]]}
                        {TILE_LABELS[opt[1]]}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#6b7280]/50 cursor-not-allowed opacity-60"
                    >
                      吃
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={passClaim}
                    className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#6b7280] hover:bg-[#5a6070] active:scale-[0.98] transition-all"
                  >
                    过
                  </button>
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
