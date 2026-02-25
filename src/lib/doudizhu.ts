/**
 * 斗地主简化版：54 张牌，3 人，抢地主、出牌（单/对/三/三带一/炸弹/火箭），先出完为胜
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

/** 牌面名，用于显示 */
export function cardLabel(c: Card): string {
  if (c === CARD_JOKER_SMALL) return '小王';
  if (c === CARD_JOKER_BIG) return '大王';
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
  | 'bomb'
  | 'rocket';

export interface Hand {
  type: HandType;
  /** 主牌点数（用于比较），火箭为 14 */
  rank: number;
  cards: Card[];
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardRank(a) - cardRank(b));
}

/** 解析选中的牌为何种牌型，非法返回 null */
export function parseHand(cards: Card[]): Hand | null {
  if (cards.length === 0) return null;
  const sorted = sortCards(cards);

  if (cards.length === 1) {
    return { type: 'single', rank: cardRank(sorted[0]), cards: sorted };
  }

  if (cards.length === 2) {
    const [a, b] = sorted;
    if (a === CARD_JOKER_SMALL && b === CARD_JOKER_BIG)
      return { type: 'rocket', rank: 14, cards: sorted };
    if (cardRank(a) === cardRank(b))
      return { type: 'pair', rank: cardRank(a), cards: sorted };
    return null;
  }

  if (cards.length === 3) {
    const r0 = cardRank(sorted[0]);
    if (cardRank(sorted[1]) === r0 && cardRank(sorted[2]) === r0)
      return { type: 'triple', rank: r0, cards: sorted };
    return null;
  }

  if (cards.length === 4) {
    const r0 = cardRank(sorted[0]);
    const r1 = cardRank(sorted[1]);
    const r2 = cardRank(sorted[2]);
    const r3 = cardRank(sorted[3]);
    if (r0 === r1 && r1 === r2 && r2 === r3)
      return { type: 'bomb', rank: r0, cards: sorted };
    if (r0 === r1 && r1 === r2)
      return { type: 'triple_single', rank: r0, cards: sorted };
    if (r1 === r2 && r2 === r3)
      return { type: 'triple_single', rank: r1, cards: sorted };
    return null;
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

const FULL_DECK: Card[] = Array.from({ length: 54 }, (_, i) => i as Card);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

export function createDeck(): Card[] {
  return shuffle(FULL_DECK);
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
export function createInitialState(): DoudizhuState {
  const deck = createDeck();
  const [h0, h1, h2, landCards] = deal(deck);
  const landlord = Math.floor(Math.random() * 3) as 0 | 1 | 2;
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

/** 简单 AI：有牌能压就出最小能压的，否则 pass */
export function getAIPlay(
  state: DoudizhuState,
): { type: 'play'; cards: Card[] } | { type: 'pass' } {
  const who = state.currentPlayer;
  if (who === 1 || state.gameOver) return { type: 'pass' };

  const hand = state.hands[who];
  const last = state.lastPlay;
  const passCount = state.passCount;

  if (!last || passCount >= 2) {
    const sorted = sortCards(hand);
    if (sorted.length >= 1) return { type: 'play', cards: [sorted[0]] };
    return { type: 'pass' };
  }

  const needBeat = last.hand;
  const rankCounts = new Map<number, number>();
  for (const c of hand) {
    const r = cardRank(c);
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const findBeat = (): Card[] | null => {
    if (needBeat.type === 'single' && hand.length >= 1) {
      for (const c of sortCards(hand)) {
        if (cardRank(c) > needBeat.rank) return [c];
      }
    }
    if (needBeat.type === 'pair') {
      for (let r = needBeat.rank + 1; r <= 14; r++) {
        const count = rankCounts.get(r) ?? 0;
        if (count >= 2) {
          const pair = hand.filter((c) => cardRank(c) === r).slice(0, 2);
          return pair;
        }
      }
    }
    if (needBeat.type === 'triple') {
      for (let r = needBeat.rank + 1; r <= 14; r++) {
        const count = rankCounts.get(r) ?? 0;
        if (count >= 3) {
          return hand.filter((c) => cardRank(c) === r).slice(0, 3);
        }
      }
    }
    if (needBeat.type === 'triple_single') {
      for (let r = needBeat.rank + 1; r <= 14; r++) {
        const triple = hand.filter((c) => cardRank(c) === r);
        if (triple.length >= 3) {
          const rest = removeCards(hand, triple.slice(0, 3));
          if (rest.length >= 1) {
            const single = sortCards(rest)[0];
            return [...triple.slice(0, 3), single];
          }
        }
      }
    }
    if (needBeat.type !== 'rocket') {
      for (let r = needBeat.rank + 1; r <= 14; r++) {
        if (rankCounts.get(r) === 4) {
          return hand.filter((c) => cardRank(c) === r);
        }
      }
      const hasRocket =
        hand.includes(CARD_JOKER_SMALL) && hand.includes(CARD_JOKER_BIG);
      if (hasRocket) return [CARD_JOKER_SMALL, CARD_JOKER_BIG];
    }
    return null;
  };

  const toPlay = findBeat();
  if (toPlay) return { type: 'play', cards: toPlay };
  return { type: 'pass' };
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
