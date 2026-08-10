import { expect, test } from '@rstest/core';
import {
  CARD_JOKER_BIG,
  CARD_JOKER_SMALL,
  type Card,
  canPass,
  canPlay,
  createInitialState,
  type DoudizhuState,
  findHint,
  getAIPlay,
  parseHand,
  passTurn,
  playHand,
  runAIUntilMyTurn,
} from '../src/lib/doudizhu';

/** 造牌：rank 为点数下标（0=3 … 11=A, 12=2），suit 为花色 */
function c(rank: number, suit = 0): Card {
  return suit * 13 + rank;
}

function group(rank: number, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => c(rank, i));
}

/** 线性同余随机源，保证测试可复现 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeHand(cards: Card[]) {
  const h = parseHand(cards);
  if (!h) throw new Error('应为合法牌型');
  return h;
}

function makeState(partial: Partial<DoudizhuState>): DoudizhuState {
  return {
    hands: [[], [], []],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: null,
    passCount: 0,
    gameOver: false,
    winner: null,
    ...partial,
  };
}

/**
 * 自动打完一局：AI 自行行动，己方总是按提示出牌，没提示就要不起。
 * 返回最终状态与总回合数。
 */
function autoPlay(seed: number): { state: DoudizhuState; turns: number } {
  let state = createInitialState(seededRng(seed));
  let turns = 0;
  const limit = 600;
  while (!state.gameOver && turns < limit) {
    turns++;
    state = runAIUntilMyTurn(state);
    if (state.gameOver) break;
    const hint = findHint(state);
    if (hint) {
      expect(canPlay(state, hint)).toBe(true);
      state = playHand(state, hint);
    } else if (canPass(state)) {
      state = passTurn(state);
    } else {
      throw new Error('己方既不能出牌也不能要不起，出现死局');
    }
  }
  return { state, turns };
}

test('固定随机源时初始发牌可复现', () => {
  const a = createInitialState(seededRng(20260810));
  const b = createInitialState(seededRng(20260810));
  expect(a).toEqual(b);
  const other = createInitialState(seededRng(1));
  expect(other.hands[1]).not.toEqual(a.hands[1]);
});

test('createInitialState 无参数或误传参数仍可正常发牌', () => {
  const s = createInitialState();
  expect(s.hands[0].length + s.hands[1].length + s.hands[2].length).toBe(54);
  // useState(createInitialState) 可能传入非函数参数，应被忽略
  const weird = createInitialState({ nonsense: true });
  expect(weird.hands[weird.landlord].length).toBe(20);
});

test('每家手牌数正确且地主多 3 张', () => {
  const s = createInitialState(seededRng(7));
  expect(s.hands[s.landlord].length).toBe(20);
  const others = [0, 1, 2].filter((p) => p !== s.landlord);
  for (const p of others) expect(s.hands[p].length).toBe(17);
  expect(s.currentPlayer).toBe(s.landlord);
});

test('固定随机源时整局对局可复现', () => {
  const first = autoPlay(20260810);
  const second = autoPlay(20260810);
  expect(first.state).toEqual(second.state);
  expect(first.turns).toBe(second.turns);
});

test('多个随机种子下整局都能在有限回合内正常结束', () => {
  for (const seed of [1, 2, 3, 42, 999, 20260810, 123456789]) {
    const { state, turns } = autoPlay(seed);
    expect(state.gameOver).toBe(true);
    expect(state.winner === 0 || state.winner === 1).toBe(true);
    expect(turns).toBeLessThan(600);
    // 胜方阵营必有人手牌为空
    const emptied = [0, 1, 2].filter((p) => state.hands[p].length === 0);
    expect(emptied.length).toBe(1);
    const isLandlordWin = emptied[0] === state.landlord;
    expect(state.winner).toBe(isLandlordWin ? 0 : 1);
  }
});

test('AI 领出时一定出牌，不会 pass', () => {
  const state = makeState({
    hands: [[c(0), c(1), c(5)], [c(2)], [c(3)]],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: null,
  });
  const action = getAIPlay(state);
  expect(action.type).toBe('play');
});

test('AI 领出优先甩最长的连牌', () => {
  const state = makeState({
    hands: [
      [c(0), c(1), c(2), c(3), c(4), c(12), CARD_JOKER_BIG],
      [c(5), c(6)],
      [c(7), c(8)],
    ],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: null,
  });
  const action = getAIPlay(state);
  if (action.type !== 'play') throw new Error('应当出牌');
  expect(makeHand(action.cards).type).toBe('straight');
  expect(action.cards.length).toBe(5);
});

test('有普通牌能压时 AI 不动炸弹', () => {
  const state = makeState({
    hands: [
      [...group(0, 4), c(9)],
      [c(1), c(2), c(3), c(4), c(5)],
      [c(6), c(7), c(8), c(10), c(11)],
    ],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: { player: 2, hand: makeHand([c(5, 1)]) },
  });
  const action = getAIPlay(state);
  if (action.type !== 'play') throw new Error('应当出牌');
  expect(action.cards).toEqual([c(9)]);
  expect(makeHand(action.cards).type).toBe('single');
});

test('无普通牌应对且局势不紧张时 AI 不炸', () => {
  const state = makeState({
    hands: [
      [...group(0, 4), c(1), c(2), c(3)],
      [c(4), c(5), c(6), c(7), c(8)],
      [c(9), c(10), c(11), c(1, 1), c(2, 1)],
    ],
    landlord: 0,
    currentPlayer: 0,
    // 上家出单张 2，AI 手上没有更大的单张
    lastPlay: { player: 2, hand: makeHand([c(12, 1)]) },
  });
  expect(getAIPlay(state)).toEqual({ type: 'pass' });
});

test('对手快走完且没有普通牌应对时 AI 出炸弹', () => {
  const state = makeState({
    hands: [
      [...group(0, 4), c(1), c(2), c(3)],
      [c(4)],
      [c(9), c(10), c(11), c(1, 1), c(2, 1)],
    ],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: { player: 2, hand: makeHand([c(12, 1)]) },
  });
  const action = getAIPlay(state);
  if (action.type !== 'play') throw new Error('应当出炸弹');
  expect(makeHand(action.cards).type).toBe('bomb');
});

test('AI 不压自己的队友', () => {
  // 地主是己方(1)，AI 0 与 AI 2 互为队友
  const state = makeState({
    hands: [
      [c(9), c(10), c(11)],
      [c(4), c(5)],
      [c(6), c(7)],
    ],
    landlord: 1,
    currentPlayer: 0,
    lastPlay: { player: 2, hand: makeHand([c(6, 1)]) },
  });
  expect(getAIPlay(state)).toEqual({ type: 'pass' });
});

test('AI 能一手走完时直接走完', () => {
  const state = makeState({
    hands: [
      [...group(5, 3), c(9)],
      [c(1), c(2)],
      [c(3), c(4)],
    ],
    landlord: 0,
    currentPlayer: 0,
    lastPlay: null,
  });
  const action = getAIPlay(state);
  if (action.type !== 'play') throw new Error('应当出牌');
  expect(action.cards.length).toBe(4);
  expect(makeHand(action.cards).type).toBe('triple_single');
});

test('findHint 给出的提示满足 canPlay，并会跳过已提示过的组合', () => {
  const state = makeState({
    hands: [[c(9, 1)], [c(2), c(3), c(4)], [c(10, 1)]],
    landlord: 0,
    currentPlayer: 1,
    lastPlay: { player: 0, hand: makeHand([c(1, 1)]) },
  });
  const first = findHint(state);
  if (!first) throw new Error('应有提示');
  expect(canPlay(state, first)).toBe(true);
  expect(first).toEqual([c(2)]);

  const second = findHint(state, [first]);
  if (!second) throw new Error('应有第二个提示');
  expect(second).not.toEqual(first);
  expect(canPlay(state, second)).toBe(true);

  expect(findHint(state, [[c(2)], [c(3)], [c(4)]])).toBeNull();
});

test('findHint 在压不过上一手时返回 null', () => {
  const state = makeState({
    hands: [[c(9, 1)], [c(2), c(3), c(4)], [c(10, 1)]],
    landlord: 0,
    currentPlayer: 1,
    lastPlay: {
      player: 0,
      hand: makeHand([CARD_JOKER_SMALL, CARD_JOKER_BIG]),
    },
  });
  expect(findHint(state)).toBeNull();
  expect(canPass(state)).toBe(true);
});

test('findHint 在新一轮时给出领出建议', () => {
  const state = makeState({
    hands: [[c(9, 1)], [c(2), c(3), c(4)], [c(10, 1)]],
    landlord: 0,
    currentPlayer: 1,
    lastPlay: null,
  });
  const hint = findHint(state);
  if (!hint) throw new Error('应有提示');
  expect(canPlay(state, hint)).toBe(true);
});

test('findHint 不是己方回合时返回 null', () => {
  const state = makeState({
    hands: [[c(9)], [c(2)], [c(3)]],
    currentPlayer: 0,
  });
  expect(findHint(state)).toBeNull();
});
