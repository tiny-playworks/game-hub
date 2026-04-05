import type { YakuResult } from '@/lib/mahjongRiichi';
import {
  getBaseTile,
  getDoraFromIndicator,
  hasYaku,
  isWinShapeRiichi,
} from '@/lib/mahjongRiichi';
import {
  clearDoujunFuriten,
  createInitialFuritenState,
  isRonForbiddenByFuriten,
} from '@/lib/riichiFuriten';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { PaymentDetail } from '@/lib/riichiSettlement';
import type { RiichiGameState, RiichiMeld } from './types';

export function getSeatWind(
  roundWind: number,
  seat: number,
  dealer: number,
): number {
  return (roundWind + ((seat - dealer + 4) % 4)) % 4;
}

/**
 * 一局结束（胡牌或流局）后计算下一局。
 * 由胡牌/流局逻辑调用；流局时传入 dealerStays=true。
 */
export function getNextRound(
  dealer: number,
  roundWind: number,
  roundNumber: number,
  honba: number,
  dealerStays: boolean,
): { dealer: number; roundWind: number; roundNumber: number; honba: number } {
  if (dealerStays) return { dealer, roundWind, roundNumber, honba: honba + 1 };
  const nextDealer = (dealer + 1) % 4;
  if (nextDealer === 0)
    return {
      dealer: 0,
      roundWind: (roundWind + 1) % 4,
      roundNumber: 1,
      honba: 0,
    };
  return {
    dealer: nextDealer,
    roundWind,
    roundNumber: nextDealer + 1,
    honba: 0,
  };
}

/**
 * 当前可加杠的副露下标（手牌含 drawnTile 且与某碰同种牌）。
 * 仅当 phase=discard、drawnTile 非空、该座有碰时有效。
 */
export function getKakanOptions(
  state: RiichiGameState,
  seat: number,
): number[] {
  if (
    state.phase !== 'discard' ||
    state.drawnTile === null ||
    state.currentPlayer !== seat
  )
    return [];
  const melds = state.melds[seat];
  const drawn = state.drawnTile;
  const base = getBaseTile(drawn);
  const indices: number[] = [];
  for (let i = 0; i < melds.length; i++) {
    const m = melds[i];
    if (
      m.type === 'peng' &&
      m.tiles.length === 3 &&
      getBaseTile(m.tiles[0]) === base
    )
      indices.push(i);
  }
  return indices;
}

export function getMatchEndReasonText(
  reason?: MatchEndReason,
  translate?: (key: string) => string,
): string {
  if (translate) {
    switch (reason) {
      case 'tobi':
        return translate('riichi.matchEndReason.tobi');
      case 'east4_end':
        return translate('riichi.matchEndReason.east4');
      case 'agari_yame':
        return translate('riichi.matchEndReason.agariYame');
      case 'south4_end':
        return translate('riichi.matchEndReason.south4');
      default:
        return translate('riichi.matchEndReason.default');
    }
  }

  switch (reason) {
    case 'tobi':
      return '有人被击飞（负分）';
    case 'east4_end':
      return '东风场东4局结束';
    case 'agari_yame':
      return '南4庄家连庄且头名，收场';
    case 'south4_end':
      return '南风场南4局结束（已达返场线）';
    default:
      return '终局';
  }
}

export function getRyuukyokuReasonText(
  reason?: RiichiGameState['ryuukyokuReason'],
  translate?: (key: string) => string,
): string {
  if (translate) {
    switch (reason) {
      case '四风连打':
        return translate('riichi.drawReason.suufonRenda');
      case '四家立直':
        return translate('riichi.drawReason.suuchaRiichi');
      case '四开杠':
        return translate('riichi.drawReason.suukaikan');
      case '九种九牌':
        return translate('riichi.drawReason.kyuushuKyuuhai');
      default:
        return translate('riichi.drawReason.default');
    }
  }

  return reason ?? '荒牌';
}

export function isExhaustiveRyuukyoku(
  reason?: RiichiGameState['ryuukyokuReason'],
): boolean {
  return reason == null || reason === '荒牌';
}

export function getRyuukyokuDescription(
  reason?: RiichiGameState['ryuukyokuReason'],
  translate?: (key: string) => string,
): string {
  if (translate) {
    switch (reason) {
      case '四风连打':
        return translate('riichi.drawDesc.suufonRenda');
      case '四家立直':
        return translate('riichi.drawDesc.suuchaRiichi');
      case '四开杠':
        return translate('riichi.drawDesc.suukaikan');
      case '九种九牌':
        return translate('riichi.drawDesc.kyuushuKyuuhai');
      default:
        return translate('riichi.drawDesc.default');
    }
  }

  switch (reason) {
    case '四风连打':
      return '四家第一打同风牌，途中流局，本场+1，庄家连庄';
    case '四家立直':
      return '四家均已立直，途中流局，本场+1，庄家连庄';
    case '四开杠':
      return '全场四杠成立（非一人四杠），途中流局，本场+1，庄家连庄';
    case '九种九牌':
      return '九种九牌宣言成立，途中流局，本场+1，庄家连庄';
    default:
      return '牌墙摸完无人和，本场+1，庄家听牌则连庄，不听换庄';
  }
}

/** 统计各基础牌型（0-33）在可见区的出现次数。 */
export function countVisibleTilesByBase(state: RiichiGameState): number[] {
  const count = new Array<number>(34).fill(0);
  const add = (tile: number) => {
    const b = getBaseTile(tile);
    if (b >= 0 && b < 34) count[b]++;
  };
  state.hands[0].forEach(add);
  for (const m of state.melds[0]) m.tiles.forEach(add);
  for (let i = 0; i < 4; i++) state.discardPiles[i].forEach(add);
  for (const ind of state.doraIndicators) add(ind);
  return count;
}

export function getRonWaitingTilesForSeatInState(
  state: RiichiGameState,
  seat: number,
): number[] {
  const hand = state.hands[seat];
  const melds = state.melds[seat];
  if (hand.length !== 13) return [];
  const waiting: number[] = [];
  for (let t = 0; t < 34; t++) {
    const testHand = [...hand, t];
    if (!isWinShapeRiichi(testHand, melds)) continue;
    const ctx = {
      hand: testHand,
      melds: melds.map((m) => ({ tiles: m.tiles })),
      meldsTyped: melds,
      isMenzhen: melds.every((m) => m.type === 'angang'),
      isTsumo: false,
      isRiichi: state.riichiDeclared[seat],
      ippatsuPossible: false,
      seatWind: getSeatWind(state.roundWind, seat, state.dealer),
      roundWind: state.roundWind,
    };
    if (hasYaku(ctx)) waiting.push(t);
  }
  return waiting;
}

export function canSeatRonByRules(
  state: RiichiGameState,
  seat: number,
): boolean {
  if (
    state.phase !== 'claim' ||
    state.lastDiscard === null ||
    state.lastDiscardFrom === null ||
    state.lastDiscardFrom === seat
  )
    return false;
  const handWithClaim = [...state.hands[seat], state.lastDiscard];
  if (!isWinShapeRiichi(handWithClaim, state.melds[seat])) return false;
  const melds = state.melds[seat];
  const yakuOk = hasYaku({
    hand: handWithClaim,
    melds: melds.map((m) => ({ tiles: m.tiles })),
    meldsTyped: melds,
    isMenzhen: melds.every((m) => m.type === 'angang'),
    isTsumo: false,
    isRiichi: state.riichiDeclared[seat],
    ippatsuPossible: false,
    seatWind: getSeatWind(state.roundWind, seat, state.dealer),
    roundWind: state.roundWind,
  });
  if (!yakuOk) return false;
  return !isRonForbiddenByFuriten({
    waitingTiles: getRonWaitingTilesForSeatInState(state, seat),
    ownDiscards: state.discardPiles[seat],
    state: state.furitenStates[seat] ?? createInitialFuritenState(),
  });
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString()} 点`;
}

export function countUraDoraHan(
  allTiles: number[],
  indicators: number[],
): number {
  if (indicators.length === 0) return 0;
  const doraTypes = indicators.map((i) => getDoraFromIndicator(i));
  return allTiles.filter((t) => doraTypes.includes(getBaseTile(t))).length;
}

export function appendUraDoraYaku(
  yaku: YakuResult[],
  uraHan: number,
): YakuResult[] {
  if (uraHan <= 0) return yaku;
  const alreadyHasUra = yaku.some((y) => y.id === '54' || y.id === 'ura_dora');
  if (alreadyHasUra) return yaku;
  return [...yaku, { id: 'ura_dora', name: '里宝牌', han: uraHan }];
}

export function summarizeWinnerPayments(
  payments: PaymentDetail[],
  winner: number,
): { base: number; honba: number; riichi: number } {
  let base = 0;
  let honba = 0;
  let riichi = 0;
  for (const p of payments) {
    if (p.to !== winner) continue;
    if (p.reason === 'riichi') riichi += p.amount;
    else if (p.reason === 'honba') honba += p.amount;
    else base += p.amount;
  }
  return { base, honba, riichi };
}

export function clearSeatDoujunStates(
  states: RiichiGameState['furitenStates'],
  seat: number,
): RiichiGameState['furitenStates'] {
  return states.map((s, i) =>
    i === seat ? clearDoujunFuriten(s ?? createInitialFuritenState()) : s,
  );
}

export function needsDiscardDecision(state: RiichiGameState): boolean {
  if (state.phase !== 'discard') return false;
  const p = state.currentPlayer;
  return state.drawnTile !== null || state.hands[p].length === 11;
}

export function getClaimPlayerFromState(state: RiichiGameState): number | null {
  if (state.phase !== 'claim' || state.lastDiscardFrom === null) return null;
  return (state.lastDiscardFrom + 1 + state.claimIndex) % 4;
}

export function needsTimedDecision(state: RiichiGameState): boolean {
  if (needsDiscardDecision(state)) return true;
  return (
    state.phase === 'claim' &&
    state.lastDiscard !== null &&
    state.lastDiscardFrom !== null &&
    getClaimPlayerFromState(state) !== null
  );
}

export function getDecisionSeat(state: RiichiGameState): number {
  if (state.phase === 'discard') return state.currentPlayer;
  return getClaimPlayerFromState(state) ?? state.currentPlayer;
}

export function getTenpaiSeatsForDraw(
  game: RiichiGameState,
  getWaitingTiles: (
    hand: number[],
    melds: RiichiMeld[],
    g?: RiichiGameState,
  ) => number[],
): number[] {
  const tenpai: number[] = [];
  for (let seat = 0; seat < 4; seat++) {
    if (getWaitingTiles(game.hands[seat], game.melds[seat], game).length > 0) {
      tenpai.push(seat);
    }
  }
  return tenpai;
}
