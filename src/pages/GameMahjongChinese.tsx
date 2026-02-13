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

/** 统一牌面外框：宽高一致（边框由 getTileStyle 提供） */
const TILE_BOX =
  "w-12 h-16 flex items-center justify-center shrink-0 rounded overflow-hidden text-sm";

/** 字牌：东南西北黑、红中红、发财绿、白板白；数牌用底色区分 */
function getTileStyle(tile: number): string {
  if (tile >= 27) {
    if (tile === 31)
      return "border-2 border-red-400 bg-red-50 text-red-600 font-bold"; // 红中
    if (tile === 32)
      return "border-2 border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"; // 发财
    if (tile === 33)
      return "border-2 border-slate-400 bg-slate-200 text-white font-bold"; // 白板：白字深灰底
    return "border-2 border-slate-400 bg-slate-50 text-slate-900 font-bold"; // 东南西北 黑
  }
  if (tile < 9) return "border-2 border-red-300 bg-red-50/90"; // 万
  if (tile < 18) return "border-2 border-emerald-400 bg-emerald-50/90"; // 条
  return "border-2 border-sky-400 bg-sky-50/90"; // 筒
}

/** 筒子 1-9 的圆点布局：每张牌用若干小圆表示 */
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
                className="h-1.5 w-1.5 rounded-full bg-sky-700"
                aria-hidden
              />
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** 条子 1-9：用竖条（竹节）表示，每行最多 3 条；单数时少的在上（如 5 条=2+3，7 条=1+3+3） */
function TileBamboo({ n }: { n: number }) {
  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    rows.push(Math.min(3, left));
    left -= 3;
  }
  rows.sort((a, b) => a - b); // 小的行放上面
  return (
    <span className="inline-flex flex-col items-center justify-center gap-0.5">
      {rows.map((count, ri) => (
        <span key={ri} className="flex items-center justify-center gap-px">
          {Array.from({ length: count }).map((_, i) => (
            <span
              key={i}
              className="rounded-sm bg-emerald-600 shrink-0"
              style={{ width: 4, height: 12 }}
              aria-hidden
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/** 万子：数字黑 + 「万」红（仿实物牌面） */
function TileWan({ tile }: { tile: number }) {
  const num = WAN_NUM[tile] ?? "";
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-slate-800 font-bold">{num}</span>
      <span className="text-red-600 font-bold text-[0.65em]">万</span>
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
              ? "流局"
              : state && state.winner !== null
                ? `${SEAT_NAMES[state.winner]} 胡牌`
                : isClaimPhase
                  ? "有人出牌，可选择吃/碰/杠/胡或过"
                  : isMyTurn
                    ? "轮到你出牌"
                    : "等待其他玩家"}
          </span>
          {state && (state.dealer ?? 0) >= 0 && (
            <span className="text-xs font-medium text-foreground">
              庄: {SEAT_NAMES[state.dealer ?? 0]}
            </span>
          )}
          {state?.scores && state.scores.length === 4 && (
            <span className="text-xs font-medium text-foreground">
              分数:{" "}
              {SEAT_NAMES.map(
                (name, i) => `${name} ${state.scores[i] ?? 0}`,
              ).join(" · ")}
            </span>
          )}
          {state?.lastWinResult && (
            <span className="text-xs font-medium text-foreground">
              番:{" "}
              {state.lastWinResult.fans
                .map((f) => `${f.name} ${f.fan}`)
                .join(" ")}{" "}
              共 {state.lastWinResult.totalFan} 番
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={startGame}
            className="border border-border font-medium text-foreground shadow-sm"
          >
            重开
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
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

            {/* 俯视牌桌：四边玩家、中央牌池 */}
            <div className="rounded-3xl border-4 border-amber-300 bg-amber-50/95 p-4 shadow-lg mb-4">
              <div className="mb-2 flex justify-between text-sm text-amber-900">
                <span>牌墙 {state.deck.length} 张</span>
                {state.dealer >= 0 && (
                  <span>庄: {SEAT_NAMES[state.dealer]}</span>
                )}
              </div>
              <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-3 min-h-[480px]">
                <div className="rounded-xl bg-amber-100/80" />
                {/* 对家 seat 2 - 上 */}
                <div className="rounded-xl bg-white/80 border border-amber-300 px-2 py-1.5 flex flex-col items-center justify-center min-h-[52px]">
                  <p className="text-xs font-medium text-amber-900">
                    {SEAT_NAMES[2]}
                  </p>
                  <p className="text-[10px] text-amber-800">
                    手牌 {state.hands[2].length} · 明 {state.melds[2].length} 组
                  </p>
                  {state.discardPiles[2].length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-1">
                      {state.discardPiles[2].slice(-4).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-amber-100/80" />
                {/* 上家 seat 3 - 左 */}
                <div className="rounded-xl bg-white/80 border border-amber-300 px-1.5 py-2 flex flex-col items-center justify-center">
                  <p className="text-xs font-medium text-amber-900">
                    {SEAT_NAMES[3]}
                  </p>
                  <p className="text-[10px] text-amber-800">
                    {state.hands[3].length} 张
                  </p>
                  {state.discardPiles[3].length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {state.discardPiles[3].slice(-3).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* 中央牌池 */}
                <div className="rounded-xl bg-amber-100/90 border-2 border-dashed border-amber-400 flex flex-wrap content-start gap-1 p-3 overflow-auto">
                  {[0, 1, 2, 3].map((seat) =>
                    state.discardPiles[seat].slice(-5).map((t, i) => (
                      <span key={`${seat}-${i}`} className={cn(TILE_BOX, getTileStyle(t))}>
                        <TileFace tile={t} />
                      </span>
                    )),
                  )}
                </div>
                {/* 下家 seat 1 - 右 */}
                <div className="rounded-xl bg-white/80 border border-amber-300 px-1.5 py-2 flex flex-col items-center justify-center">
                  <p className="text-xs font-medium text-amber-900">
                    {SEAT_NAMES[1]}
                  </p>
                  <p className="text-[10px] text-amber-800">
                    {state.hands[1].length} 张
                  </p>
                  {state.discardPiles[1].length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {state.discardPiles[1].slice(-3).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-amber-100/80" />
                {/* 自家 seat 0 - 下 */}
                <div className="col-span-3 rounded-xl bg-white/95 border-2 border-amber-400 p-3 space-y-2">
                  {state.melds[0].length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-amber-900">明牌</span>
                      {state.melds[0].map((m, i) => (
                        <span
                          key={i}
                          className="flex flex-wrap items-center gap-1 rounded border border-primary/50 bg-primary/10 p-1"
                        >
                          {m.tiles.map((t, j) => (
                            <span key={j} className={cn(TILE_BOX, getTileStyle(t))}>
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
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        {restHand.length > 0 &&
                          restHand.map((tile, i) => (
                            <button
                              key={`rest-${i}-${tile}`}
                              type="button"
                              onClick={() =>
                                isMyTurn &&
                                state.winner === null &&
                                discard(0, restIndices[i])
                              }
                              disabled={!isMyTurn || state.winner !== null}
                              className={cn(
                                TILE_BOX,
                                getTileStyle(tile),
                                "shadow-sm",
                                isMyTurn && state.winner === null
                                  ? "cursor-pointer hover:opacity-90"
                                  : "cursor-default opacity-90",
                              )}
                            >
                              <TileFace tile={tile} />
                            </button>
                          ))}
                        {drawn !== null && (
                          <>
                            <span className="text-xs font-medium text-amber-900">
                              刚摸
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                isMyTurn &&
                                state.winner === null &&
                                discard(0, drawnIndex)
                              }
                              disabled={!isMyTurn || state.winner !== null}
                              className={cn(
                                TILE_BOX,
                                getTileStyle(drawn),
                                "shadow-md ring-2 ring-primary ring-offset-1",
                                isMyTurn && state.winner === null
                                  ? "cursor-pointer hover:opacity-90"
                                  : "cursor-default",
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
                      <span className="text-xs text-amber-900">弃牌</span>
                      {state.discardPiles[0].slice(-8).map((t, i) => (
                        <span key={i} className={cn(TILE_BOX, getTileStyle(t))}>
                          <TileFace tile={t} />
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-300">
                    {canZiMo && (
                      <Button variant="default" size="sm" onClick={doZiMo}>
                        自摸
                      </Button>
                    )}
                    {isMyTurn &&
                      state &&
                      state.winner === null &&
                      state.hands[0].length === 14 &&
                      getJiagangOptions(state.hands[0], state.melds[0]).length >
                        0 && (
                        <>
                          {getJiagangOptions(
                            state.hands[0],
                            state.melds[0],
                          ).map((meldIdx) => (
                            <Button
                              key={meldIdx}
                              variant="outline"
                              size="sm"
                              onClick={() => doJiagang(meldIdx)}
                            >
                              加杠{" "}
                              {TILE_LABELS[state.melds[0][meldIdx].tiles[0]]}
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
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={doGang}
                          >
                            杠
                          </Button>
                        )}
                        {state.claimOption.peng && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={doPeng}
                          >
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
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default GameMahjongChinese;
