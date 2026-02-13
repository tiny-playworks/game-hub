/** 34 种牌型：0-8 万 9-17 条 18-26 筒 27-33 字牌(东南西北中发白) */
export const TILE_LABELS: string[] = [
  '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万',
  '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条',
  '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  '东', '南', '西', '北', '中', '发', '白',
];

export const SEAT_NAMES = ['自家', '下家', '对家', '上家'];

const TILE_COUNT = 34;
const COPIES = 4;
const NUM_PLAYERS = 4;
const HAND_INIT = 13;

/** 幺九牌：1/9 万条筒 */
const YAO_JIU = [0, 8, 9, 17, 18, 26];
/** 字牌：东南西北中发白 */
const ZI_TILES = [27, 28, 29, 30, 31, 32, 33];
/** 十三幺所需 13 种牌：幺九 + 字牌 */
const THIRTEEN_ORPHANS_TYPES = [...YAO_JIU, ...ZI_TILES];

/** 明牌组：吃/碰/明杠/暗杠/加杠 */
export type MeldType = 'chi' | 'peng' | 'mingang' | 'angang' | 'jiagang';

export interface Meld {
  type: MeldType;
  tiles: number[];
  fromPlayer?: number;
}

/** 生成 136 张牌并洗牌 */
export function createShuffledDeck(): number[] {
  const deck: number[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    for (let c = 0; c < COPIES; c++) deck.push(t);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 发牌：逆时针每人 13 张，庄家再摸 1 张（庄家 14，其余 13）。返回 [手牌], 剩余牌墙 */
export function deal(deck: number[], dealer: number): [number[][], number[]] {
  const hands: number[][] = [[], [], [], []];
  const d = [...deck];
  for (let i = 0; i < HAND_INIT * NUM_PLAYERS; i++) {
    hands[i % NUM_PLAYERS].push(d.shift()!);
  }
  hands[dealer].push(d.shift()!);
  hands[dealer].sort((a, b) => a - b);
  for (let i = 0; i < NUM_PLAYERS; i++) {
    if (i !== dealer) hands[i].sort((a, b) => a - b);
  }
  return [hands, d];
}

function isNumberTile(t: number): boolean {
  return t < 27;
}

function sameSuit(a: number, b: number, c: number): boolean {
  if (!isNumberTile(a) || !isNumberTile(b) || !isNumberTile(c)) return false;
  const s = (x: number) => Math.floor(x / 9);
  return s(a) === s(b) && s(b) === s(c);
}

function isSequence(a: number, b: number, c: number): boolean {
  return sameSuit(a, b, c) && a + 1 === b && b + 1 === c;
}

/** 12 张牌能否组成 4 组 */
function canFormFourMelds(arr: number[]): boolean {
  if (arr.length === 0) return true;
  const sorted = [...arr].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      for (let k = j + 1; k < sorted.length; k++) {
        const [a, b, c] = [sorted[i], sorted[j], sorted[k]];
        const rest = sorted.filter((_, idx) => idx !== i && idx !== j && idx !== k);
        const isTriple = a === b && b === c;
        const isSeq = isSequence(a, b, c);
        if ((isTriple || isSeq) && canFormFourMelds(rest)) return true;
      }
    }
  }
  return false;
}

/** 手牌 + 明牌组展开为牌列表（用于胡牌判定） */
export function handAndMeldsToTiles(hand: number[], melds: Meld[]): number[] {
  const list = [...hand];
  for (const m of melds) {
    list.push(...m.tiles);
  }
  return list;
}

/** 七小对：14 张为 7 对（每种牌恰好 2 张） */
export function isSevenPairs(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = new Map<number, number>();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const vals = [...counts.values()];
  return vals.every((c) => c === 2) && vals.length === 7;
}

/** 龙七对：七小对变种，其中 1 组为 4 张相同（计为 2 对），共 6 对 + 1 个四张 */
export function isDragonSevenPairs(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = new Map<number, number>();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const vals = [...counts.values()];
  const fours = vals.filter((c) => c === 4).length;
  const twos = vals.filter((c) => c === 2).length;
  return fours === 1 && twos === 5;
}

/** 十三幺：13 种幺九+字牌各 1 张，加任意 1 张重复（共 14 张） */
export function isThirteenOrphans(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const count = new Map<number, number>();
  for (const t of tiles) count.set(t, (count.get(t) ?? 0) + 1);
  let hasPair = false;
  for (const type of THIRTEEN_ORPHANS_TYPES) {
    const c = count.get(type) ?? 0;
    if (c === 0) return false;
    if (c >= 2) hasPair = true;
  }
  return hasPair;
}

/** 是否胡牌：手牌+明牌共 14 张。先判特殊牌型，再判基础 1 对+4 组 */
export function checkWin(hand: number[], melds: Meld[], drawnTile?: number): boolean {
  const all = drawnTile !== undefined ? [...hand, drawnTile] : [...hand];
  const fromMelds = melds.flatMap((m) => m.tiles);
  const total = all.length + fromMelds.length;
  if (total !== 14) return false;
  const combined = [...all, ...fromMelds];
  if (isThirteenOrphans(combined)) return true;
  if (isDragonSevenPairs(combined)) return true;
  if (isSevenPairs(combined)) return true;
  const sorted = combined.sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    if (i + 1 < sorted.length && sorted[i] === sorted[i + 1]) {
      const rest = sorted.filter((_, idx) => idx !== i && idx !== i + 1);
      if (canFormFourMelds(rest)) return true;
    }
  }
  return false;
}

/** 吃：只能吃上家的牌。上家 = (myIndex + 3) % 4。返回可吃的组合 [ [牌1, 牌2], ... ]，与 lastTile 组成顺子 */
export function getChiOptions(hand: number[], lastTile: number, fromPlayer: number, myIndex: number): [number, number][] {
  const 上家 = (myIndex + 3) % 4;
  if (fromPlayer !== 上家) return [];
  if (!isNumberTile(lastTile)) return [];
  const options: [number, number][] = [];
  const need = [
    [lastTile - 2, lastTile - 1],
    [lastTile - 1, lastTile + 1],
    [lastTile + 1, lastTile + 2],
  ].filter(([a, b]) => a >= 0 && b < 27 && sameSuit(a, b, lastTile));
  for (const [a, b] of need) {
    const handCopy = [...hand];
    const ia = handCopy.indexOf(a);
    if (ia === -1) continue;
    handCopy.splice(ia, 1);
    const ib = handCopy.indexOf(b);
    if (ib === -1) continue;
    options.push([a, b]);
  }
  return options;
}

/** 碰：手牌有至少 2 张与 lastTile 相同 */
export function canPeng(hand: number[], lastTile: number): boolean {
  const n = hand.filter((t) => t === lastTile).length;
  return n >= 2;
}

/** 明杠：手牌有 3 张与 lastTile 相同 */
export function canMingang(hand: number[], lastTile: number): boolean {
  return hand.filter((t) => t === lastTile).length >= 3;
}

/** 暗杠：手牌有 4 张相同，返回可暗杠的牌型列表 */
export function getAngangOptions(hand: number[]): number[] {
  const types: number[] = [];
  const sorted = [...hand].sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - 4; i++) {
    if (sorted[i] === sorted[i + 1] && sorted[i] === sorted[i + 2] && sorted[i] === sorted[i + 3]) {
      if (!types.includes(sorted[i])) types.push(sorted[i]);
    }
  }
  return types;
}

/** 加杠：已有碰组，手牌有第 4 张，返回可加杠的 meld 下标 */
export function getJiagangOptions(hand: number[], melds: Meld[]): number[] {
  const indices: number[] = [];
  melds.forEach((m, i) => {
    if (m.type === 'peng' && m.tiles.length === 3) {
      const t = m.tiles[0];
      if (hand.includes(t)) indices.push(i);
    }
  });
  return indices;
}

const TILE_TYPES = 34;

/** 牌池统计：每种牌（0–33）已出现的张数（牌池+各家明牌），用于记牌与熟张/生张判定 */
export function getTileCountsSeen(discardPiles: number[][], melds: Meld[][]): number[] {
  const counts = new Array<number>(TILE_TYPES).fill(0);
  for (const pile of discardPiles) {
    for (const t of pile) counts[t]++;
  }
  for (const playerMelds of melds) {
    for (const m of playerMelds) {
      for (const t of m.tiles) counts[t]++;
    }
  }
  return counts;
}

/** 听牌检测：手牌 13 张 + 明牌时，返回能胡的牌型列表（等待张）；非听牌返回空数组 */
export function getWaitingTiles(hand: number[], melds: Meld[]): number[] {
  if (hand.length !== 13) return [];
  const waiting: number[] = [];
  for (let t = 0; t < TILE_TYPES; t++) {
    if (checkWin(hand, melds, t)) waiting.push(t);
  }
  return waiting;
}

/** 幺九牌型（1/9 万条筒） */
const YAO_JIU_TYPES = new Set([0, 8, 9, 17, 18, 26]);
/** 字牌类型 27–33 */
function isZiType(t: number): boolean {
  return t >= 27;
}

/** 快胡值估算：数值越大越难胡（步数越多）。易胡 ≤4，难胡 >6。用于起手路线与舍牌策略 */
export function estimateKuaiHuValue(hand: number[], melds: Meld[]): number {
  const meldCount = melds.length;
  const counts = new Map<number, number>();
  for (const t of hand) counts.set(t, (counts.get(t) ?? 0) + 1);
  let pairCount = 0;
  let daziCount = 0;
  for (const [, c] of counts) {
    if (c >= 2) pairCount++;
    if (c >= 2) daziCount += Math.floor(c / 2);
  }
  for (let i = 0; i < hand.length - 1; i++) {
    const a = hand[i];
    const b = hand[i + 1];
    if (a < 27 && b === a + 1 && Math.floor(a / 9) === Math.floor(b / 9)) daziCount++;
  }
  const need = 4 - meldCount;
  const hasPair = pairCount >= 1;
  const steps = need + (hasPair ? 0 : 1) - Math.min(2, daziCount) * 0.5;
  return Math.max(0, Math.min(10, Math.round(steps * 10) / 10));
}

/** 是否为幺九牌（1/9 万条筒） */
export function isYaoJiu(tile: number): boolean {
  return YAO_JIU_TYPES.has(tile);
}

/** 是否为字牌 */
export function isZiTile(tile: number): boolean {
  return isZiType(tile);
}

/** 游戏状态 */
export type Phase = 'draw' | 'discard' | 'claim';

/** 要牌轮次：胡/杠/碰 三家按顺序（下家→对家→上家），吃仅下家 */
export interface ClaimRound {
  phase: 'hu' | 'gang' | 'peng' | 'chi';
  index: number; // 0..2 对应 下家、对家、上家；吃阶段仅用 0
}

export interface LastDiscard {
  tile: number;
  fromPlayer: number;
}

export interface ClaimOption {
  chi?: [number, number][];
  peng?: boolean;
  gang?: boolean;
  hu?: boolean;
  angang?: number[];
  jiagang?: number[];
}

/** 番种名与番数（用于计分） */
export interface FanItem {
  name: string;
  fan: number;
}

/** 胡牌结果：番种列表与总番数 */
export interface WinResult {
  fans: FanItem[];
  totalFan: number;
}

/** 杠牌记录：用于局终杠牌计分 */
export interface GangRecord {
  type: 'mingang' | 'jiagang' | 'angang';
  player: number;
  /** 明杠/补杠时付分者（点杠者或原碰牌出牌者） */
  fromPlayer?: number;
}

/** 单笔结算：谁付给谁多少、原因 */
export interface SettlementPayment {
  from: number;
  to: number;
  amount: number;
  reason: 'hu' | 'gang';
}

/** 局终结算结果：用于展示 */
export interface SettlementResult {
  payments: SettlementPayment[];
  newScores: number[];
}

function suitOf(t: number): number {
  if (t >= 27) return 3; // 字牌
  return Math.floor(t / 9); // 0万 1条 2筒
}

/** 基础型是否全部为刻子（对对胡）：1 对将 + 4 组刻/杠（每组 3 或 4 张） */
function isAllTriplets(hand: number[], melds: Meld[], drawnTile?: number): boolean {
  const all = drawnTile !== undefined ? [...hand, drawnTile] : [...hand];
  const fromMelds = melds.flatMap((m) => m.tiles);
  const combined = [...all, ...fromMelds];
  if (combined.length !== 14) return false;
  const counts = new Map<number, number>();
  for (const t of combined) counts.set(t, (counts.get(t) ?? 0) + 1);
  let pairCount = 0;
  let groupCount = 0; // 刻子或杠算 1 组
  for (const c of counts.values()) {
    if (c === 2) pairCount++;
    else if (c === 3 || c === 4) groupCount++;
    else return false;
  }
  return pairCount === 1 && groupCount === 4;
}

/** 是否混一色：仅一种数牌花色 + 字牌 */
function isMixedOneSuit(tiles: number[]): boolean {
  const suits = new Set(tiles.map(suitOf));
  if (suits.size > 2) return false;
  if (suits.size === 1) return true; // 清一色也算混一色的子集，但计番时清一色优先
  const hasZi = suits.has(3);
  const numSuits = [...suits].filter((s) => s !== 3);
  return hasZi && numSuits.length === 1;
}

/** 是否清一色：仅一种数牌花色，无字牌 */
function isPureOneSuit(tiles: number[]): boolean {
  const suits = new Set(tiles.map(suitOf));
  return suits.size === 1 && !suits.has(3);
}

/** 门清：无吃、碰、明杠、加杠（可有暗杠） */
function isMenqing(melds: Meld[]): boolean {
  return melds.every((m) => m.type === 'angang');
}

/** 计算胡牌番种。drawnTile 为自摸牌或点炮牌；options 传入自摸/杠上开花/海底捞月等 */
export function getWinFans(
  hand: number[],
  melds: Meld[],
  drawnTile: number | undefined,
  options: { isZiMo?: boolean; isGangShang?: boolean; isHaidilao?: boolean },
): WinResult | null {
  const all = drawnTile !== undefined ? [...hand, drawnTile] : [...hand];
  const fromMelds = melds.flatMap((m) => m.tiles);
  const combined = [...all, ...fromMelds];
  if (combined.length !== 14) return null;
  if (!checkWin(hand, melds, drawnTile)) return null;
  const fans: FanItem[] = [];
  const tiles = combined;

  if (isThirteenOrphans(tiles)) {
    fans.push({ name: '十三幺', fan: 8 });
  } else if (isDragonSevenPairs(tiles)) {
    fans.push({ name: '龙七对', fan: 6 });
  } else if (isSevenPairs(tiles)) {
    fans.push({ name: '七小对', fan: 4 });
  } else {
    fans.push({ name: '屁胡', fan: 1 });
    if (isAllTriplets(hand, melds, drawnTile)) fans.push({ name: '对对胡', fan: 2 });
    if (isPureOneSuit(tiles)) fans.push({ name: '清一色', fan: 4 });
    else if (isMixedOneSuit(tiles)) fans.push({ name: '混一色', fan: 2 });
    if (isMenqing(melds)) fans.push({ name: '门清', fan: 1 });
  }
  if (options.isZiMo) fans.push({ name: '自摸', fan: 1 });
  if (options.isGangShang) fans.push({ name: '杠上开花', fan: 1 });
  if (options.isHaidilao) fans.push({ name: '海底捞月', fan: 1 });

  const totalFan = fans.reduce((s, f) => s + f.fan, 0);
  return { fans, totalFan };
}

export interface GameState {
  hands: number[][];
  melds: Meld[][];
  discardPiles: number[][];
  deck: number[];
  currentPlayer: number;
  phase: Phase;
  lastDiscard: LastDiscard | null;
  claimOption: ClaimOption | null;
  /** 当前等待要牌决策的玩家（展示按钮时 = 人类座位） */
  claimPlayer: number | null;
  /** 要牌轮次：从谁开始、到哪一阶段 */
  claimRound: ClaimRound | null;
  winner: number | null;
  humanSeat: number;
  dealer: number;
  /** 最近一次胡牌结果（番种与总番），用于展示 */
  lastWinResult: WinResult | null;
  /** 是否流局 */
  isDraw: boolean;
  /** 基础分（默认 1） */
  baseScore: number;
  /** 四家累计得分 */
  scores: number[];
  /** 本局杠牌记录，局终结算 */
  gangRecords: GangRecord[];
  /** 点炮时点炮者座位号，自摸为 null */
  lastHuFromPlayer: number | null;
  /** 局终结算明细（胡牌/流局后展示） */
  lastSettlement: SettlementResult | null;
  /** 自家刚摸到的牌（用于 UI 单独展示，出牌后清空） */
  lastDrawnTile: number | null;
}

/** 局终结算：胡牌计分（自摸 3 家付 / 点炮 1 家付）+ 杠牌计分，返回收支明细与新分数 */
export function computeSettlement(s: GameState): SettlementResult {
  const payments: SettlementPayment[] = [];
  const newScores = [...(s.scores ?? [0, 0, 0, 0])];
  const base = s.baseScore ?? 1;

  if (s.winner !== null && s.lastWinResult) {
    const total = s.lastWinResult.totalFan * base;
    if (s.lastHuFromPlayer === null) {
      for (let i = 0; i < 4; i++) {
        if (i !== s.winner) {
          payments.push({ from: i, to: s.winner, amount: total, reason: 'hu' });
          newScores[i] -= total;
          newScores[s.winner] += total;
        }
      }
    } else {
      payments.push({ from: s.lastHuFromPlayer, to: s.winner, amount: total, reason: 'hu' });
      newScores[s.lastHuFromPlayer] -= total;
      newScores[s.winner] += total;
    }
  }

  const records = s.gangRecords ?? [];
  for (const g of records) {
    if (g.type === 'angang') {
      for (let i = 0; i < 4; i++) {
        if (i !== g.player) {
          payments.push({ from: i, to: g.player, amount: base, reason: 'gang' });
          newScores[i] -= base;
          newScores[g.player] += base;
        }
      }
    } else if (g.fromPlayer !== undefined) {
      payments.push({ from: g.fromPlayer, to: g.player, amount: base, reason: 'gang' });
      newScores[g.fromPlayer] -= base;
      newScores[g.player] += base;
    }
  }

  return { payments, newScores };
}

export const INITIAL_HAND_SIZE = HAND_INIT;
