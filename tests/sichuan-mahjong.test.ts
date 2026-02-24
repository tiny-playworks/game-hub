import { expect, test } from '@rstest/core';
import {
  calculateFanSichuan,
  createSichuanDeck,
  dealSichuan,
  isValidQueMenHand,
} from '../src/lib/mahjongSichuan';

test('creates proper Sichuan deck', () => {
  const deck = createSichuanDeck();
  expect(deck).toHaveLength(136);
});

test('deals Sichuan cards correctly', () => {
  const deck = createSichuanDeck();
  const [hands] = dealSichuan(deck, 0);

  expect(hands[0]).toHaveLength(14);
  expect(hands[1]).toHaveLength(13);
  expect(hands[2]).toHaveLength(13);
  expect(hands[3]).toHaveLength(13);
});

test('validates que men requirement', () => {
  const hand = [0, 1, 2, 9, 10, 11]; // 万子和条子
  expect(isValidQueMenHand(hand, 'tong')).toBe(true); // 缺筒子，符合要求
  expect(isValidQueMenHand(hand, 'wan')).toBe(false); // 不缺万子，不符合
});

test('calculates fan correctly', () => {
  const hand = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
  const melds = [{ type: 'peng' as const, tiles: [0, 0, 0] }];

  const result1 = calculateFanSichuan(hand, melds, false, null); // 点炮
  const result2 = calculateFanSichuan(hand, melds, true, null); // 自摸

  expect(result1.fan).toBe(2); // 基础1番 + 带根1番
  expect(result2.fan).toBe(3); // 基础1番 + 自摸1番 + 带根1番

  // 验证番型数组
  expect(result1.fanTypes).toContain('基础番');
  expect(result1.fanTypes).toContain('带根');
  expect(result2.fanTypes).toContain('自摸');
});
