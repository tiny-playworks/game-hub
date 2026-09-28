import {
  canMingangRiichi,
  canPengRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  isMenzhen,
} from '@/lib/mahjongRiichi';
import { canDeclareKyuushuKyuuhai, countKans } from '@/lib/riichiAbortiveDraw';
import { isRonForbiddenByFuriten } from '@/lib/riichiFuriten';
import { analyzeRiichiHand } from '@/lib/riichiRules';
import type {
  ClaimKind,
  KakanOption,
  RiichiGameState,
  RiichiMeld,
  SeatClaimOptions,
  SeatTurnOptions,
} from '../types';
import { evaluateSeatWin, isKokushiEvaluation } from './evaluate';
import { getWaits, removeTiles, sameWaits, takeByBase } from './hand';
import type { RiichiRuleConfig } from './rules';

export const RIICHI_COST = 1000;
export const MAX_KANS = 4;

/** 开杠需要：活牌山至少 1 张（海底不可杠）、岭上牌有剩余、全场杠数未满 4 */
export function canDeclareKan(state: RiichiGameState): boolean {
  return (
    state.wall.length > 0 &&
    state.rinshanTiles.length > 0 &&
    countKans(state.melds).total < MAX_KANS
  );
}

function uniqueTiles(tiles: readonly number[]): number[] {
  return [...new Set(tiles)];
}

/** 鸣牌后禁止打出的基础牌型（现物食替 + 筋食替） */
export function getKuikaeForbiddenBases(
  calledTile: number,
  handTiles: readonly number[] | null,
): number[] {
  const called = getBaseTile(calledTile);
  if (!handTiles || called >= 27) return [called];
  const [a, b] = handTiles.map(getBaseTile).sort((x, y) => x - y);
  const suitStart = Math.floor(called / 9) * 9;
  const inSuit = (t: number) => t >= suitStart && t <= suitStart + 8;
  const forbidden = [called];
  if (a === called + 1 && b === called + 2 && inSuit(called + 3)) {
    forbidden.push(called + 3);
  }
  if (a === called - 2 && b === called - 1 && inSuit(called - 3)) {
    forbidden.push(called - 3);
  }
  return forbidden;
}

function discardableAfterKuikae(
  hand: readonly number[],
  forbidden: readonly number[],
): number[] {
  const set = new Set(forbidden);
  return uniqueTiles(hand.filter((t) => !set.has(getBaseTile(t))));
}

/** 立直可打出的牌：打出后门前 13 张仍听牌 */
export function getRiichiDiscards(
  state: RiichiGameState,
  seat: number,
): number[] {
  const hand = state.hands[seat];
  const melds = state.melds[seat];
  if (
    state.riichiDeclared[seat] ||
    !isMenzhen(melds) ||
    state.scores[seat] < RIICHI_COST ||
    state.wall.length < 4
  ) {
    return [];
  }
  let analysis: ReturnType<typeof analyzeRiichiHand>;
  try {
    analysis = analyzeRiichiHand({ hand, melds });
  } catch {
    return [];
  }
  const tenpaiBases = new Set(
    analysis.discardOptions
      .filter((o) => o.shanten === 0 && o.effectiveTiles.length > 0)
      .map((o) => o.discard),
  );
  return uniqueTiles(hand.filter((t) => tenpaiBases.has(getBaseTile(t))));
}

function getAnkanOptions(state: RiichiGameState, seat: number): number[][] {
  if (!canDeclareKan(state)) return [];
  const hand = state.hands[seat];
  const melds = state.melds[seat];
  const bases = new Set(hand.map(getBaseTile));
  const options: number[][] = [];
  for (const base of bases) {
    const taken = takeByBase(hand, base, 4);
    if (!taken) continue;
    if (state.riichiDeclared[seat]) {
      // 立直后只能用摸到的牌暗杠，且不能改变待牌
      if (state.drawnTile === null || getBaseTile(state.drawnTile) !== base) {
        continue;
      }
      const before = removeTiles(hand, [state.drawnTile]);
      if (!before) continue;
      const afterMelds: RiichiMeld[] = [
        ...melds,
        { type: 'angang', tiles: taken.taken },
      ];
      if (!sameWaits(getWaits(before, melds), getWaits(taken.rest, afterMelds)))
        continue;
    }
    options.push(taken.taken);
  }
  return options;
}

function getKakanOptions(state: RiichiGameState, seat: number): KakanOption[] {
  if (!canDeclareKan(state) || state.riichiDeclared[seat]) return [];
  const hand = state.hands[seat];
  const options: KakanOption[] = [];
  state.melds[seat].forEach((meld, meldIndex) => {
    if (meld.type !== 'peng') return;
    const base = getBaseTile(meld.tiles[0]);
    const tile = hand.find((t) => getBaseTile(t) === base);
    if (tile !== undefined) options.push({ meldIndex, tile });
  });
  return options;
}

/** 摸牌后（含岭上）行牌者的全部合法操作 */
export function computeDrawTurnOptions(
  state: RiichiGameState,
  seat: number,
  rules: Pick<RiichiRuleConfig, 'doubleYakuman'>,
): SeatTurnOptions {
  const hand = state.hands[seat];
  let tsumo = false;
  if (state.drawnTile !== null) {
    try {
      tsumo = evaluateSeatWin({
        state,
        seat,
        isTsumo: true,
        winningTile: state.drawnTile,
        rules,
      }).legalWin;
    } catch {
      tsumo = false;
    }
  }
  const riichiLocked = state.riichiDeclared[seat];
  return {
    seat,
    tsumo,
    riichiDiscards: getRiichiDiscards(state, seat),
    ankan: getAnkanOptions(state, seat),
    kakan: getKakanOptions(state, seat),
    kyuushu:
      state.firstTurn[seat] &&
      state.melds.every((m) => m.length === 0) &&
      canDeclareKyuushuKyuuhai(hand),
    discardable:
      riichiLocked && state.drawnTile !== null
        ? [state.drawnTile]
        : uniqueTiles(hand),
  };
}

/** 吃/碰后行牌者只能打牌（不可立即开杠），并受食替限制 */
export function computeCallTurnOptions(
  state: RiichiGameState,
  seat: number,
): SeatTurnOptions {
  return {
    seat,
    tsumo: false,
    riichiDiscards: [],
    ankan: [],
    kakan: [],
    kyuushu: false,
    discardable: discardableAfterKuikae(
      state.hands[seat],
      state.kuikaeForbidden,
    ),
  };
}

/** 振听判定：待牌、自家舍牌与记忆中的同巡/立直振听 */
export function isSeatFuriten(state: RiichiGameState, seat: number): boolean {
  return isRonForbiddenByFuriten({
    waitingTiles: getWaits(state.hands[seat], state.melds[seat]),
    ownDiscards: state.discardPiles[seat],
    state: state.furitenStates[seat],
  });
}

export function canSeatRon(
  state: RiichiGameState,
  seat: number,
  tile: number,
  kind: ClaimKind,
  rules: Pick<RiichiRuleConfig, 'doubleYakuman' | 'kokushiChankanAnkan'>,
): boolean {
  const waits = getWaits(state.hands[seat], state.melds[seat]);
  if (!waits.includes(getBaseTile(tile))) return false;
  if (
    isRonForbiddenByFuriten({
      waitingTiles: waits,
      ownDiscards: state.discardPiles[seat],
      state: state.furitenStates[seat],
    })
  ) {
    return false;
  }
  if (kind === 'ankan' && !rules.kokushiChankanAnkan) return false;
  let evaluation: ReturnType<typeof evaluateSeatWin>;
  try {
    evaluation = evaluateSeatWin({
      state,
      seat,
      isTsumo: false,
      winningTile: tile,
      chankan: kind !== 'discard',
      rules,
    });
  } catch {
    return false;
  }
  if (!evaluation.legalWin) return false;
  if (kind === 'ankan') return isKokushiEvaluation(evaluation);
  return true;
}

/** 吃牌组合中至少保留一张可以打出的牌（否则因食替无法成立） */
function chiLeavesDiscard(
  hand: readonly number[],
  pair: [number, number],
  calledTile: number,
  kuikae: boolean,
): boolean {
  const rest = removeTiles(hand, pair);
  if (!rest || rest.length === 0) return false;
  if (!kuikae) return true;
  return (
    discardableAfterKuikae(rest, getKuikaeForbiddenBases(calledTile, pair))
      .length > 0
  );
}

function ponLeavesDiscard(
  hand: readonly number[],
  calledTile: number,
  kuikae: boolean,
): boolean {
  const taken = takeByBase(hand, getBaseTile(calledTile), 2);
  if (!taken || taken.rest.length === 0) return false;
  if (!kuikae) return true;
  return (
    discardableAfterKuikae(
      taken.rest,
      getKuikaeForbiddenBases(calledTile, null),
    ).length > 0
  );
}

/** 为一次舍牌 / 加杠 / 暗杠打开鸣牌窗口时各座位的可选操作 */
export function computeClaimOptions(
  state: RiichiGameState,
  tile: number,
  from: number,
  kind: ClaimKind,
  rules: RiichiRuleConfig,
): (SeatClaimOptions | null)[] {
  const isHoutei = state.wall.length === 0;
  return [0, 1, 2, 3].map((seat) => {
    if (seat === from) return null;
    const hand = state.hands[seat];
    const ron = canSeatRon(state, seat, tile, kind, rules);
    const callsAllowed =
      kind === 'discard' && !isHoutei && !state.riichiDeclared[seat];
    const chi = callsAllowed
      ? getChiOptionsRiichi(hand, tile, from, seat).filter((pair) =>
          chiLeavesDiscard(hand, pair, tile, rules.kuikae),
        )
      : [];
    const pon =
      callsAllowed &&
      canPengRiichi(hand, tile) &&
      ponLeavesDiscard(hand, tile, rules.kuikae);
    const minkan =
      callsAllowed && canMingangRiichi(hand, tile) && canDeclareKan(state);
    if (!ron && chi.length === 0 && !pon && !minkan) return null;
    return { ron, chi, pon, minkan };
  });
}
