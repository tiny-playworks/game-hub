import { RIICHI_TIME_BANK_INITIAL_SECONDS } from '@/lib/riichiClock';
import { RIICHI_INITIAL_POINTS } from '@/lib/riichiSettlement';

export const SEAT_NAMES = ['自家', '下家', '对家', '上家'];
export const WIND_NAMES = ['东', '南', '西', '北'];

export const TILE_HAND =
  'w-[70px] h-[96px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-2xl transition-all duration-200';
export const TILE_DISCARD =
  'w-[50px] h-[68px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center shrink-0 font-black text-sm transition-all duration-200';
export const TILE_ACTIVE =
  'border-[#ffc107] border-[3px] -translate-y-3 shadow-xl ring-2 ring-[#ffc107]/60 animate-riichi-active-pulse';

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
