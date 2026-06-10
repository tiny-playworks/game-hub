import { expect, test } from '@rstest/core';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import {
  belongsToLayer,
  chooseGestureAxis,
  getGestureCandidateAxes,
  getResponsiveCameraZoom,
  HALF_PI,
  snapAngle,
  snapCoordinate,
} from '../src/pages/rubiks/gestureMath';

function createCamera(position: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.copy(position);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

test('表面法线排除自身轴，只保留两个可旋转轴', () => {
  expect(getGestureCandidateAxes(new Vector3(0.02, -0.01, 0.99))).toEqual([
    'x',
    'y',
  ]);
  expect(getGestureCandidateAxes(new Vector3(0.01, 0.98, -0.03))).toEqual([
    'x',
    'z',
  ]);
});

test('从正面向右拖动选择 Y 轴且保持正向跟手', () => {
  const result = chooseGestureAxis({
    camera: createCamera(new Vector3(0, 0, 8)),
    drag: new Vector2(80, 0),
    normal: new Vector3(0, 0, 1),
    origin: new Vector3(0, 0, 1.5),
    viewport: { height: 800, width: 800 },
  });

  expect(result.axis).toBe('y');
  expect(result.screenDirection.dot(new Vector2(1, 0))).toBeGreaterThan(0.99);
});

test('从背面向右拖动仍选择 Y 轴且视觉方向不反转', () => {
  const result = chooseGestureAxis({
    camera: createCamera(new Vector3(0, 0, -8)),
    drag: new Vector2(80, 0),
    normal: new Vector3(0, 0, -1),
    origin: new Vector3(0, 0, -1.5),
    viewport: { height: 800, width: 800 },
  });

  expect(result.axis).toBe('y');
  expect(result.screenDirection.dot(new Vector2(1, 0))).toBeGreaterThan(0.99);
});

test('角度与位置吸附到最近的 90 度和空间格点', () => {
  expect(snapAngle(HALF_PI * 0.49)).toBe(0);
  expect(snapAngle(HALF_PI * 0.51)).toBeCloseTo(HALF_PI);
  expect(snapAngle(HALF_PI * -1.51)).toBeCloseTo(-HALF_PI * 2);

  expect(snapCoordinate(1.018, 1.04)).toBeCloseTo(1.04);
  expect(snapCoordinate(-1.031, 1.04)).toBeCloseTo(-1.04);
});

test('层筛选只依据当前世界坐标与 Epsilon', () => {
  const worldPosition = new Vector3(1.04, -0.03, -1.04);

  expect(belongsToLayer(worldPosition, 'x', 1.04, 0.08)).toBe(true);
  expect(belongsToLayer(worldPosition, 'y', 0, 0.08)).toBe(true);
  expect(belongsToLayer(worldPosition, 'z', 1.04, 0.08)).toBe(false);
});

test('竖屏降低相机缩放以完整容纳魔方，横屏保持原构图', () => {
  expect(getResponsiveCameraZoom(16 / 9)).toBe(1);
  expect(getResponsiveCameraZoom(390 / 844)).toBeCloseTo(0.59, 1);
});
