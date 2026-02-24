import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSichuanMahjongGame } from '@/hooks/useSichuanMahjongGame';
import {
  checkWinSichuan,
  getAngangOptionsSichuan,
  getJiagangOptionsSichuan,
  getPlayerQueMenOptions,
  SUIT_NAMES,
  type SuitType,
  TILE_LABELS_SICHUAN,
} from '@/lib/mahjongSichuan';
import { cn } from '@/lib/utils';

const WAN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const ZI_LABELS = ['东', '南', '西', '北', '中', '发', '白'];

const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
const TILE_SMALL =
  'w-[42px] h-[58px] rounded-[4px] border bg-[#fff9e6] flex items-center justify-center shrink-0 font-bold text-xs';
const TILE_ACTIVE =
  'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60';
const TILE_GAP = 'gap-2.5';

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

function TileWan({ tile }: { tile: number }) {
  const num = WAN_NUM[tile] ?? '';
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-stone-900">{num}</span>
      <span className="text-red-700 text-[0.65em]">万</span>
    </span>
  );
}

function TileFace({ tile, className }: { tile: number; className?: string }) {
  if (tile >= 27) {
    const label = ZI_LABELS[tile - 27] ?? '';
    return <span className={className}>{label}</span>;
  }
  if (tile < 9) return <TileWan tile={tile} />;
  if (tile < 18) return <TileBamboo n={tile - 9 + 1} />;
  return <TileDots n={tile - 18 + 1} />;
}

const GameMahjongSichuan = () => {
  const {
    state,
    startGame,
    declareQueMen,
    discard,
    passClaim,
    doHu,
    doPeng,
    doGang,
    doJiagang,
    doAngang,
    doZiMo,
    SEAT_NAMES,
  } = useSichuanMahjongGame();

  const isQueMenPhase = state?.phase === 'queMen';
  const needHumanQueMen = isQueMenPhase && !state?.isQueMenDeclared[0];
  const needAiQueMen = isQueMenPhase && state?.isQueMenDeclared[0];

  useEffect(() => {
    if (!needAiQueMen || !state) return;
    const firstAi = [1, 2, 3].find((i) => !state.isQueMenDeclared[i]);
    if (firstAi === undefined) return;
    const opts = getPlayerQueMenOptions(state.hands[firstAi]);
    if (opts.length === 0) return;
    const t = setTimeout(() => {
      declareQueMen(firstAi, opts[Math.floor(Math.random() * opts.length)]);
    }, 300);
    return () => clearTimeout(t);
  }, [needAiQueMen, state, declareQueMen]);

  const isMyTurn =
    state?.phase === 'discard' &&
    state.currentPlayer === 0 &&
    !state.isGameOver;
  const isClaimPhase =
    state?.phase === 'claim' &&
    state.lastDiscard !== null &&
    state.claimPlayer === 0;
  const canZiMo =
    state?.phase === 'discard' &&
    state?.currentPlayer === 0 &&
    !state?.isGameOver &&
    state &&
    state.hands[0].length === 14 &&
    checkWinSichuan(state.hands[0], state.melds[0], state.queMen[0]);

  return (
    <div className="min-h-screen bg-[#1a2e25] text-[#f1faee] bg-gradient-to-b from-[#1a2e25] to-[#152019]">
      <header className="flex items-center justify-between border-b border-[#2d4a3c] bg-[#1a2e25] px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            to="/category/mahjong"
            className="text-[#f1faee]/80 hover:text-[#f1faee] text-sm"
          >
            ← 返回
          </Link>
          <span className="text-[#f1faee] text-sm">
            {state
              ? `四川麻将 · 庄 ${SEAT_NAMES[state.dealer ?? 0]}`
              : '四川麻将'}
          </span>
          <button
            type="button"
            onClick={startGame}
            className="rounded-lg border border-[#d4b886] px-3 py-1.5 text-sm text-[#f1faee] hover:bg-[#2d4a3c]"
          >
            重开
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
            <h2 className="text-lg font-semibold">四川麻将</h2>
            <div className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
              <p>
                · 血战到底：四人局，108 张（仅万/条/筒，无字牌），庄家 14
                张先出，其余 13 张。
              </p>
              <p>· 定缺：开局选定缺门花色，胡牌前须打完定缺且手牌花色数≤2。</p>
              <p>
                · 仅碰、杠、胡（无吃牌）；胡优先于杠/碰。自摸 3 家付，点炮 1
                家付；番数乘算（基础番×自摸×杠上花等）。
              </p>
              <p>
                ·
                番型：平胡、对对胡、清一色、七对、龙七对、清对、清七对、全幺九等；加分项自摸×2、杠上花×2、金钩钓×2。
              </p>
            </div>
            <button
              type="button"
              onClick={startGame}
              className="mt-6 h-11 rounded-lg px-6 font-semibold text-white bg-[#2d4a3c] hover:bg-[#3d5a4c] border border-[#d4b886]"
            >
              开始
            </button>
          </div>
        ) : needHumanQueMen ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">定缺</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              选择本局要缺的花色（手牌中需有该花色）
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {getPlayerQueMenOptions(state.hands[0]).map((suit: SuitType) => (
                <button
                  key={suit}
                  type="button"
                  onClick={() => declareQueMen(0, suit)}
                  className="rounded-lg border-2 border-[#d4b886] px-6 py-3 text-lg font-semibold text-[#f1faee] hover:bg-[#2d4a3c]"
                >
                  {SUIT_NAMES[suit]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {state.isGameOver && state.huPlayers.length > 0 && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  {SEAT_NAMES[state.huPlayers[0]]} 胡牌
                </p>
                <p className="text-xs text-muted-foreground">
                  当前分数:{' '}
                  {SEAT_NAMES.map(
                    (name, i) => `${name} ${state.scores[i]}`,
                  ).join(' · ')}
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-[#2d4a3c] p-4 md:p-6 mb-4 min-h-[520px] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              <p className="text-center text-sm text-[#f1faee]/90 mb-3">
                {state.isGameOver
                  ? '局终'
                  : isClaimPhase
                    ? '轮到你：碰/杠/胡 或 过'
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
                      !state.isGameOver &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[2].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1">
                    {SEAT_NAMES[2]}
                    {state.currentPlayer === 2 && !state.isGameOver && (
                      <span className="text-[10px] text-[#ffc107] ml-1">
                        ⏳出牌
                      </span>
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
                      !state.isGameOver &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[3].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1">
                    {SEAT_NAMES[3]}
                    {state.currentPlayer === 3 && !state.isGameOver && (
                      <span className="text-[10px] text-[#ffc107] ml-1">
                        ⏳出牌
                      </span>
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
                    剩余 {state.wall.length}
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
                      !state.isGameOver &&
                      'bg-[#ffc107]/10 border border-[#ffc107]/40',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2d4a3c] border-2 border-[#d4b886] flex items-center justify-center text-sm font-bold text-[#ffd700]">
                    {SEAT_NAMES[1].slice(0, 1)}
                  </div>
                  <p className="text-xs font-semibold text-[#f1faee] mt-1">
                    {SEAT_NAMES[1]}
                    {state.currentPlayer === 1 && !state.isGameOver && (
                      <span className="text-[10px] text-[#ffc107] ml-1">
                        ⏳出牌
                      </span>
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
                  {state.queMen[0] && (
                    <p className="text-center text-xs text-[#f1faee]/80">
                      定缺: {SUIT_NAMES[state.queMen[0]]}
                    </p>
                  )}
                  {isMyTurn && !state.isGameOver && (
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
                    const drawn = state.drawnTile ?? null;
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
                    const canDiscard = isMyTurn && !state.isGameOver;
                    return (
                      <div
                        className={cn(
                          'flex flex-wrap justify-center items-center',
                          TILE_GAP,
                        )}
                      >
                        {restHand.map((tile, i) => (
                          <button
                            key={`rest-${i}-${tile}`}
                            type="button"
                            onClick={() =>
                              canDiscard && discard(0, restIndices[i])
                            }
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
                            onClick={() => canDiscard && discard(0, drawnIndex)}
                            disabled={!canDiscard}
                            className={cn(
                              TILE_HAND,
                              getTileColorClass(drawn),
                              TILE_ACTIVE,
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
                  onClick={doZiMo}
                  className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#e63946] hover:bg-[#d62839] active:scale-[0.98] transition-all"
                >
                  自摸
                </button>
              )}
              {isMyTurn &&
                !state?.isGameOver &&
                state.hands[0].length === 14 &&
                getJiagangOptionsSichuan(state.hands[0], state.melds[0])
                  .length > 0 &&
                getJiagangOptionsSichuan(state.hands[0], state.melds[0]).map(
                  (meldIdx) => (
                    <button
                      key={meldIdx}
                      type="button"
                      onClick={() => doJiagang(meldIdx)}
                      className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98] transition-all"
                    >
                      加杠{' '}
                      {TILE_LABELS_SICHUAN[state.melds[0][meldIdx].tiles[0]]}
                    </button>
                  ),
                )}
              {isMyTurn &&
                !state?.isGameOver &&
                state.hands[0].length === 14 &&
                getAngangOptionsSichuan(state.hands[0]).length > 0 &&
                getAngangOptionsSichuan(state.hands[0]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => doAngang(t)}
                    className="h-11 min-w-[72px] rounded-lg px-4 font-semibold text-white bg-[#f4a261] hover:bg-[#e76f51] active:scale-[0.98] transition-all"
                  >
                    暗杠 {TILE_LABELS_SICHUAN[t]}
                  </button>
                ))}
              {isClaimPhase && (
                <>
                  <button
                    type="button"
                    onClick={doHu}
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
                    onClick={doGang}
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
                    onClick={doPeng}
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

export default GameMahjongSichuan;
