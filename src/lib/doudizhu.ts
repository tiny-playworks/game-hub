/**
 * 斗地主：54 张牌，3 人（1 地主 + 2 农民），先出完手牌的一方取胜。
 * 牌型覆盖：单张 / 对子 / 三张 / 三带一 / 三带二 / 顺子 / 连对 /
 * 飞机（纯三顺、带单、带对）/ 四带二（带单、带对）/ 炸弹 / 火箭。
 */

/** 0–51：四花色 3~2（0=3, 12=2），52=小王，53=大王 */
export type Card = number;

export const CARD_JOKER_SMALL = 52;
export const CARD_JOKER_BIG = 53;

/** 牌点数：3=0, 4=1, ..., K=10, A=11, 2=12, 小王=13, 大王=14 */
export function cardRank(c: Card): number {
  if (c === CARD_JOKER_SMALL) return 13;
  if (c === CARD_JOKER_BIG) return 14;
  return c % 13;
}

/** 花色：0=黑桃 1=红桃 2=梅花 3=方片；大小王没有花色，返回 null */
export function cardSuit(c: Card): 0 | 1 | 2 | 3 | null {
  if (c === CARD_JOKER_SMALL || c === CARD_JOKER_BIG) return null;
  return Math.floor(c / 13) as 0 | 1 | 2 | 3;
}

/** 牌面名，用于显示 */
export function cardLabel(c: Card, locale?: 'zh' | 'en'): string {
  if (c === CARD_JOKER_SMALL) return locale === 'en' ? 'Black Joker' : '小王';
  if (c === CARD_JOKER_BIG) return locale === 'en' ? 'Red Joker' : '大王';
  const r = c % 13;
  const labels = [
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
    'A',
    '2',
  ];
  return labels[r] ?? '';
}

/** 牌型 */
export type HandType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple_single'
  | 'triple_pair'
  | 'straight'
  | 'straight_pair'
  | 'plane'
  | 'plane_single'
  | 'plane_pair'
  | 'quad_two_single'
  | 'quad_two_pair'
  | 'bomb'
  | 'rocket';

export interface Hand {
  type: HandType;
  /** 主牌点数（用于比较），火箭为 14 */
  rank: number;
  cards: Card[];
}

const HAND_TYPE_LABELS: Record<HandType, readonly [string, string]> = {
  single: ['单张', 'Single'],
  pair: ['对子', 'Pair'],
  triple: ['三张', 'Triple'],
  triple_single: ['三带一', 'Triple with Single'],
  triple_pair: ['三带二', 'Triple with Pair'],
  straight: ['顺子', 'Straight'],
  straight_pair: ['连对', 'Consecutive Pairs'],
  plane: ['飞机', 'Airplane'],
  plane_single: ['飞机带单', 'Airplane with Singles'],
  plane_pair: ['飞机带对', 'Airplane with Pairs'],
  quad_two_single: ['四带二', 'Quad with Two Singles'],
  quad_two_pair: ['四带二对', 'Quad with Two Pairs'],
  bomb: ['炸弹', 'Bomb'],
  rocket: ['火箭', 'Rocket'],
};

/** 牌型名，用于显示「上一手」的牌型 */
export function handTypeLabel(type: HandType, locale?: 'zh' | 'en'): string {
  const entry = HAND_TYPE_LABELS[type];
  return locale === 'en' ? entry[1] : entry[0];
}

/** 顺子/连对/飞机允许的最大点数：A(11)。2 与双王永远不能入顺 */
const MAX_SEQ_RANK = 11;

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardRank(a) - cardRank(b) || a - b);
}

/** 按点数分组：点数 -> 该点数的牌（牌值升序） */
function groupByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const c of [...cards].sort((a, b) => a - b)) {
    const r = cardRank(c);
    const list = map.get(r);
    if (list) list.push(c);
    else map.set(r, [c]);
  }
  return map;
}

/** 点数是否连续递增 1 */
function isConsecutive(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** 在候选点数中找出所有长度为 len 的连续段（升序返回） */
function consecutiveRuns(ranks: number[], len: number): number[][] {
  const set = new Set(ranks);
  const runs: number[][] = [];
  for (let start = 0; start + len - 1 <= MAX_SEQ_RANK; start++) {
    let ok = true;
    for (let r = start; r < start + len; r++) {
      if (!set.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) runs.push(Array.from({ length: len }, (_, i) => start + i));
  }
  return runs;
}

/** 解析选中的牌为何种牌型，非法返回 null */
export function parseHand(cards: Card[]): Hand | null {
  if (cards.length === 0) return null;
  const sorted = sortCards(cards);
  const n = sorted.length;
  const groups = groupByRank(sorted);
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const countOf = (r: number) => groups.get(r)?.length ?? 0;
  const top = ranks[ranks.length - 1];
  const make = (type: HandType, rank: number): Hand => ({
    type,
    rank,
    cards: sorted,
  });

  // 火箭：双王
  if (n === 2 && sorted[0] === CARD_JOKER_SMALL && sorted[1] === CARD_JOKER_BIG)
    return make('rocket', 14);

  // 单一点数：单张 / 对子 / 三张 / 炸弹
  if (ranks.length === 1) {
    if (n === 1) return make('single', top);
    if (n === 2) return make('pair', top);
    if (n === 3) return make('triple', top);
    if (n === 4) return make('bomb', top);
    return null;
  }

  // 三带一
  if (n === 4) {
    const t = ranks.find((r) => countOf(r) === 3);
    return t === undefined ? null : make('triple_single', t);
  }

  // 三带二（5 张：AAABB 永远按三带二解析，而非顺子）
  if (n === 5) {
    const t = ranks.find((r) => countOf(r) === 3);
    if (t !== undefined) {
      const other = ranks.find((r) => r !== t);
      if (other !== undefined && countOf(other) === 2)
        return make('triple_pair', t);
      return null;
    }
  }

  // 顺子：≥5 张单牌连续，且不含 2 与双王
  if (
    n >= 5 &&
    ranks.length === n &&
    top <= MAX_SEQ_RANK &&
    isConsecutive(ranks)
  )
    return make('straight', top);

  // 连对：≥3 组连续对子
  if (
    n >= 6 &&
    n % 2 === 0 &&
    ranks.length === n / 2 &&
    ranks.every((r) => countOf(r) === 2) &&
    top <= MAX_SEQ_RANK &&
    isConsecutive(ranks)
  )
    return make('straight_pair', top);

  // 飞机（纯三顺）：≥2 组连续三张
  if (
    n >= 6 &&
    n % 3 === 0 &&
    ranks.length === n / 3 &&
    ranks.every((r) => countOf(r) === 3) &&
    top <= MAX_SEQ_RANK &&
    isConsecutive(ranks)
  )
    return make('plane', top);

  const quadRank = ranks.find((r) => countOf(r) === 4);

  // 四带二单：4 + 2 张带牌（带牌不能与四张同点）
  if (n === 6 && quadRank !== undefined)
    return make('quad_two_single', quadRank);

  // 四带二对：4 + 两个对子
  if (n === 8 && quadRank !== undefined) {
    const kickers = ranks.filter((r) => r !== quadRank);
    if (kickers.length === 2 && kickers.every((r) => countOf(r) === 2))
      return make('quad_two_pair', quadRank);
  }

  // 三顺候选点数：本身有三张且不超过 A
  const tripleRanks = ranks.filter((r) => countOf(r) >= 3 && r <= MAX_SEQ_RANK);

  /** 校验「n 组连续三张 + 带牌」，带牌点数不得与三顺重合 */
  const parsePlaneWithKickers = (
    runLen: number,
    kickerKind: 'single' | 'pair',
  ): Hand | null => {
    // 连续段从高到低尝试，取最大的三顺
    const runs = consecutiveRuns(tripleRanks, runLen).reverse();
    for (const run of runs) {
      const inRun = new Set(run);
      // 三顺内的点数只能恰好 3 张，多出来的牌会成为同点带牌，不合法
      if (run.some((r) => countOf(r) !== 3)) continue;
      const kickerRanks = ranks.filter((r) => !inRun.has(r));
      if (kickerKind === 'single') {
        const total = kickerRanks.reduce((s, r) => s + countOf(r), 0);
        if (total === runLen) return make('plane_single', run[run.length - 1]);
      } else {
        if (
          kickerRanks.length === runLen &&
          kickerRanks.every((r) => countOf(r) === 2)
        )
          return make('plane_pair', run[run.length - 1]);
      }
    }
    return null;
  };

  // 飞机带单：n 组三张 + n 张单牌
  if (n % 4 === 0 && n / 4 >= 2) {
    const parsed = parsePlaneWithKickers(n / 4, 'single');
    if (parsed) return parsed;
  }

  // 飞机带对：n 组三张 + n 个对子
  if (n % 5 === 0 && n / 5 >= 2) {
    const parsed = parsePlaneWithKickers(n / 5, 'pair');
    if (parsed) return parsed;
  }

  return null;
}

/** 比较牌型大小：a 压过 b 返回 true */
export function handBeats(a: Hand, b: Hand): boolean {
  if (a.type === 'rocket') return true;
  if (b.type === 'rocket') return false;
  if (a.type === 'bomb' && b.type !== 'bomb') return true;
  if (a.type !== 'bomb' && b.type === 'bomb') return false;
  if (a.type !== b.type || a.cards.length !== b.cards.length) return false;
  return a.rank > b.rank;
}

/** 从手牌中是否包含这些 card（按索引或按牌值均可，这里按牌值：选中子集即可出） */
export function hasCards(hand: Card[], toPlay: Card[]): boolean {
  const count = (arr: Card[], c: Card) => arr.filter((x) => x === c).length;
  for (const c of toPlay) {
    if (count(toPlay, c) > count(hand, c)) return false;
  }
  return true;
}

/** 移除手牌中的牌，返回新手牌（不修改原数组） */
export function removeCards(hand: Card[], toRemove: Card[]): Card[] {
  const list = [...hand];
  for (const c of toRemove) {
    const i = list.indexOf(c);
    if (i !== -1) list.splice(i, 1);
  }
  return list;
}

/** 手牌展示排序：点数从大到小，同点数聚在一起 */
export function sortHandForDisplay(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => cardRank(b) - cardRank(a) || a - b);
}

const FULL_DECK: Card[] = Array.from({ length: 54 }, (_, i) => i as Card);

/** 随机数源，测试可注入以复现对局 */
export type Rng = () => number;

/** 只有传入真正的函数才使用，避免 useState(createInitialState) 之类误传参数 */
function resolveRng(rng?: Rng | unknown): Rng {
  return typeof rng === 'function' ? (rng as Rng) : Math.random;
}

function shuffle<T>(arr: T[], rng?: Rng | unknown): T[] {
  const rand = resolveRng(rng);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface DoudizhuState {
  /** 三人手牌，0=下家(左)，1=己方，2=上家(右) */
  hands: [Card[], Card[], Card[]];
  /** 地主 0/1/2 */
  landlord: number;
  /** 当前该出牌的玩家 0/1/2 */
  currentPlayer: number;
  /** 上一手牌（谁出的、牌型）；null 表示新一轮或尚未出牌 */
  lastPlay: { player: number; hand: Hand } | null;
  /** 连续 pass 次数，到 2 则清空 lastPlay 并由上一出牌者下家起出新牌 */
  passCount: number;
  gameOver: boolean;
  /** 0=地主胜，1=农民胜；仅 gameOver 时有效 */
  winner: 0 | 1 | null;
}

export function createDeck(rng?: Rng | unknown): Card[] {
  return shuffle(FULL_DECK, rng);
}

/** 发牌：17,17,17 + 3 张底牌；返回 [手0, 手1, 手2, 底牌] */
export function deal(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const a = deck.slice(0, 17);
  const b = deck.slice(17, 34);
  const c = deck.slice(34, 51);
  const land = deck.slice(51, 54);
  return [a, b, c, land];
}

/** 创建初始状态：随机地主，地主拿底牌。human 固定为 1（己方） */
export function createInitialState(rng?: Rng | unknown): DoudizhuState {
  const rand = resolveRng(rng);
  const deck = createDeck(rand);
  const [h0, h1, h2, landCards] = deal(deck);
  const landlord = Math.floor(rand() * 3) as 0 | 1 | 2;
  const hands: [Card[], Card[], Card[]] = [
    landlord === 0 ? [...h0, ...landCards] : h0,
    landlord === 1 ? [...h1, ...landCards] : h1,
    landlord === 2 ? [...h2, ...landCards] : h2,
  ];
  return {
    hands,
    landlord,
    currentPlayer: landlord,
    lastPlay: null,
    passCount: 0,
    gameOver: false,
    winner: null,
  };
}

/** 己方是否为地主 */
export function isLandlord(state: DoudizhuState): boolean {
  return state.landlord === 1;
}

/** 当前是否轮到己方 */
export function isMyTurn(state: DoudizhuState): boolean {
  return state.currentPlayer === 1 && !state.gameOver;
}

/** 能否出牌：无上家出牌或已两人 pass 则可出任意合法牌型；否则必须同类型且更大，或出炸弹/火箭 */
export function canPlay(state: DoudizhuState, selected: Card[]): boolean {
  if (state.gameOver || state.currentPlayer !== 1) return false;
  const myHand = state.hands[1];
  if (!hasCards(myHand, selected)) return false;
  const hand = parseHand(selected);
  if (!hand) return false;

  const last = state.lastPlay;
  if (!last || state.passCount >= 2) return true;
  if (handBeats(hand, last.hand)) return true;
  return false;
}

/** 能否 pass（有上家出牌且未连续两人 pass） */
export function canPass(state: DoudizhuState): boolean {
  if (state.gameOver || state.currentPlayer !== 1) return false;
  return state.lastPlay !== null && state.passCount < 2;
}

function nextPlayer(i: number): number {
  return (i + 1) % 3;
}

/** 任意玩家出牌，返回新状态；不校验合法性 */
function playHandBy(
  state: DoudizhuState,
  player: number,
  selected: Card[],
): DoudizhuState {
  const hand = parseHand(selected);
  if (!hand) return state;

  const currentHand = state.hands[player];
  const newHands: [Card[], Card[], Card[]] = [...state.hands];
  newHands[player] = removeCards(currentHand, selected);

  const next = nextPlayer(player);
  const gameOver = newHands[player].length === 0;
  const winner: 0 | 1 | null = gameOver
    ? state.landlord === player
      ? 0
      : 1
    : null;

  return {
    ...state,
    hands: newHands,
    currentPlayer: next,
    lastPlay: { player, hand },
    passCount: 0,
    gameOver,
    winner,
  };
}

/** 执行出牌（己方），返回新状态；不校验 canPlay，调用方保证合法 */
export function playHand(
  state: DoudizhuState,
  selected: Card[],
): DoudizhuState {
  return playHandBy(state, 1, selected);
}

/** 执行 pass（当前玩家），返回新状态 */
export function passTurn(state: DoudizhuState): DoudizhuState {
  if (state.gameOver) return state;
  if (state.lastPlay === null) return state;
  if (state.passCount >= 2) return state;

  const count = state.passCount + 1;
  const next = nextPlayer(state.currentPlayer);

  if (count >= 2) {
    return {
      ...state,
      currentPlayer: next,
      lastPlay: null,
      passCount: 0,
    };
  }

  return {
    ...state,
    currentPlayer: next,
    passCount: count,
  };
}

// ---------------------------------------------------------------------------
// 候选牌型生成
// ---------------------------------------------------------------------------

function cardsKey(cards: Card[]): string {
  return [...cards].sort((a, b) => a - b).join(',');
}

/**
 * 从剩余牌里挑 n 张散牌当带牌：优先不拆对子/三张/炸弹，其次点数小、避开王。
 * exclude 为主牌点数集合（带牌不能与主牌同点）。
 */
function pickSingleKickers(
  rest: Card[],
  n: number,
  exclude: Set<number>,
): Card[] | null {
  const groups = groupByRank(rest);
  const scored: { card: Card; cost: number }[] = [];
  for (const [r, cards] of groups) {
    if (exclude.has(r)) continue;
    const breakCost = cards.length === 1 ? 0 : cards.length === 2 ? 2 : 4;
    for (const c of cards) {
      scored.push({ card: c, cost: breakCost * 100 + r });
    }
  }
  if (scored.length < n) return null;
  scored.sort((a, b) => a.cost - b.cost || a.card - b.card);
  return scored.slice(0, n).map((s) => s.card);
}

/** 从剩余牌里挑 n 个对子当带牌：优先纯对子、点数小 */
function pickPairKickers(
  rest: Card[],
  n: number,
  exclude: Set<number>,
): Card[] | null {
  const groups = groupByRank(rest);
  const candidates: { rank: number; cards: Card[]; cost: number }[] = [];
  for (const [r, cards] of groups) {
    if (exclude.has(r) || cards.length < 2) continue;
    const breakCost = cards.length === 2 ? 0 : cards.length === 3 ? 2 : 4;
    candidates.push({
      rank: r,
      cards: cards.slice(0, 2),
      cost: breakCost * 100 + r,
    });
  }
  if (candidates.length < n) return null;
  candidates.sort((a, b) => a.cost - b.cost || a.rank - b.rank);
  return candidates.slice(0, n).flatMap((c) => c.cards);
}

/** 候选排序：普通牌型在前（张数少、点数小优先），炸弹、火箭压到最后 */
function candidateClass(h: Hand): number {
  if (h.type === 'rocket') return 2;
  if (h.type === 'bomb') return 1;
  return 0;
}

function compareCandidates(a: Hand, b: Hand): number {
  return (
    candidateClass(a) - candidateClass(b) ||
    a.cards.length - b.cards.length ||
    a.rank - b.rank ||
    a.cards[0] - b.cards[0]
  );
}

/**
 * 枚举手牌中所有「合理」的出法（按牌型生成，不做全组合爆搜）。
 * toBeat 为 null 时给出所有可领出的牌型，否则只保留能压过 toBeat 的。
 */
function enumerateHands(hand: Card[], toBeat: Hand | null): Hand[] {
  if (hand.length === 0) return [];
  if (toBeat && toBeat.type === 'rocket') return [];

  const groups = groupByRank(hand);
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const countOf = (r: number) => groups.get(r)?.length ?? 0;
  const cardsOf = (r: number, k: number) => (groups.get(r) ?? []).slice(0, k);
  const raw: Card[][] = [];

  // 单张 / 对子 / 三张 / 炸弹
  for (const r of ranks) {
    const cnt = countOf(r);
    raw.push(cardsOf(r, 1));
    if (cnt >= 2) raw.push(cardsOf(r, 2));
    if (cnt >= 3) raw.push(cardsOf(r, 3));
    if (cnt >= 4) raw.push(cardsOf(r, 4));
  }

  // 火箭
  if (hand.includes(CARD_JOKER_SMALL) && hand.includes(CARD_JOKER_BIG))
    raw.push([CARD_JOKER_SMALL, CARD_JOKER_BIG]);

  // 三带一 / 三带二
  for (const r of ranks) {
    if (countOf(r) < 3) continue;
    const main = cardsOf(r, 3);
    const rest = removeCards(hand, main);
    const exclude = new Set([r]);
    const one = pickSingleKickers(rest, 1, exclude);
    if (one) raw.push([...main, ...one]);
    const pair = pickPairKickers(rest, 1, exclude);
    if (pair) raw.push([...main, ...pair]);
  }

  // 四带二单 / 四带二对
  for (const r of ranks) {
    if (countOf(r) !== 4) continue;
    const main = cardsOf(r, 4);
    const rest = removeCards(hand, main);
    const exclude = new Set([r]);
    const singles = pickSingleKickers(rest, 2, exclude);
    if (singles) raw.push([...main, ...singles]);
    const pairs = pickPairKickers(rest, 2, exclude);
    if (pairs) raw.push([...main, ...pairs]);
  }

  // 顺子 / 连对
  for (const [size, minRuns] of [
    [1, 5],
    [2, 3],
  ] as const) {
    for (let len = minRuns; len <= MAX_SEQ_RANK + 1; len++) {
      for (const run of consecutiveRuns(
        ranks.filter((r) => countOf(r) >= size && r <= MAX_SEQ_RANK),
        len,
      )) {
        raw.push(run.flatMap((r) => cardsOf(r, size)));
      }
    }
  }

  // 飞机：纯三顺 + 带单 + 带对
  const tripleRanks = ranks.filter((r) => countOf(r) >= 3 && r <= MAX_SEQ_RANK);
  for (let len = 2; len <= MAX_SEQ_RANK + 1; len++) {
    for (const run of consecutiveRuns(tripleRanks, len)) {
      const main = run.flatMap((r) => cardsOf(r, 3));
      raw.push(main);
      const rest = removeCards(hand, main);
      const exclude = new Set(run);
      const singles = pickSingleKickers(rest, len, exclude);
      if (singles) raw.push([...main, ...singles]);
      const pairs = pickPairKickers(rest, len, exclude);
      if (pairs) raw.push([...main, ...pairs]);
    }
  }

  // 统一校验：只保留真正合法且能压过 toBeat 的组合
  const seen = new Set<string>();
  const out: Hand[] = [];
  for (const cards of raw) {
    if (cards.length === 0) continue;
    const key = cardsKey(cards);
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = parseHand(cards);
    if (!parsed) continue;
    if (toBeat && !handBeats(parsed, toBeat)) continue;
    out.push(parsed);
  }
  out.sort(compareCandidates);
  return out;
}

/** 列出手牌中能压过 toBeat 的所有出法（toBeat 为 null 时为所有可领出的出法） */
export function findPlayableHands(hand: Card[], toBeat: Hand | null): Card[][] {
  return enumerateHands(hand, toBeat).map((h) => h.cards);
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

/** 两个座位是否同阵营：都不是地主即为队友 */
function isTeammate(state: DoudizhuState, a: number, b: number): boolean {
  if (a === b) return true;
  return a !== state.landlord && b !== state.landlord;
}

const STRUCTURED_TYPES: ReadonlySet<HandType> = new Set<HandType>([
  'straight',
  'straight_pair',
  'plane',
  'plane_single',
  'plane_pair',
]);

/** 是否含 2 或王：领出时尽量留着 */
function hasHighCard(cards: Card[]): boolean {
  return cards.some((c) => cardRank(c) >= 12);
}

/** 这手牌是否拆掉了手上的炸弹 */
function breaksBomb(hand: Card[], cards: Card[]): boolean {
  const handGroups = groupByRank(hand);
  const useGroups = groupByRank(cards);
  for (const [r, used] of useGroups) {
    if ((handGroups.get(r)?.length ?? 0) === 4 && used.length < 4) return true;
  }
  return false;
}

/** 领出：能一手走完就走完，否则先甩最长的连牌，再甩小单张/小对子，炸弹与 2 留后手 */
function chooseLead(hand: Card[]): Card[] {
  const candidates = enumerateHands(hand, null);
  if (candidates.length === 0) return [hand[0]];

  const finish = candidates.find((h) => h.cards.length === hand.length);
  if (finish) return finish.cards;

  const plain = candidates.filter(
    (h) => h.type !== 'bomb' && h.type !== 'rocket',
  );
  const pool = plain.length > 0 ? plain : candidates;
  const lowOnly = pool.filter((h) => !hasHighCard(h.cards));
  const usable = lowOnly.length > 0 ? lowOnly : pool;

  const structured = usable.filter((h) => STRUCTURED_TYPES.has(h.type));
  if (structured.length > 0) {
    const best = [...structured].sort(
      (a, b) => b.cards.length - a.cards.length || a.rank - b.rank,
    )[0];
    return best.cards;
  }

  const best = [...usable].sort(
    (a, b) =>
      Number(breaksBomb(hand, a.cards)) - Number(breaksBomb(hand, b.cards)) ||
      a.rank - b.rank ||
      b.cards.length - a.cards.length,
  )[0];
  return best.cards;
}

/** 简单 AI：队友领出不压；能用普通牌型压就压最小的；炸弹只在关键时刻用 */
export function getAIPlay(
  state: DoudizhuState,
): { type: 'play'; cards: Card[] } | { type: 'pass' } {
  const who = state.currentPlayer;
  if (who === 1 || state.gameOver) return { type: 'pass' };

  const hand = state.hands[who];
  if (hand.length === 0) return { type: 'pass' };

  const last = state.lastPlay;
  // 新一轮：必须领出，不能 pass
  if (!last || state.passCount >= 2) {
    return { type: 'play', cards: chooseLead(hand) };
  }

  // 不压自己的队友
  if (isTeammate(state, who, last.player)) return { type: 'pass' };

  const candidates = enumerateHands(hand, last.hand);
  if (candidates.length === 0) return { type: 'pass' };

  const normal = candidates.filter(
    (h) => h.type !== 'bomb' && h.type !== 'rocket',
  );
  if (normal.length > 0) {
    const best = [...normal].sort(
      (a, b) =>
        Number(breaksBomb(hand, a.cards)) - Number(breaksBomb(hand, b.cards)) ||
        a.rank - b.rank ||
        a.cards.length - b.cards.length,
    )[0];
    return { type: 'play', cards: best.cards };
  }

  // 没有普通牌应对：仅在对手快走完或自己快走完时动炸弹
  const enemyMin = Math.min(
    ...[0, 1, 2]
      .filter((p) => p !== who && !isTeammate(state, who, p))
      .map((p) => state.hands[p].length),
  );
  const critical = enemyMin <= 3 || hand.length <= 5;
  if (!critical) return { type: 'pass' };

  return { type: 'play', cards: candidates[0].cards };
}

/** 应用 AI 一步并返回新状态 */
export function applyAITurn(state: DoudizhuState): DoudizhuState {
  if (state.gameOver || state.currentPlayer === 1) return state;

  const action = getAIPlay(state);
  if (action.type === 'pass') {
    return passTurn(state);
  }
  return playHandBy(state, state.currentPlayer, action.cards);
}

/** 连续执行 AI 直到轮到己方或对局结束，返回最终状态 */
export function runAIUntilMyTurn(state: DoudizhuState): DoudizhuState {
  let s = state;
  while (!s.gameOver && s.currentPlayer !== 1) {
    s = applyAITurn(s);
  }
  return s;
}

/** 提示：给己方找下一手能出的牌，alreadyTried 里已经提示过的组合会被跳过 */
export function findHint(
  state: DoudizhuState,
  alreadyTried?: Card[][],
): Card[] | null {
  if (state.gameOver || state.currentPlayer !== 1) return null;
  const toBeat =
    state.lastPlay && state.passCount < 2 ? state.lastPlay.hand : null;
  const candidates = findPlayableHands(state.hands[1], toBeat);
  const tried = new Set((alreadyTried ?? []).map(cardsKey));
  for (const cards of candidates) {
    if (!tried.has(cardsKey(cards))) return cards;
  }
  return null;
}
