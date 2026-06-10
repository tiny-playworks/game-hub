import {
  Color,
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import { TETRIS_COLORS, type TetrisSpecial } from '@/lib/tetris';

export interface TetrisMaterialLibrary {
  blocks: MeshPhysicalMaterial[];
  specials: Record<TetrisSpecial, MeshPhysicalMaterial>;
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
    specials: {
      bomb: new MeshPhysicalMaterial({
        color: '#f97316',
        emissive: '#fb7185',
        emissiveIntensity: 0.48,
        roughness: 0.32,
        metalness: 0.18,
        clearcoat: 0.8,
      }),
      ice: new MeshPhysicalMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.88,
        roughness: 0.18,
        metalness: 0.04,
        transmission: 0.18,
        thickness: 0.45,
      }),
      wildcard: new MeshPhysicalMaterial({
        color: '#fef3c7',
        emissive: '#a78bfa',
        emissiveIntensity: 0.42,
        roughness: 0.24,
        metalness: 0.22,
        clearcoat: 0.9,
      }),
    },
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
    ...Object.values(materials.specials),
    materials.ghost,
    materials.glass,
    materials.floor,
  ];
  for (const material of owned) {
    material.dispose();
  }
}
