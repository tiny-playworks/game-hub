import { type Camera, Vector2, Vector3 } from 'three';

export type CubeAxis = 'x' | 'y' | 'z';

export const HALF_PI = Math.PI / 2;

const AXIS_VECTORS: Record<CubeAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

export function snapAngle(angle: number): number {
  return Math.round(angle / HALF_PI) * HALF_PI;
}

export function snapCoordinate(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function getResponsiveCameraZoom(aspect: number): number {
  return Math.min(1, Math.max(0.55, aspect / 0.78));
}

export function axisVector(axis: CubeAxis): Vector3 {
  return AXIS_VECTORS[axis].clone();
}

export function belongsToLayer(
  worldPosition: Vector3,
  axis: CubeAxis,
  layerCoordinate: number,
  epsilon: number,
): boolean {
  return Math.abs(worldPosition[axis] - layerCoordinate) <= epsilon;
}

export function getGestureCandidateAxes(normal: Vector3): CubeAxis[] {
  const absolute = {
    x: Math.abs(normal.x),
    y: Math.abs(normal.y),
    z: Math.abs(normal.z),
  };
  const faceAxis = (Object.entries(absolute) as [CubeAxis, number][]).reduce(
    (largest, current) => (current[1] > largest[1] ? current : largest),
  )[0];

  return (['x', 'y', 'z'] as CubeAxis[]).filter((axis) => axis !== faceAxis);
}

interface ProjectionViewport {
  width: number;
  height: number;
}

function projectDirectionToScreen(
  direction: Vector3,
  origin: Vector3,
  camera: Camera,
  viewport: ProjectionViewport,
): Vector2 {
  const start = origin.clone().project(camera);
  const end = origin.clone().add(direction).project(camera);
  const projected = new Vector2(
    (end.x - start.x) * viewport.width * 0.5,
    -(end.y - start.y) * viewport.height * 0.5,
  );

  return projected.lengthSq() > 0 ? projected.normalize() : projected;
}

interface ChooseGestureAxisOptions {
  camera: Camera;
  drag: Vector2;
  normal: Vector3;
  origin: Vector3;
  viewport: ProjectionViewport;
}

export interface GestureAxisMatch {
  axis: CubeAxis;
  screenDirection: Vector2;
}

export function chooseGestureAxis({
  camera,
  drag,
  normal,
  origin,
  viewport,
}: ChooseGestureAxisOptions): GestureAxisMatch {
  const dragDirection = drag.clone().normalize();
  const candidates = getGestureCandidateAxes(normal);
  let bestAxis = candidates[0];
  let bestDirection = new Vector2();
  let bestScore = -1;

  for (const axis of candidates) {
    // 正向绕 axis 旋转时，表面点沿 axis × normal 的切线移动。
    // 投影这条切线后再和鼠标向量做点积，能同时解决轴选择与正反面符号问题。
    const tangent = axisVector(axis).cross(normal).normalize();
    const screenDirection = projectDirectionToScreen(
      tangent,
      origin,
      camera,
      viewport,
    );
    const score = Math.abs(screenDirection.dot(dragDirection));

    if (score > bestScore) {
      bestAxis = axis;
      bestDirection = screenDirection;
      bestScore = score;
    }
  }

  return { axis: bestAxis, screenDirection: bestDirection };
}
