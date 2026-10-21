import type { RoomAppearance } from './room';

const RIICHI_EFFECTS = new Set([
  'riichi-default', 'riichi-sparks', 'riichi-sakura', 'riichi-lightning', 'riichi-ink',
]);
const WIN_EFFECTS = new Set([
  'win-default', 'win-fireworks', 'win-sakura', 'win-dragon', 'win-galaxy',
  'win-mio', 'win-chitose', 'win-aya', 'win-yoru', 'win-tsubaki',
]);

export function normalizeRoomAppearance(raw?: Partial<RoomAppearance> | null): RoomAppearance {
  return {
    riichiEffect: raw?.riichiEffect && RIICHI_EFFECTS.has(raw.riichiEffect)
      ? raw.riichiEffect : 'riichi-default',
    winEffect: raw?.winEffect && WIN_EFFECTS.has(raw.winEffect)
      ? raw.winEffect : 'win-default',
  };
}

export function characterRoomAppearance(characterId?: string): RoomAppearance {
  return normalizeRoomAppearance({ winEffect: `win-${characterId}` });
}
