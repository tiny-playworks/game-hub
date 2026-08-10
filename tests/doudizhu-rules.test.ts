import { expect, test } from '@rstest/core';
import {
  CARD_JOKER_BIG,
  CARD_JOKER_SMALL,
  type Card,
  cardSuit,
  findPlayableHands,
  handBeats,
  handTypeLabel,
  parseHand,
  sortHandForDisplay,
} from '../src/lib/doudizhu';

/** 造牌：rank 为点数下标（0=3 … 11=A, 12=2），suit 为花色 */
function c(rank: number, suit = 0): Card {
  return suit * 13 + rank;
}

/** 造同点数的 n 张牌 */
function group(rank: number, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => c(rank, i));
}

function parsed(cards: Card[]) {
  const h = parseHand(cards);
  if (!h) throw new Error('应为合法牌型');
  return h;
}

test('单张/对子/三张识别', () => {
  expect(parsed([c(0)]).type).toBe('single');
  expect(parsed(group(0, 2)).type).toBe('pair');
  expect(parsed(group(0, 3)).type).toBe('triple');
});

test('四张同点解析为炸弹而非四带二', () => {
  const h = parsed(group(5, 4));
  expect(h.type).toBe('bomb');
  expect(h.rank).toBe(5);
});

test('双王为火箭', () => {
  const h = parsed([CARD_JOKER_SMALL, CARD_JOKER_BIG]);
  expect(h.type).toBe('rocket');
  expect(h.rank).toBe(14);
});

test('三带一与三带二识别', () => {
  expect(parsed([...group(4, 3), c(12)]).type).toBe('triple_single');
  const h = parsed([...group(4, 3), ...group(0, 2)]);
  expect(h.type).toBe('triple_pair');
  expect(h.rank).toBe(4);
});

test('AAABB 解析为三带二而不是顺子', () => {
  const h = parsed([...group(11, 3), ...group(0, 2)]);
  expect(h.type).toBe('triple_pair');
  expect(h.rank).toBe(11);
});

test('顺子识别，rank 取最大点数', () => {
  const h = parsed([c(0), c(1), c(2), c(3), c(4)]);
  expect(h.type).toBe('straight');
  expect(h.rank).toBe(4);
  expect(h.cards.length).toBe(5);
});

test('顺子含 2 非法', () => {
  // 10 J Q K 2
  expect(parseHand([c(7), c(8), c(9), c(10), c(12)])).toBeNull();
  // J Q K A 2 —— 点数连续但包含 2
  expect(parseHand([c(8), c(9), c(10), c(11), c(12)])).toBeNull();
});

test('顺子含王非法', () => {
  expect(parseHand([c(8), c(9), c(10), c(11), CARD_JOKER_SMALL])).toBeNull();
});

test('四张的顺子非法', () => {
  expect(parseHand([c(0), c(1), c(2), c(3)])).toBeNull();
});

test('连对识别与最小 3 连限制', () => {
  const h = parsed([...group(0, 2), ...group(1, 2), ...group(2, 2)]);
  expect(h.type).toBe('straight_pair');
  expect(h.rank).toBe(2);
  // 两连对非法
  expect(parseHand([...group(0, 2), ...group(1, 2)])).toBeNull();
  // 连对含 2 非法（A2）
  expect(
    parseHand([...group(10, 2), ...group(11, 2), ...group(12, 2)]),
  ).toBeNull();
});

test('飞机（纯三顺）识别', () => {
  const h = parsed([...group(0, 3), ...group(1, 3)]);
  expect(h.type).toBe('plane');
  expect(h.rank).toBe(1);
});

test('飞机含 2 非法', () => {
  expect(parseHand([...group(11, 3), ...group(12, 3)])).toBeNull();
});

test('飞机不连续非法', () => {
  expect(parseHand([...group(0, 3), ...group(2, 3)])).toBeNull();
});

test('飞机带单：带牌可以是 2 与王', () => {
  const h = parsed([...group(0, 3), ...group(1, 3), c(12), CARD_JOKER_BIG]);
  expect(h.type).toBe('plane_single');
  expect(h.rank).toBe(1);
  expect(h.cards.length).toBe(8);
});

test('飞机带单：双王可当两张单牌', () => {
  const h = parsed([
    ...group(0, 3),
    ...group(1, 3),
    CARD_JOKER_SMALL,
    CARD_JOKER_BIG,
  ]);
  expect(h.type).toBe('plane_single');
});

test('飞机带对识别', () => {
  const h = parsed([
    ...group(0, 3),
    ...group(1, 3),
    ...group(3, 2),
    ...group(5, 2),
  ]);
  expect(h.type).toBe('plane_pair');
  expect(h.rank).toBe(1);
  expect(h.cards.length).toBe(10);
});

test('四带二单与四带二对识别', () => {
  const single = parsed([...group(0, 4), c(5), c(7)]);
  expect(single.type).toBe('quad_two_single');
  expect(single.rank).toBe(0);

  const pair = parsed([...group(0, 4), ...group(5, 2), ...group(7, 2)]);
  expect(pair.type).toBe('quad_two_pair');
  expect(pair.rank).toBe(0);
});

test('两个炸弹拼在一起非法', () => {
  expect(parseHand([...group(0, 4), ...group(1, 4)])).toBeNull();
});

test('同长度顺子比点数，不同长度顺子互不相压', () => {
  const low = parsed([c(0), c(1), c(2), c(3), c(4)]);
  const high = parsed([c(1, 1), c(2, 1), c(3, 1), c(4, 1), c(5, 1)]);
  expect(handBeats(high, low)).toBe(true);
  expect(handBeats(low, high)).toBe(false);

  const long = parsed([c(1, 2), c(2, 2), c(3, 2), c(4, 2), c(5, 2), c(6, 2)]);
  expect(handBeats(long, low)).toBe(false);
  expect(handBeats(low, long)).toBe(false);
});

test('炸弹压顺子，火箭压炸弹，大炸弹压小炸弹', () => {
  const straight = parsed([c(0), c(1), c(2), c(3), c(4)]);
  const smallBomb = parsed(group(2, 4));
  const bigBomb = parsed(group(9, 4));
  const rocket = parsed([CARD_JOKER_SMALL, CARD_JOKER_BIG]);

  expect(handBeats(smallBomb, straight)).toBe(true);
  expect(handBeats(straight, smallBomb)).toBe(false);
  expect(handBeats(bigBomb, smallBomb)).toBe(true);
  expect(handBeats(smallBomb, bigBomb)).toBe(false);
  expect(handBeats(rocket, bigBomb)).toBe(true);
  expect(handBeats(bigBomb, rocket)).toBe(false);
});

test('连对与飞机需同长度才能比较', () => {
  const threePairs = parsed([...group(0, 2), ...group(1, 2), ...group(2, 2)]);
  const fourPairs = parsed([
    ...group(1, 2),
    ...group(2, 2),
    ...group(3, 2),
    ...group(4, 2),
  ]);
  expect(handBeats(fourPairs, threePairs)).toBe(false);

  const higherThree = parsed([...group(3, 2), ...group(4, 2), ...group(5, 2)]);
  expect(handBeats(higherThree, threePairs)).toBe(true);
});

test('findPlayableHands 能找出压过小顺子的顺子', () => {
  const toBeat = parsed([c(0), c(1), c(2), c(3), c(4)]);
  const hand = [c(1, 1), c(2, 1), c(3, 1), c(4, 1), c(5, 1)];
  const plays = findPlayableHands(hand, toBeat);
  expect(plays.length).toBe(1);
  expect(parsed(plays[0]).type).toBe('straight');
  expect(parsed(plays[0]).rank).toBe(5);
});

test('findPlayableHands 无法压过火箭时返回空', () => {
  const rocket = parsed([CARD_JOKER_SMALL, CARD_JOKER_BIG]);
  const hand = [...group(0, 4), ...group(9, 4)];
  expect(findPlayableHands(hand, rocket)).toEqual([]);
});

test('findPlayableHands 领出时包含各类牌型', () => {
  const hand = [c(0), c(1), c(2), c(3), c(4), ...group(9, 2)];
  const types = new Set(
    findPlayableHands(hand, null).map((cards) => parsed(cards).type),
  );
  expect(types.has('single')).toBe(true);
  expect(types.has('pair')).toBe(true);
  expect(types.has('straight')).toBe(true);
});

test('cardSuit 与 handTypeLabel', () => {
  expect(cardSuit(c(0, 0))).toBe(0);
  expect(cardSuit(c(5, 3))).toBe(3);
  expect(cardSuit(CARD_JOKER_BIG)).toBeNull();
  expect(handTypeLabel('straight')).toBe('顺子');
  expect(handTypeLabel('plane_pair')).toBe('飞机带对');
  expect(handTypeLabel('rocket', 'en')).toBe('Rocket');
});

test('sortHandForDisplay 按点数从大到小且同点相邻', () => {
  const hand = [c(0, 1), CARD_JOKER_BIG, c(9, 0), c(0, 0), c(12, 2)];
  const sorted = sortHandForDisplay(hand);
  expect(sorted[0]).toBe(CARD_JOKER_BIG);
  expect(sorted[1]).toBe(c(12, 2));
  expect(sorted[2]).toBe(c(9, 0));
  expect(sorted.slice(3)).toEqual([c(0, 0), c(0, 1)]);
});
