import { getBaseTile } from '@/lib/mahjongRiichi';
import { analyzeRiichiHand, type RiichiRulesMeld } from '@/lib/riichiRules';

/** 每种基础牌型的可见枚数（0-33） */
export type VisibleCounts = number[];

export function emptyVisibleCounts(): VisibleCounts {
  return new Array<number>(34).fill(0);
}

export function addVisible(counts: VisibleCounts, tiles: readonly number[]) {
  for (const t of tiles) counts[getBaseTile(t)]++;
}

/** 某牌型对该家而言剩余（未见）枚数 */
export function remainingOf(base: number, visible: VisibleCounts): number {
  return Math.max(0, 4 - (visible[base] ?? 0));
}

export function countRemaining(
  tiles: readonly number[],
  visible: VisibleCounts,
): number {
  return tiles.reduce(
    (sum, t) => sum + remainingOf(getBaseTile(t), visible),
    0,
  );
}

/** 13 张逻辑牌的向听数（-1 已和，0 听牌） */
export function getShanten(hand: number[], melds: RiichiRulesMeld[]): number {
  try {
    return analyzeRiichiHand({ hand, melds }).shanten;
  } catch {
    return 8;
  }
}

export interface DiscardCandidate {
  /** 基础牌型 */
  base: number;
  shanten: number;
  /** 进张牌型 */
  effectiveTiles: number[];
  /** 进张剩余枚数 */
  ukeire: number;
}

/** 14 张逻辑牌：每种可打牌型打出后的向听与进张 */
export function evaluateDiscards(
  hand: number[],
  melds: RiichiRulesMeld[],
  visible: VisibleCounts,
): DiscardCandidate[] {
  try {
    const analysis = analyzeRiichiHand({ hand, melds });
    return analysis.discardOptions.map((o) => ({
      base: o.discard,
      shanten: o.shanten,
      effectiveTiles: o.effectiveTiles,
      ukeire: countRemaining(o.effectiveTiles, visible),
    }));
  } catch {
    return [];
  }
}
