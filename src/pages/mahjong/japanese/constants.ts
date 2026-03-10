import { RIICHI_TIME_BANK_INITIAL_SECONDS } from '@/lib/riichiClock';
import { RIICHI_INITIAL_POINTS } from '@/lib/riichiSettlement';

export const SEAT_NAMES = ['自家', '下家', '对家', '上家'];
export const WIND_NAMES = ['东', '南', '西', '北'];

export type RiichiThemeId = 'green' | 'blue' | 'warm';
export const RIICHI_THEMES: { id: RiichiThemeId; label: string }[] = [
  { id: 'green', label: '绿桌' },
  { id: 'blue', label: '蓝桌' },
  { id: 'warm', label: '暖桌' },
];
export const RIICHI_THEME_STORAGE_KEY = 'game-hub-riichi-theme';

export const TILE_HAND = 'riichi-tile-hand shrink-0 cursor-pointer';
export const TILE_DISCARD = 'riichi-tile-discard shrink-0';
export const TILE_ACTIVE = 'riichi-tile-active';

export const MAX_HISTORY = 40;
export const MAX_LOG = 150;

export const DEFAULT_SCORES = [
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
];
export const DEFAULT_TIME_BANKS = [
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
];
