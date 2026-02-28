import { getBaseTile } from '@/lib/mahjongRiichi';

export type AbortiveDrawReason =
  | '九种九牌'
  | '四风连打'
  | '四家立直'
  | '四开杠';

type RiichiMeldLike = { type: 'chi' | 'peng' | 'mingang' | 'angang' };

const YAOCHUU_BASES = new Set<number>([
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
]);

/** 九种九牌：配牌/第一自摸时，幺九牌+字牌种类数 >= 9。 */
export function canDeclareKyuushuKyuuhai(hand: number[]): boolean {
  if (hand.length !== 14) return false;
  const uniq = new Set<number>();
  for (const tile of hand) {
    const base = getBaseTile(tile);
    if (YAOCHUU_BASES.has(base)) uniq.add(base);
  }
  return uniq.size >= 9;
}

/** 四风连打：无人副露时，四家第一打均为同一风牌。 */
export function shouldAbortOnSuufonRenda(
  discardPiles: number[][],
  melds: RiichiMeldLike[][],
): boolean {
  const hasAnyMeld = melds.some((seatMelds) => seatMelds.length > 0);
  if (hasAnyMeld) return false;
  const totalDiscards = discardPiles.reduce(
    (sum, pile) => sum + pile.length,
    0,
  );
  if (totalDiscards !== 4) return false;
  const firstDiscards = discardPiles.map((pile) => pile[0]);
  if (firstDiscards.some((t) => t === undefined)) return false;
  const firstBase = getBaseTile(firstDiscards[0]);
  if (firstBase < 27 || firstBase > 30) return false;
  return firstDiscards.every((t) => getBaseTile(t) === firstBase);
}

/** 四家立直：四家都已立直。 */
export function shouldAbortOnSuuchaRiichi(riichiDeclared: boolean[]): boolean {
  return riichiDeclared.length === 4 && riichiDeclared.every(Boolean);
}

/** 四开杠：全场杠子总数 >=4，且不是同一人独占四杠。 */
export function shouldAbortOnSuukaikan(melds: RiichiMeldLike[][]): boolean {
  let totalKan = 0;
  let kanSeats = 0;
  for (const seatMelds of melds) {
    const seatKan = seatMelds.filter(
      (m) => m.type === 'mingang' || m.type === 'angang',
    ).length;
    totalKan += seatKan;
    if (seatKan > 0) kanSeats++;
  }
  return totalKan >= 4 && kanSeats >= 2;
}
