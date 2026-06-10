import {
  Color,
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import { TETRIS_COLORS } from '@/lib/tetris';

export interface TetrisMaterialLibrary {
  blocks: MeshPhysicalMaterial[];
  ghost: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
  floor: MeshStandardMaterial;
}

export function createTetrisMaterialLibrary(): TetrisMaterialLibrary {
  const blocks = TETRIS_COLORS.slice(1).map((color) => {
    const base = new Color(color);
    return new MeshPhysicalMaterial({
      color: base,
      emissive: base.clone().multiplyScalar(0.16),
      metalness: 0.05,
      roughness: 0.36,
      clearcoat: 0.65,
      clearcoatRoughness: 0.28,
    });
  });

  return {
    blocks,
    ghost: new MeshPhysicalMaterial({
      color: '#dbeafe',
      emissive: '#38bdf8',
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      roughness: 0.52,
      metalness: 0.02,
    }),
    glass: new MeshPhysicalMaterial({
      color: '#0f2742',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.36,
      roughness: 0.18,
      metalness: 0.18,
      transmission: 0.32,
      thickness: 0.7,
    }),
    floor: new MeshStandardMaterial({
      color: '#050b16',
      emissive: '#03111f',
      roughness: 0.82,
      metalness: 0.16,
    }),
  };
}

export function disposeTetrisMaterialLibrary(
  materials: TetrisMaterialLibrary,
): void {
  const owned: Material[] = [
    ...materials.blocks,
    materials.ghost,
    materials.glass,
    materials.floor,
  ];
  for (const material of owned) {
    material.dispose();
  }
}
