import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  canMingangRiichi,
  canPengRiichi,
  computeYaku,
  createRiichiDeck,
  dealRiichi,
  getAngangOptionsRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getTileLabel,
  hasYaku,
  isAkaFive,
  isWinShapeRiichi,
  TILE_LABELS_RIICHI,
  type YakuResult,
} from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

const SEAT_NAMES = ['自家', '下家', '对家', '上家'];
const WIND_NAMES = ['东', '南', '西', '北'];

const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
const TILE_ACTIVE =
  'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60';

function getTileColorClass(tile: number): string {
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

/** 牌面：日麻 0-36；红宝牌仅数字/花色用红色，不写「赤」 */
function RiichiTileFace({
  tile,
  className,
}: {
  tile: number;
  className?: string;
}) {
  const base = getBaseTile(tile);
  const isRed = isAkaFive(tile);
  if (base >= 27) {
    return (
      <span className={cn(className, isRed && 'text-red-600')}>
        {TILE_LABELS_RIICHI[base]}
      </span>
    );
  }
  const num = (base % 9) + 1;
  const suit = base < 9 ? '万' : base < 18 ? '条' : '筒';
  return (
    <span className={className}>
      <span className={isRed ? 'text-red-600' : undefined}>{num}</span>
      <span className={cn('text-[0.65em] opacity-90', isRed && 'text-red-600')}>
        {suit}
      </span>
    </span>
  );
}

/** 牌背：用于展示电脑手牌张数，不露牌面 */
function TileBack({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-[4px] border-2 border-amber-800/60 bg-gradient-to-br from-amber-900/90 to-amber-800/70 flex items-center justify-center',
        className,
      )}
      title="牌背"
    >
      <span className="text-[8px] text-amber-200/40 font-bold">🀄</span>
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
  /** 上一动：谁 碰/吃/杠 了（用于提示「上家碰了所以你没轮到」） */
  lastClaimMsg: string | null;
  /** 场风 0=东 1=南 2=西 3=北；东场打满 4 局后进南场 */
  roundWind: number;
  /** 局数 1-4，东1局～东4局后变为南1局 */
  roundNumber: number;
  /** 本场 0,1,2,… 庄家连庄时+1，下庄后归零 */
  honba: number;
  /** 庄家座位 0-3；胡牌/流局后按结果换庄 */
  dealer: number;
  /** 立直状态：每个玩家是否已立直 */
  riichiDeclared: boolean[];
  /** 立直宣言牌：记录每个玩家立直时打出的牌（用于一发判定） */
  riichiDiscard: (number | null)[];
  /** 里宝牌指示牌 */
  uraDoraIndicators: number[];
}

function initRiichiGame(
  dealer = 0,
  roundWind = 0,
  roundNumber = 1,
  honba = 0,
): RiichiGameState {
  const deck = createRiichiDeck();
  const [hands, rest] = dealRiichi(deck, dealer);
  const doraIndicator = rest[0];
  const wall = rest.slice(1);
  return {
    hands,
    wall,
    discardPiles: [[], [], [], []],
    melds: [[], [], [], []],
    currentPlayer: dealer,
    drawnTile: null,
    doraIndicator,
    phase: 'discard',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
    lastClaimMsg: null,
    roundWind,
    roundNumber,
    honba,
    dealer,
    riichiDeclared: [false, false, false, false],
    riichiDiscard: [null, null, null, null],
    uraDoraIndicators: [],
  };
}

/**
 * 一局结束（胡牌或流局）后计算下一局：
 * - 庄家胡 或 流局：不换庄（相当于连庄），局数不变，本场+1。
 * - 子家胡：下庄，下家坐庄，本场归零，局数+1；东4局后进南1局。
 * 由胡牌/流局逻辑调用；流局时传入 dealerStays=true，与庄家胡相同。
 */
export function getNextRound(
  dealer: number,
  roundWind: number,
  roundNumber: number,
  honba: number,
  dealerStays: boolean, // true = 庄家胡 或 流局（不换庄）
): { dealer: number; roundWind: number; roundNumber: number; honba: number } {
  if (dealerStays) return { dealer, roundWind, roundNumber, honba: honba + 1 };
  const nextDealer = (dealer + 1) % 4;
  if (nextDealer === 0)
    return {
      dealer: 0,
      roundWind: (roundWind + 1) % 4,
      roundNumber: 1,
      honba: 0,
    };
  return {
    dealer: nextDealer,
    roundWind,
    roundNumber: roundNumber + 1,
    honba: 0,
  };
}

/** 自风：庄家=场风，下家/对家/上家依次为场风+1,+2,+3（随庄家变化） */
function getSeatWind(roundWind: number, seat: number, dealer: number): number {
  return (roundWind + ((seat - dealer + 4) % 4)) % 4;
}

const MAX_HISTORY = 40;
const MAX_LOG = 150;

const GameMahjongJapanese = () => {
  const [view, setView] = useState<'rules' | 'game'>('rules');
  const [game, setGame] = useState<RiichiGameState | null>(null);
  const [history, setHistory] = useState<RiichiGameState[]>([]);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [winResult, setWinResult] = useState<{
    winner: number;
    isTsumo: boolean;
    yaku: YakuResult[];
  } | null>(null);
  const [showGuide, setShowGuide] = useState(true); // 新手引导状态
  const prevGameRef = useRef<RiichiGameState | null>(null);
  const undoingRef = useRef(false);
  const addLogRef = useRef<(msg: string) => void>(() => {});

  const addLog = useCallback((msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setGameLog((l) => [...l, line].slice(-MAX_LOG));
  }, []);
  addLogRef.current = addLog;

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      return;
    }
    if (undoingRef.current) {
      undoingRef.current = false;
      prevGameRef.current = game;
      return;
    }
    if (prevGameRef.current != null) {
      try {
        setHistory((h) =>
          [...h, JSON.parse(JSON.stringify(prevGameRef.current))].slice(
            -MAX_HISTORY,
          ),
        );
      } catch {
        // skip clone if too large
      }
    }
    prevGameRef.current = game;
  }, [game]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    undoingRef.current = true;
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    addLog('回退一步');
  }, [history.length, addLog, history[history.length - 1]]);

  const startGame = useCallback(() => {
    setHistory([]);
    setGameLog([]);
    setWinResult(null);
    setGame(initRiichiGame());
    setView('game');
    addLog('新一局');
  }, [addLog]);

  const discard = useCallback(
    (player: number, tile: number) => {
      if (!game || game.phase !== 'discard') return;
      const hands = game.hands.map((h) => [...h]);
      const piles = game.discardPiles.map((p) => [...p]);
      const idx = hands[player].indexOf(tile);
      if (idx === -1) return;
      hands[player].splice(idx, 1);
      piles[player].push(tile);
      addLog(`自家 打出 ${getTileLabel(tile)}`);
      setGame({
        ...game,
        hands,
        discardPiles: piles,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
        lastClaimMsg: null,
      });
    },
    [game, addLog],
  );

  const passClaim = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscardFrom === null)
      return;
    const nextIndex = game.claimIndex + 1;
    if (nextIndex >= 3) {
      const nextPlayer = (game.lastDiscardFrom + 1) % 4;
      if (game.wall.length === 0) {
        setGame({
          ...game,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          lastClaimMsg: null,
        });
        return;
      }
      const draw = game.wall[0];
      const newWall = game.wall.slice(1);
      const newHands = game.hands.map((h) => [...h]);
      newHands[nextPlayer].push(draw);
      newHands[nextPlayer].sort(
        (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
      );
      setGame({
        ...game,
        hands: newHands,
        wall: newWall,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        drawnTile: draw,
        lastClaimMsg: null,
      });
    } else {
      addLog('自家 过');
      setGame({ ...game, claimIndex: nextIndex, lastClaimMsg: null });
    }
  }, [game, addLog]);

  const doChi = useCallback(
    (option: [number, number]) => {
      if (
        !game ||
        game.phase !== 'claim' ||
        game.lastDiscard === null ||
        game.lastDiscardFrom === null
      )
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
        {
          type: 'chi' as const,
          tiles: [a, b, game.lastDiscard].sort(
            (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
          ),
          fromPlayer: game.lastDiscardFrom,
        },
      ];
      const piles = game.discardPiles.map((q) => [...q]);
      if (piles[game.lastDiscardFrom].length > 0)
        piles[game.lastDiscardFrom].pop();
      addLog(`自家 吃 ${getTileLabel(a)}${getTileLabel(b)}`);
      setGame({
        ...game,
        hands,
        melds,
        discardPiles: piles,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        lastClaimMsg: null,
      });
    },
    [game, addLog],
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
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'peng' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog('自家 碰');
    setGame({
      ...game,
      hands,
      melds,
      discardPiles: piles,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      lastClaimMsg: null,
    });
  }, [game, addLog]);

  /** 获取听牌信息（需传入 game 以取 roundWind/dealer） */
  const getWaitingTilesRiichi = useCallback(
    (
      hand: number[],
      melds: RiichiMeld[],
      gameState?: RiichiGameState | null,
    ): number[] => {
      if (hand.length !== 13) return [];
      const waiting: number[] = [];
      for (let t = 0; t < 34; t++) {
        const testHand = [...hand, t];
        if (isWinShapeRiichi(testHand, melds)) {
          const ctx = {
            hand: testHand,
            melds: melds.map((m) => ({ tiles: m.tiles })),
            isMenzhen: melds.every((m) => m.type === 'angang'),
            isTsumo: true,
            isRiichi: true,
            ippatsuPossible: false,
            seatWind: getSeatWind(
              gameState?.roundWind ?? 0,
              0,
              gameState?.dealer ?? 0,
            ),
            roundWind: gameState?.roundWind ?? 0,
          };
          if (hasYaku(ctx)) {
            waiting.push(t);
          }
        }
      }
      return waiting;
    },
    [],
  );

  /** 立直宣告：门前清听牌时可宣告，扣除1000点棒 */
  const doRiichi = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.riichiDeclared[0]
    )
      return;

    // 检查是否门前清
    const melds = game.melds[0];
    const isMenzen = melds.every((m) => m.type === 'angang');
    if (!isMenzen) return;

    // 检查是否听牌
    const waitingTiles = getWaitingTilesRiichi(game.hands[0], melds, game);
    if (waitingTiles.length === 0) return;

    addLog('自家 立直宣言！');

    setGame({
      ...game,
      riichiDeclared: game.riichiDeclared.map((declared, i) =>
        i === 0 ? true : declared,
      ),
      lastClaimMsg: '立直宣言！听牌固定，不能换牌',
    });
  }, [game, addLog, getWaitingTilesRiichi]);

  const doMingang = useCallback(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      game.lastDiscard === null ||
      game.wall.length === 0
    )
      return;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 3; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 3) return;
    const tiles = [game.lastDiscard, ...indices.map((i) => h0[i])];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const rinshan = game.wall[0];
    const newWall = game.wall.slice(1);
    h0.push(rinshan);
    h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'mingang' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog(`自家 明杠 ${getTileLabel(game.lastDiscard)}`);
    setGame({
      ...game,
      hands,
      melds,
      discardPiles: piles,
      wall: newWall,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      drawnTile: rinshan,
      lastClaimMsg: null,
    });
  }, [game, addLog]);

  /** 暗杠：从手牌移除 4 张，加暗杠面子，摸岭上 1 张（暗杠不算副露） */
  const doAngang = useCallback(
    (fourTiles: number[]) => {
      if (
        !game ||
        game.phase !== 'discard' ||
        game.currentPlayer !== 0 ||
        game.wall.length === 0
      )
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

  const angangOptions =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14
      ? getAngangOptionsRiichi(game.hands[0])
      : [];

  // 自家回合且手牌 13 张时先摸牌（庄家第一巡除外）；仅在出牌阶段
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
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
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game?.hands[0]?.length,
    game,
  ]);

  // AI 回合 1：未摸牌时先摸牌（与出牌拆开）；仅出牌阶段；碰/吃/杠后手牌已 11 张不再摸
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[game.currentPlayer].length !== 13
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
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length, game]);

  // AI 碰/吃/杠后：手牌 11 张，直接打出一张（不摸牌），并进入要牌阶段（立即更新，避免 setTimeout 被清理或竞态）
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.hands[game.currentPlayer].length !== 11
    )
      return;
    const p = game.currentPlayer;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'discard' ||
        g.currentPlayer !== p ||
        g.drawnTile !== null
      )
        return g;
      const hp = g.hands[p];
      if (hp.length !== 11) return g;
      const hand = [...hp];
      const toDiscard = hand[0];
      hand.shift();
      const piles = g.discardPiles.map((q) => [...q]);
      piles[p].push(toDiscard);
      return {
        ...g,
        hands: g.hands.map((h, i) => (i === p ? hand : h)),
        discardPiles: piles,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: p,
        claimIndex: 0,
        currentPlayer: (p + 1) % 4,
        lastClaimMsg: null,
      };
    });
  }, [game?.phase, game?.currentPlayer, game?.drawnTile, game?.hands, game]);

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
            const i = consumed.indexOf(t);
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
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            lastClaimMsg: null,
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
          phase: 'claim',
          lastDiscard: toDiscard,
          lastDiscardFrom: p,
          claimIndex: 0,
          lastClaimMsg: null,
        };
      });
    }, 500);
    return () => clearTimeout(tid);
  }, [game?.currentPlayer, game?.drawnTile, game]);

  const isMyTurn =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.wall.length >= 0;
  const isClaimPhase = game?.phase === 'claim' && game.lastDiscard !== null;
  const claimPlayer =
    game?.phase === 'claim' && game.lastDiscardFrom !== null
      ? (game.lastDiscardFrom + 1 + game.claimIndex) % 4
      : null;
  const isMyClaim = isClaimPhase && claimPlayer === 0;
  const chiOptions =
    game &&
    isMyClaim &&
    game.lastDiscard !== null &&
    game.lastDiscardFrom !== null
      ? getChiOptionsRiichi(
          game.hands[0],
          game.lastDiscard,
          game.lastDiscardFrom,
          0,
        )
      : [];
  const canPeng =
    game &&
    isMyClaim &&
    game.lastDiscard !== null &&
    canPengRiichi(game.hands[0], game.lastDiscard);
  const canMingang =
    game &&
    isMyClaim &&
    game.lastDiscard !== null &&
    canMingangRiichi(game.hands[0], game.lastDiscard);

  /** 构建役判定上下文（自家） */
  const buildYakuCtx = useCallback(
    (hand: number[], isTsumo: boolean) => {
      if (!game) return null;
      const melds = game.melds[0];
      const menzen = melds.every((m) => m.type === 'angang');
      return {
        hand,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: menzen,
        isTsumo,
        isRiichi: false,
        ippatsuPossible: false,
        seatWind: getSeatWind(game.roundWind, 0, game.dealer),
        roundWind: game.roundWind,
      };
    },
    [game],
  );

  const canTsumo =
    game &&
    game.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    isWinShapeRiichi(game.hands[0], game.melds[0]) &&
    (() => {
      const ctx = buildYakuCtx(game.hands[0], true);
      return ctx ? hasYaku(ctx) : false;
    })();

  const canRon =
    game &&
    isMyClaim &&
    game.lastDiscard !== null &&
    game.lastDiscardFrom !== null &&
    (() => {
      const lastD = game.lastDiscard;
      if (lastD === undefined) return;
      const handWithClaim = [...game.hands[0], lastD];
      if (!isWinShapeRiichi(handWithClaim, game.melds[0])) return false;
      const ctx = buildYakuCtx(handWithClaim, false);
      return ctx ? hasYaku(ctx) : false;
    })();

  const hasAnyClaimOption =
    chiOptions.length > 0 || canPeng || canMingang || canRon;

  /** 自摸：当前手牌 14 张且和牌形+有役 */
  const doTsumo = useCallback(() => {
    if (!game || !canTsumo) return;
    const ctx = buildYakuCtx(game.hands[0], true);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(`自家 自摸！役: ${yaku.map((y) => y.name).join(' ')}`);
    setWinResult({ winner: 0, isTsumo: true, yaku });
  }, [game, canTsumo, buildYakuCtx, addLog]);

  /** 荣和：要牌阶段别人打的牌能胡 */
  const doRon = useCallback(() => {
    if (!game || !canRon || game.lastDiscard === null) return;
    const handWithClaim = [...game.hands[0], game.lastDiscard];
    const ctx = buildYakuCtx(handWithClaim, false);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(
      `自家 荣和 ${getTileLabel(game.lastDiscard)}！役: ${yaku.map((y) => y.name).join(' ')}`,
    );
    setWinResult({ winner: 0, isTsumo: false, yaku });
  }, [game, canRon, buildYakuCtx, addLog]);

  /** 胡牌后进入下一局 */
  const proceedToNextRound = useCallback(() => {
    if (!game || !winResult) return;
    const dealerWon = game.dealer === winResult.winner;
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      dealerWon,
    );
    setWinResult(null);
    setGame(
      initRiichiGame(next.dealer, next.roundWind, next.roundNumber, next.honba),
    );
    addLog(dealerWon ? '庄家胡，连庄' : '子家胡，换庄');
  }, [game, winResult, addLog]);

  // 要牌阶段：轮到自家且没有任何吃/碰/杠可选时，自动过，不暂停
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer !== 0 ||
      hasAnyClaimOption
    )
      return;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'claim' ||
        g.lastDiscardFrom === null ||
        g.lastDiscard === null
      )
        return g;
      const lastTile = g.lastDiscard;
      const chiOpts = getChiOptionsRiichi(
        g.hands[0],
        lastTile,
        g.lastDiscardFrom,
        0,
      );
      const peng = canPengRiichi(g.hands[0], lastTile);
      const gang = canMingangRiichi(g.hands[0], lastTile);
      if (chiOpts.length > 0 || peng || gang) return g;
      const nextIndex = g.claimIndex + 1;
      if (nextIndex >= 3) {
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (g.wall.length === 0) {
          return {
            ...g,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: null,
          };
        }
        const draw = g.wall[0];
        const newWall = g.wall.slice(1);
        const newHands = g.hands.map((h) => [...h]);
        newHands[nextPlayer].push(draw);
        newHands[nextPlayer].sort(
          (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
        );
        return {
          ...g,
          hands: newHands,
          wall: newWall,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: null,
        };
      }
      return { ...g, claimIndex: nextIndex, lastClaimMsg: null };
    });
  }, [
    game?.phase,
    game?.claimIndex,
    game?.lastDiscardFrom,
    claimPlayer,
    hasAnyClaimOption,
    game,
  ]);

  // 要牌阶段：轮到 AI 时自动 吃/碰/杠 或 过
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer === null ||
      claimPlayer === 0
    )
      return;
    const p = claimPlayer;
    const last = game.lastDiscard;
    const from = game.lastDiscardFrom;
    if (last === null || from === null) return;
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
              tiles: [a, b, last].sort(
                (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
              ),
              fromPlayer: from,
            },
          ];
          const pilesChi = game.discardPiles.map((q) => [...q]);
          if (pilesChi[from].length > 0) pilesChi[from].pop();
          const toDiscard = hp[0];
          hp.shift();
          pilesChi[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesChi,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)}`,
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
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'peng' as const, tiles }] : m,
          );
          const pilesPeng = game.discardPiles.map((q) => [...q]);
          if (pilesPeng[from].length > 0) pilesPeng[from].pop();
          const toDiscard = h[0];
          h.shift();
          pilesPeng[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesPeng,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      if (gang && Math.random() < 0.3 && game.wall.length > 0) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 3; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 3) {
          const tiles = [last, ...indices.map((i) => h[i])];
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const rinshan = game.wall[0];
          const newWall = game.wall.slice(1);
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'mingang' as const, tiles }] : m,
          );
          const pilesGang = game.discardPiles.map((q) => [...q]);
          if (pilesGang[from].length > 0) pilesGang[from].pop();
          addLogRef.current(`${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`);
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesGang,
            wall: newWall,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
            drawnTile: rinshan,
            lastClaimMsg: `${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      addLogRef.current(`${SEAT_NAMES[p]} 过`);
      setGame((g) => {
        if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
        const nextIndex = g.claimIndex + 1;
        if (nextIndex >= 3) {
          const nextPlayer = (g.lastDiscardFrom + 1) % 4;
          if (g.wall.length === 0) {
            return {
              ...g,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              currentPlayer: nextPlayer,
            };
          }
          const draw = g.wall[0];
          const newWall = g.wall.slice(1);
          const newHands = g.hands.map((h) => [...h]);
          newHands[nextPlayer].push(draw);
          newHands[nextPlayer].sort(
            (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
          );
          return {
            ...g,
            hands: newHands,
            wall: newWall,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            drawnTile: draw,
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
    game?.discardPiles?.map,
    game?.hands?.map,
    game?.wall?.slice,
    game?.wall?.length,
    game?.wall?.[0],
    game?.melds?.map,
    game?.hands?.[claimPlayer ?? 0],
    game,
  ]);

  if (view === 'rules') {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <Link
            to="/category/mahjong"
            className="text-muted-foreground hover:text-foreground"
          >
            ← 返回麻将分类
          </Link>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-xl font-bold text-foreground">日本立直麻将</h1>
          <p className="mt-2 text-muted-foreground">
            规则与策略以 skill「mahjong-japanese-riichi」为准
          </p>

          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              核心规则摘要
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>4 人 · 136 张 + 红宝牌 3 枚（赤 5 万/筒/索）</li>
              <li>无役不能胡；振听只能自摸，不能荣和</li>
              <li>立直：门前清听牌宣告，放 1000 点棒，听牌后不能换牌</li>
              <li>宝牌只加番不算役；里宝牌在立直和了时翻开</li>
              <li>计分：符 × 2^(番+2) × 倍率（亲家 1.5 倍）</li>
            </ul>
          </section>

          <section className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              起和役（常用）
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              立直(1)、门前清自摸(1)、断幺九(1)、役牌(1)、平和(1)、一发(1)、七对子(2)、混一色(3)、清一色(6)
              等
            </p>
          </section>

          <div className="mt-6">
            <Button
              onClick={startGame}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
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
          <span className="text-sm text-[#f1faee]">
            {game
              ? `${WIND_NAMES[game.roundWind]}${game.roundNumber}局 ${WIND_NAMES[game.roundWind]}${game.honba}场 · 庄 ${SEAT_NAMES[game.dealer]} (${WIND_NAMES[getSeatWind(game.roundWind, game.dealer, game.dealer)]})`
              : '东1局 东0场 · 庄 自家 (东)'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startGame}
              className="rounded-lg border border-[#d4b886] px-3 py-1.5 text-sm text-[#f1faee] hover:bg-[#2d4a3c]"
            >
              新一局
            </button>
            {game && history.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="rounded-lg border border-amber-600/70 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-900/30"
                title="回退一步（便于排查问题）"
              >
                回退
              </button>
            )}
            {game && (
              <button
                type="button"
                onClick={() => setLogOpen((o) => !o)}
                className="rounded-lg border border-slate-500/60 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/30"
              >
                {logOpen ? '收起日志' : '日志'}
              </button>
            )}
          </div>
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
          {/* 新手引导面板 */}
          {showGuide && (
            <div className="mb-4 p-4 bg-[#1d3557]/80 rounded-xl border border-[#457b9d]/50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-[#a8dadc]">
                  新人玩家指南
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="text-[#f1faee]/70 hover:text-[#f1faee] text-sm"
                >
                  ✕ 关闭
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
                  <h4 className="font-semibold text-[#f1faee] mb-2">
                    🎯 基本目标
                  </h4>
                  <ul className="text-[#f1faee]/80 space-y-1 text-xs">
                    <li>• 组成 4 面子 + 1 对子</li>
                    <li>• 必须有至少 1 个役种</li>
                    <li>• 立直后听牌固定</li>
                  </ul>
                </div>
                <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
                  <h4 className="font-semibold text-[#f1faee] mb-2">
                    🎮 操作说明
                  </h4>
                  <ul className="text-[#f1faee]/80 space-y-1 text-xs">
                    <li>• 点击手牌出牌</li>
                    <li>• 可吃/碰/杠时会提示</li>
                    <li>• 听牌时可宣告立直</li>
                  </ul>
                </div>
                <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
                  <h4 className="font-semibold text-[#f1faee] mb-2">
                    💡 小贴士
                  </h4>
                  <ul className="text-[#f1faee]/80 space-y-1 text-xs">
                    <li>• 绿色=条子 红色=万子</li>
                    <li>• 黄色=筒子 黑色=字牌</li>
                    <li>• 红色数字=赤宝牌</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#457b9d]/30">
                <p className="text-xs text-[#a8dadc]/90">
                  💡
                  提示：游戏上方会显示当前状态和可选操作，仔细阅读后再做决定哦！
                </p>
              </div>
            </div>
          )}
          <div className="text-center mb-3">
            {/* 主要状态提示 */}
            <div className="mb-2">
              <p className="text-sm text-[#f1faee] font-medium">
                {isClaimPhase
                  ? isMyClaim
                    ? hasAnyClaimOption
                      ? `⚠️ ${game.lastDiscardFrom != null ? SEAT_NAMES[game.lastDiscardFrom] : ''} 打出了 ${game.lastDiscard != null ? getTileLabel(game.lastDiscard) : ''}`
                      : '⏳ 等待其他玩家行动...'
                    : `⏳ ${game.lastDiscardFrom != null ? SEAT_NAMES[game.lastDiscardFrom] : ''} 打出了 ${game.lastDiscard != null ? getTileLabel(game.lastDiscard) : ''}，当前轮到 ${SEAT_NAMES[claimPlayer ?? 0]}`
                  : isMyTurn
                    ? '🎮 轮到你出牌了'
                    : `⏳ 等待 ${SEAT_NAMES[game.currentPlayer]} 行动`}
              </p>
            </div>

            {/* 操作建议 */}
            {isMyClaim && hasAnyClaimOption && (
              <div className="mb-2">
                <p className="text-xs text-[#a8dadc] bg-[#1d3557]/50 rounded-lg py-1 px-3 inline-block">
                  💡 可选操作：{canRon && '胡牌 '}{' '}
                  {chiOptions.length > 0 && `吃(${chiOptions.length}种) `}{' '}
                  {canPeng && '碰 '} {canMingang && '杠 '} {'过'}
                </p>
              </div>
            )}

            {/* 特殊状态提示 */}
            {game.lastClaimMsg && (
              <div className="mb-2">
                <span className="inline-block text-xs text-amber-300/95 bg-amber-900/30 rounded-lg py-1 px-3">
                  📢 {game.lastClaimMsg}
                </span>
              </div>
            )}

            {/* 立直状态提示 */}
            {game.riichiDeclared.some((d) => d) && (
              <div className="mb-2">
                <div className="flex flex-wrap justify-center gap-2">
                  {game.riichiDeclared.map(
                    (declared, i) =>
                      declared && (
                        <span
                          key={i}
                          className="text-xs text-red-300 bg-red-900/30 rounded-lg py-1 px-2"
                        >
                          🎯 {SEAT_NAMES[i]} 已立直
                        </span>
                      ),
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-3">
            <div />
            <div
              className={cn(
                'rounded-lg px-3 py-2 flex flex-col items-center justify-center min-h-[64px]',
                game.currentPlayer === 2 &&
                  'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">
                {SEAT_NAMES[2]} (
                {WIND_NAMES[getSeatWind(game.roundWind, 2, game.dealer)]})
              </p>
              <p className="text-xs text-[#ffd700]">
                {game.hands[2].length} 张
              </p>
              {game.hands[2].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.hands[2].map((_, i) => (
                    <TileBack
                      key={i}
                      className="w-[28px] h-[38px] text-[6px]"
                    />
                  ))}
                </div>
              )}
              {game.melds[2].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.melds[2].map((m, i) => (
                    <span key={i} className="flex gap-0.5">
                      {m.tiles.map((t, j) => (
                        <span
                          key={j}
                          className={cn(
                            'w-[32px] h-[42px] rounded flex items-center justify-center font-bold text-[10px]',
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
            </div>
            <div />

            <div
              className={cn(
                'rounded-lg px-3 py-2 flex flex-col items-center',
                game.currentPlayer === 3 &&
                  'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">
                {SEAT_NAMES[3]} (
                {WIND_NAMES[getSeatWind(game.roundWind, 3, game.dealer)]})
              </p>
              <p className="text-xs text-[#ffd700]">
                {game.hands[3].length} 张
              </p>
              {game.hands[3].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.hands[3].map((_, i) => (
                    <TileBack
                      key={i}
                      className="w-[28px] h-[38px] text-[6px]"
                    />
                  ))}
                </div>
              )}
              {game.melds[3].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.melds[3].map((m, i) => (
                    <span key={i} className="flex gap-0.5">
                      {m.tiles.map((t, j) => (
                        <span
                          key={j}
                          className={cn(
                            'w-[32px] h-[42px] rounded flex items-center justify-center font-bold text-[10px]',
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
            </div>

            <div className="rounded-lg bg-[#1a2e25]/50 flex flex-col p-3 min-h-[100px]">
              <p className="text-center text-2xl font-bold text-[#ffd700] tabular-nums">
                剩余 {game.wall.length}
              </p>
              <div className="flex flex-col gap-1.5 overflow-auto mt-2">
                {([0, 1, 2, 3] as const).map((seat) => (
                  <div key={seat} className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-[#f1faee]/70 shrink-0">
                      {SEAT_NAMES[seat]} (
                      {
                        WIND_NAMES[
                          getSeatWind(game.roundWind, seat, game.dealer)
                        ]
                      }
                      )
                    </span>
                    {game.discardPiles[seat].slice(-8).map((t, i) => (
                      <span
                        key={`${seat}-${i}`}
                        className={cn(TILE_DISCARD, getTileColorClass(t))}
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
                game.currentPlayer === 1 &&
                  'bg-[#ffc107]/10 border border-[#ffc107]/40',
              )}
            >
              <p className="text-xs font-semibold text-[#f1faee]">
                {SEAT_NAMES[1]} (
                {WIND_NAMES[getSeatWind(game.roundWind, 1, game.dealer)]})
              </p>
              <p className="text-xs text-[#ffd700]">
                {game.hands[1].length} 张
              </p>
              {game.hands[1].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.hands[1].map((_, i) => (
                    <TileBack
                      key={i}
                      className="w-[28px] h-[38px] text-[6px]"
                    />
                  ))}
                </div>
              )}
              {game.melds[1].length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {game.melds[1].map((m, i) => (
                    <span key={i} className="flex gap-0.5">
                      {m.tiles.map((t, j) => (
                        <span
                          key={j}
                          className={cn(
                            'w-[32px] h-[42px] rounded flex items-center justify-center font-bold text-[10px]',
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
            </div>
            <div />
            <div className="col-span-3 rounded-xl bg-[#2d4a3c]/80 p-4 space-y-3">
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
                    >
                      🏆 自摸胡牌
                    </Button>
                  </div>
                </div>
              )}
              {isMyClaim && hasAnyClaimOption && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-[#f1faee]/90 bg-[#1d3557]/50 rounded-lg py-2 px-4 inline-block">
                      ⚠️ 请选择你要的操作：
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {canRon && (
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3"
                        onClick={doRon}
                      >
                        🎉 胡牌（荣和）
                      </Button>
                    )}
                    {chiOptions.map((opt, i) => (
                      <Button
                        key={i}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3"
                        onClick={() => doChi(opt)}
                      >
                        🍣 吃({getTileLabel(opt[0])}
                        {getTileLabel(opt[1])})
                      </Button>
                    ))}
                    {canPeng && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3"
                        onClick={doPeng}
                      >
                        🔨 碰
                      </Button>
                    )}
                    {canMingang && (
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3"
                        onClick={doMingang}
                      >
                        ⚡ 杠
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-3"
                      onClick={passClaim}
                    >
                      ❌ 过
                    </Button>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[#a8dadc]/80">
                      💡 提示：胡牌 {'>'} 杠 {'>'} 碰 {'>'} 吃 {'>'}{' '}
                      过（按优先级排序）
                    </p>
                  </div>
                </div>
              )}
              {isMyTurn && (
                <div className="space-y-3">
                  {/* 立直提示区域 */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {!game.riichiDeclared[0] && (
                      <div className="flex items-center gap-2 bg-[#1d3557]/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#f1faee]/80">
                          门前清听牌可立直：
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-400 text-[#f1faee] hover:bg-red-600/50"
                          onClick={doRiichi}
                          disabled={
                            game.riichiDeclared[0] ||
                            !game.melds[0].every((m) => m.type === 'angang') ||
                            getWaitingTilesRiichi(
                              game.hands[0],
                              game.melds[0],
                              game,
                            ).length === 0
                          }
                        >
                          🎯 立直宣言
                        </Button>
                      </div>
                    )}

                    {/* 暗杠提示区域 */}
                    {angangOptions.length > 0 && (
                      <div className="flex items-center gap-2 bg-[#2d4a3c]/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#f1faee]/80">
                          暗杠（不算副露）：
                        </span>
                        {angangOptions.map((opt, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="outline"
                            className="border-slate-400 text-[#f1faee] hover:bg-slate-600/50"
                            onClick={() => doAngang(opt)}
                          >
                            ⚡ 暗杠({getTileLabel(opt[0])})
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 出牌提示 */}
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
                        m.type === 'angang' &&
                          'border-slate-500 bg-slate-700/40',
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
                      const isDrawn =
                        drawn !== null && hand.indexOf(drawn) === i;
                      return (
                        <button
                          key={`${i}-${tile}`}
                          type="button"
                          onClick={() => canDiscard && discard(0, tile)}
                          className={cn(
                            TILE_HAND,
                            getTileColorClass(tile),
                            isDrawn && TILE_ACTIVE,
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-xl font-bold text-[#ffc107] text-center mb-3">
                {winResult.isTsumo ? '自摸！' : '荣和！'}
              </h3>
              <p className="text-sm text-[#f1faee]/90 mb-2">役种：</p>
              <ul className="list-disc list-inside text-sm text-[#f1faee] space-y-1 mb-4">
                {winResult.yaku.map((y, i) => (
                  <li key={i}>
                    {y.name} {y.han}番
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
                onClick={proceedToNextRound}
              >
                下一局
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GameMahjongJapanese;
