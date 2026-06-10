import { expect, test } from '@rstest/core';
import {
  createCubieCoordinates,
  getCubieFaceColors,
  PLASTIC_COLOR,
  STICKER_COLORS,
} from '../src/pages/rubiks/cubeModel';

test('坐标生成器创建 27 个互不重复的小方块位置', () => {
  const coordinates = createCubieCoordinates();
  const keys = coordinates.map(({ x, y, z }) => `${x},${y},${z}`);

  expect(coordinates).toHaveLength(27);
  expect(new Set(keys).size).toBe(27);
});

test('标准三阶魔方共有 54 张外露贴纸，内部面保持黑色塑料', () => {
  const stickerColors = new Set(Object.values(STICKER_COLORS));
  let stickerCount = 0;

  for (const coordinate of createCubieCoordinates()) {
    const colors = getCubieFaceColors(coordinate);
    stickerCount += colors.filter((color) => stickerColors.has(color)).length;

    if (coordinate.x === 0) {
      expect(colors[0]).toBe(PLASTIC_COLOR);
      expect(colors[1]).toBe(PLASTIC_COLOR);
    }
    if (coordinate.y === 0) {
      expect(colors[2]).toBe(PLASTIC_COLOR);
      expect(colors[3]).toBe(PLASTIC_COLOR);
    }
    if (coordinate.z === 0) {
      expect(colors[4]).toBe(PLASTIC_COLOR);
      expect(colors[5]).toBe(PLASTIC_COLOR);
    }
  }

  expect(stickerCount).toBe(54);
});
