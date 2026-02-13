import { useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  createRiichiDeck,
  dealRiichi,
  getBaseTile,
  isAkaFive,
  getChiOptionsRiichi,
  canPengRiichi,
  canMingangRiichi,
  getAngangOptionsRiichi,
  getTileLabel,
  TILE_LABELS_RIICHI,
} from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

const SEAT_NAMES = ['自家', '下家', '对家', '上家'];

const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
const TILE_SMALL =
  'w-[42px] h-[58px] rounded-[4px] border bg-[#fff9e6] flex items-center justify-center shrink-0 font-bold text-xs';
const TILE_ACTIVE = 'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60';

function getTileColorClass(tile: number): string {
  if (isAkaFive(tile)) return 'text-red-700 bg-red-100 border-red-500';
  const t = getBaseTile(tile);
  if (t >= 27) {
    if (t === 31) return 'text-red-700 bg-red-50 border-red-400';
    if (t === 32) return 'text-green-800 bg-emerald-50 border-emerald-500';
    if (t === 33) return 'text-stone-700 bg-stone-200 border-stone-500';
    return 'text-stone-900 bg-stone-100 border-stone-600';
  }
  if (t < 9) return 'text-red-800 bg-red-50 border-red-400';
  if (t < 18) return 'text-green-800 bg-green-50 border-green-500';
  return 'text-amber-800 bg-amber-50 border-amber-500';
}

/** 牌面：日麻 0-36，赤 5 显示「赤」+ 数字花色 */
function RiichiTileFace({ tile, className }: { tile: number; className?: string }) {
  const base = getBaseTile(tile);
  if (base >= 27) return <span className={className}>{TILE_LABELS_RIICHI[base]}</span>;
  const num = (base % 9) + 1;
  const suit = base < 9 ? '万' : base < 18 ? '条' : '筒';
  return (
    <span className={className}>
      {isAkaFive(tile) && <span className="text-red-600 text-[0.6em]">赤</span>}
      <span>{num}</span>
      <span className="text-[0.65em] opacity-90">{suit}</span>
    </span>
  );
}

/** 副露：吃/碰/明杠；暗杠不算副露，保留门前清 */
interface RiichiMeld {
  type: 'chi' | 'peng' | 'mingang' | 'angang';
  tiles: number[];
  fromPlayer?: number;
}

interface RiichiGameState {
  hands: number[][];
  wall: number[];
  discardPiles: number[][];
  melds: RiichiMeld[][];
  currentPlayer: number;
  drawnTile: number | null;
  doraIndicator: number;
  phase: 'discard' | 'claim';
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  claimIndex: number;
}

function initRiichiGame(): RiichiGameState {
  const deck = createRiichiDeck();
  const [hands, rest] = dealRiichi(deck, 0);
  const doraIndicator = rest[0];
  const wall = rest.slice(1);
  return {
    hands,
    wall,
    discardPiles: [[], [], [], []],
    melds: [[], [], [], []],
    currentPlayer: 0,
    drawnTile: null,
    doraIndicator,
    phase: 'discard',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
  };
}

const GameMahjongJapanese = () => {
  const [view, setView] = useState<'rules' | 'game'>('rules');
  const [game, setGame] = useState<RiichiGameState | null>(null);

  const startGame = useCallback(() => {
    setGame(initRiichiGame());
    setView('game');
  }, []);

  const discard = useCallback(
    (player: number, tile: number) => {
      if (!game || game.phase !== 'discard') return;
      const hands = game.hands.map((h) => [...h]);
      const piles = game.discardPiles.map((p) => [...p]);
      const idx = hands[player].indexOf(tile);
      if (idx === -1) return;
      hands[player].splice(idx, 1);
      piles[player].push(tile);
      setGame({
        ...game,
        hands,
        discardPiles: piles,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
      });
    },
    [game],
  );

  const passClaim = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscardFrom === null) return;
    const nextIndex = game.claimIndex + 1;
    if (nextIndex >= 3) {
      const nextPlayer = (game.lastDiscardFrom + 1) % 4;
      setGame({
        ...game,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
      });
    } else {
      setGame({ ...game, claimIndex: nextIndex });
    }
  }, [game]);

  const doChi = useCallback(
    (option: [number, number]) => {
      if (!game || game.phase !== 'claim' || game.lastDiscard === null || game.lastDiscardFrom === null)
        return;
      const [a, b] = option;
      const hands = game.hands.map((h) => [...h]);
      const melds = game.melds.map((m) => [...m]);
      const h0 = hands[0];
      const ia = h0.indexOf(a);
      const ib = h0.indexOf(b);
      if (ia === -1 || ib === -1) return;
      h0.splice(Math.max(ia, ib), 1);
      h0.splice(Math.min(ia, ib), 1);
      melds[0] = [
        ...melds[0],
        { type: 'chi' as const, tiles: [a, b, game.lastDiscard].sort((x, y) => getBaseTile(x) - getBaseTile(y) || x - y), fromPlayer: game.lastDiscardFrom },
      ];
      setGame({
        ...game,
        hands,
        melds,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
      });
    },
    [game],
  );

  const doPeng = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscard === null) return;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 2; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 2) return;
    const tiles = [game.lastDiscard, h0[indices[0]], h0[indices[1]]];
    indices.sort((x, y) => y - x).forEach((i) => h0.splice(i, 1));
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'peng' as const, tiles }] : m,
    );
    setGame({
      ...game,
      hands,
      melds,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
    });
  }, [game]);

  const doMingang = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscard === null) return;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 3; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 3) return;
    const tiles = [game.lastDiscard, ...indices.map((i) => h0[i])];
    indices.sort((x, y) => y - x).forEach((i) => h0.splice(i, 1));
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'mingang' as const, tiles }] : m,
    );
    setGame({
      ...game,
      hands,
      melds,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
    });
  }, [game]);

  /** 暗杠：从手牌移除 4 张，加暗杠面子，摸岭上 1 张（暗杠不算副露） */
  const doAngang = useCallback(
    (fourTiles: number[]) => {
      if (!game || game.phase !== 'discard' || game.currentPlayer !== 0 || game.wall.length === 0)
        return;
      const h0 = [...game.hands[0]];
      for (const t of fourTiles) {
        const i = h0.indexOf(t);
        if (i === -1) return;
        h0.splice(i, 1);
      }
      if (h0.length !== 10) return;
      const rinshan = game.wall[0];
      const newWall = game.wall.slice(1);
      h0.push(rinshan);
      h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
      const melds = game.melds.map((m, i) =>
        i === 0 ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
      );
      setGame({
        ...game,
        hands: game.hands.map((h, i) => (i === 0 ? h0 : h)),
        melds,
        wall: newWall,
      });
    },
    [game],
  );

  const angangOptions = game?.phase === 'discard' && game.currentPlayer === 0 && game.hands[0].length === 14
    ? getAngangOptionsRiichi(game.hands[0])
    : [];

  // 自家回合且手牌 13 张时先摸牌（庄家第一巡除外）；仅在出牌阶段
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[0].length !== 13
    )
      return;
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[0].push(draw);
    newHands[0].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g ? g : { ...g, hands: newHands, wall: newWall, drawnTile: draw },
    );
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length, game?.hands[0]?.length]);

  // AI 回合 1：未摸牌时先摸牌（与出牌拆开）；仅在出牌阶段
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0
    )
      return;
    const p = game.currentPlayer;
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[p].push(draw);
    newHands[p].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g ? g : { ...g, hands: newHands, wall: newWall, drawnTile: draw },
    );
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length]);

  // AI 回合 2：已摸牌则 500ms 后出牌（独立 effect）；仅出牌阶段
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile === null
    )
      return;
    const p = game.currentPlayer;
    const tid = setTimeout(() => {
      setGame((g) => {
        if (!g || g.currentPlayer !== p || g.drawnTile === null) return g;
        const hand = [...g.hands[p]];
        const angOpts = getAngangOptionsRiichi(hand);
        if (angOpts.length > 0 && g.wall.length > 0 && Math.random() < 0.2) {
          const fourTiles = [...angOpts[0]];
          const consumed = [...fourTiles];
          const h = hand.filter((t) => {
            const i = consumed.findIndex((f) => f === t);
            if (i >= 0) {
              consumed.splice(i, 1);
              return false;
            }
            return true;
          });
          if (h.length !== 10) return g;
          const rinshan = g.wall[0];
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const toDiscard = rinshan;
          const idx = h.indexOf(toDiscard);
          if (idx === -1) return g;
          h.splice(idx, 1);
          const melds = g.melds.map((m, i) =>
            i === p ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
          );
          const piles = g.discardPiles.map((q) => [...q]);
          piles[p].push(toDiscard);
          return {
            ...g,
            hands: g.hands.map((h0, i) => (i === p ? h : h0)),
            melds,
            wall: g.wall.slice(1),
            discardPiles: piles,
            currentPlayer: (p + 1) % 4,
            drawnTile: null,
          };
        }
        const toDiscard = g.drawnTile;
        const idx = hand.indexOf(toDiscard);
        if (idx === -1) return g;
        hand.splice(idx, 1);
        const piles = g.discardPiles.map((q) => [...q]);
        piles[p].push(toDiscard);
        const next = (p + 1) % 4;
        return {
          ...g,
          hands: g.hands.map((h, i) => (i === p ? hand : h)),
          discardPiles: piles,
          currentPlayer: next,
          drawnTile: null,
        };
      });
    }, 500);
    return () => clearTimeout(tid);
  }, [game?.currentPlayer, game?.drawnTile]);

  const isMyTurn =
    game?.phase === 'discard' && game.currentPlayer === 0 && game.wall.length >= 0;
  const isClaimPhase = game?.phase === 'claim' && game.lastDiscard !== null;
  const claimPlayer =
    game?.phase === 'claim' && game.lastDiscardFrom !== null
      ? (game.lastDiscardFrom + 1 + game.claimIndex) % 4
      : null;
  const isMyClaim = isClaimPhase && claimPlayer === 0;
  const chiOptions =
    game && isMyClaim && game.lastDiscard !== null && game.lastDiscardFrom !== null
      ? getChiOptionsRiichi(game.hands[0], game.lastDiscard, game.lastDiscardFrom, 0)
      : [];
  const canPeng =
    game && isMyClaim && game.lastDiscard !== null && canPengRiichi(game.hands[0], game.lastDiscard);
  const canMingang =
    game &&
    isMyClaim &&
    game.lastDiscard !== null &&
    canMingangRiichi(game.hands[0], game.lastDiscard);

  // 要牌阶段：轮到 AI 时自动 吃/碰/杠 或 过
  useEffect(() => {
    if (!game || game.phase !== 'claim' || claimPlayer === null || claimPlayer === 0) return;
    const p = claimPlayer;
    const last = game.lastDiscard!;
    const from = game.lastDiscardFrom!;
    const hand = game.hands[p];
    const chiOpts = getChiOptionsRiichi(hand, last, from, p);
    const peng = canPengRiichi(hand, last);
    const gang = canMingangRiichi(hand, last);
    const tid = setTimeout(() => {
      if (chiOpts.length > 0 && Math.random() < 0.6) {
        const [a, b] = chiOpts[0];
        const hands = game.hands.map((h) => [...h]);
        const melds = game.melds.map((m) => [...m]);
        const hp = hands[p];
        const ia = hp.indexOf(a);
        const ib = hp.indexOf(b);
        if (ia !== -1 && ib !== -1) {
          hp.splice(Math.max(ia, ib), 1);
          hp.splice(Math.min(ia, ib), 1);
          melds[p] = [
            ...melds[p],
            {
              type: 'chi' as const,
              tiles: [a, b, last].sort((x, y) => getBaseTile(x) - getBaseTile(y) || x - y),
              fromPlayer: from,
            },
          ];
          setGame({
            ...game,
            hands,
            melds,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
          });
          return;
        }
      }
      if (peng && Math.random() < 0.4) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 2; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 2) {
          const tiles = [last, h[indices[0]], h[indices[1]]];
          indices.sort((x, y) => y - x).forEach((i) => h.splice(i, 1));
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'peng' as const, tiles }] : m,
          );
          setGame({
            ...game,
            hands,
            melds,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
          });
          return;
        }
      }
      if (gang && Math.random() < 0.3) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 3; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 3) {
          const tiles = [last, ...indices.map((i) => h[i])];
          indices.sort((x, y) => y - x).forEach((i) => h.splice(i, 1));
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'mingang' as const, tiles }] : m,
          );
          setGame({
            ...game,
            hands,
            melds,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
          });
          return;
        }
      }
      setGame((g) => {
        if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
        const nextIndex = g.claimIndex + 1;
        if (nextIndex >= 3) {
          const nextPlayer = (g.lastDiscardFrom + 1) % 4;
          return {
            ...g,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
          };
        }
        return { ...g, claimIndex: nextIndex };
      });
    }, 400);
    return () => clearTimeout(tid);
  }, [
    game?.phase,
    game?.claimIndex,
    claimPlayer,
    game?.lastDiscard,
    game?.lastDiscardFrom,
  ]);

  if (view === 'rules') {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <Link to="/category/mahjong" className="text-muted-foreground hover:text-foreground">
            ← 返回麻将分类
          </Link>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-xl font-bold text-foreground">日本立直麻将</h1>
          <p className="mt-2 text-muted-foreground">
            规则与策略以 skill「mahjong-japanese-riichi」为准
          </p>

          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">核心规则摘要</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>4 人 · 136 张 + 红宝牌 3 枚（赤 5 万/筒/索）</li>
              <li>无役不能胡；振听只能自摸，不能荣和</li>
              <li>立直：门前清听牌宣告，放 1000 点棒，听牌后不能换牌</li>
              <li>宝牌只加番不算役；里宝牌在立直和了时翻开</li>
              <li>计分：符 × 2^(番+2) × 倍率（亲家 1.5 倍）</li>
            </ul>
          </section>

          <section className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">起和役（常用）</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              立直(1)、门前清自摸(1)、断幺九(1)、役牌(1)、平和(1)、一发(1)、七对子(2)、混一色(3)、清一色(6)
              等
            </p>
          </section>

          <div className="mt-6">
            <Button onClick={startGame} className="bg-primary text-primary-foreground hover:bg-primary/90">
              开始游戏
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="min-h-screen bg-[#1a2e25] text-[#f1faee] bg-gradient-to-b from-[#1a2e25] to-[#152019]">
      <header className="flex items-center justify-between border-b border-[#2d4a3c] bg-[#1a2e25] px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setView('rules')}
            className="text-[#f1faee]/80 hover:text-[#f1faee] text-sm"
          >
            ← 返回规则
          </button>
          <span className="text-sm text-[#f1faee]">东一局 · 庄 自家</span>
          <button
            type="button"
            onClick={startGame}
            className="rounded-lg border border-[#d4b886] px-3 py-1.5 text-sm text-[#f1faee] hover:bg-[#2d4a3c]"
          >
            新一局
          </button>
        </div>
        {game && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-[#f1faee]/80">宝牌表示</span>
            <span
              className={cn(
                'w-[52px] h-[72px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center font-black text-lg shrink-0 tile-dora-glow',
                getTileColorClass(game.doraIndicator),
              )}
            >
              <RiichiTileFace tile={game.doraIndicator} />
            </span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="rounded-2xl bg-[#2d4a3c] p-4 md:p-6 mb-4 min-h-[480px] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          <p className="text-center text-sm text-[#f1faee]/90 mb-3">
            {isClaimPhase
              ? isMyClaim
                ? `上家打了 ${game.lastDiscard != null ? getTileLabel(game.lastDiscard) : ''}，可吃/碰/杠 或 过`
                : `等待 ${SEAT_NAMES[claimPlayer ?? 0]} 要牌`
              : isMyTurn
                ? '轮到你出牌'
                : `等待 ${SEAT_NAMES[game.currentPlayer]}`}
          </p>

          <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-3">
            <div />
            <div
              className={cn(
                'rounded-lg px-3 py-2 flex flex-col items-center justify-center min-h-[64px]',
                game.currentPlayer === 2 && 'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">{SEAT_NAMES[2]}</p>
              <p className="text-xs text-[#ffd700]">{game.hands[2].length} 张</p>
              {game.discardPiles[2].length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {game.discardPiles[2].slice(-4).map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        TILE_SMALL,
                        getTileColorClass(t),
                        isAkaFive(t) && 'tile-aka-glow',
                      )}
                    >
                      <RiichiTileFace tile={t} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div />

            <div
              className={cn(
                'rounded-lg px-3 py-2 flex flex-col items-center',
                game.currentPlayer === 3 && 'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">{SEAT_NAMES[3]}</p>
              <p className="text-xs text-[#ffd700]">{game.hands[3].length} 张</p>
              {game.discardPiles[3].length > 0 && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {game.discardPiles[3].slice(-3).map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        TILE_SMALL,
                        getTileColorClass(t),
                        isAkaFive(t) && 'tile-aka-glow',
                      )}
                    >
                      <RiichiTileFace tile={t} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-[#1a2e25]/50 flex flex-col p-3 min-h-[100px]">
              <p className="text-center text-2xl font-bold text-[#ffd700] tabular-nums">
                剩余 {game.wall.length}
              </p>
              <div className="flex flex-col gap-1.5 overflow-auto mt-2">
                {([0, 1, 2, 3] as const).map((seat) => (
                  <div key={seat} className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-[#f1faee]/70 w-6 shrink-0">
                      {SEAT_NAMES[seat]}
                    </span>
                    {game.discardPiles[seat].slice(-8).map((t, i) => (
                      <span
                        key={`${seat}-${i}`}
                        className={cn(
                          TILE_DISCARD,
                          getTileColorClass(t),
                          isAkaFive(t) && 'tile-aka-glow',
                        )}
                      >
                        <RiichiTileFace tile={t} />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                'rounded-lg px-3 py-2 flex flex-col items-center',
                game.currentPlayer === 1 && 'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">{SEAT_NAMES[1]}</p>
              <p className="text-xs text-[#ffd700]">{game.hands[1].length} 张</p>
              {game.discardPiles[1].length > 0 && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {game.discardPiles[1].slice(-3).map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        TILE_SMALL,
                        getTileColorClass(t),
                        isAkaFive(t) && 'tile-aka-glow',
                      )}
                    >
                      <RiichiTileFace tile={t} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div />
            <div className="col-span-3 rounded-xl bg-[#2d4a3c]/80 p-4 space-y-3">
              {isMyClaim && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {chiOptions.map((opt, i) => (
                    <Button
                      key={i}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => doChi(opt)}
                    >
                      吃({getTileLabel(opt[0])}{getTileLabel(opt[1])})
                    </Button>
                  ))}
                  {canPeng && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={doPeng}
                    >
                      碰
                    </Button>
                  )}
                  {canMingang && (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={doMingang}
                    >
                      杠
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="border-[#d4b886] text-[#f1faee]" onClick={passClaim}>
                    过
                  </Button>
                </div>
              )}
              {isMyTurn && angangOptions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-[#f1faee]/80 mr-1">暗杠（不算副露）：</span>
                  {angangOptions.map((opt, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant="outline"
                      className="border-slate-400 text-[#f1faee] hover:bg-slate-600/50"
                      onClick={() => doAngang(opt)}
                    >
                      暗杠({getTileLabel(opt[0])})
                    </Button>
                  ))}
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
                        m.type === 'mingang' && 'border-orange-500 bg-[#fff9e6]/90',
                        m.type === 'angang' && 'border-slate-500 bg-slate-700/40',
                      )}
                    >
                      {m.type === 'angang' && (
                        <span className="text-[10px] text-slate-300 px-0.5" title="暗杠不算副露">暗</span>
                      )}
                      {m.tiles.map((t, j) => (
                        <span
                          key={j}
                          className={cn(
                            'w-[44px] h-[60px] rounded flex items-center justify-center font-bold text-sm',
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
              {isMyTurn && (
                <p className="text-center text-sm text-[#ffc107]/90">点击手牌出牌</p>
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
                            isAkaFive(tile) && 'tile-aka-glow',
                            canDiscard && 'cursor-pointer hover:ring-2 hover:ring-[#ffc107]/60',
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
        </div>
      </main>
    </div>
  );
};

export default GameMahjongJapanese;
