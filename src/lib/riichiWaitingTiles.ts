import { hasYaku, isMenzhen, isWinShapeRiichi } from '@/lib/mahjongRiichi';
import {
  enumerateTenpaiConcealedStates,
  tenpaiConcealedCount,
} from '@/lib/riichiTenpaiHelpers';

/** 听牌计算所需场况（避免依赖页面层大类型） */
export type RiichiWaitingTilesGameSlice = {
  roundWind: number;
  dealer: number;
  riichiDeclared: boolean[];
};

export type RiichiMeldLike = {
  type: 'chi' | 'peng' | 'mingang' | 'angang' | 'kakan';
  tiles: number[];
};

function seatWindIndex(
  roundWind: number,
  seat: number,
  dealer: number,
): number {
  return (roundWind + ((seat - dealer + 4) % 4)) % 4;
}

/**
 * 与牌墙/荣和/立直预览共用的听牌（含役判定）。
 * `meldsTyped` 与 `isMenzhen` 与 `hasYaku` / `computeYaku` 一致。
 */
export function computeWaitingTilesRiichi(
  hand: number[],
  melds: RiichiMeldLike[],
  gameState: RiichiWaitingTilesGameSlice | null | undefined,
  options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
): number[] {
  const seat = options?.seat ?? 0;
  const tc = tenpaiConcealedCount(melds);
  const rw = gameState?.roundWind ?? 0;
  const dealer = gameState?.dealer ?? 0;
  const menzen = isMenzhen(melds);

  const waitingForTc = (handTc: number[]): number[] => {
    if (handTc.length !== tc) return [];
    const waiting: number[] = [];
    for (let t = 0; t < 34; t++) {
      const testHand = [...handTc, t];
      if (isWinShapeRiichi(testHand, melds)) {
        const ctx = {
          hand: testHand,
          melds: melds.map((m) => ({ tiles: m.tiles })),
          meldsTyped: melds,
          isMenzhen: menzen,
          isTsumo: options?.isTsumo ?? true,
          isRiichi:
            options?.treatAsRiichi ?? gameState?.riichiDeclared[seat] ?? false,
          ippatsuPossible: false,
          seatWind: seatWindIndex(rw, seat, dealer),
          roundWind: rw,
        };
        if (hasYaku(ctx)) {
          waiting.push(t);
        }
      }
    }
    return waiting;
  };

  const states = enumerateTenpaiConcealedStates(hand, melds);
  if (states.length === 0) return [];

  const union = new Set<number>();
  for (const concealed of states) {
    for (const w of waitingForTc(concealed)) {
      union.add(w);
    }
  }
  return Array.from(union).sort((a, b) => a - b);
}
