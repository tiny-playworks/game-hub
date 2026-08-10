/**
 * 升级入门：单副牌 54 张，4 人两对（0-2 一队、1-3 一队），单张跟牌，庄家扣底，闲家 40 分升级
 */

/** 0–51 四花色 3~2，52=小王，53=大王 */
export type Card = number;

export const CARD_JOKER_SMALL = 52;
export const CARD_JOKER_BIG = 53;

/** 花色 0=黑桃 1=红桃 2=梅花 3=方片，王为 -1 */
export function getSuit(c: Card): number {
  if (c >= 52) return -1;
  return Math.floor(c / 13);
}

/** 点数 0=3, 1=4, ..., 11=A, 12=2, 小王=13, 大王=14 */
export function getRank(c: Card): number {
  if (c === CARD_JOKER_SMALL) return 13;
  if (c === CARD_JOKER_BIG) return 14;
  return c % 13;
}

/** 牌面名 */
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
  const suits = ['♠', '♥', '♣', '♦'];
  return `${suits[Math.floor(c / 13)] ?? ''}${labels[r] ?? ''}`;
}

/** 分牌分数：5=5分，10=10分，K=10分（getRank 下 5→2, 10→7, K→10） */
export function cardPoints(c: Card): number {
  const r = getRank(c);
  if (r === 2) return 5;
  if (r === 7) return 10;
  if (r === 10) return 10;
  return 0;
}

// 5 的 rank 是 2 (0-indexed: 3=0,4=1,5=2). 10 的 rank 是 7. K 的 rank 是 10.
function pointsForRank(rank: number): number {
  if (rank === 2) return 5; // 5
  if (rank === 7) return 10; // 10
  if (rank === 10) return 10; // K
  return 0;
}

/** 是否主牌：王、级牌、主花色 */
export function isTrump(
  c: Card,
  trumpSuit: number,
  levelRank: number,
): boolean {
  if (c >= 52) return true;
  if (getRank(c) === levelRank) return true;
  return getSuit(c) === trumpSuit;
}

/** 主牌比较用序：大者赢 */
export function trumpOrder(c: Card, levelRank: number): number {
  const r = getRank(c);
  if (c === CARD_JOKER_BIG) return 16;
  if (c === CARD_JOKER_SMALL) return 15;
  if (r === levelRank) return 14;
  return r;
}

/** 领出为副牌时，跟出同花色的比较用序（级牌最大） */
function followOrder(c: Card, levelRank: number): number {
  const r = getRank(c);
  if (r === levelRank) return 14;
  return r;
}

/** 一墩中谁赢：返回赢家在当前墩中的下标 0..3 */
export function trickWinner(
  trick: Card[],
  leaderIndex: number,
  trumpSuit: number,
  levelRank: number,
): number {
  const lead = trick[0];
  const leadTrump = isTrump(lead, trumpSuit, levelRank);
  const leadSuit = leadTrump ? -1 : getSuit(lead);

  let bestIndex = 0;
  let bestTrumped = leadTrump;
  let bestOrder = leadTrump
    ? trumpOrder(lead, levelRank)
    : followOrder(lead, levelRank);

  for (let i = 1; i < 4; i++) {
    const c = trick[i];
    const cTrump = isTrump(c, trumpSuit, levelRank);
    const cSuit = getSuit(c);

    if (leadTrump) {
      if (!cTrump) continue;
      const o = trumpOrder(c, levelRank);
      if (o > bestOrder) {
        bestOrder = o;
        bestIndex = i;
      }
      continue;
    }

    if (cTrump) {
      if (!bestTrumped) {
        bestTrumped = true;
        bestOrder = trumpOrder(c, levelRank);
        bestIndex = i;
      } else {
        const o = trumpOrder(c, levelRank);
        if (o > bestOrder) {
          bestOrder = o;
          bestIndex = i;
        }
      }
      continue;
    }

    if (cSuit !== leadSuit) continue;
    const o = followOrder(c, levelRank);
    if (o > bestOrder) {
      bestOrder = o;
      bestIndex = i;
    }
  }

  return (leaderIndex + bestIndex) % 4;
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

/** 发牌：4 人各 13 张，底牌 2 张 */
export function deal(): [Card[][], Card[]] {
  const deck = shuffle(FULL_DECK);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < 52; i++) {
    hands[i % 4].push(deck[i]);
  }
  const bottom = deck.slice(52, 54);
  return [hands, bottom];
}

/** 队友：0-2 一队，1-3 一队 */
export function partner(player: number): number {
  return (player + 2) % 4;
}

export function teamIndex(player: number): 0 | 1 {
  return player === 0 || player === 2 ? 0 : 1;
}

/** 刚打完的一墩，供界面回放；否则第四张牌一出现墩就被清空，玩家根本看不到 */
export interface FinishedTrick {
  cards: Card[];
  /** 领出者 0..3 */
  leader: number;
  /** 赢墩者 0..3 */
  winner: number;
  /** 这一墩的分数 */
  points: number;
}

export interface ShengjiState {
  hands: Card[][];
  /** 庄家 0..3 */
  dealer: number;
  /** 主花色 0..3，-1 表示未定（第一墩前由庄家选或翻牌） */
  trumpSuit: number;
  /** 级牌点数 0..12，打2 则 12 */
  levelRank: number;
  /** 当前出牌人 */
  currentPlayer: number;
  /** 当前墩已出的牌（按出牌顺序） */
  currentTrick: Card[];
  /** 当前墩领出者 */
  trickLeader: number;
  /** 两队得分 [庄家队, 闲家队] */
  teamScores: [number, number];
  /** 已打完的墩数 0..13 */
  tricksPlayed: number;
  /** 本局结束 */
  roundOver: boolean;
  /** 闲家是否升级（roundOver 时有效） */
  defenderUpgrade: boolean;
  /** 上一墩的完整结果，界面用它做「亮牌 → 收墩」的展示 */
  lastTrick: FinishedTrick | null;
  /** 庄家扣的底牌 */
  bottomCards: Card[];
  /** 闲家抠底拿到的分（末墩由闲家赢下时按两倍计入），未结算为 0 */
  bottomBonus: number;
}

/** 从底牌第一张定主花色；若无主牌则随机 */
function decideTrumpSuit(bottom: Card[], levelRank: number): number {
  const c = bottom[0];
  if (c < 52 && getRank(c) !== levelRank) return getSuit(c);
  if (c < 52) return getSuit(c);
  return Math.floor(Math.random() * 4);
}

/** 创建一局：随机庄家，庄家拿底牌并扣底 2 张，定主 */
export function createInitialState(): ShengjiState {
  const [hands, bottom] = deal();
  const dealer = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
  const levelRank = 12;
  const trumpSuit = decideTrumpSuit(bottom, levelRank);

  // 庄家扣底：真人不会把分牌埋进底牌，优先扣掉无分的副牌小牌
  const dealerHand = [...hands[dealer], ...bottom];
  const buryOrder = [...dealerHand].sort((a, b) => {
    const pa = cardPoints(a);
    const pb = cardPoints(b);
    if (pa !== pb) return pa - pb;
    const ta = isTrump(a, trumpSuit, levelRank) ? 1 : 0;
    const tb = isTrump(b, trumpSuit, levelRank) ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return getRank(a) - getRank(b);
  });
  const buried = buryOrder.slice(0, 2);
  const afterDiscard = dealerHand.filter((c) => !buried.includes(c));

  const newHands = hands.map((h, i) => (i === dealer ? afterDiscard : h));

  return {
    hands: newHands,
    dealer,
    trumpSuit,
    levelRank,
    currentPlayer: dealer,
    currentTrick: [],
    trickLeader: dealer,
    teamScores: [0, 0],
    tricksPlayed: 0,
    roundOver: false,
    defenderUpgrade: false,
    lastTrick: null,
    bottomCards: buried,
    bottomBonus: 0,
  };
}

/** 当前墩领出花色（主牌视为 -1） */
function leadSuit(state: ShengjiState): number {
  if (state.currentTrick.length === 0) return -1;
  const c = state.currentTrick[0];
  if (isTrump(c, state.trumpSuit, state.levelRank)) return -1;
  return getSuit(c);
}

/** 是否有某花色（含主牌时“有主”可毙） */
function hasSuit(hand: Card[], suit: number, state: ShengjiState): boolean {
  if (suit === -1)
    return hand.some((c) => isTrump(c, state.trumpSuit, state.levelRank));
  return hand.some((c) => c < 52 && getSuit(c) === suit);
}

/** 可选出的牌：领出任意；跟牌需跟同花色，没有可出任意 */
export function getValidPlays(state: ShengjiState, player: number): Card[] {
  const hand = state.hands[player];
  if (hand.length === 0) return [];

  if (state.currentTrick.length === 0) return hand;

  const suit = leadSuit(state);
  if (suit === -1) return hand;

  const hasLead = hasSuit(hand, suit, state);
  if (hasLead) return hand.filter((c) => c < 52 && getSuit(c) === suit);
  return hand;
}

/** 出牌是否合法 */
export function canPlayCard(
  state: ShengjiState,
  player: number,
  card: Card,
): boolean {
  const valid = getValidPlays(state, player);
  return valid.includes(card);
}

/** 执行出一张牌，返回新状态；不校验合法性 */
export function playCard(
  state: ShengjiState,
  player: number,
  card: Card,
): ShengjiState {
  const newHands = state.hands.map((h, i) =>
    i === player ? h.filter((c) => c !== card) : h,
  );
  const trick = [...state.currentTrick, card];

  if (trick.length < 4) {
    return {
      ...state,
      hands: newHands,
      currentTrick: trick,
      currentPlayer: (player + 1) % 4,
    };
  }

  const winner = trickWinner(
    trick,
    state.trickLeader,
    state.trumpSuit,
    state.levelRank,
  );
  const pointsInTrick = trick.reduce(
    (s, c) => s + pointsForRank(getRank(c)),
    0,
  );
  const winnerTeam = teamIndex(winner);
  const dealerTeam = teamIndex(state.dealer);
  const newScores: [number, number] = [
    winnerTeam === dealerTeam
      ? state.teamScores[0] + pointsInTrick
      : state.teamScores[0],
    winnerTeam !== dealerTeam
      ? state.teamScores[1] + pointsInTrick
      : state.teamScores[1],
  ];

  const tricksPlayed = state.tricksPlayed + 1;
  const roundOver = tricksPlayed >= 13;

  // 抠底：末墩由闲家赢下，底牌分数按两倍计入闲家
  let bottomBonus = state.bottomBonus;
  if (roundOver && winnerTeam !== dealerTeam) {
    bottomBonus =
      state.bottomCards.reduce((sum, c) => sum + cardPoints(c), 0) * 2;
    newScores[1] += bottomBonus;
  }

  return {
    ...state,
    hands: newHands,
    currentTrick: [],
    trickLeader: winner,
    currentPlayer: winner,
    teamScores: newScores,
    tricksPlayed,
    roundOver,
    defenderUpgrade: roundOver ? newScores[1] >= 40 : false,
    bottomBonus,
    lastTrick: {
      cards: trick,
      leader: state.trickLeader,
      winner,
      points: pointsInTrick,
    },
  };
}

/** 这一墩当前是谁最大（用于 AI 判断队友是否已经拿下） */
export function currentTrickLeaderSeat(state: ShengjiState): number | null {
  if (state.currentTrick.length === 0) return null;
  const padded = [...state.currentTrick];
  // trickWinner 需要 4 张，未满时用领出牌补齐，不影响谁最大的判断
  while (padded.length < 4) padded.push(state.currentTrick[0]);
  const seatOffset = trickWinner(
    padded,
    state.trickLeader,
    state.trumpSuit,
    state.levelRank,
  );
  const relative = (seatOffset - state.trickLeader + 4) % 4;
  if (relative >= state.currentTrick.length) return state.trickLeader;
  return seatOffset;
}

/** 闲家队得分（roundOver 时有意义） */
export function defenderScore(state: ShengjiState): number {
  return state.teamScores[1];
}

/** 是否轮到己方（0 为人类） */
export function isMyTurn(state: ShengjiState): boolean {
  return state.currentPlayer === 0 && !state.roundOver;
}

/** 这张牌在当前墩里的强弱，用于 AI 排序 */
function strengthOf(card: Card, state: ShengjiState): number {
  return isTrump(card, state.trumpSuit, state.levelRank)
    ? 100 + trumpOrder(card, state.levelRank)
    : followOrder(card, state.levelRank);
}

/** 换成这张牌后，出牌方是否能拿下当前这一墩 */
function wouldWinTrick(
  state: ShengjiState,
  player: number,
  card: Card,
): boolean {
  const after = {
    ...state,
    hands: state.hands.map((h, i) =>
      i === player ? h.filter((c) => c !== card) : h,
    ),
    currentTrick: [...state.currentTrick, card],
  };
  const seat = currentTrickLeaderSeat(after);
  return seat === player;
}

/**
 * 升级 AI：跟牌型游戏的基本盘——队友拿下就贴分，对手拿下就用最省的牌盖过去，
 * 盖不过就垫最小的闲张。比原来的「随机出一张」强得多，也不会拖慢界面。
 */
export function getAIPlay(state: ShengjiState): Card | null {
  const player = state.currentPlayer;
  if (player === 0 || state.roundOver) return null;
  const valid = getValidPlays(state, player);
  if (valid.length === 0) return null;

  const byStrength = [...valid].sort(
    (a, b) => strengthOf(a, state) - strengthOf(b, state),
  );

  // 领出：优先打副牌里的大牌探路，手上只剩主牌时才出主
  if (state.currentTrick.length === 0) {
    const sideCards = byStrength.filter(
      (c) => !isTrump(c, state.trumpSuit, state.levelRank),
    );
    const pool = sideCards.length > 0 ? sideCards : byStrength;
    return pool[pool.length - 1];
  }

  const leaderSeat = currentTrickLeaderSeat(state);
  const partnerWinning = leaderSeat !== null && leaderSeat === partner(player);
  const trickPoints = state.currentTrick.reduce(
    (sum, c) => sum + pointsForRank(getRank(c)),
    0,
  );

  if (partnerWinning) {
    // 队友已经拿下，把分牌贴进去
    const pointCards = byStrength.filter((c) => cardPoints(c) > 0);
    if (pointCards.length > 0) {
      return pointCards.reduce((best, c) =>
        cardPoints(c) > cardPoints(best) ? c : best,
      );
    }
    return byStrength[0];
  }

  // 对手领先：找能赢下来的最小一张
  const winners = byStrength.filter((c) => wouldWinTrick(state, player, c));
  if (winners.length > 0) {
    // 墩里没分且要动用主牌时，不值得为空墩消耗主牌
    const cheapest = winners[0];
    const spendsTrump = isTrump(cheapest, state.trumpSuit, state.levelRank);
    const leadIsTrump = isTrump(
      state.currentTrick[0],
      state.trumpSuit,
      state.levelRank,
    );
    if (trickPoints === 0 && spendsTrump && !leadIsTrump) {
      return byStrength[0];
    }
    return cheapest;
  }

  // 赢不了：垫掉最小的无分牌，保住分牌
  const noPoint = byStrength.filter((c) => cardPoints(c) === 0);
  return noPoint.length > 0 ? noPoint[0] : byStrength[0];
}

/** 执行一步 AI 并返回新状态 */
export function applyAITurn(state: ShengjiState): ShengjiState {
  const card = getAIPlay(state);
  if (card === null) return state;
  return playCard(state, state.currentPlayer, card);
}

/** 连续执行 AI 直到轮到己方或结束 */
export function runAIUntilMyTurn(state: ShengjiState): ShengjiState {
  let s = state;
  while (!s.roundOver && s.currentPlayer !== 0) {
    s = applyAITurn(s);
  }
  return s;
}
