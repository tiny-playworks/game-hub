import { expect, test } from '@rstest/core';
import { cn } from '../src/lib/utils';

test('cn 合并多个 class 字符串', () => {
  expect(cn('a', 'b')).toBe('a b');
  expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
});

test('cn 忽略 false/undefined/null', () => {
  expect(cn('a', false, 'b', undefined, null)).toBe('a b');
});

test('cn 与 tailwind-merge：后者覆盖前者冲突类', () => {
  // 同一类目（如 padding）后者生效
  expect(cn('p-2', 'p-4')).toBe('p-4');
  expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
});

test('cn 保留无冲突的类', () => {
  expect(cn('p-2', 'm-4')).toBe('p-2 m-4');
});
