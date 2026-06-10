import { expect, test } from '@rstest/core';
import { Vector3 } from 'three';
import { RUBIKS_LIGHTING } from '../src/pages/rubiks/lighting';

test('摄影棚补光让六个轴向表面的亮度保持在可辨识范围', () => {
  const normals = [
    new Vector3(1, 0, 0),
    new Vector3(-1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, -1),
  ];
  const keyDirection = new Vector3(...RUBIKS_LIGHTING.key.position).normalize();
  const fillDirection = new Vector3(
    ...RUBIKS_LIGHTING.fill.position,
  ).normalize();
  const levels = normals.map(
    (normal) =>
      RUBIKS_LIGHTING.ambient.intensity +
      Math.max(0, normal.dot(keyDirection)) * RUBIKS_LIGHTING.key.intensity +
      Math.max(0, normal.dot(fillDirection)) * RUBIKS_LIGHTING.fill.intensity,
  );

  expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
  expect(Math.max(...levels) / Math.min(...levels)).toBeLessThan(3.5);
});
