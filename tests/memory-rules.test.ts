import { expect, test } from '@rstest/core';
import {
  allMatched,
  createInitialMemoryState,
  generateCards,
  MEMORY,
  MEMORY_EMOJIS,
  type MemoryState,
  memoryReducer,
} from '../src/lib/memory.ts';

function fixedRng() {
  let i = 0;
  return () => (i++ % 1000) / 1000;
}

function stateWithCards(
  cards: MemoryState['cards'],
  overrides: Partial<MemoryState> = {},
): MemoryState {
  return {
    cards,
    level: 1,
    score: 0,
    moves: 0,
    timeLeft: MEMORY.initialTime,
    status: 'playing',
    lastFlipped: null,
    lock: false,
    ...overrides,
  };
}

test('generateCards：16 张牌，8 种 emoji 各两张', () => {
  const cards = generateCards(1, fixedRng());
  expect(cards).toHaveLength(16);

  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.emoji, (counts.get(card.emoji) ?? 0) + 1);
  }
  expect(counts.size).toBe(8);
  for (const count of counts.values()) {
    expect(count).toBe(2);
  }

  const expected = new Set(MEMORY_EMOJIS.slice(0, 8));
  expect(new Set(counts.keys())).toEqual(expected);
});

test('FLIP 先翻再翻匹配：matched、score、时间奖励', () => {
  const cards = generateCards(1, fixedRng());
  const emoji = cards[0].emoji;
  const pairIndex = cards.findIndex((c, i) => i > 0 && c.emoji === emoji);
  expect(pairIndex).toBeGreaterThan(0);

  let state = stateWithCards(cards);
  let result = memoryReducer(state, { type: 'FLIP', index: 0 });
  expect(result.state.cards[0].flipped).toBe(true);
  expect(result.state.lastFlipped).toBe(0);
  expect(result.effects).toEqual([]);

  state = result.state;
  const timeBefore = state.timeLeft;
  result = memoryReducer(state, { type: 'FLIP', index: pairIndex });

  expect(result.state.moves).toBe(1);
  expect(result.state.score).toBe(1);
  expect(result.state.timeLeft).toBe(timeBefore + MEMORY.bonusMatch);
  expect(result.state.lastFlipped).toBeNull();
  expect(result.state.cards[0].matched).toBe(true);
  expect(result.state.cards[pairIndex].matched).toBe(true);
  expect(result.state.cards[0].flipped).toBe(true);
  expect(result.state.cards[pairIndex].flipped).toBe(true);
});

test('FLIP 不匹配：lock、error、mismatch_delay + shake', () => {
  const cards = generateCards(1, fixedRng());
  const first = 0;
  const second = cards.findIndex((c, i) => i > 0 && c.emoji !== cards[0].emoji);
  expect(second).toBeGreaterThan(0);

  let state = stateWithCards(cards);
  state = memoryReducer(state, { type: 'FLIP', index: first }).state;
  const result = memoryReducer(state, { type: 'FLIP', index: second });

  expect(result.state.lock).toBe(true);
  expect(result.state.lastFlipped).toBeNull();
  expect(result.state.moves).toBe(1);
  expect(result.state.cards[first].error).toBe(true);
  expect(result.state.cards[second].error).toBe(true);
  expect(result.state.cards[first].flipped).toBe(true);
  expect(result.state.cards[second].flipped).toBe(true);
  expect(result.effects).toEqual([
    { type: 'mismatch_delay', indices: [first, second], ms: 600 },
    { type: 'shake' },
  ]);
});

test('CLEAR_MISMATCH 解锁并翻回', () => {
  const cards = generateCards(1, fixedRng()).map((c, i) =>
    i === 0 || i === 1 ? { ...c, flipped: true, error: true } : c,
  );
  const state = stateWithCards(cards, { lock: true, moves: 1 });
  const result = memoryReducer(state, {
    type: 'CLEAR_MISMATCH',
    indices: [0, 1],
  });

  expect(result.state.lock).toBe(false);
  expect(result.state.cards[0].flipped).toBe(false);
  expect(result.state.cards[1].flipped).toBe(false);
  expect(result.state.cards[0].error).toBe(false);
  expect(result.state.cards[1].error).toBe(false);
  expect(result.effects).toEqual([]);
});

test('TICK 到 0：lost + game_over', () => {
  const state = stateWithCards(generateCards(1, fixedRng()), { timeLeft: 1 });
  const result = memoryReducer(state, { type: 'TICK' });

  expect(result.state.timeLeft).toBe(0);
  expect(result.state.status).toBe('lost');
  expect(result.effects).toEqual([{ type: 'game_over' }]);
});

test('ADVANCE_LEVEL 升关并重新发牌', () => {
  const state = stateWithCards(generateCards(1, fixedRng()), {
    level: 1,
    timeLeft: 5,
    lock: true,
    lastFlipped: 3,
    score: 8,
  });
  const rng = fixedRng();
  const result = memoryReducer(state, { type: 'ADVANCE_LEVEL', rng });

  expect(result.state.level).toBe(2);
  expect(result.state.timeLeft).toBe(5 + MEMORY.bonusLevel);
  expect(result.state.lock).toBe(false);
  expect(result.state.lastFlipped).toBeNull();
  expect(result.state.score).toBe(8);
  expect(result.state.cards).toHaveLength(16);
  expect(allMatched(result.state.cards)).toBe(false);
  expect(result.state.cards.every((c) => !c.flipped && !c.matched)).toBe(true);

  const level2Emojis = new Set(MEMORY_EMOJIS.slice(8, 16));
  expect(new Set(result.state.cards.map((c) => c.emoji))).toEqual(level2Emojis);
});

test('lock 时非法 FLIP 被忽略', () => {
  const cards = generateCards(1, fixedRng());
  const state = stateWithCards(cards, { lock: true });
  const result = memoryReducer(state, { type: 'FLIP', index: 0 });

  expect(result.state).toEqual(state);
  expect(result.effects).toEqual([]);
});

test('createInitialMemoryState 初始值正确', () => {
  const state = createInitialMemoryState(fixedRng());
  expect(state.level).toBe(1);
  expect(state.score).toBe(0);
  expect(state.moves).toBe(0);
  expect(state.timeLeft).toBe(MEMORY.initialTime);
  expect(state.status).toBe('playing');
  expect(state.lastFlipped).toBeNull();
  expect(state.lock).toBe(false);
  expect(state.cards).toHaveLength(16);
});
