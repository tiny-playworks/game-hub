import { expect, test } from '@rstest/core';
import { games, getGameByPath, getGamesByCategory } from '../src/data/games';

test('games 中每项均有 id、categoryId、name、path、difficulty、tags', () => {
  const categoryIds = new Set(['mini', 'board', 'mahjong', 'poker']);
  for (const g of games) {
    expect(g.id).toBeDefined();
    expect(g.name).toBeDefined();
    expect(g.path).toBeDefined();
    expect(g.path).toMatch(/^\/game\//);
    expect(categoryIds.has(g.categoryId)).toBe(true);
    expect([1, 2, 3, 4]).toContain(g.difficulty);
    expect(Array.isArray(g.tags)).toBe(true);
  }
});

test('games 的 id 不重复', () => {
  const ids = games.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('games 的 path 不重复', () => {
  const paths = games.map((g) => g.path);
  expect(new Set(paths).size).toBe(paths.length);
});

test('getGamesByCategory 按 categoryId 过滤', () => {
  const mini = getGamesByCategory('mini');
  expect(mini.length).toBeGreaterThan(0);
  expect(mini.every((g) => g.categoryId === 'mini')).toBe(true);

  const mahjong = getGamesByCategory('mahjong');
  expect(mahjong.length).toBe(1);
  expect(mahjong.every((g) => g.categoryId === 'mahjong')).toBe(true);
  expect(mahjong[0]?.id).toBe('mahjong-japanese');

  const empty = getGamesByCategory('nonexistent');
  expect(empty).toHaveLength(0);
});

test('getGameByPath 能根据 path 找到游戏', () => {
  const guess = getGameByPath('/game/guess-number');
  expect(guess).toBeDefined();
  expect(guess?.id).toBe('guess-number');
  expect(guess?.name).toBe('猜数字');

  const riichi = getGameByPath('/game/mahjong-japanese');
  expect(riichi).toBeDefined();
  expect(riichi?.categoryId).toBe('mahjong');
  expect(riichi?.id).toBe('mahjong-japanese');
});

test('getGameByPath 不存在的 path 返回 undefined', () => {
  expect(getGameByPath('/game/not-exist')).toBeUndefined();
  expect(getGameByPath('/')).toBeUndefined();
});
