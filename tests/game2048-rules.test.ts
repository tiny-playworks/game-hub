import { expect, test } from '@rstest/core';
import {
  createInitialState,
  type Game2048State,
  isGameOver,
  moveBoard,
  spawnTile,
  type Tile,
} from '../src/lib/game2048';

function fixedRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function idSeq(prefix = 't'): () => string {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

function tilesAt(
  cells: Array<{ id: string; value: number; r: number; c: number }>,
): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  for (const cell of cells) {
    tiles[cell.id] = { ...cell };
  }
  return tiles;
}

function stateWith(tiles: Record<string, Tile>, score = 0): Game2048State {
  return { tiles, score, combo: 0, gameOver: false };
}

test('spawnTile 落在空格且按 rng 决定 2/4', () => {
  const tiles = tilesAt([{ id: 'a', value: 2, r: 0, c: 0 }]);
  // first rng for empty pick (index 0 of remaining), second for value
  const tile = spawnTile(tiles, fixedRng([0, 0.95]), idSeq());
  if (!tile) throw new Error('expected spawn');
  expect(tile.value).toBe(4);
  expect(tile.isNew).toBe(true);
  expect(`${tile.r},${tile.c}`).not.toBe('0,0');
});

test('isGameOver：有空格不算结束', () => {
  expect(isGameOver(tilesAt([{ id: 'a', value: 2, r: 0, c: 0 }]))).toBe(false);
});

test('isGameOver：满盘且无可合并为结束', () => {
  const tiles = tilesAt([
    { id: 'a', value: 2, r: 0, c: 0 },
    { id: 'b', value: 4, r: 0, c: 1 },
    { id: 'c', value: 2, r: 0, c: 2 },
    { id: 'd', value: 4, r: 0, c: 3 },
    { id: 'e', value: 4, r: 1, c: 0 },
    { id: 'f', value: 2, r: 1, c: 1 },
    { id: 'g', value: 4, r: 1, c: 2 },
    { id: 'h', value: 2, r: 1, c: 3 },
    { id: 'i', value: 2, r: 2, c: 0 },
    { id: 'j', value: 4, r: 2, c: 1 },
    { id: 'k', value: 2, r: 2, c: 2 },
    { id: 'l', value: 4, r: 2, c: 3 },
    { id: 'm', value: 4, r: 3, c: 0 },
    { id: 'n', value: 2, r: 3, c: 1 },
    { id: 'o', value: 4, r: 3, c: 2 },
    { id: 'p', value: 2, r: 3, c: 3 },
  ]);
  expect(isGameOver(tiles)).toBe(true);
});

test('isGameOver：满盘但可横向合并不算结束', () => {
  const tiles = tilesAt([
    { id: 'a', value: 2, r: 0, c: 0 },
    { id: 'b', value: 2, r: 0, c: 1 },
    { id: 'c', value: 4, r: 0, c: 2 },
    { id: 'd', value: 8, r: 0, c: 3 },
    { id: 'e', value: 4, r: 1, c: 0 },
    { id: 'f', value: 8, r: 1, c: 1 },
    { id: 'g', value: 16, r: 1, c: 2 },
    { id: 'h', value: 32, r: 1, c: 3 },
    { id: 'i', value: 8, r: 2, c: 0 },
    { id: 'j', value: 16, r: 2, c: 1 },
    { id: 'k', value: 32, r: 2, c: 2 },
    { id: 'l', value: 64, r: 2, c: 3 },
    { id: 'm', value: 16, r: 3, c: 0 },
    { id: 'n', value: 32, r: 3, c: 1 },
    { id: 'o', value: 64, r: 3, c: 2 },
    { id: 'p', value: 128, r: 3, c: 3 },
  ]);
  expect(isGameOver(tiles)).toBe(false);
});

test('moveBoard 向左合并同值并计分，同回合不二次合并', () => {
  // [2, 2, 2, 0] left → [4, 2, 0, 0] not [8,0,0,0]
  const state = stateWith(
    tilesAt([
      { id: 'a', value: 2, r: 0, c: 0 },
      { id: 'b', value: 2, r: 0, c: 1 },
      { id: 'c', value: 2, r: 0, c: 2 },
    ]),
  );
  const result = moveBoard(state, 'left', () => 0, idSeq());
  expect(result.isMoved).toBe(true);
  if (!result.isMoved) return;
  expect(result.addedScore).toBe(4);
  const values = Object.values(result.state.tiles)
    .filter((t) => !t.mergedInto)
    .map((t) => t.value)
    .sort((a, b) => a - b);
  // one merged 4, one leftover 2, plus spawned tile
  expect(values.filter((v) => v === 4).length).toBeGreaterThanOrEqual(1);
  expect(values).toContain(2);
  expect(result.state.score).toBe(4);
});

test('moveBoard 无效移动不改状态', () => {
  const state = stateWith(tilesAt([{ id: 'a', value: 2, r: 0, c: 0 }]));
  const result = moveBoard(state, 'up', () => 0, idSeq());
  expect(result.isMoved).toBe(false);
  if (result.isMoved) return;
  expect(result.state).toBe(state);
});

test('moveBoard 不原地修改输入 tiles', () => {
  const tiles = tilesAt([
    { id: 'a', value: 2, r: 0, c: 0 },
    { id: 'b', value: 2, r: 0, c: 1 },
  ]);
  const snapshot = structuredClone(tiles);
  const state = stateWith(tiles);
  moveBoard(state, 'left', () => 0, idSeq());
  expect(tiles).toEqual(snapshot);
});

test('createInitialState 生成两枚新砖', () => {
  const state = createInitialState(fixedRng([0, 0.1, 0, 0.1]), idSeq());
  const active = Object.values(state.tiles).filter((t) => !t.mergedInto);
  expect(active).toHaveLength(2);
  expect(state.score).toBe(0);
  expect(state.gameOver).toBe(false);
});
