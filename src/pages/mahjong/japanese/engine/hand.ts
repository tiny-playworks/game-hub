import { compareTiles, getBaseTile } from '@/lib/mahjongRiichi';
import { tenpaiConcealedCount } from '@/lib/riichiTenpaiHelpers';
import { computeWaitingTilesRiichi } from '@/lib/riichiWaitingTiles';
import type { RiichiMeld } from '../types';

export function sortHand(hand: number[]): number[] {
  return [...hand].sort(compareTiles);
}

/** 按精确牌 id 移除；任一张不存在则返回 null */
export function removeTiles(
  hand: readonly number[],
  tiles: readonly number[],
): number[] | null {
  const rest = [...hand];
  for (const t of tiles) {
    const i = rest.indexOf(t);
    if (i === -1) return null;
    rest.splice(i, 1);
  }
  return rest;
}

/** 按牌型移除 count 张（优先移除普通牌，保留赤五在手里之外的顺序无关） */
export function takeByBase(
  hand: readonly number[],
  base: number,
  count: number,
): { rest: number[]; taken: number[] } | null {
  const rest = [...hand];
  const taken: number[] = [];
  for (let i = 0; i < rest.length && taken.length < count; ) {
    if (getBaseTile(rest[i]) === base) {
      taken.push(rest[i]);
      rest.splice(i, 1);
    } else {
      i++;
    }
  }
  return taken.length === count ? { rest, taken } : null;
}

export function countByBase(hand: readonly number[], base: number): number {
  let n = 0;
  for (const t of hand) if (getBaseTile(t) === base) n++;
  return n;
}

/** 听牌中的待牌基础牌型（门前张数不为 13 - 3×副露 时返回空） */
export function getWaits(hand: number[], melds: RiichiMeld[]): number[] {
  if (hand.length !== tenpaiConcealedCount(melds)) return [];
  return computeWaitingTilesRiichi(hand, melds);
}

export function isTenpai(hand: number[], melds: RiichiMeld[]): boolean {
  return getWaits(hand, melds).length > 0;
}

export function sameWaits(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}
