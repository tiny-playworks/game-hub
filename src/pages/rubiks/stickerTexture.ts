import {
  CanvasTexture,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  type WebGLRenderer,
} from 'three';
import { PLASTIC_COLOR, STICKER_COLORS } from './cubeModel';

const TEXTURE_SIZE = 512;
const STICKER_INSET = 42;
const STICKER_RADIUS = 52;

export function drawStickerCanvas(
  canvas: HTMLCanvasElement,
  color: string,
): void {
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持 Canvas 2D 纹理');
  }

  context.fillStyle = PLASTIC_COLOR;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  context.shadowColor = 'rgba(0,0,0,0.7)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  context.beginPath();
  context.roundRect(
    STICKER_INSET,
    STICKER_INSET,
    TEXTURE_SIZE - STICKER_INSET * 2,
    TEXTURE_SIZE - STICKER_INSET * 2,
    STICKER_RADIUS,
  );
  context.fillStyle = color;
  context.fill();

  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.lineWidth = 7;
  context.strokeStyle = 'rgba(255,255,255,0.2)';
  context.stroke();

  const center = TEXTURE_SIZE / 2;
  const highlight = context.createRadialGradient(
    center,
    center,
    18,
    center,
    center,
    250,
  );
  highlight.addColorStop(0, 'rgba(255,255,255,0.12)');
  highlight.addColorStop(0.62, 'rgba(255,255,255,0.04)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  context.beginPath();
  context.roundRect(
    STICKER_INSET + 8,
    STICKER_INSET + 8,
    TEXTURE_SIZE - (STICKER_INSET + 8) * 2,
    TEXTURE_SIZE - (STICKER_INSET + 8) * 2,
    STICKER_RADIUS - 8,
  );
  context.fillStyle = highlight;
  context.fill();
}

function createStickerMaterial(
  color: string,
  renderer: WebGLRenderer,
): MeshPhysicalMaterial {
  const canvas = document.createElement('canvas');
  drawStickerCanvas(canvas, color);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  return new MeshPhysicalMaterial({
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    map: texture,
    metalness: 0.02,
    roughness: 0.24,
  });
}

export function createRubiksMaterialLibrary(
  renderer: WebGLRenderer,
): Map<string, MeshPhysicalMaterial> {
  const materials = new Map<string, MeshPhysicalMaterial>();
  materials.set(
    PLASTIC_COLOR,
    new MeshPhysicalMaterial({
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      color: PLASTIC_COLOR,
      roughness: 0.3,
    }),
  );

  for (const color of Object.values(STICKER_COLORS)) {
    materials.set(color, createStickerMaterial(color, renderer));
  }

  return materials;
}

export function disposeRubiksMaterialLibrary(
  materials: Map<string, MeshPhysicalMaterial>,
): void {
  for (const material of materials.values()) {
    material.map?.dispose();
    material.dispose();
  }
  materials.clear();
}
