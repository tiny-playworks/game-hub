import { expect, test } from '@rstest/core';
import {
  getHighestUnlockedTitle,
  getNextLockedTitle,
  getUnlockedTitles,
  resolveActiveTitle,
} from '../src/lib/titles';

test('称号阈值解锁：200/600/1200', () => {
  expect(getUnlockedTitles(199).length).toBe(0);
  expect(getUnlockedTitles(200).map((title) => title.id)).toEqual(['que-shi']);
  expect(getUnlockedTitles(600).map((title) => title.id)).toEqual([
    'que-shi',
    'que-jie',
  ]);
  expect(getUnlockedTitles(1200).map((title) => title.id)).toEqual([
    'que-shi',
    'que-jie',
    'que-hao',
  ]);
});

test('自动称号选择：无效或空称号时补最高可用称号', () => {
  expect(resolveActiveTitle(null, 50)).toBeNull();
  expect(resolveActiveTitle(null, 200)).toBe('que-shi');
  expect(resolveActiveTitle('invalid', 700)).toBe('que-jie');
  expect(resolveActiveTitle('que-shi', 700)).toBe('que-shi');
});

test('下一称号与最高称号计算正确', () => {
  expect(getHighestUnlockedTitle(300)?.id).toBe('que-shi');
  expect(getHighestUnlockedTitle(900)?.id).toBe('que-jie');
  expect(getHighestUnlockedTitle(1400)?.id).toBe('que-hao');

  expect(getNextLockedTitle(50)?.id).toBe('que-shi');
  expect(getNextLockedTitle(250)?.id).toBe('que-jie');
  expect(getNextLockedTitle(800)?.id).toBe('que-hao');
  expect(getNextLockedTitle(1500)).toBeNull();
});
