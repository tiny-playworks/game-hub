import {
  getBaseTile,
  getDoraFromIndicator,
  isAkaFive,
  isMenzhen,
  isYaochuu,
} from '@/lib/mahjongRiichi';
import type { CharacterStyle } from '@/lib/playerCharacters';
import { rankSeatsByScore, resolveRiichiMatchEnd } from '@/lib/riichiGameEnd';
import { remainingOf, type VisibleCounts } from '@/lib/riichiShanten';
import type { RiichiGameState, RiichiMeld } from '../types';
import { evaluateSeatWin } from './evaluate';
import { getWaits } from './hand';
import { DEFAULT_RIICHI_RULES, type RiichiRuleConfig } from './rules';

/** 不读他家手牌。副露同色且牌河明显避开该色，才视为染手信号。 */
export function suspectedFlushSuit(
  state: RiichiGameState,
  seat: number,
): number | null {
  const open = state.melds[seat].filter((meld) => meld.type !== 'angang');
  const suits = new Set(
    open
      .flatMap((meld) => meld.tiles)
      .map(getBaseTile)
      .filter((base) => base < 27)
      .map((base) => Math.floor(base / 9)),
  );
  const river = state.discardPiles[seat].map(getBaseTile);
  if (suits.size !== 1 || river.length < 4) return null;
  const suit = [...suits][0];
  return river.filter((base) => base < 27 && Math.floor(base / 9) === suit)
    .length <=
    river.length * 0.15
    ? suit
    : null;
}

/** 未听牌时的保守打点估计；只计已形成的役和宝牌，宝牌本身不提供役。 */
export function estimateHandPoints(
  state: RiichiGameState,
  seat: number,
  hand = state.hands[seat],
  melds: RiichiMeld[] = state.melds[seat],
): number {
  const all = [...hand, ...melds.flatMap((meld) => meld.tiles)];
  const bases = all.map(getBaseTile);
  let yaku = isMenzhen(melds) ? 1 : 0; // 门清可走立直路线
  if (all.every((tile) => !isYaochuu(tile))) yaku++;
  for (let base = 27; base < 34; base++) {
    if (bases.filter((tile) => tile === base).length < 3) continue;
    if (base >= 31) yaku++;
    if (base === 27 + ((seat - state.dealer + 4) % 4)) yaku++;
    if (base === 27 + state.roundWind) yaku++;
  }
  const suits = new Set(
    bases.filter((base) => base < 27).map((base) => Math.floor(base / 9)),
  );
  if (suits.size === 1 && bases.filter((base) => base < 27).length >= 8) {
    yaku += bases.some((base) => base >= 27)
      ? isMenzhen(melds)
        ? 3
        : 2
      : isMenzhen(melds)
        ? 6
        : 5;
  }
  if (yaku === 0) return 0;
  const doras = state.doraIndicators.map(getDoraFromIndicator);
  const han =
    yaku +
    all.reduce(
      (sum, tile) =>
        sum +
        Number(isAkaFive(tile)) +
        doras.filter((dora) => dora === getBaseTile(tile)).length,
      0,
    );
  const points =
    han >= 13
      ? 32000
      : han >= 11
        ? 24000
        : han >= 8
          ? 16000
          : han >= 6
            ? 12000
            : han >= 5
              ? 8000
              : han === 4
                ? 7700
                : han === 3
                  ? 3900
                  : han === 2
                    ? 2000
                    : 1000;
  return points * (seat === state.dealer ? 1.5 : 1);
}

export interface AttackOutlook {
  points: number;
  waitTypes: number;
  remaining: number;
}

/** 听牌时实际按可见待牌加权；不依赖里宝、对手手牌或牌山内容。 */
export function attackOutlook(
  state: RiichiGameState,
  seat: number,
  hand: number[],
  shanten: number,
  visible: VisibleCounts,
  rules = DEFAULT_RIICHI_RULES,
): AttackOutlook {
  if (shanten !== 0)
    return {
      points: estimateHandPoints(state, seat, hand),
      waitTypes: 0,
      remaining: 0,
    };
  const preview = {
    ...state,
    hands: state.hands.map((original, index) =>
      index === seat ? hand : original,
    ),
    riichiDeclared: state.riichiDeclared.map((original, index) =>
      index === seat
        ? isMenzhen(state.melds[seat]) &&
          state.scores[seat] >= 1000 &&
          state.wall.length >= 4
        : original,
    ),
  };
  let points = 0;
  let remaining = 0;
  let waitTypes = 0;
  for (const winningTile of getWaits(hand, state.melds[seat])) {
    const copies = remainingOf(getBaseTile(winningTile), visible);
    if (!copies) continue;
    const win = evaluateSeatWin({
      state: preview,
      seat,
      isTsumo: false,
      winningTile,
      preview: true,
      rules,
    });
    if (!win.legalWin) continue;
    points += copies * win.totalPoints;
    remaining += copies;
    waitTypes++;
  }
  return { points: remaining ? points / remaining : 0, waitTypes, remaining };
}

/** 和了是否足以收场，以及非直击情况下改善顺位所需的最低收入。 */
export function positionOutlook(
  state: RiichiGameState,
  seat: number,
  points = 0,
  rules: RiichiRuleConfig = DEFAULT_RIICHI_RULES,
) {
  const ranking = rankSeatsByScore(state.scores);
  const place = ranking.indexOf(seat);
  const lastWind = state.matchLength === 'east' ? 0 : 1;
  const late =
    state.roundWind >= (state.matchLength === 'south' ? 1 : 0) &&
    (state.matchLength === 'south' ||
      state.roundWind > 0 ||
      state.roundNumber >= 3);
  const allLast =
    state.roundWind > lastWind ||
    (state.roundWind === lastWind && state.roundNumber === 4);
  const ahead = place > 0 ? ranking[place - 1] : null;
  const needed =
    ahead === null
      ? 0
      : state.scores[ahead] - state.scores[seat] + (seat > ahead ? 100 : 0);
  const projected = state.scores.map((score, index) =>
    index === seat
      ? score + points + state.riichiPot + state.honba * 300
      : score,
  );
  const ends =
    allLast &&
    resolveRiichiMatchEnd({
      scores: projected,
      roundWind: state.roundWind,
      roundNumber: state.roundNumber,
      dealer: state.dealer,
      dealerStays: seat === state.dealer,
      dealerWon: seat === state.dealer,
      matchLength: state.matchLength,
      rules: rules.matchEnd,
    }).end;
  return {
    late,
    allLast,
    place,
    needed,
    leading: late && place === 0,
    needsValue:
      late &&
      place === 3 &&
      points + state.riichiPot + state.honba * 300 < needed,
    unchangedFinish:
      ends && place > 0 && rankSeatsByScore(projected).indexOf(seat) === place,
  };
}

export function advancedStance(
  state: RiichiGameState,
  seat: number,
  shanten: number,
  attack: AttackOutlook,
  threat: number,
  expert: boolean,
  style?: CharacterStyle,
  rules = DEFAULT_RIICHI_RULES,
): 'attack' | 'balanced' | 'fold' {
  if (threat <= 0) return 'attack';
  const position = positionOutlook(state, seat, attack.points, rules);
  if (expert && position.leading) {
    if (shanten > 0 || attack.waitTypes < 2 || attack.points < 3900)
      return 'fold';
    return 'balanced';
  }
  const pressure = threat * (0.85 + (style?.defenseBias ?? 0.5) * 0.3);
  const mangan = seat === state.dealer ? 12000 : 8000;
  if (shanten >= 1) {
    if (attack.points < mangan || shanten >= 2 || state.wall.length < 16)
      return 'fold';
    return pressure < 1.8 ? 'balanced' : 'fold';
  }
  if (attack.remaining === 0) return 'fold';
  if (attack.waitTypes >= 2) return pressure >= 2.2 ? 'balanced' : 'attack';
  if (attack.points < mangan && (state.wall.length < 24 || pressure >= 1.8))
    return 'fold';
  return 'balanced';
}
