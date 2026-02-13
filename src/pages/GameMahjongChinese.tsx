import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  TILE_LABELS,
  SEAT_NAMES,
  getAngangOptions,
  getJiagangOptions,
} from "@/lib/mahjong";
import { useMahjongGame } from "@/hooks/useMahjongGame";
import { cn } from "@/lib/utils";

const WAN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const ZI_LABELS = ["东", "南", "西", "北", "中", "发", "白"];

/** 牌面尺寸：移动端 ≥48px，桌面端 ≥60px；统一圆角与字重 */
const TILE_BOX_BASE =
  "min-w-[48px] w-12 min-h-[64px] h-16 md:min-w-[60px] md:w-[60px] md:min-h-[80px] md:h-20 flex items-center justify-center shrink-0 rounded-md overflow-hidden text-sm md:text-base font-black transition-all duration-200";
/** 对手牌略小 */
const TILE_BOX_SMALL =
  "min-w-[36px] w-9 min-h-[48px] h-12 md:min-w-[44px] md:w-11 md:min-h-[58px] md:h-[58px] flex items-center justify-center shrink-0 rounded overflow-hidden text-xs font-black";

/** 中式风格：暗红/墨绿/金色为主，粗黑体 */
function getTileStyle(tile: number): string {
  if (tile >= 27) {
    if (tile === 31)
      return "border-2 border-red-700 bg-red-100 text-red-800"; // 红中
    if (tile === 32)
      return "border-2 border-emerald-800 bg-emerald-100 text-emerald-900"; // 发财
    if (tile === 33)
      return "border-2 border-stone-500 bg-stone-200 text-stone-800"; // 白板
    return "border-2 border-stone-600 bg-stone-100 text-stone-900"; // 东南西北
  }
  if (tile < 9) return "border-2 border-red-700/80 bg-red-50/95 text-red-900"; // 万
  if (tile < 18) return "border-2 border-emerald-700/80 bg-emerald-50/95 text-emerald-900"; // 条
  return "border-2 border-amber-700/80 bg-amber-50/95 text-amber-900"; // 筒
}

/** 选中/出牌高亮：上浮 + 阴影 + 边框 */
const TILE_SELECTED =
  "shadow-lg -translate-y-1.5 ring-2 ring-amber-500 ring-offset-2 ring-offset-amber-50";

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
  const num = WAN_NUM[tile] ?? "";
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
    const label = ZI_LABELS[tile - 27] ?? "";
    return <span className={className}>{label}</span>;
  }
  if (tile < 9) return <TileWan tile={tile} />;
  if (tile < 18) return <TileBamboo n={tile - 9 + 1} />;
  return <TileDots n={tile - 18 + 1} />;
}

const GameMahjongChinese = () => {
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

  useEffect(() => {
    if (!needAiDiscard) return;
    const t = setTimeout(runAiTurn, 600);
    return () => clearTimeout(t);
  }, [needAiDiscard, runAiTurn]);

  // 轮到 AI 要牌时（claimOption 为 null）由 runAiClaim 决策：胡/杠/碰/吃 或 过
  useEffect(() => {
    if (!needPassClaim) return;
    const t = setTimeout(runAiClaim, 400);
    return () => clearTimeout(t);
  }, [needPassClaim, runAiClaim]);

  const isMyTurn =
    state?.phase === "discard" &&
    state.currentPlayer === 0 &&
    state.winner === null;
  const isClaimPhase = state?.phase === "claim" && state.lastDiscard !== null;
  const canZiMo =
    state?.phase === "discard" &&
    state?.currentPlayer === 0 &&
    state?.winner === null &&
    state &&
    state.hands[0].length === 14;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-200 via-stone-100 to-amber-950/5">
      {/* 信息层级：左上 房间/局数，右上 分数/操作 */}
      <header className="flex items-center justify-between border-b border-stone-300 bg-stone-200/60 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/category/mahjong"
            className="text-stone-600 hover:text-stone-900 text-sm"
          >
            ← 返回
          </Link>
          <span className="text-stone-700 font-medium text-sm">
            {state ? `局 · 庄 ${SEAT_NAMES[state.dealer ?? 0]}` : "中国麻将"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={startGame}
            className="border-stone-400 text-stone-700"
          >
            重开
          </Button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {state?.scores && state.scores.length === 4 && (
            <span className="font-medium text-stone-800">
              {SEAT_NAMES.map((name, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {name} <span className="text-amber-700">{state.scores[i] ?? 0}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6 min-[400px]:p-4" style={{ paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>
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
            <Button className="mt-6" onClick={startGame}>
              开始
            </Button>
          </div>
        ) : (
          <>
            {/* 局终结算明细 */}
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
                        {p.reason === "hu" ? " (胡牌)" : " (杠牌)"}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    当前分数:{" "}
                    {SEAT_NAMES.map(
                      (name, i) =>
                        `${name} ${state.lastSettlement!.newScores[i]}`,
                    ).join(" · ")}
                  </p>
                </div>
              )}

            {/* 俯视牌桌：低饱和度、不抢眼；出牌/摸牌有 transition 过渡 */}
            <div className="rounded-2xl border-2 border-amber-800/30 bg-amber-900/10 p-4 md:p-6 shadow-xl mb-4 min-h-[520px] md:min-h-[560px] transition-shadow duration-300">
              {/* 状态提示：单行，不挤在牌桌内 */}
              <p className="text-center text-sm text-stone-600 mb-3">
                {state.isDraw
                  ? "流局"
                  : state.winner !== null
                    ? `${SEAT_NAMES[state.winner]} 胡牌`
                    : isClaimPhase
                      ? (state.claimPlayer === 0 ? "轮到你：吃/碰/杠/胡 或 过" : "等待要牌")
                      : isMyTurn
                        ? "轮到你出牌"
                        : "等待其他玩家"}
              </p>
              <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-3 md:gap-4 flex-1">
                <div className="flex flex-col items-center justify-end">
                  <span className="text-[10px] text-stone-500 mb-1">剩余</span>
                  <span className="text-sm font-bold text-amber-800 tabular-nums">{state.deck.length}</span>
                </div>
                {/* 对家 seat 2 - 上 */}
                <div className="rounded-xl bg-white/70 border border-amber-700/20 px-2 py-2 flex flex-col items-center justify-center min-h-[56px]">
                  <div className="w-8 h-8 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-xs font-bold text-amber-800">
                    {SEAT_NAMES[2].slice(0, 1)}
                  </div>
                  <p className="text-xs font-medium text-stone-700 mt-1">{SEAT_NAMES[2]}</p>
                  <span className="text-[10px] text-amber-700 font-medium">{state.scores?.[2] ?? 0} 分</span>
                  {state.discardPiles[2].length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                      {state.discardPiles[2].slice(-4).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX_SMALL, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div />
                {/* 上家 seat 3 - 左 */}
                <div className="rounded-xl bg-white/70 border border-amber-700/20 px-2 py-2 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-xs font-bold text-amber-800">
                    {SEAT_NAMES[3].slice(0, 1)}
                  </div>
                  <p className="text-xs font-medium text-stone-700 mt-1">{SEAT_NAMES[3]}</p>
                  <span className="text-[10px] text-amber-700 font-medium">{state.scores?.[3] ?? 0} 分</span>
                  {state.discardPiles[3].length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {state.discardPiles[3].slice(-3).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX_SMALL, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* 中央牌池 */}
                <div className="rounded-xl bg-amber-800/10 border border-dashed border-amber-700/30 flex flex-wrap content-start gap-1 p-3 overflow-auto">
                  {[0, 1, 2, 3].map((seat) =>
                    state.discardPiles[seat].slice(-5).map((t, i) => (
                      <span key={`${seat}-${i}`} className={cn(TILE_BOX_SMALL, getTileStyle(t))}>
                        <TileFace tile={t} />
                      </span>
                    )),
                  )}
                </div>
                {/* 下家 seat 1 - 右 */}
                <div className="rounded-xl bg-white/70 border border-amber-700/20 px-2 py-2 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-xs font-bold text-amber-800">
                    {SEAT_NAMES[1].slice(0, 1)}
                  </div>
                  <p className="text-xs font-medium text-stone-700 mt-1">{SEAT_NAMES[1]}</p>
                  <span className="text-[10px] text-amber-700 font-medium">{state.scores?.[1] ?? 0} 分</span>
                  {state.discardPiles[1].length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {state.discardPiles[1].slice(-3).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX_SMALL, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div />
                {/* 自家 seat 0 - 下：牌大且清晰，选中上浮+阴影+边框 */}
                <div className="col-span-3 rounded-xl bg-white/95 border-2 border-amber-500/50 p-3 md:p-4 space-y-3">
                  {state.melds[0].length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-stone-500">明牌</span>
                      {state.melds[0].map((m, i) => (
                        <span
                          key={i}
                          className="flex flex-wrap items-center gap-1 rounded-md border border-amber-600/30 bg-amber-50/80 p-1"
                        >
                          {m.tiles.map((t, j) => (
                            <span key={j} className={cn(TILE_BOX_BASE, getTileStyle(t))}>
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
                    const drawnIndex = drawn !== null ? hand.indexOf(drawn) : -1;
                    const restHand = drawnIndex >= 0 ? hand.filter((_, i) => i !== drawnIndex) : hand;
                    const restIndices = drawnIndex >= 0 ? hand.map((_, i) => i).filter((i) => i !== drawnIndex) : hand.map((_, i) => i);
                    const canDiscard = isMyTurn && state.winner === null;
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        {restHand.length > 0 &&
                          restHand.map((tile, i) => (
                            <button
                              key={`rest-${i}-${tile}`}
                              type="button"
                              onClick={() => canDiscard && discard(0, restIndices[i])}
                              disabled={!canDiscard}
                              className={cn(
                                TILE_BOX_BASE,
                                getTileStyle(tile),
                                "hover:shadow-md hover:-translate-y-0.5",
                                canDiscard && "cursor-pointer hover:ring-2 hover:ring-amber-500 hover:ring-offset-2 active:scale-[0.98] transition-all",
                                !canDiscard && "cursor-default opacity-90",
                              )}
                            >
                              <TileFace tile={tile} />
                            </button>
                          ))}
                        {drawn !== null && (
                          <>
                            <span className="text-xs font-medium text-stone-500">刚摸</span>
                            <button
                              type="button"
                              onClick={() => canDiscard && discard(0, drawnIndex)}
                              disabled={!canDiscard}
                              className={cn(
                                TILE_BOX_BASE,
                                getTileStyle(drawn),
                                TILE_SELECTED,
                                canDiscard && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all",
                                !canDiscard && "cursor-default",
                              )}
                            >
                              <TileFace tile={drawn} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {state.discardPiles[0].length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-stone-500">弃牌</span>
                      {state.discardPiles[0].slice(-8).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX_BASE, getTileStyle(t), "opacity-90")}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部中央：操作区（吃/碰/杠/胡/过）— 别人出牌才显示吃碰杠胡，自己摸牌只显示杠/胡/过 */}
            <div className="flex flex-wrap justify-center items-center gap-2 py-3 px-4 bg-white/80 rounded-xl border border-amber-700/20 shadow-sm">
              {canZiMo && (
                <Button size="lg" onClick={doZiMo} className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md min-w-[72px]">
                  自摸
                </Button>
              )}
              {isMyTurn && state?.winner === null && state.hands[0].length === 14 && getJiagangOptions(state.hands[0], state.melds[0]).length > 0 &&
                getJiagangOptions(state.hands[0], state.melds[0]).map((meldIdx) => (
                  <Button key={meldIdx} size="lg" variant="outline" onClick={() => doJiagang(meldIdx)} className="border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100 font-bold min-w-[72px]">
                    加杠 {TILE_LABELS[state.melds[0][meldIdx].tiles[0]]}
                  </Button>
                ))}
              {isMyTurn && state?.winner === null && state.hands[0].length === 14 && getAngangOptions(state.hands[0]).length > 0 &&
                getAngangOptions(state.hands[0]).map((t) => (
                  <Button key={t} size="lg" variant="outline" onClick={() => doAngang(t)} className="border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100 font-bold min-w-[72px]">
                    暗杠 {TILE_LABELS[t]}
                  </Button>
                ))}
              {isClaimPhase && state.claimOption && (
                <>
                  {state.claimOption.hu && (
                    <Button size="lg" onClick={doHu} className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md min-w-[72px]">
                      胡
                    </Button>
                  )}
                  {state.claimOption.gang && (
                    <Button size="lg" variant="outline" onClick={doGang} className="border-amber-600 bg-amber-100 text-amber-900 hover:bg-amber-200 font-bold min-w-[72px]">
                      杠
                    </Button>
                  )}
                  {state.claimOption.peng && (
                    <Button size="lg" variant="outline" onClick={doPeng} className="border-amber-600 bg-amber-100 text-amber-900 hover:bg-amber-200 font-bold min-w-[72px]">
                      碰
                    </Button>
                  )}
                  {state.claimOption.chi && state.claimOption.chi.map((opt, i) => (
                    <Button key={i} size="lg" variant="outline" onClick={() => doChi(opt)} className="border-blue-600 bg-blue-50 text-blue-900 hover:bg-blue-100 font-bold min-w-[72px]">
                      吃 {TILE_LABELS[opt[0]]}{TILE_LABELS[opt[1]]}
                    </Button>
                  ))}
                  <Button size="lg" variant="ghost" onClick={passClaim} className="text-stone-500 hover:text-stone-700 hover:bg-stone-100 min-w-[72px]">
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
