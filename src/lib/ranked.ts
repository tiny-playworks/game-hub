import { CHARACTER_DEFS, CHARACTER_RANK_BANDS, type RankBand } from './playerCharacters';
import { mixSeed, mulberry32 } from './seededRandom';
import type { RiichiAiLevel, RiichiSeatAiLevels } from '@/pages/mahjong/japanese/engine/rules';

export const RANKED_STORAGE_KEY = 'game-hub-ranked-v1';
export const RANKED_CHANGED_EVENT = 'game-hub:ranked-changed';
export interface Rank { band: RankBand; level: 1 | 2 | 3 }
export interface RankPoints extends Rank { pt: number }
export type Placement = 1 | 2 | 3 | 4;
export type MatchLength = 'east' | 'south';
export const RANK_TABLE: Record<RankBand, readonly { start: number; max: number }[]> = {
  novice: [{ start: 0, max: 20 }, { start: 0, max: 80 }, { start: 0, max: 200 }],
  adept: [{ start: 300, max: 600 }, { start: 400, max: 800 }, { start: 500, max: 1000 }],
  expert: [{ start: 600, max: 1200 }, { start: 700, max: 1400 }, { start: 1000, max: 2000 }],
  master: [{ start: 1400, max: 2800 }, { start: 1600, max: 3200 }, { start: 1800, max: 3600 }],
  saint: [{ start: 2000, max: 4000 }, { start: 3000, max: 6000 }, { start: 4500, max: Infinity }],
};
const PLACEMENT_POINTS = { novice: [30, 15, 5, 0], adept: [40, 20, 0, -20], expert: [50, 20, 0, -40], master: [60, 25, 0, -60], saint: [70, 30, 0, -90] };
export interface RankedTicket extends Rank {
  id: string; seed: number; at: number; matchLength: MatchLength;
  characterId: string; affinityStart: number; opponents: [string, string, string];
  seatAiLevels: RiichiSeatAiLevels;
}
export interface RankedHistoryEntry {
  id: string; at: number; matchLength: MatchLength; placement: Placement;
  finalScore: number; ptDelta: number; opponents: string[];
  before: RankPoints; after: RankPoints; change: 'up' | 'down' | null;
  finalScores: number[]; ranking: number[]; characterId: string;
  coins: number; affinityDelta: number; unlocked: string[]; forfeit: boolean;
}
export interface RankedState extends RankPoints {
  version: 1; peak: Rank; history: RankedHistoryEntry[];
  activeMatchId: string | null; activeTicket: RankedTicket | null;
}
export function rankIndex(rank: Rank): number { return CHARACTER_RANK_BANDS.indexOf(rank.band) * 3 + rank.level - 1; }
export function rankLimits(rank: Rank) { return RANK_TABLE[rank.band][rank.level - 1]; }
export function computePtDelta(input: { band: RankBand; placement: Placement; finalScore: number; matchLength: MatchLength }): number {
  const score = Math.max(-30, Math.min(30, Math.round((input.finalScore - 25000) / 1000)));
  const base = PLACEMENT_POINTS[input.band][input.placement - 1] + score;
  return Math.round(base * (input.matchLength === 'south' ? 1.5 : 1)) - (input.finalScore < 0 ? 10 : 0);
}
export function applyPtDelta<T extends RankPoints & { peak: Rank }>(state: T, delta: number): { state: T; change: 'up' | 'down' | null } {
  let index = rankIndex(state);
  let pt = state.pt + delta;
  let change: 'up' | 'down' | null = null;
  if (pt >= rankLimits(state).max && index < 14) { index++; change = 'up'; }
  else if (pt < 0 && state.band !== 'novice') { index--; change = 'down'; }
  const rank: Rank = { band: CHARACTER_RANK_BANDS[Math.floor(index / 3)], level: (index % 3 + 1) as Rank['level'] };
  pt = change ? rankLimits(rank).start : Math.max(0, pt);
  return { state: { ...state, ...rank, pt, peak: rankIndex(rank) > rankIndex(state.peak) ? rank : state.peak }, change };
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function integer(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback; }
function rankOf(value: unknown): RankPoints {
  const raw = object(value);
  const band = CHARACTER_RANK_BANDS.find((band) => band === raw.band) ?? 'novice';
  const level = raw.level === 2 || raw.level === 3 ? raw.level : 1;
  const max = RANK_TABLE[band][level - 1].max;
  return { band, level, pt: Math.min(Math.max(0, integer(raw.pt)), Number.isFinite(max) ? max - 1 : Number.MAX_SAFE_INTEGER) };
}
const validId = (value: unknown): value is string => typeof value === 'string' && CHARACTER_DEFS.some((character) => character.id === value);
export function isRankedTicket(value: unknown): value is RankedTicket {
  const raw = object(value);
  return typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 120 &&
    Number.isSafeInteger(raw.seed) && Number.isSafeInteger(raw.at) && Number(raw.at) >= 0 &&
    (raw.matchLength === 'east' || raw.matchLength === 'south') && validId(raw.characterId) &&
    Number.isSafeInteger(raw.affinityStart) && Number(raw.affinityStart) >= 0 &&
    CHARACTER_RANK_BANDS.some((band) => band === raw.band) && [1,2,3].includes(Number(raw.level)) &&
    Array.isArray(raw.opponents) && raw.opponents.length === 3 && raw.opponents.every(validId) &&
    !raw.opponents.includes(raw.characterId) && new Set(raw.opponents).size === 3 &&
    Array.isArray(raw.seatAiLevels) && raw.seatAiLevels.length === 4 && raw.seatAiLevels.every((level) => ['beginner','standard','strong','expert'].includes(String(level)));
}
export function normalizeRankedState(value: unknown): RankedState {
  const raw = object(value);
  const current = rankOf(raw);
  const peak = rankOf(raw.peak);
  const history: RankedHistoryEntry[] = [];
  for (const entry of Array.isArray(raw.history) ? raw.history.slice(-50) : []) {
    const item = object(entry);
    if (![1,2,3,4].includes(Number(item.placement)) || !Number.isSafeInteger(item.finalScore) || !Number.isSafeInteger(item.ptDelta) || !Number.isSafeInteger(item.at) || (item.matchLength !== 'east' && item.matchLength !== 'south')) continue;
    const opponents = Array.isArray(item.opponents) ? item.opponents.filter(validId).slice(0,3) : [];
    history.push({ id: typeof item.id === 'string' ? item.id : `legacy-${item.at}-${history.length}`, at: integer(item.at), matchLength: item.matchLength,
      placement: Number(item.placement) as Placement, finalScore: integer(item.finalScore), ptDelta: integer(item.ptDelta), opponents,
      before: rankOf(item.before ?? current), after: rankOf(item.after ?? current), change: item.change === 'up' || item.change === 'down' ? item.change : null,
      finalScores: Array.isArray(item.finalScores) && item.finalScores.length === 4 && item.finalScores.every(Number.isSafeInteger) ? item.finalScores as number[] : [integer(item.finalScore),25000,25000,25000],
      ranking: Array.isArray(item.ranking) && item.ranking.length === 4 && new Set(item.ranking).size === 4 && item.ranking.every((seat) => [0,1,2,3].includes(Number(seat))) ? item.ranking as number[] : [0,1,2,3],
      characterId: validId(item.characterId) ? item.characterId : 'mio', coins: Math.max(0,integer(item.coins)), affinityDelta: Math.max(0,integer(item.affinityDelta)),
      unlocked: Array.isArray(item.unlocked) ? item.unlocked.filter(validId) : [], forfeit: item.forfeit === true });
  }
  const activeMatchId = typeof raw.activeMatchId === 'string' && raw.activeMatchId.length <= 120 && raw.activeMatchId.length > 0 ? raw.activeMatchId : null;
  return { version: 1, ...current, peak: rankIndex(peak) >= rankIndex(current) ? {band:peak.band,level:peak.level} : {band:current.band,level:current.level}, history,
    activeMatchId, activeTicket: isRankedTicket(raw.activeTicket) && raw.activeTicket.id === activeMatchId ? raw.activeTicket : null };
}
export function getRankedState(): RankedState {
  try { return normalizeRankedState(JSON.parse(localStorage.getItem(RANKED_STORAGE_KEY) ?? 'null')); }
  catch { return normalizeRankedState(null); }
}
export function saveRankedState(state: RankedState): void {
  localStorage.setItem(RANKED_STORAGE_KEY, JSON.stringify(state));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RANKED_CHANGED_EVENT));
}

interface MatchPlan { required?: string; primary: RankBand[]; primaryCount: number; mix: RankBand[] }
/** 路线图 3.6 的对手池。名册只有 8 人，主池不足时才按段位距离补位。 */
export function rankedMatchPlan(rank: Rank): MatchPlan {
  switch (rank.band) {
    case 'novice': return rank.level === 3 ? { primary: ['novice'], primaryCount: 2, mix: ['adept'] } : { primary: ['novice'], primaryCount: 3, mix: [] };
    case 'adept': return { primary: ['adept'], primaryCount: 2, mix: ['novice', 'expert'] };
    case 'expert': return { primary: ['expert'], primaryCount: 2, mix: ['adept', 'master'] };
    case 'master': return { primary: ['master', 'expert'], primaryCount: 3, mix: [] };
    case 'saint': return { required: 'yoru', primary: ['expert', 'master', 'saint'], primaryCount: 3, mix: [] };
  }
}
function opponentLevel(rank: Rank, band: RankBand, primaryStrongUsed: { value: boolean }): RiichiAiLevel {
  switch (rank.band) {
    case 'novice': return rank.level === 3 && band !== 'novice' ? 'standard' : 'beginner';
    case 'adept': return 'standard';
    case 'expert':
      if (band === 'expert') { const level = primaryStrongUsed.value ? 'standard' : 'strong'; primaryStrongUsed.value = true; return level; }
      return CHARACTER_RANK_BANDS.indexOf(band) > CHARACTER_RANK_BANDS.indexOf('expert') ? 'strong' : 'standard';
    case 'master': return 'strong';
    case 'saint': return 'expert';
  }
}
/** 独立随机流。主池 → 混入池 → 按段位距离补位；主角色排除，三名对手互不重复。 */
export function selectRankedOpponents(rank: Rank, playerId: string, seed: number): { opponents: [string,string,string]; seatAiLevels: RiichiSeatAiLevels } {
  const random = mulberry32(mixSeed(seed, 0x52414e4b));
  const bandIndex = CHARACTER_RANK_BANDS.indexOf(rank.band);
  const plan = rankedMatchPlan(rank);
  const pool = CHARACTER_DEFS.filter((character) => character.id !== playerId).map((character) => ({ character, tie: random() })).sort((a,b) => a.tie - b.tie).map(({character}) => character);
  const picked: typeof pool = [];
  const take = (filter: (character: (typeof pool)[number]) => boolean, count: number) => {
    for (const character of pool) { if (picked.length >= 3 || count <= 0) return; if (!picked.includes(character) && filter(character)) { picked.push(character); count--; } }
  };
  if (plan.required) take((character) => character.id === plan.required, 1);
  take((character) => plan.primary.includes(character.rankBand), plan.primaryCount - picked.length);
  take((character) => plan.mix.includes(character.rankBand), 3 - picked.length);
  const distance = (character: (typeof pool)[number]) => Math.abs(CHARACTER_RANK_BANDS.indexOf(character.rankBand) - bandIndex);
  for (const character of [...pool].sort((a,b) => distance(a) - distance(b))) if (picked.length < 3 && !picked.includes(character)) picked.push(character);
  // 座次随机，混入的对手不固定坐在同一家。
  for (let index = picked.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [picked[index], picked[swap]] = [picked[swap], picked[index]]; }
  const strongUsed = { value: false };
  const levels = picked.map((character) => opponentLevel(rank, character.rankBand, strongUsed));
  // 0 号座位是玩家，仅作占位；对手依次坐 1–3 号。
  return { opponents: picked.map((character) => character.id) as [string,string,string], seatAiLevels: [levels[0],levels[0],levels[1],levels[2]] };
}
