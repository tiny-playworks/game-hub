/**
 * 日麻 AI：按向听数 / 进张选牌，按期望综合判断立直、鸣牌与攻守。
 * 纯函数、无随机：相同局面总是给出相同决策，便于回放与测试。
 */
import { getBaseTile, isMenzhen, isYaochuu } from '@/lib/mahjongRiichi';
import {
  evaluateTileDanger,
  evaluateTileValue,
  isYakuhaiBase,
  type OpponentView,
} from '@/lib/riichiAi';
import {
  addVisible,
  type DiscardCandidate,
  emptyVisibleCounts,
  evaluateDiscards,
  getShanten,
  remainingOf,
  type VisibleCounts,
} from '@/lib/riichiShanten';
import type {
  ClaimResponse,
  RiichiGameState,
  RiichiMeld,
  SeatClaimOptions,
} from '../types';
import { evaluateSeatWin } from './evaluate';
import { getWaits, removeTiles, takeByBase } from './hand';
import type { RiichiEvent } from './match';
import { getKuikaeForbiddenBases } from './options';
import type { RiichiAiLevel } from './rules';

type TurnEvent = Extract<
  RiichiEvent,
  { type: 'discard' | 'riichi' | 'tsumo' | 'ankan' | 'kakan' | 'kyuushu' }
>;

export function getSeatWindOf(state: RiichiGameState, seat: number): number {
  return (seat - state.dealer + 4) % 4;
}

/** 该座位视角下每种牌的可见枚数 */
export function visibleCountsFor(
  state: RiichiGameState,
  seat: number,
): VisibleCounts {
  const counts = emptyVisibleCounts();
  addVisible(counts, state.hands[seat]);
  for (const pile of state.discardPiles) addVisible(counts, pile);
  for (const melds of state.melds) {
    for (const meld of melds) addVisible(counts, meld.tiles);
  }
  addVisible(counts, state.doraIndicators);
  return counts;
}

export function opponentViewOf(
  state: RiichiGameState,
  opp: number,
): OpponentView {
  return {
    discards: state.discardPiles[opp],
    safeAfterRiichi: state.riichiSafeTiles[opp],
    riichi: state.riichiDeclared[opp],
    riichiIndex: state.riichiDiscardIndex[opp],
    meldCount: state.melds[opp].filter((m) => m.type !== 'angang').length,
  };
}

/** 对手威胁度：立直 1；多副露 0.3~0.6；庄家加权 */
export function threatOf(state: RiichiGameState, opp: number): number {
  let threat = 0;
  if (state.riichiDeclared[opp]) {
    threat = 1;
  } else {
    const open = state.melds[opp].filter((m) => m.type !== 'angang');
    if (open.length >= 2) threat = 0.3 + 0.15 * (open.length - 2);
    if (open.length >= 3) threat += 0.15;
  }
  if (threat > 0 && opp === state.dealer) threat *= 1.3;
  if (threat > 0 && state.wall.length < 20) threat *= 1.15;
  return threat;
}

export function dangerFor(
  state: RiichiGameState,
  seat: number,
  tile: number,
  visible: VisibleCounts,
): number {
  let danger = 0;
  for (let opp = 0; opp < 4; opp++) {
    if (opp === seat) continue;
    const threat = threatOf(state, opp);
    if (threat <= 0) continue;
    danger +=
      threat * evaluateTileDanger(tile, opponentViewOf(state, opp), visible);
  }
  return danger;
}

function totalThreat(state: RiichiGameState, seat: number): number {
  let sum = 0;
  for (let opp = 0; opp < 4; opp++)
    if (opp !== seat) sum += threatOf(state, opp);
  return sum;
}

function candidateMap(
  cands: DiscardCandidate[],
): Map<number, DiscardCandidate> {
  return new Map(cands.map((c) => [c.base, c]));
}

type Stance = 'attack' | 'balanced' | 'fold';

function chooseStance(
  state: RiichiGameState,
  seat: number,
  bestShanten: number,
  level: RiichiAiLevel,
): Stance {
  if (level === 'beginner') return 'attack';
  const threat = totalThreat(state, seat);
  if (threat <= 0) return 'attack';
  if (bestShanten <= 0) return threat >= 2.2 ? 'balanced' : 'attack';
  if (bestShanten === 1) {
    return state.wall.length >= 24 && threat < 1.2 ? 'balanced' : 'fold';
  }
  return 'fold';
}

function pickDiscard(
  state: RiichiGameState,
  seat: number,
  tiles: readonly number[],
  cands: Map<number, DiscardCandidate>,
  stance: Stance,
  visible: VisibleCounts,
  level: RiichiAiLevel,
): number {
  const hand = state.hands[seat];
  const valueCtx = {
    doraIndicators: state.doraIndicators,
    seatWind: getSeatWindOf(state, seat),
    roundWind: state.roundWind,
  };
  let best = tiles[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const tile of tiles) {
    const cand = cands.get(getBaseTile(tile));
    const shanten = cand?.shanten ?? 8;
    const ukeire = cand?.ukeire ?? 0;
    const efficiency = -shanten * 100 + ukeire;
    const value =
      level === 'beginner' ? 0 : evaluateTileValue(tile, hand, valueCtx);
    const edgeBonus = isYaochuu(tile) ? 0.5 : 0;
    const attackScore = efficiency - value * 4 + edgeBonus;
    const danger =
      stance === 'attack' && level === 'beginner'
        ? 0
        : dangerFor(state, seat, tile, visible);
    const score =
      stance === 'fold'
        ? -danger * 1000 + attackScore * 0.01
        : stance === 'balanced'
          ? attackScore - danger * 60
          : attackScore - danger * 8;
    if (score > bestScore || (score === bestScore && tile > best)) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

function hasYakuWithoutRiichi(
  state: RiichiGameState,
  seat: number,
  hand13: number[],
): boolean {
  const waits = getWaits(hand13, state.melds[seat]);
  if (waits.length === 0) return false;
  const preview: RiichiGameState = {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? hand13 : h)),
  };
  return waits.some((w) => {
    try {
      return evaluateSeatWin({
        state: preview,
        seat,
        isTsumo: false,
        winningTile: w,
        preview: true,
      }).legalWin;
    } catch {
      return false;
    }
  });
}

/** 按可见待牌加权比较默听与立直打点，并考虑余巡、庄位与末局点差。 */
function shouldDeclareRiichi(
  state: RiichiGameState,
  seat: number,
  hand13: number[],
  waitRemaining: number,
  level: RiichiAiLevel,
): boolean {
  if (waitRemaining <= 0) return false;
  if (level === 'beginner') return true;
  const visible = visibleCountsFor(state, seat);
  const preview = {
    ...state,
    hands: state.hands.map((hand, index) => (index === seat ? hand13 : hand)),
  };
  const declared = {
    ...preview,
    riichiDeclared: state.riichiDeclared.map(
      (value, index) => index === seat || value,
    ),
    doubleRiichi: state.doubleRiichi.map((value, index) =>
      index === seat ? state.firstTurn[seat] : value,
    ),
  };
  let damaPoints = 0;
  let riichiPoints = 0;
  let legalDamaCopies = 0;
  for (const winningTile of getWaits(hand13, state.melds[seat])) {
    const copies = remainingOf(getBaseTile(winningTile), visible);
    if (copies === 0) continue;
    const dama = evaluateSeatWin({
      state: preview,
      seat,
      isTsumo: false,
      winningTile,
      preview: true,
    });
    const riichi = evaluateSeatWin({
      state: declared,
      seat,
      isTsumo: false,
      winningTile,
      preview: true,
    });
    damaPoints += dama.totalPoints * copies;
    riichiPoints += riichi.totalPoints * copies;
    if (dama.legalWin) legalDamaCopies += copies;
  }
  if (legalDamaCopies === 0) return true;
  damaPoints /= waitRemaining;
  riichiPoints /= waitRemaining;

  const lastWind = state.matchLength === 'east' ? 0 : 1;
  const allLast =
    state.roundWind > lastWind ||
    (state.roundWind === lastWind && state.roundNumber === 4);
  const score = state.scores[seat];
  const otherScores = state.scores.filter((_, index) => index !== seat);
  const lead = score - Math.max(...otherScores);
  const threat = totalThreat(state, seat);
  if (allLast && lead >= 8000 && threat > 0) return false;

  const unseen = Math.max(
    waitRemaining,
    136 - visible.reduce((sum, count) => sum + count, 0),
  );
  // 仅使用公开信息估计后续摸牌与他家舍牌机会；不读取他家手牌内容。
  const winChance =
    1 - Math.exp((-waitRemaining * state.wall.length * 0.4) / unseen);
  const nextScore = Math.min(...otherScores.filter((points) => points > score));
  const gap = nextScore - score;
  if (allLast && damaPoints < gap && riichiPoints >= gap && winChance >= 0.1)
    return true;
  const valueWeight =
    (seat === state.dealer ? 1.15 : 1) * (allLast && lead < 0 ? 1.35 : 1);
  const addedValue = (riichiPoints - damaPoints) * winChance * valueWeight;
  const stickRisk = 1000 * (1 - winChance);
  const flexibilityCost = threat * (state.wall.length < 20 ? 600 : 300);
  return addedValue > stickRisk + flexibilityCost;
}

export function decideAiTurn(
  state: RiichiGameState,
  seat: number,
  level: RiichiAiLevel,
): TurnEvent | null {
  const opts = state.turnOptions;
  if (state.phase !== 'discard' || state.currentPlayer !== seat || !opts) {
    return null;
  }
  if (opts.tsumo) return { type: 'tsumo', seat };

  const hand = state.hands[seat];
  const melds = state.melds[seat];
  const visible = visibleCountsFor(state, seat);
  const cands = candidateMap(evaluateDiscards(hand, melds, visible));
  const discardable = opts.discardable;
  const bestShanten = Math.min(
    ...discardable.map((t) => cands.get(getBaseTile(t))?.shanten ?? 8),
  );

  if (opts.kyuushu && (level === 'beginner' || bestShanten >= 3)) {
    return { type: 'kyuushu', seat };
  }

  if (state.riichiDeclared[seat]) {
    if (opts.ankan.length > 0)
      return { type: 'ankan', seat, tiles: opts.ankan[0] };
    return { type: 'discard', seat, tile: discardable[0] };
  }

  const stance = chooseStance(state, seat, bestShanten, level);

  if (stance !== 'fold') {
    for (const option of opts.ankan) {
      const rest = removeTiles(hand, option);
      if (!rest) continue;
      const after = getShanten(rest, [
        ...melds,
        { type: 'angang', tiles: option },
      ]);
      if (after <= bestShanten) return { type: 'ankan', seat, tiles: option };
    }
    if (
      stance === 'attack' &&
      opts.kakan.length > 0 &&
      totalThreat(state, seat) === 0
    ) {
      const k = opts.kakan[0];
      return { type: 'kakan', seat, meldIndex: k.meldIndex, tile: k.tile };
    }
  }

  if (opts.riichiDiscards.length > 0 && stance !== 'fold') {
    const choice = pickDiscard(
      state,
      seat,
      opts.riichiDiscards,
      cands,
      stance,
      visible,
      level,
    );
    const hand13 = removeTiles(hand, [choice]);
    const remaining = cands.get(getBaseTile(choice))?.ukeire ?? 0;
    if (hand13 && shouldDeclareRiichi(state, seat, hand13, remaining, level)) {
      return { type: 'riichi', seat, tile: choice };
    }
  }

  const tile = pickDiscard(
    state,
    seat,
    discardable,
    cands,
    stance,
    visible,
    level,
  );
  return { type: 'discard', seat, tile };
}

function allTilesOf(
  hand: readonly number[],
  melds: readonly RiichiMeld[],
): number[] {
  return [...hand, ...melds.flatMap((m) => m.tiles)];
}

function tanyaoPossible(
  tiles: readonly number[],
  hand: readonly number[],
): boolean {
  const meldTiles = tiles.slice(hand.length);
  if (meldTiles.some(isYaochuu)) return false;
  return !hand.some(isYaochuu);
}

function honitsuTendency(tiles: readonly number[]): boolean {
  const suitCounts = [0, 0, 0];
  for (const t of tiles) {
    const b = getBaseTile(t);
    if (b < 27) suitCounts[Math.floor(b / 9)]++;
  }
  const main = suitCounts.indexOf(Math.max(...suitCounts));
  const others = suitCounts.reduce((s, c, i) => (i === main ? s : s + c), 0);
  return others === 0;
}

interface CallPlan {
  response: ClaimResponse;
  shanten: number;
  ukeire: number;
}

function evaluateCall(
  state: RiichiGameState,
  seat: number,
  consumed: number[],
  meld: RiichiMeld,
  forbidden: number[],
  visible: VisibleCounts,
): { shanten: number; ukeire: number } | null {
  const rest = removeTiles(state.hands[seat], consumed);
  if (!rest) return null;
  const melds = [...state.melds[seat], meld];
  const forbiddenSet = new Set(forbidden);
  const cands = evaluateDiscards(rest, melds, visible).filter((candidate) => {
    if (forbiddenSet.has(candidate.base)) return false;
    const discarded = rest.find((tile) => getBaseTile(tile) === candidate.base);
    if (discarded === undefined) return false;
    const hand = removeTiles(rest, [discarded]);
    return (
      hand !== null && callHasYaku(state, seat, hand, melds, candidate.shanten)
    );
  });
  if (cands.length === 0) return null;
  const best = cands.reduce((a, b) =>
    a.shanten !== b.shanten
      ? a.shanten < b.shanten
        ? a
        : b
      : a.ukeire >= b.ukeire
        ? a
        : b,
  );
  return { shanten: best.shanten, ukeire: best.ukeire };
}

function callHasYaku(
  state: RiichiGameState,
  seat: number,
  hand: number[],
  melds: RiichiMeld[],
  shanten: number,
): boolean {
  if (shanten === 0) {
    const preview = {
      ...state,
      hands: state.hands.map((original, index) =>
        index === seat ? hand : original,
      ),
      melds: state.melds.map((original, index) =>
        index === seat ? melds : original,
      ),
    };
    return hasYakuWithoutRiichi(preview, seat, hand);
  }
  const seatWind = getSeatWindOf(state, seat);
  if (
    hand.some(
      (t) =>
        isYakuhaiBase(getBaseTile(t), seatWind, state.roundWind) &&
        hand.filter((x) => getBaseTile(x) === getBaseTile(t)).length >= 3,
    )
  ) {
    return true;
  }
  if (
    melds.some(
      (m) =>
        m.type !== 'chi' &&
        isYakuhaiBase(getBaseTile(m.tiles[0]), seatWind, state.roundWind),
    )
  ) {
    return true;
  }
  const tiles = allTilesOf(hand, melds);
  return tanyaoPossible(tiles, hand) || honitsuTendency(tiles);
}

export function decideAiClaim(
  state: RiichiGameState,
  seat: number,
  level: RiichiAiLevel,
): ClaimResponse {
  const claim = state.claim;
  const options: SeatClaimOptions | null = claim?.options[seat] ?? null;
  if (!claim || !options) return { type: 'pass' };
  if (options.ron) return { type: 'ron' };
  if (state.riichiDeclared[seat]) return { type: 'pass' };

  const hand = state.hands[seat];
  const melds = state.melds[seat];
  const current = getShanten(hand, melds);
  if (level === 'standard' && totalThreat(state, seat) >= 1 && current >= 1) {
    return { type: 'pass' };
  }
  const visible = visibleCountsFor(state, seat);
  const tile = claim.tile;
  const base = getBaseTile(tile);
  const plans: CallPlan[] = [];

  if (options.pon) {
    const taken = takeByBase(hand, base, 2);
    if (taken) {
      const meld: RiichiMeld = {
        type: 'peng',
        tiles: [...taken.taken, tile],
        fromPlayer: claim.from,
      };
      const result = evaluateCall(
        state,
        seat,
        taken.taken,
        meld,
        getKuikaeForbiddenBases(tile, null),
        visible,
      );
      if (result) {
        plans.push({ response: { type: 'pon' }, ...result });
      }
    }
  }
  for (const pair of options.chi) {
    const meld: RiichiMeld = {
      type: 'chi',
      tiles: [...pair, tile],
      fromPlayer: claim.from,
    };
    const result = evaluateCall(
      state,
      seat,
      pair,
      meld,
      getKuikaeForbiddenBases(tile, pair),
      visible,
    );
    if (result) {
      plans.push({ response: { type: 'chi', tiles: pair }, ...result });
    }
  }

  const improving = plans.filter((p) => p.shanten < current);
  if (improving.length === 0) {
    if (
      options.minkan &&
      level === 'standard' &&
      current <= 1 &&
      totalThreat(state, seat) === 0 &&
      isYakuhaiBase(base, getSeatWindOf(state, seat), state.roundWind) &&
      !isMenzhen(melds)
    ) {
      return { type: 'minkan' };
    }
    return { type: 'pass' };
  }
  improving.sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire);
  return improving[0].response;
}
