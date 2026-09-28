/**
 * 日麻 AI 的纯函数评估：放铳危险度与牌价值。决策流程见 pages/mahjong/japanese/engine/ai.ts。
 */
import {
  getBaseTile,
  getDoraFromIndicator,
  isAkaFive,
} from '@/lib/mahjongRiichi';
import type { VisibleCounts } from '@/lib/riichiShanten';

/** 一名对手的可观察信息 */
export interface OpponentView {
  discards: number[];
  /** 立直宣言后全场打出且该家未荣和的牌（同巡 / 立直后现物） */
  safeAfterRiichi: number[];
  riichi: boolean;
  /** 立直宣言牌在该家牌河中的下标 */
  riichiIndex: number | null;
  meldCount: number;
}

function isGenbutsu(base: number, opp: OpponentView): boolean {
  return (
    opp.discards.some((t) => getBaseTile(t) === base) ||
    opp.safeAfterRiichi.some((t) => getBaseTile(t) === base)
  );
}

function sujiState(
  base: number,
  opp: OpponentView,
): 'full' | 'half' | 'none' {
  const num = base % 9;
  const suitStart = base - num;
  const has = (n: number) =>
    n >= 0 &&
    n <= 8 &&
    opp.discards.some((t) => getBaseTile(t) === suitStart + n);
  const low = num - 3;
  const high = num + 3;
  const needLow = low >= 0;
  const needHigh = high <= 8;
  const okLow = needLow ? has(low) : true;
  const okHigh = needHigh ? has(high) : true;
  if (okLow && okHigh) return 'full';
  if ((needLow && has(low)) || (needHigh && has(high))) return 'half';
  return 'none';
}

/** 壁：相邻牌型 4 张全部可见时，两面待无法经过该牌（No Chance） */
function isKabeSafe(base: number, visible: VisibleCounts): boolean {
  const num = base % 9;
  const suitStart = base - num;
  const walled = (n: number) => n >= 0 && n <= 8 && visible[suitStart + n] >= 4;
  if (num <= 2) return walled(num + 1) || walled(num + 2);
  if (num >= 6) return walled(num - 1) || walled(num - 2);
  return (walled(num - 1) || walled(num - 2)) && (walled(num + 1) || walled(num + 2));
}

/**
 * 估算某张牌对单个对手的放铳危险度：0 为现物，1 约为无筋中张。
 * 考虑现物、字牌可见枚数、筋 / 半筋、壁与幺九。
 */
export function evaluateTileDanger(
  tile: number,
  opp: OpponentView,
  visible: VisibleCounts,
): number {
  const base = getBaseTile(tile);
  if (isGenbutsu(base, opp)) return 0;
  if (base >= 27) {
    const seen = visible[base] ?? 0;
    if (seen >= 3) return 0.05;
    if (seen === 2) return 0.25;
    return 0.55;
  }
  const num = base % 9;
  const isTerminal = num === 0 || num === 8;
  if (isKabeSafe(base, visible)) return isTerminal ? 0.1 : 0.2;
  const suji = sujiState(base, opp);
  if (isTerminal) return suji === 'none' ? 0.6 : 0.2;
  if (num === 1 || num === 7) {
    return suji === 'full' ? 0.3 : suji === 'half' ? 0.55 : 0.8;
  }
  return suji === 'full' ? 0.4 : suji === 'half' ? 0.75 : 1;
}

export interface TileValueContext {
  doraIndicators: number[];
  seatWind: number;
  roundWind: number;
}

/** 牌本身的打点价值：宝牌、赤宝、役牌对子 */
export function evaluateTileValue(
  tile: number,
  hand: readonly number[],
  ctx: TileValueContext,
): number {
  const base = getBaseTile(tile);
  const doras = ctx.doraIndicators.map(getDoraFromIndicator);
  let value = 0;
  value += doras.filter((d) => d === base).length * 0.9;
  if (isAkaFive(tile)) value += 0.9;
  if (base >= 27) {
    const yakuhai =
      base >= 31 || base === 27 + ctx.seatWind || base === 27 + ctx.roundWind;
    const count = hand.filter((t) => getBaseTile(t) === base).length;
    if (yakuhai && count >= 2) value += 1.2;
  }
  return value;
}

export function isYakuhaiBase(
  base: number,
  seatWind: number,
  roundWind: number,
): boolean {
  return base >= 31 || base === 27 + seatWind || base === 27 + roundWind;
}
