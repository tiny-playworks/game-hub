export const PLASTIC_COLOR = '#07090d';

export const STICKER_COLORS = {
  back: '#1557c0',
  bottom: '#ffd500',
  front: '#00a651',
  left: '#ff6d00',
  right: '#dc2626',
  top: '#f8fafc',
} as const;

export interface CubieCoordinate {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
}

export function createCubieCoordinates(): CubieCoordinate[] {
  const coordinates: CubieCoordinate[] = [];
  const values = [-1, 0, 1] as const;

  for (const x of values) {
    for (const y of values) {
      for (const z of values) {
        coordinates.push({ x, y, z });
      }
    }
  }

  return coordinates;
}

// BoxGeometry 的六个材质槽依次为：右、左、上、下、前、后。
export function getCubieFaceColors({ x, y, z }: CubieCoordinate): string[] {
  return [
    x === 1 ? STICKER_COLORS.right : PLASTIC_COLOR,
    x === -1 ? STICKER_COLORS.left : PLASTIC_COLOR,
    y === 1 ? STICKER_COLORS.top : PLASTIC_COLOR,
    y === -1 ? STICKER_COLORS.bottom : PLASTIC_COLOR,
    z === 1 ? STICKER_COLORS.front : PLASTIC_COLOR,
    z === -1 ? STICKER_COLORS.back : PLASTIC_COLOR,
  ];
}
