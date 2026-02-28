import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useRiichiSounds } from '@/hooks/useRiichiSounds';
import {
  calcFu,
  calcScore,
  canMingangRiichi,
  canPengRiichi,
  computeYaku,
  createRiichiDeck,
  dealRiichi,
  getAngangOptionsRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getDoraFromIndicator,
  getTileLabel,
  getTotalHan,
  hasYaku,
  isAkaFive,
  isWinShapeRiichi,
  TILE_LABELS_RIICHI,
  type YakuResult,
} from '@/lib/mahjongRiichi';
import {
  type AbortiveDrawReason,
  canDeclareKyuushuKyuuhai,
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
  shouldAbortOnSuukaikan,
} from '@/lib/riichiAbortiveDraw';
import {
  applyAiRiichiState,
  canAiRonOnClaim,
  chooseAiClaimActionAgainstRiichi,
  chooseAiDefensiveDiscardWithMeta,
  shouldAiDeclareRiichi,
  shouldAiFoldClaimAgainstRiichi,
} from '@/lib/riichiAi';
import { canOfferRon, resolveClaimPass } from '@/lib/riichiClaimFlow';
import {
  consumeTimeBankSeconds,
  getTurnTotalSeconds,
  isTurnTimeout,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
} from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  clearDoujunFuriten,
  createInitialFuritenState,
  isRonForbiddenByFuriten,
} from '@/lib/riichiFuriten';
import {
  type MatchEndReason,
  rankSeatsByScore,
  resolveRiichiMatchEnd,
} from '@/lib/riichiGameEnd';
import {
  buildRiichiInput,
  calcWithRiichiRs,
  type GameStateForRs,
} from '@/lib/riichiRsAdapter';
import {
  type PaymentDetail,
  RIICHI_INITIAL_POINTS,
  settleRyuukyoku,
  settleWin,
} from '@/lib/riichiSettlement';
import { cn } from '@/lib/utils';

const SEAT_NAMES = ['自家', '下家', '对家', '上家'];
const WIND_NAMES = ['东', '南', '西', '北'];

const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
const TILE_ACTIVE =
  'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60 animate-riichi-active-pulse';

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
  /** 四家总分（默认 25000 起） */
  scores: number[];
  /** 四家时间库（秒），每巡额外+5秒读秒 */
  timeBanks: number[];
  /** 立直棒池（点数，1000 的倍数） */
  riichiPot: number;
  /** 立直状态：每个玩家是否已立直 */
  riichiDeclared: boolean[];
  /** 振听状态（sutehai 为展示位，实时根据手牌与河计算） */
  furitenStates: { sutehai: boolean; doujun: boolean; riichi: boolean }[];
  /** 立直宣言牌：记录每个玩家立直时打出的牌（用于一发判定） */
  riichiDiscard: (number | null)[];
  /** 里宝牌指示牌 */
  uraDoraIndicators: number[];
  /** 荒牌流局：牌墙摸完无人和 */
  ryuukyoku?: boolean;
  /** 流局类型：荒牌/途中流局。 */
  ryuukyokuReason?: '荒牌' | AbortiveDrawReason;
  /** 本局结算流水（用于弹窗/日志） */
  lastSettlement?: {
    payments: PaymentDetail[];
    deltas: number[];
    newScores: number[];
    tenpaiSeats?: number[];
    timeoutEvents?: string[];
  };
  /** 本局超时自动出牌记录 */
  timeoutEvents: string[];
}

function initRiichiGame(
  dealer = 0,
  roundWind = 0,
  roundNumber = 1,
  honba = 0,
  scores: number[] = [
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
  ],
  timeBanks: number[] = [
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
  ],
  riichiPot = 0,
  lastSettlement?: RiichiGameState['lastSettlement'],
): RiichiGameState {
  const deck = createRiichiDeck();
  const [hands, rest] = dealRiichi(deck, dealer);
  const doraIndicator = rest[0];
  const uraDoraIndicator = rest[1];
  const wall = rest.slice(2);
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
    scores: [...scores],
    timeBanks: [...timeBanks],
    riichiPot,
    riichiDeclared: [false, false, false, false],
    furitenStates: [
      createInitialFuritenState(),
      createInitialFuritenState(),
      createInitialFuritenState(),
      createInitialFuritenState(),
    ],
    riichiDiscard: [null, null, null, null],
    uraDoraIndicators: uraDoraIndicator === undefined ? [] : [uraDoraIndicator],
    timeoutEvents: [],
    lastSettlement,
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

function getRyuukyokuReasonText(
  reason?: RiichiGameState['ryuukyokuReason'],
): string {
  return reason ?? '荒牌';
}

function getRyuukyokuDescription(
  reason?: RiichiGameState['ryuukyokuReason'],
): string {
  switch (reason) {
    case '四风连打':
      return '四家第一打同风牌，途中流局，本场+1，庄家连庄';
    case '四家立直':
      return '四家均已立直，途中流局，本场+1，庄家连庄';
    case '四开杠':
      return '全场四杠成立（非一人四杠），途中流局，本场+1，庄家连庄';
    case '九种九牌':
      return '九种九牌宣言成立，途中流局，本场+1，庄家连庄';
    default:
      return '牌墙摸完无人和，本场+1，庄家连庄';
  }
}

function getMatchEndReasonText(reason?: MatchEndReason): string {
  switch (reason) {
    case 'tobi':
      return '有人被击飞（负分）';
    case 'agari_yame':
      return '南4庄家连庄且头名，收场';
    case 'south4_end':
      return '南4本局结束';
    default:
      return '终局';
  }
}

function getRonWaitingTilesForSeatInState(
  state: RiichiGameState,
  seat: number,
): number[] {
  const hand = state.hands[seat];
  const melds = state.melds[seat];
  if (hand.length !== 13) return [];
  const waiting: number[] = [];
  for (let t = 0; t < 34; t++) {
    const testHand = [...hand, t];
    if (!isWinShapeRiichi(testHand, melds)) continue;
    const ctx = {
      hand: testHand,
      melds: melds.map((m) => ({ tiles: m.tiles })),
      meldsTyped: melds,
      isMenzhen: melds.every((m) => m.type === 'angang'),
      isTsumo: false,
      isRiichi: state.riichiDeclared[seat],
      ippatsuPossible: false,
      seatWind: getSeatWind(state.roundWind, seat, state.dealer),
      roundWind: state.roundWind,
    };
    if (hasYaku(ctx)) waiting.push(t);
  }
  return waiting;
}

function canSeatRonByRules(state: RiichiGameState, seat: number): boolean {
  if (
    state.phase !== 'claim' ||
    state.lastDiscard === null ||
    state.lastDiscardFrom === null ||
    state.lastDiscardFrom === seat
  )
    return false;
  const handWithClaim = [...state.hands[seat], state.lastDiscard];
  if (!isWinShapeRiichi(handWithClaim, state.melds[seat])) return false;
  const melds = state.melds[seat];
  const yakuOk = hasYaku({
    hand: handWithClaim,
    melds: melds.map((m) => ({ tiles: m.tiles })),
    meldsTyped: melds,
    isMenzhen: melds.every((m) => m.type === 'angang'),
    isTsumo: false,
    isRiichi: state.riichiDeclared[seat],
    ippatsuPossible: false,
    seatWind: getSeatWind(state.roundWind, seat, state.dealer),
    roundWind: state.roundWind,
  });
  if (!yakuOk) return false;
  return !isRonForbiddenByFuriten({
    waitingTiles: getRonWaitingTilesForSeatInState(state, seat),
    ownDiscards: state.discardPiles[seat],
    state: state.furitenStates[seat] ?? createInitialFuritenState(),
  });
}

const MAX_HISTORY = 40;
const MAX_LOG = 150;

function formatPoints(points: number): string {
  return `${points.toLocaleString()} 点`;
}

function countUraDoraHan(allTiles: number[], indicators: number[]): number {
  if (indicators.length === 0) return 0;
  const doraTypes = indicators.map((i) => getDoraFromIndicator(i));
  return allTiles.filter((t) => doraTypes.includes(getBaseTile(t))).length;
}

function appendUraDoraYaku(yaku: YakuResult[], uraHan: number): YakuResult[] {
  if (uraHan <= 0) return yaku;
  const alreadyHasUra = yaku.some((y) => y.id === '54' || y.id === 'ura_dora');
  if (alreadyHasUra) return yaku;
  return [...yaku, { id: 'ura_dora', name: '里宝牌', han: uraHan }];
}

function summarizeWinnerPayments(
  payments: PaymentDetail[],
  winner: number,
): { base: number; honba: number; riichi: number } {
  let base = 0;
  let honba = 0;
  let riichi = 0;
  for (const p of payments) {
    if (p.to !== winner) continue;
    if (p.reason === 'riichi') riichi += p.amount;
    else if (p.reason === 'honba') honba += p.amount;
    else base += p.amount;
  }
  return { base, honba, riichi };
}

function clearSeatDoujunStates(
  states: RiichiGameState['furitenStates'],
  seat: number,
): RiichiGameState['furitenStates'] {
  return states.map((s, i) =>
    i === seat ? clearDoujunFuriten(s ?? createInitialFuritenState()) : s,
  );
}

function needsDiscardDecision(state: RiichiGameState): boolean {
  if (state.phase !== 'discard') return false;
  const p = state.currentPlayer;
  return state.drawnTile !== null || state.hands[p].length === 11;
}

function getClaimPlayerFromState(state: RiichiGameState): number | null {
  if (state.phase !== 'claim' || state.lastDiscardFrom === null) return null;
  return (state.lastDiscardFrom + 1 + state.claimIndex) % 4;
}

function needsTimedDecision(state: RiichiGameState): boolean {
  if (needsDiscardDecision(state)) return true;
  return (
    state.phase === 'claim' &&
    state.lastDiscard !== null &&
    state.lastDiscardFrom !== null &&
    getClaimPlayerFromState(state) !== null
  );
}

function getDecisionSeat(state: RiichiGameState): number {
  if (state.phase === 'discard') return state.currentPlayer;
  return getClaimPlayerFromState(state) ?? state.currentPlayer;
}

function getTenpaiSeatsForDraw(
  game: RiichiGameState,
  getWaitingTiles: (
    hand: number[],
    melds: RiichiMeld[],
    g?: RiichiGameState,
  ) => number[],
): number[] {
  const tenpai: number[] = [];
  for (let seat = 0; seat < 4; seat++) {
    if (getWaitingTiles(game.hands[seat], game.melds[seat], game).length > 0) {
      tenpai.push(seat);
    }
  }
  return tenpai;
}

const GameMahjongJapanese = () => {
  const { t } = useLocale();
  const sounds = useRiichiSounds();
  const [view, setView] = useState<'rules' | 'game'>('rules');
  const [game, setGame] = useState<RiichiGameState | null>(null);
  const [history, setHistory] = useState<RiichiGameState[]>([]);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [winResult, setWinResult] = useState<{
    winner: number;
    isTsumo: boolean;
    yaku: YakuResult[];
    fu?: number;
    han?: number;
    ten?: number;
    uraHan?: number;
    uraDoraIndicators?: number[];
  } | null>(null);
  const [showGuide, setShowGuide] = useState(true); // 新手引导状态
  const [declinedRonToken, setDeclinedRonToken] = useState<string | null>(null);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [matchEnd, setMatchEnd] = useState<{
    reason: MatchEndReason;
    finalScores: number[];
    ranking: number[];
  } | null>(null);
  const prevGameRef = useRef<RiichiGameState | null>(null);
  const undoingRef = useRef(false);
  const addLogRef = useRef<(msg: string) => void>(() => {});
  const turnClockRef = useRef<{ player: number; startedAt: number } | null>(
    null,
  );
  const lowTimeWarnedTurnRef = useRef<string | null>(null);

  const addLog = useCallback((msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setGameLog((l) => [...l, line].slice(-MAX_LOG));
  }, []);
  addLogRef.current = addLog;

  const enrichWinResultWithUra = useCallback(
    (params: {
      state: RiichiGameState;
      winner: number;
      isTsumo: boolean;
      handWithWin: number[];
      yaku: YakuResult[];
      fu?: number;
      han?: number;
      ten?: number;
    }): {
      winner: number;
      isTsumo: boolean;
      handWithWin: number[];
      yaku: YakuResult[];
      fu?: number;
      han?: number;
      ten?: number;
      uraHan?: number;
      uraDoraIndicators?: number[];
    } => {
      if (!params.state.riichiDeclared[params.winner]) {
        return {
          winner: params.winner,
          isTsumo: params.isTsumo,
          handWithWin: params.handWithWin,
          yaku: params.yaku,
          fu: params.fu,
          han: params.han,
          ten: params.ten,
          uraHan: 0,
          uraDoraIndicators: [],
        };
      }
      const allTiles = [
        ...params.handWithWin,
        ...params.state.melds[params.winner].flatMap((m) => m.tiles),
      ];
      const uraHan = countUraDoraHan(allTiles, params.state.uraDoraIndicators);
      const yakuWithUra = appendUraDoraYaku(params.yaku, uraHan);
      const uraAdded = yakuWithUra.length !== params.yaku.length;
      if (!uraAdded) {
        return {
          winner: params.winner,
          isTsumo: params.isTsumo,
          handWithWin: params.handWithWin,
          yaku: yakuWithUra,
          fu: params.fu,
          han: params.han,
          ten: params.ten,
          uraHan,
          uraDoraIndicators: params.state.uraDoraIndicators,
        };
      }
      const baseHan = params.han ?? getTotalHan(params.yaku);
      const nextHan = baseHan + uraHan;
      const nextTen =
        params.fu != null
          ? calcScore(
              params.fu,
              nextHan,
              params.state.dealer === params.winner,
              params.isTsumo,
            )
          : params.ten;
      return {
        winner: params.winner,
        isTsumo: params.isTsumo,
        handWithWin: params.handWithWin,
        yaku: yakuWithUra,
        fu: params.fu,
        han: nextHan,
        ten: nextTen,
        uraHan,
        uraDoraIndicators: params.state.uraDoraIndicators,
      };
    },
    [],
  );

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

  useEffect(() => {
    const id = window.setInterval(() => setClockNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const getElapsedSecondsForSeat = useCallback((seat: number): number => {
    const c = turnClockRef.current;
    if (!c || c.player !== seat) return 0;
    return Math.max(0, (Date.now() - c.startedAt) / 1000);
  }, []);

  const consumeSeatTimeBank = useCallback(
    (state: RiichiGameState, seat: number): number[] => {
      const elapsed = getElapsedSecondsForSeat(seat);
      if (elapsed <= 0) return state.timeBanks;
      return state.timeBanks.map((tb, i) =>
        i === seat ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
    },
    [getElapsedSecondsForSeat],
  );

  useEffect(() => {
    if (!game || !needsTimedDecision(game)) {
      turnClockRef.current = null;
      return;
    }
    const decisionSeat = getDecisionSeat(game);
    const current = turnClockRef.current;
    if (!current || current.player !== decisionSeat) {
      turnClockRef.current = { player: decisionSeat, startedAt: Date.now() };
    }
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.claimIndex,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.drawnTile,
    game?.hands?.[game?.currentPlayer ?? 0]?.length,
    game,
  ]);

  useEffect(() => {
    if (!game || !needsTimedDecision(game)) return;
    const player = getDecisionSeat(game);
    const c = turnClockRef.current;
    if (!c || c.player !== player) return;
    const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
    if (!isTurnTimeout(game.timeBanks[player], elapsed)) return;
    setGame((g) => {
      if (!g || !needsTimedDecision(g) || getDecisionSeat(g) !== player)
        return g;
      const nextBanks = g.timeBanks.map((tb, i) =>
        i === player ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      if (g.phase === 'claim' && g.lastDiscardFrom !== null) {
        const ronDeclined = canSeatRonByRules(g, player);
        const nextFuritenStates = ronDeclined
          ? g.furitenStates.map((s, i) =>
              i === player
                ? applyRonDeclinedFuriten(
                    s ?? createInitialFuritenState(),
                    g.riichiDeclared[player],
                  )
                : s,
            )
          : g.furitenStates;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        if (passResult.type === 'next') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            claimIndex: passResult.nextClaimIndex,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
          };
        }
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (passResult.type === 'ryuukyoku') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过（流局）`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
            ryuukyoku: true,
            ryuukyokuReason: '荒牌',
          };
        }
        const draw = g.wall[0];
        const newWall = g.wall.slice(1);
        const newHands = g.hands.map((h) => [...h]);
        newHands[nextPlayer].push(draw);
        newHands[nextPlayer].sort(
          (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
        );
        addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
        turnClockRef.current = null;
        return {
          ...g,
          timeBanks: nextBanks,
          furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
          hands: newHands,
          wall: newWall,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
        };
      }
      const toDiscard = g.drawnTile ?? g.hands[player][0];
      if (toDiscard === undefined) return g;
      const hand = [...g.hands[player]];
      const idx = hand.indexOf(toDiscard);
      if (idx < 0) return g;
      hand.splice(idx, 1);
      const piles = g.discardPiles.map((q) => [...q]);
      piles[player].push(toDiscard);
      const nextPlayer = (player + 1) % 4;
      addLogRef.current(
        `${SEAT_NAMES[player]} 超时，自动打出 ${getTileLabel(toDiscard)}`,
      );
      const timeoutEvent = `${SEAT_NAMES[player]} 超时自动打出 ${getTileLabel(toDiscard)}`;
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...g,
        timeoutEvents: [...g.timeoutEvents, timeoutEvent].slice(-20),
        timeBanks: nextBanks,
        hands: g.hands.map((h, i) => (i === player ? hand : h)),
        discardPiles: piles,
        currentPlayer: nextPlayer,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: player,
        claimIndex: 0,
        lastClaimMsg: `${SEAT_NAMES[player]} 超时自动出牌`,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLogRef.current('流局（四家立直）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        };
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLogRef.current('流局（四风连打）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        };
      }
      return nextState;
    });
  }, [clockNowMs, game]);

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
    setMatchEnd(null);
    setDeclinedRonToken(null);
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
      if (player === 0) sounds.playDiscard();
      const nextTimeBanks = consumeSeatTimeBank(game, player);
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...game,
        timeBanks: nextTimeBanks,
        hands,
        discardPiles: piles,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
        lastClaimMsg: null,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLog('流局（四家立直）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        });
        return;
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLog('流局（四风连打）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        });
        return;
      }
      setGame(nextState);
    },
    [game, addLog, sounds, consumeSeatTimeBank],
  );

  const passClaim = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscardFrom === null)
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const passResult = resolveClaimPass(game.claimIndex, game.wall.length);
    if (passResult.type === 'next') {
      addLog('自家 过');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        claimIndex: passResult.nextClaimIndex,
        lastClaimMsg: null,
      });
      return;
    }
    const nextPlayer = (game.lastDiscardFrom + 1) % 4;
    if (passResult.type === 'ryuukyoku') {
      addLog('流局（荒牌）');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '荒牌',
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
      timeBanks: timedBanks,
      hands: newHands,
      wall: newWall,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: nextPlayer,
      drawnTile: draw,
      lastClaimMsg: null,
    });
  }, [game, addLog, consumeSeatTimeBank]);

  const doChi = useCallback(
    (option: [number, number]) => {
      if (
        !game ||
        game.phase !== 'claim' ||
        game.lastDiscard === null ||
        game.lastDiscardFrom === null
      )
        return;
      const ronDeclined = canSeatRonByRules(game, 0);
      const timedBanks = consumeSeatTimeBank(game, 0);
      turnClockRef.current = null;
      const nextFuritenStates = ronDeclined
        ? game.furitenStates.map((s, i) =>
            i === 0
              ? applyRonDeclinedFuriten(
                  s ?? createInitialFuritenState(),
                  game.riichiDeclared[0],
                )
              : s,
          )
        : game.furitenStates;
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
      sounds.playChi();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
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
    [game, addLog, sounds, consumeSeatTimeBank],
  );

  const doPeng = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
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
    sounds.playPon();
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: nextFuritenStates,
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
  }, [game, addLog, sounds, consumeSeatTimeBank]);

  /** 获取听牌信息（需传入 game 以取 roundWind/dealer） */
  const getWaitingTilesRiichi = useCallback(
    (
      hand: number[],
      melds: RiichiMeld[],
      gameState?: RiichiGameState | null,
      options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
    ): number[] => {
      if (hand.length !== 13) return [];
      const seat = options?.seat ?? 0;
      const waiting: number[] = [];
      for (let t = 0; t < 34; t++) {
        const testHand = [...hand, t];
        if (isWinShapeRiichi(testHand, melds)) {
          const ctx = {
            hand: testHand,
            melds: melds.map((m) => ({ tiles: m.tiles })),
            isMenzhen: melds.every((m) => m.type === 'angang'),
            isTsumo: options?.isTsumo ?? true,
            isRiichi:
              options?.treatAsRiichi ??
              gameState?.riichiDeclared[seat] ??
              false,
            ippatsuPossible: false,
            seatWind: getSeatWind(
              gameState?.roundWind ?? 0,
              seat,
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
    const waitingTiles = getWaitingTilesRiichi(game.hands[0], melds, game, {
      seat: 0,
      isTsumo: false,
      treatAsRiichi: true,
    });
    if (waitingTiles.length === 0) return;
    if (game.scores[0] < 1000) {
      addLog('点数不足 1000，不能立直');
      return;
    }

    addLog('自家 立直宣言！（-1000 点）');
    sounds.playRiichi();

    setGame({
      ...game,
      scores: game.scores.map((v, i) => (i === 0 ? v - 1000 : v)),
      riichiPot: game.riichiPot + 1000,
      riichiDeclared: game.riichiDeclared.map((declared, i) =>
        i === 0 ? true : declared,
      ),
      lastClaimMsg: '立直宣言！听牌固定，不能换牌',
    });
  }, [game, addLog, getWaitingTilesRiichi, sounds]);

  const doKyuushuKyuuhai = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.hands[0].length !== 14
    )
      return;
    const isFirstTurnSelf = game.discardPiles[0].length === 0;
    if (!isFirstTurnSelf) return;
    if (!canDeclareKyuushuKyuuhai(game.hands[0])) return;
    addLog('自家 九种九牌，途中流局');
    sounds.playRyuukyoku();
    setGame({
      ...game,
      ryuukyoku: true,
      ryuukyokuReason: '九种九牌',
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds]);

  const doMingang = useCallback(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      game.lastDiscard === null ||
      game.wall.length === 0
    )
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
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
    const handAfterKan = [...h0];
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
    sounds.playKan();
    if (shouldAbortOnSuukaikan(melds)) {
      addLog('流局（四开杠）');
      sounds.playRyuukyoku();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
        hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
        melds,
        discardPiles: piles,
        wall: game.wall,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        drawnTile: null,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '四开杠',
      });
      return;
    }
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
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
  }, [game, addLog, sounds, consumeSeatTimeBank]);

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
      const handAfterKan = [...h0];
      const rinshan = game.wall[0];
      const newWall = game.wall.slice(1);
      h0.push(rinshan);
      h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
      const melds = game.melds.map((m, i) =>
        i === 0 ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
      );
      if (shouldAbortOnSuukaikan(melds)) {
        addLog('流局（四开杠）');
        sounds.playRyuukyoku();
        setGame({
          ...game,
          hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
          melds,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: 0,
          drawnTile: null,
          lastClaimMsg: null,
          ryuukyoku: true,
          ryuukyokuReason: '四开杠',
        });
        return;
      }
      sounds.playKan();
      setGame({
        ...game,
        hands: game.hands.map((h, i) => (i === 0 ? h0 : h)),
        melds,
        wall: newWall,
        furitenStates: clearSeatDoujunStates(game.furitenStates, 0),
      });
    },
    [game, addLog, sounds],
  );

  const angangOptions =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14
      ? getAngangOptionsRiichi(game.hands[0])
      : [];
  const canKyuushuKyuuhai =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    game.discardPiles[0].length === 0 &&
    canDeclareKyuushuKyuuhai(game.hands[0]);

  // 荒牌流局：自家待摸牌但牌墙已空
  useEffect(() => {
    if (
      !game ||
      game.ryuukyoku ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length !== 0 ||
      game.hands[0].length !== 13
    )
      return;
    addLog('流局（荒牌）');
    sounds.playRyuukyoku();
    setGame((g) =>
      !g ? g : { ...g, ryuukyoku: true, ryuukyokuReason: '荒牌' },
    );
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall?.length,
    game?.hands?.[0]?.length,
    game?.ryuukyoku,
    game,
    addLog,
    sounds,
  ]);

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
    sounds.playDraw();
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[0].push(draw);
    newHands[0].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, 0),
          },
    );
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game?.hands[0]?.length,
    game,
    sounds,
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
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, p),
          },
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
      const elapsed = getElapsedSecondsForSeat(p);
      const nextTimeBanks = g.timeBanks.map((tb, i) =>
        i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      turnClockRef.current = null;
      return {
        ...g,
        timeBanks: nextTimeBanks,
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
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.hands,
    game,
    getElapsedSecondsForSeat,
  ]);

  // AI 回合 2：已摸牌则 500ms 后出牌（独立 effect）；仅出牌阶段
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
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
        const tsumoCtx = buildYakuCtx(p, hand, true);
        if (
          isWinShapeRiichi(hand, g.melds[p]) &&
          tsumoCtx &&
          hasYaku(tsumoCtx)
        ) {
          const yaku = computeYaku(tsumoCtx);
          const han = getTotalHan(yaku);
          const fu = calcFu({
            isTsumo: true,
            isMenzhen: g.melds[p].every((m) => m.type === 'angang'),
            hasPinfu: yaku.some((y) => y.id === 'pinfu'),
            isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
          });
          addLogRef.current(`${SEAT_NAMES[p]} 自摸！`);
          sounds.playTsumo();
          const ten = calcScore(fu, han, g.dealer === p, true);
          const enriched = enrichWinResultWithUra({
            state: g,
            winner: p,
            isTsumo: true,
            handWithWin: hand,
            yaku,
            han,
            fu,
            ten,
          });
          setWinResult({
            winner: p,
            isTsumo: true,
            yaku: enriched.yaku,
            han: enriched.han,
            fu: enriched.fu,
            ten: enriched.ten,
            uraHan: enriched.uraHan,
            uraDoraIndicators: enriched.uraDoraIndicators,
          });
          return g;
        }

        const doAiRiichi = shouldAiDeclareRiichi({
          alreadyRiichi: g.riichiDeclared[p],
          isMenzen: g.melds[p].every((m) => m.type === 'angang'),
          score: g.scores[p],
          waitingCount: getWaitingTilesRiichi(hand, g.melds[p], g, {
            seat: p,
            isTsumo: false,
            treatAsRiichi: true,
          }).length,
          random: Math.random(),
        });

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
          const aiRiichiLocked = g.riichiDeclared[p];
          const defensiveChoice = !aiRiichiLocked
            ? chooseAiDefensiveDiscardWithMeta({
                hand: h,
                aiSeat: p,
                riichiDeclared: g.riichiDeclared,
                discardPiles: g.discardPiles,
                doraIndicators: [g.doraIndicator],
              })
            : null;
          const defensiveDiscard = defensiveChoice?.tile ?? null;
          const toDiscard = aiRiichiLocked
            ? rinshan
            : (defensiveDiscard ?? rinshan);
          const idx = h.indexOf(toDiscard);
          if (idx === -1) return g;
          h.splice(idx, 1);
          const melds = g.melds.map((m, i) =>
            i === p ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
          );
          const piles = g.discardPiles.map((q) => [...q]);
          piles[p].push(toDiscard);
          if (
            !aiRiichiLocked &&
            defensiveChoice &&
            defensiveChoice.tile !== null &&
            defensiveChoice.reason
          ) {
            addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
          }
          if (doAiRiichi) {
            addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
            sounds.playRiichi();
          }
          const elapsed = getElapsedSecondsForSeat(p);
          const timedBanks = g.timeBanks.map((tb, i) =>
            i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
          );
          turnClockRef.current = null;
          const nextRiichi = doAiRiichi
            ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
            : null;
          const nextState: RiichiGameState = {
            ...g,
            timeBanks: timedBanks,
            scores: nextRiichi?.scores ?? g.scores,
            riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
            riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
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
            lastClaimMsg: doAiRiichi
              ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
              : null,
          };
          if (shouldAbortOnSuukaikan(nextState.melds)) {
            addLogRef.current('流局（四开杠）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四开杠',
            };
          }
          if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
            addLogRef.current('流局（四家立直）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四家立直',
            };
          }
          if (
            shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)
          ) {
            addLogRef.current('流局（四风连打）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四风连打',
            };
          }
          return nextState;
        }
        const aiRiichiLocked = g.riichiDeclared[p];
        const defensiveChoice = !aiRiichiLocked
          ? chooseAiDefensiveDiscardWithMeta({
              hand,
              aiSeat: p,
              riichiDeclared: g.riichiDeclared,
              discardPiles: g.discardPiles,
              doraIndicators: [g.doraIndicator],
            })
          : null;
        const defensiveDiscard = defensiveChoice?.tile ?? null;
        const toDiscard = aiRiichiLocked
          ? g.drawnTile
          : (defensiveDiscard ?? g.drawnTile);
        const idx = hand.indexOf(toDiscard);
        if (idx === -1) return g;
        hand.splice(idx, 1);
        const piles = g.discardPiles.map((q) => [...q]);
        piles[p].push(toDiscard);
        const next = (p + 1) % 4;
        if (
          !aiRiichiLocked &&
          defensiveChoice &&
          defensiveChoice.tile !== null &&
          defensiveChoice.reason
        ) {
          addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
        }
        if (doAiRiichi) {
          addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
          sounds.playRiichi();
        }
        const elapsed = getElapsedSecondsForSeat(p);
        const timedBanks = g.timeBanks.map((tb, i) =>
          i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
        );
        turnClockRef.current = null;
        const nextRiichi = doAiRiichi
          ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
          : null;
        const nextState: RiichiGameState = {
          ...g,
          timeBanks: timedBanks,
          scores: nextRiichi?.scores ?? g.scores,
          riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
          riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
          hands: g.hands.map((h, i) => (i === p ? hand : h)),
          discardPiles: piles,
          currentPlayer: next,
          drawnTile: null,
          phase: 'claim',
          lastDiscard: toDiscard,
          lastDiscardFrom: p,
          claimIndex: 0,
          lastClaimMsg: doAiRiichi
            ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
            : null,
        };
        if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
          addLogRef.current('流局（四家立直）');
          sounds.playRyuukyoku();
          return {
            ...nextState,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            ryuukyoku: true,
            ryuukyokuReason: '四家立直',
          };
        }
        if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
          addLogRef.current('流局（四风连打）');
          sounds.playRyuukyoku();
          return {
            ...nextState,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            ryuukyoku: true,
            ryuukyokuReason: '四风连打',
          };
        }
        return nextState;
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
  const currentClaimToken =
    game &&
    isClaimPhase &&
    game.lastDiscardFrom !== null &&
    game.lastDiscard !== null
      ? `${game.roundWind}:${game.roundNumber}:${game.honba}:${game.wall.length}:${game.lastDiscardFrom}:${game.lastDiscard}:${game.discardPiles[game.lastDiscardFrom]?.length ?? 0}`
      : null;
  /** 立直后禁止吃/碰/明杠（技能：立直约束） */
  const riichiNoClaim = game?.riichiDeclared[0] ?? false;
  const chiOptions =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
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
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canPengRiichi(game.hands[0], game.lastDiscard);
  const canMingang =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canMingangRiichi(game.hands[0], game.lastDiscard);

  /** 构建役判定上下文（自家）；立直/一发按当前局状态传入 */
  const buildYakuCtx = useCallback(
    (seat: number, hand: number[], isTsumo: boolean) => {
      if (!game) return null;
      const melds = game.melds[seat];
      const menzen = melds.every((m) => m.type === 'angang');
      return {
        hand,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: menzen,
        isTsumo,
        isRiichi: game.riichiDeclared[seat],
        ippatsuPossible: false, // 一发需立直后一巡内和了，可后续按巡数细化
        seatWind: getSeatWind(game.roundWind, seat, game.dealer),
        roundWind: game.roundWind,
      };
    },
    [game],
  );

  const getRonWaitingTilesForSeat = useCallback(
    (seat: number, state: RiichiGameState): number[] =>
      getWaitingTilesRiichi(state.hands[seat], state.melds[seat], state, {
        seat,
        isTsumo: false,
      }),
    [getWaitingTilesRiichi],
  );

  const isSeatFuriten = useCallback(
    (seat: number, state: RiichiGameState): boolean =>
      isRonForbiddenByFuriten({
        waitingTiles: getRonWaitingTilesForSeat(seat, state),
        ownDiscards: state.discardPiles[seat],
        state: state.furitenStates[seat] ?? createInitialFuritenState(),
      }),
    [getRonWaitingTilesForSeat],
  );

  const markSeatRonDeclined = useCallback((seat: number) => {
    setGame((g) => {
      if (!g) return g;
      const furitenStates = g.furitenStates.map((s, i) =>
        i === seat
          ? applyRonDeclinedFuriten(
              s ?? createInitialFuritenState(),
              g.riichiDeclared[seat],
            )
          : s,
      );
      return { ...g, furitenStates };
    });
  }, []);

  const canTsumo =
    game &&
    game.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    isWinShapeRiichi(game.hands[0], game.melds[0]) &&
    (() => {
      const ctx = buildYakuCtx(0, game.hands[0], true);
      return ctx ? hasYaku(ctx) : false;
    })();

  const canRon =
    game &&
    (() => {
      const lastD = game.lastDiscard;
      if (lastD === null) return false;
      const handWithClaim = [...game.hands[0], lastD];
      const winShape = isWinShapeRiichi(handWithClaim, game.melds[0]);
      const ctx = buildYakuCtx(0, handWithClaim, false);
      const yakuReady = ctx ? hasYaku(ctx) : false;
      const furitenBlocked = isSeatFuriten(0, game);
      return canOfferRon({
        phase: game.phase,
        lastDiscard: game.lastDiscard,
        lastDiscardFrom: game.lastDiscardFrom,
        currentClaimToken,
        declinedRonToken,
        isWinShape: winShape,
        hasYaku: yakuReady && !furitenBlocked,
      });
    })();

  const hasNonRonClaimOption = chiOptions.length > 0 || canPeng || canMingang;
  const hasAnyClaimOption = hasNonRonClaimOption || canRon;
  const decisionSeat =
    game && needsTimedDecision(game) ? getDecisionSeat(game) : null;
  const decisionSeatRemainSeconds =
    game && decisionSeat !== null
      ? (() => {
          const c = turnClockRef.current;
          if (!c || c.player !== decisionSeat) {
            return getTurnTotalSeconds(game.timeBanks[decisionSeat]);
          }
          const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
          return Math.max(
            0,
            Math.ceil(
              getTurnTotalSeconds(game.timeBanks[decisionSeat]) - elapsed,
            ),
          );
        })()
      : null;
  const currentTurnRemainSeconds =
    game && decisionSeat === 0 ? decisionSeatRemainSeconds : null;
  const timerTextClass = (seat: number): string => {
    const active = decisionSeat === seat && decisionSeatRemainSeconds != null;
    if (!active) return 'text-[#a8dadc]';
    if (decisionSeatRemainSeconds <= 3)
      return 'text-red-300 animate-pulse font-semibold';
    if (decisionSeatRemainSeconds <= 8) return 'text-amber-300 font-semibold';
    return 'text-emerald-300';
  };

  const decisionTurnKey =
    game && decisionSeat !== null
      ? `${game.phase}:${decisionSeat}:${game.currentPlayer}:${game.claimIndex}:${game.lastDiscardFrom ?? -1}:${game.lastDiscard ?? -1}`
      : null;

  useEffect(() => {
    if (!game || decisionSeat !== 0 || currentTurnRemainSeconds == null) return;
    if (currentTurnRemainSeconds > 3 || currentTurnRemainSeconds <= 0) return;
    if (!decisionTurnKey) return;
    if (lowTimeWarnedTurnRef.current === decisionTurnKey) return;
    sounds.playTimeWarning();
    lowTimeWarnedTurnRef.current = decisionTurnKey;
  }, [game, decisionSeat, currentTurnRemainSeconds, decisionTurnKey, sounds]);
  const myFuritenReason =
    game && isClaimPhase
      ? (() => {
          const waits = getRonWaitingTilesForSeat(0, game);
          const st = game.furitenStates[0] ?? createInitialFuritenState();
          const sutehai = isRonForbiddenByFuriten({
            waitingTiles: waits,
            ownDiscards: game.discardPiles[0],
            state: { ...st, doujun: false, riichi: false, sutehai: false },
          });
          if (st.riichi) return '立直振听（本局不可荣和）';
          if (st.doujun) return '同巡振听（下次摸牌后解除）';
          if (sutehai) return '舍张振听（当前听牌牌种与自家河重复）';
          return null;
        })()
      : null;

  /** 自摸：当前手牌 14 张且和牌形+有役；优先用 riichi-rs 算分 */
  const doTsumo = useCallback(() => {
    if (!game || !canTsumo) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const hand = game.hands[0];
    const stateForRs: GameStateForRs = {
      hand,
      melds: game.melds[0],
      doraIndicator: game.doraIndicator,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
    };
    const input = buildRiichiInput(stateForRs, true);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(`自家 自摸！${rs.fu}符 ${rs.han}番 ${rs.ten}点`);
      sounds.playTsumo();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: true,
        handWithWin: hand,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      setWinResult({
        winner: 0,
        isTsumo: true,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, hand, true);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(`自家 自摸！役: ${yaku.map((y) => y.name).join(' ')}`);
    sounds.playTsumo();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: true,
      isMenzhen: game.melds[0].every((m) => m.type === 'angang'),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, true);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: true,
      handWithWin: hand,
      yaku,
      fu,
      han,
      ten,
    });
    setWinResult({
      winner: 0,
      isTsumo: true,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canTsumo,
    buildYakuCtx,
    addLog,
    sounds,
    enrichWinResultWithUra,
    consumeSeatTimeBank,
  ]);

  /** 荣和：要牌阶段别人打的牌能胡；优先用 riichi-rs 算分 */
  const doRon = useCallback(() => {
    if (!game || !canRon || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const handWithClaim = [...game.hands[0], game.lastDiscard];
    const stateForRs: GameStateForRs = {
      hand: handWithClaim,
      melds: game.melds[0],
      doraIndicator: game.doraIndicator,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
    };
    const input = buildRiichiInput(stateForRs, false, game.lastDiscard);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(
        `自家 荣和 ${getTileLabel(game.lastDiscard)}！${rs.fu}符 ${rs.han}番 ${rs.ten}点`,
      );
      sounds.playRon();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: false,
        handWithWin: handWithClaim,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      setWinResult({
        winner: 0,
        isTsumo: false,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, handWithClaim, false);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(
      `自家 荣和 ${getTileLabel(game.lastDiscard)}！役: ${yaku.map((y) => y.name).join(' ')}`,
    );
    sounds.playRon();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: false,
      isMenzhen: game.melds[0].every((m) => m.type === 'angang'),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, false);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: false,
      handWithWin: handWithClaim,
      yaku,
      fu,
      han,
      ten,
    });
    setWinResult({
      winner: 0,
      isTsumo: false,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [
    game,
    canRon,
    buildYakuCtx,
    addLog,
    sounds,
    enrichWinResultWithUra,
    consumeSeatTimeBank,
  ]);

  const passRonOpportunity = useCallback(() => {
    if (!currentClaimToken) return;
    markSeatRonDeclined(0);
    setGame((g) => (g ? { ...g, timeBanks: consumeSeatTimeBank(g, 0) } : g));
    turnClockRef.current = null;
    setDeclinedRonToken(currentClaimToken);
    addLog('自家 过（放弃荣和）');
  }, [currentClaimToken, addLog, markSeatRonDeclined, consumeSeatTimeBank]);

  const resolveWinBaseTen = useCallback(
    (result: NonNullable<typeof winResult>, state: RiichiGameState): number => {
      if (result.ten != null && result.ten > 0) return result.ten;
      const han = result.han ?? getTotalHan(result.yaku);
      if (han <= 0) return 1000;
      const hasPinfu = result.yaku.some((y) => y.id === 'pinfu');
      const isChiitoitsu = result.yaku.some((y) => y.id === 'chiitoitsu');
      const isMenzhen = state.melds[result.winner].every(
        (m) => m.type === 'angang',
      );
      const fu =
        result.fu ??
        calcFu({
          isTsumo: result.isTsumo,
          isMenzhen,
          hasPinfu,
          isChiitoitsu,
        });
      return calcScore(fu, han, state.dealer === result.winner, result.isTsumo);
    },
    [],
  );

  /** 胡牌后进入下一局 */
  const proceedToNextRound = useCallback(() => {
    if (!game || !winResult) return;
    const baseTen = resolveWinBaseTen(winResult, game);
    const settlement = settleWin({
      scores: game.scores,
      winner: winResult.winner,
      isTsumo: winResult.isTsumo,
      baseTen,
      dealer: game.dealer,
      honba: game.honba,
      riichiPot: game.riichiPot,
      ronFrom: game.lastDiscardFrom,
    });
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`本局结算：${scoreLine}`);
    const dealerWon = game.dealer === winResult.winner;
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays: dealerWon,
    });
    if (end.end && end.reason) {
      setWinResult(null);
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      dealerWon,
    );
    setWinResult(null);
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          timeoutEvents: game.timeoutEvents,
        },
      ),
    );
    addLog(dealerWon ? '庄家胡，连庄' : '子家胡，换庄');
  }, [game, winResult, addLog, resolveWinBaseTen]);

  /** 流局后进入下一局（庄家连庄，本场+1） */
  const proceedAfterRyuukyoku = useCallback(() => {
    if (!game || !game.ryuukyoku) return;
    const reason = game.ryuukyokuReason ?? '荒牌';
    const isExhaustiveDraw = reason === '荒牌';
    const tenpaiSeats = isExhaustiveDraw
      ? getTenpaiSeatsForDraw(game, getWaitingTilesRiichi)
      : [];
    const settlement = isExhaustiveDraw
      ? settleRyuukyoku(game.scores, tenpaiSeats, game.riichiPot)
      : {
          payments: [] as PaymentDetail[],
          deltas: [0, 0, 0, 0],
          newScores: [...game.scores],
          nextRiichiPot: game.riichiPot,
        };
    const tenpaiText = !isExhaustiveDraw
      ? '途中流局（不执行不听罚符）'
      : tenpaiSeats.length === 0
        ? '无人听牌'
        : tenpaiSeats.length === 4
          ? '全员听牌'
          : `听牌：${tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`;
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`流局结算（${tenpaiText}）：${scoreLine}`);
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays: true,
    });
    if (end.end && end.reason) {
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      true,
    );
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          tenpaiSeats: isExhaustiveDraw ? tenpaiSeats : undefined,
          timeoutEvents: game.timeoutEvents,
        },
      ),
    );
    addLog(`流局（${reason}），连庄`);
  }, [game, addLog, getWaitingTilesRiichi]);

  const winSettlementPreview = useMemo(() => {
    if (!game || !winResult) return null;
    const baseTen = resolveWinBaseTen(winResult, game);
    try {
      return settleWin({
        scores: game.scores,
        winner: winResult.winner,
        isTsumo: winResult.isTsumo,
        baseTen,
        dealer: game.dealer,
        honba: game.honba,
        riichiPot: game.riichiPot,
        ronFrom: game.lastDiscardFrom,
      });
    } catch {
      return null;
    }
  }, [game, winResult, resolveWinBaseTen]);

  const drawSettlementPreview = useMemo(() => {
    if (!game || !game.ryuukyoku) return null;
    const reason = game.ryuukyokuReason ?? '荒牌';
    const isExhaustiveDraw = reason === '荒牌';
    const tenpaiSeats = isExhaustiveDraw
      ? getTenpaiSeatsForDraw(game, getWaitingTilesRiichi)
      : [];
    const settlement = isExhaustiveDraw
      ? settleRyuukyoku(game.scores, tenpaiSeats, game.riichiPot)
      : {
          payments: [] as PaymentDetail[],
          deltas: [0, 0, 0, 0],
          newScores: [...game.scores],
          nextRiichiPot: game.riichiPot,
        };
    return { tenpaiSeats, settlement };
  }, [game, getWaitingTilesRiichi]);

  const winnerPaymentSummary = useMemo(() => {
    if (!winResult || !winSettlementPreview) return null;
    return summarizeWinnerPayments(
      winSettlementPreview.payments,
      winResult.winner,
    );
  }, [winResult, winSettlementPreview]);

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
      const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
      if (passResult.type === 'next') {
        return {
          ...g,
          claimIndex: passResult.nextClaimIndex,
          lastClaimMsg: null,
        };
      }
      const nextPlayer = (g.lastDiscardFrom + 1) % 4;
      if (passResult.type === 'ryuukyoku') {
        addLogRef.current('流局（荒牌）');
        return {
          ...g,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          lastClaimMsg: null,
          ryuukyoku: true,
          ryuukyokuReason: '荒牌',
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
        furitenStates: clearSeatDoujunStates(g.furitenStates, nextPlayer),
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        drawnTile: draw,
        lastClaimMsg: null,
      };
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer === null ||
      claimPlayer === 0 ||
      canRon
    )
      return;
    const p = claimPlayer;
    const last = game.lastDiscard;
    const from = game.lastDiscardFrom;
    if (last === null || from === null) return;
    const hand = game.hands[p];
    const handWithClaim = [...hand, last];
    const ronCtx = buildYakuCtx(p, handWithClaim, false);
    const furitenBlocked = isSeatFuriten(p, game);
    const aiCanRon = canAiRonOnClaim({
      fromPlayer: from,
      aiSeat: p,
      isWinShape: isWinShapeRiichi(handWithClaim, game.melds[p]),
      hasYaku: (ronCtx ? hasYaku(ronCtx) : false) && !furitenBlocked,
    });
    const aiRiichiLocked = game.riichiDeclared[p];
    const foldClaimByRiichi =
      !aiRiichiLocked &&
      shouldAiFoldClaimAgainstRiichi({
        aiSeat: p,
        riichiDeclared: game.riichiDeclared,
      });
    const chiOpts = aiRiichiLocked
      ? []
      : getChiOptionsRiichi(hand, last, from, p);
    const peng = aiRiichiLocked ? false : canPengRiichi(hand, last);
    const gang =
      aiRiichiLocked || foldClaimByRiichi
        ? false
        : canMingangRiichi(hand, last);
    const claimDefensePlan = foldClaimByRiichi
      ? chooseAiClaimActionAgainstRiichi({
          aiSeat: p,
          hand,
          chiOptions: chiOpts,
          canPeng: peng,
          lastTile: last,
          riichiDeclared: game.riichiDeclared,
          discardPiles: game.discardPiles,
          doraIndicators: [game.doraIndicator],
          seatWind: getSeatWind(game.roundWind, p, game.dealer),
          roundWind: game.roundWind,
        })
      : null;
    const forcedChiOption =
      claimDefensePlan?.action === 'chi' ? claimDefensePlan.chiOption : null;
    const forcedPengDiscard =
      claimDefensePlan?.action === 'peng' ? claimDefensePlan.discardTile : null;
    const allowRandomClaim = !foldClaimByRiichi;
    const tid = setTimeout(() => {
      if (aiCanRon) {
        const yaku = ronCtx ? computeYaku(ronCtx) : [];
        const han = getTotalHan(yaku);
        const fu = calcFu({
          isTsumo: false,
          isMenzhen: game.melds[p].every((m) => m.type === 'angang'),
          hasPinfu: yaku.some((y) => y.id === 'pinfu'),
          isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
        });
        addLogRef.current(`${SEAT_NAMES[p]} 荣和 ${getTileLabel(last)}！`);
        sounds.playRon();
        const ten = calcScore(fu, han, game.dealer === p, false);
        const enriched = enrichWinResultWithUra({
          state: game,
          winner: p,
          isTsumo: false,
          handWithWin: handWithClaim,
          yaku,
          han,
          fu,
          ten,
        });
        setWinResult({
          winner: p,
          isTsumo: false,
          yaku: enriched.yaku,
          han: enriched.han,
          fu: enriched.fu,
          ten: enriched.ten,
          uraHan: enriched.uraHan,
          uraDoraIndicators: enriched.uraDoraIndicators,
        });
        return;
      }
      if (
        (forcedChiOption || chiOpts.length > 0) &&
        (forcedChiOption || (allowRandomClaim && Math.random() < 0.6))
      ) {
        const [a, b] = forcedChiOption ?? chiOpts[0];
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
          const plannedDiscard =
            claimDefensePlan?.action === 'chi'
              ? claimDefensePlan.discardTile
              : null;
          const discardIdx =
            plannedDiscard !== null ? hp.indexOf(plannedDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? hp[discardIdx] : hp[0];
          if (discardIdx >= 0) hp.splice(discardIdx, 1);
          else hp.shift();
          pilesChi[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'chi' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
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
      if (
        (forcedPengDiscard !== null || peng) &&
        (forcedPengDiscard !== null ||
          (allowRandomClaim && Math.random() < 0.4))
      ) {
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
          const discardIdx =
            forcedPengDiscard !== null ? h.indexOf(forcedPengDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? h[discardIdx] : h[0];
          if (discardIdx >= 0) h.splice(discardIdx, 1);
          else h.shift();
          pilesPeng[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'peng' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
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
          const handAfterKan = [...h];
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
          if (shouldAbortOnSuukaikan(melds)) {
            addLogRef.current('流局（四开杠）');
            sounds.playRyuukyoku();
            setGame({
              ...game,
              hands: game.hands.map((h0, i) => (i === p ? handAfterKan : h0)),
              melds,
              discardPiles: pilesGang,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              currentPlayer: p,
              drawnTile: null,
              lastClaimMsg: null,
              ryuukyoku: true,
              ryuukyokuReason: '四开杠',
            });
            return;
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesGang,
            wall: newWall,
            furitenStates: clearSeatDoujunStates(game.furitenStates, p),
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
      addLogRef.current(
        foldClaimByRiichi
          ? `${SEAT_NAMES[p]} 过（${claimDefensePlan?.reason || '他家立直，防守优先'}）`
          : `${SEAT_NAMES[p]} 过`,
      );
      setGame((g) => {
        if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        if (passResult.type === 'next') {
          return {
            ...g,
            claimIndex: passResult.nextClaimIndex,
            lastClaimMsg: null,
          };
        }
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (passResult.type === 'ryuukyoku') {
          addLogRef.current('流局（荒牌）');
          return {
            ...g,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: null,
            ryuukyoku: true,
            ryuukyokuReason: '荒牌',
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
          furitenStates: clearSeatDoujunStates(g.furitenStates, nextPlayer),
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: null,
        };
      });
    }, 400);
    return () => clearTimeout(tid);
  }, [
    game?.phase,
    game?.claimIndex,
    claimPlayer,
    canRon,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.discardPiles?.map,
    game?.hands?.map,
    game?.wall?.slice,
    game?.wall?.length,
    game?.wall?.[0],
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
            ← {t('common.backToCategory')}
          </Link>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-xl font-bold text-foreground">日本立直麻将</h1>
          <p className="mt-2 text-muted-foreground">
            天凤/雀魂标准，规则以 skill「mahjong-japanese-riichi」为准
          </p>

          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              核心规则摘要
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>4 人 · 136 张 + 红宝牌 3 枚（赤 5 万/筒/索）</li>
              <li>无役不能和了；振听只能自摸，不能荣和</li>
              <li>
                立直：门前清听牌宣告，放 1000
                点棒；立直后禁止换牌、禁止吃/碰/明杠/补杠，仅可暗杠与和了
              </li>
              <li>宝牌只加番不算役；里宝牌在立直和了时翻开</li>
              <li>
                符数最小 10 符，七对子固定 25 符；1–2 番按 符×2^(番+2)，3
                番满贯、5–6 番跳满、7–10 番倍满、≥13 役满
              </li>
            </ul>
          </section>

          <section className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              起和役（常用）
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              立直(1)、门前清自摸(1)、断幺九(1)、役牌(1)、平和(1)、一发(1)、七对子(2)、混一色(3)、清一色(6)
              等；满贯 12000/8000、跳满 18000/12000、役满 48000/32000（亲/子）
            </p>
          </section>

          <div className="mt-6">
            <Button
              onClick={startGame}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('common.startGame')}
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
            ← {t('common.returnRules')}
          </button>
          <span className="text-sm text-[#f1faee]">
            {game
              ? `${WIND_NAMES[game.roundWind]}${game.roundNumber}局 ${WIND_NAMES[game.roundWind]}${game.honba}场 · 庄 ${SEAT_NAMES[game.dealer]} (${WIND_NAMES[getSeatWind(game.roundWind, game.dealer, game.dealer)]})`
              : '东1局 东0场 · 庄 自家 (东)'}
          </span>
          <span className="text-xs text-[#ffd700]">
            立直棒池 {formatPoints(game.riichiPot)}
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
        <div className="mb-3 rounded-lg border border-[#d4b886]/30 bg-[#1a2e25]/70 px-3 py-2 text-xs text-[#f1faee]/90">
          {SEAT_NAMES.map((name, i) => (
            <span key={name}>
              {i > 0 && ' · '}
              {name}{' '}
              <span className="font-semibold text-[#ffd700]">
                {formatPoints(game.scores[i])}
              </span>
            </span>
          ))}
        </div>
        {game.lastSettlement && (
          <div className="mb-3 rounded-lg border border-[#457b9d]/40 bg-[#1d3557]/35 px-3 py-2">
            <p className="text-xs font-medium text-[#a8dadc]">上一局结算</p>
            {game.lastSettlement.tenpaiSeats && (
              <p className="mt-1 text-[11px] text-[#f1faee]/80">
                听牌：
                {game.lastSettlement.tenpaiSeats.length === 0
                  ? ' 无'
                  : ` ${game.lastSettlement.tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`}
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#f1faee]/80">
              分差：{' '}
              {game.lastSettlement.deltas
                .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
                .join(' · ')}
            </p>
            {game.lastSettlement.timeoutEvents &&
              game.lastSettlement.timeoutEvents.length > 0 && (
                <p className="mt-1 text-[11px] text-[#f1faee]/80">
                  超时：{game.lastSettlement.timeoutEvents.join('；')}
                </p>
              )}
          </div>
        )}
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
            {(canRon || (isMyClaim && hasNonRonClaimOption)) && (
              <div className="mb-2">
                <p className="text-xs text-[#a8dadc] bg-[#1d3557]/50 rounded-lg py-1 px-3 inline-block">
                  💡 可选操作：{canRon && '胡牌 '}{' '}
                  {chiOptions.length > 0 && `吃(${chiOptions.length}种) `}{' '}
                  {canPeng && '碰 '} {canMingang && '杠 '}{' '}
                  {isMyClaim ? '过' : canRon ? '放弃荣和' : ''}
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
            {myFuritenReason && (
              <div className="mb-2">
                <span className="inline-block text-xs text-rose-200 bg-rose-900/30 rounded-lg py-1 px-3">
                  ⚠️ {myFuritenReason}
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
              <p className="text-[11px] text-amber-200">
                {formatPoints(game.scores[2])}
              </p>
              <p className="text-[11px] text-[#a8dadc]">
                <span className={timerTextClass(2)}>
                  时库 {game.timeBanks[2]}s
                  {decisionSeat === 2 &&
                    decisionSeatRemainSeconds != null &&
                    ` · 本巡 ${decisionSeatRemainSeconds}s`}
                </span>
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
              <p className="text-[11px] text-amber-200">
                {formatPoints(game.scores[3])}
              </p>
              <p className="text-[11px] text-[#a8dadc]">
                <span className={timerTextClass(3)}>
                  时库 {game.timeBanks[3]}s
                  {decisionSeat === 3 &&
                    decisionSeatRemainSeconds != null &&
                    ` · 本巡 ${decisionSeatRemainSeconds}s`}
                </span>
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
              <p className="text-[11px] text-amber-200">
                {formatPoints(game.scores[1])}
              </p>
              <p className="text-[11px] text-[#a8dadc]">
                <span className={timerTextClass(1)}>
                  时库 {game.timeBanks[1]}s
                  {decisionSeat === 1 &&
                    decisionSeatRemainSeconds != null &&
                    ` · 本巡 ${decisionSeatRemainSeconds}s`}
                </span>
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
                    >
                      🏆 自摸胡牌
                    </Button>
                  </div>
                </div>
              )}
              {(canRon || (isMyClaim && hasNonRonClaimOption)) && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-[#f1faee]/90 bg-[#1d3557]/50 rounded-lg py-2 px-4 inline-block">
                      ⚠️{' '}
                      {canRon ? '你可以荣和，是否和牌？' : '请选择你要的操作：'}
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
                    {isMyClaim &&
                      chiOptions.map((opt, i) => (
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
                    {isMyClaim && canPeng && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3"
                        onClick={doPeng}
                      >
                        🔨 碰
                      </Button>
                    )}
                    {isMyClaim && canMingang && (
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3"
                        onClick={doMingang}
                      >
                        ⚡ 杠
                      </Button>
                    )}
                    {isMyClaim ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-3"
                        onClick={passClaim}
                      >
                        ❌ 过
                      </Button>
                    ) : (
                      canRon && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#d4b886] bg-[#3d5a4a] text-[#f1faee] hover:bg-[#4a6b58] hover:text-white px-4 py-3"
                          onClick={passRonOpportunity}
                        >
                          ❌ 放弃荣和
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
                  {/* 立直提示区域 */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {canKyuushuKyuuhai && (
                      <div className="flex items-center gap-2 bg-purple-900/30 rounded-lg px-3 py-2 border border-purple-400/40">
                        <span className="text-xs text-[#f1faee]/85">
                          九种九牌可宣言：
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-400 text-[#f1faee] hover:bg-purple-600/40"
                          onClick={doKyuushuKyuuhai}
                        >
                          🀄 九种九牌流局
                        </Button>
                      </div>
                    )}
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
                              {
                                seat: 0,
                                isTsumo: false,
                                treatAsRiichi: true,
                              },
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in">
            <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in">
              <h3 className="text-xl font-bold text-[#ffc107] text-center mb-3">
                {winResult.isTsumo ? '自摸！' : '荣和！'}
              </h3>
              {winResult.ten != null && (
                <p className="text-center text-[#ffc107] font-semibold mb-2">
                  {winResult.fu != null && winResult.han != null
                    ? `${winResult.fu} 符 ${winResult.han} 番 · `
                    : ''}
                  {winResult.ten} 点
                </p>
              )}
              <p className="text-sm text-[#f1faee]/90 mb-2">役种：</p>
              <ul className="list-disc list-inside text-sm text-[#f1faee] space-y-1 mb-4">
                {winResult.yaku.map((y, i) => (
                  <li key={i}>
                    {y.name} {y.han}番
                  </li>
                ))}
              </ul>
              {winResult.uraDoraIndicators &&
                winResult.uraDoraIndicators.length > 0 && (
                  <p className="mb-2 text-xs text-[#a8dadc]">
                    里宝牌表示：{' '}
                    {winResult.uraDoraIndicators
                      .map((t) => getTileLabel(t))
                      .join(' · ')}
                    {winResult.uraHan != null
                      ? `（里宝牌 ${winResult.uraHan} 番）`
                      : ''}
                  </p>
                )}
              {winSettlementPreview && (
                <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
                  {winnerPaymentSummary && (
                    <p>
                      本局收入： 和牌基础 +{winnerPaymentSummary.base}
                      {' / '}
                      本场棒 +{winnerPaymentSummary.honba}
                      {' / '}
                      立直棒 +{winnerPaymentSummary.riichi}
                    </p>
                  )}
                  <p>
                    分差：{' '}
                    {winSettlementPreview.deltas
                      .map(
                        (d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`,
                      )
                      .join(' · ')}
                  </p>
                  <p>
                    总分：{' '}
                    {winSettlementPreview.newScores
                      .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                      .join(' · ')}
                  </p>
                  {winSettlementPreview.payments.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] text-[#f1faee]/80">
                      {winSettlementPreview.payments.slice(0, 8).map((p, i) => (
                        <li key={i}>
                          {p.from >= 0 ? SEAT_NAMES[p.from] : '立直棒池'} →{' '}
                          {SEAT_NAMES[p.to]} {p.amount}点
                          {p.reason === 'honba'
                            ? '（本场棒）'
                            : p.reason === 'riichi'
                              ? '（立直棒）'
                              : p.reason === 'ron'
                                ? '（荣和）'
                                : p.reason === 'tsumo'
                                  ? '（自摸）'
                                  : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {game.timeoutEvents.length > 0 && (
                    <p className="text-[11px] text-[#f1faee]/80">
                      超时：{game.timeoutEvents.join('；')}
                    </p>
                  )}
                </div>
              )}
              <Button
                className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
                onClick={proceedToNextRound}
              >
                下一局
              </Button>
            </div>
          </div>
        )}

        {game.ryuukyoku && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-riichi-overlay-in">
            <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in">
              <h3 className="text-xl font-bold text-amber-200 text-center mb-3">
                流局（{getRyuukyokuReasonText(game.ryuukyokuReason)}）
              </h3>
              <p className="text-sm text-[#f1faee]/90 mb-2 text-center">
                {getRyuukyokuDescription(game.ryuukyokuReason)}
              </p>
              {drawSettlementPreview && (
                <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
                  {(game.ryuukyokuReason ?? '荒牌') === '荒牌' ? (
                    <p>
                      听牌：
                      {drawSettlementPreview.tenpaiSeats.length === 0
                        ? ' 无'
                        : ` ${drawSettlementPreview.tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`}
                    </p>
                  ) : (
                    <p>途中流局：不执行不听罚符，立直棒保留到下一局</p>
                  )}
                  <p>
                    分差：{' '}
                    {drawSettlementPreview.settlement.deltas
                      .map(
                        (d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`,
                      )
                      .join(' · ')}
                  </p>
                  <p>
                    总分：{' '}
                    {drawSettlementPreview.settlement.newScores
                      .map((s, i) => `${SEAT_NAMES[i]} ${s}`)
                      .join(' · ')}
                  </p>
                  {game.timeoutEvents.length > 0 && (
                    <p className="text-[11px] text-[#f1faee]/80">
                      超时：{game.timeoutEvents.join('；')}
                    </p>
                  )}
                </div>
              )}
              <Button
                className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
                onClick={proceedAfterRyuukyoku}
              >
                下一局
              </Button>
            </div>
          </div>
        )}

        {matchEnd && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 animate-riichi-overlay-in">
            <div className="rounded-2xl bg-[#2d4a3c] border-2 border-[#d4b886] p-6 max-w-sm w-full mx-4 shadow-xl animate-riichi-modal-in">
              <h3 className="text-xl font-bold text-amber-200 text-center mb-2">
                对局结束
              </h3>
              <p className="text-sm text-[#f1faee]/90 mb-3 text-center">
                {getMatchEndReasonText(matchEnd.reason)}
              </p>
              <div className="mb-4 rounded-lg border border-[#d4b886]/40 bg-[#1a2e25]/70 p-3 text-xs text-[#f1faee]/90 space-y-1">
                {matchEnd.ranking.map((seat, i) => (
                  <p key={seat}>
                    {i + 1}位：{SEAT_NAMES[seat]}{' '}
                    {formatPoints(matchEnd.finalScores[seat])}
                  </p>
                ))}
              </div>
              <Button
                className="w-full bg-[#d4b886] text-[#1a2e25] hover:bg-[#e5c997] font-semibold"
                onClick={startGame}
              >
                再来一局
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GameMahjongJapanese;
