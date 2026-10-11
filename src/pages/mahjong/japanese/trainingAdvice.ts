import { getBaseTile } from '@/lib/mahjongRiichi';
import { analyzeRiichiHand } from '@/lib/riichiRules';
import { countRemaining, remainingOf } from '@/lib/riichiShanten';
import { dangerFor, threatOf, visibleCountsFor } from './engine/ai';
import { getSeatTurnOptions } from './engine/selectors';
import type { RiichiGameState } from './types';

export function getTrainingAdvice(
  state: RiichiGameState,
  riichiSelecting = false,
) {
  if (state.phase === 'end') return null;
  const visible = visibleCountsFor(state, 0);
  const analysis = analyzeRiichiHand({
    hand: state.hands[0],
    melds: state.melds[0],
  });
  const turn = getSeatTurnOptions(state, 0);
  const discardable = [
    ...((riichiSelecting ? turn?.riichiDiscards : turn?.discardable) ?? []),
  ].sort((a, b) => a - b);
  const hasThreat = [1, 2, 3].some((seat) => threatOf(state, seat) > 0);
  const candidates = turn
    ? analysis.discardOptions
        .flatMap((option) => {
          // 同牌型优先保留赤牌；只建议引擎允许打出的实际手牌。
          const tile = discardable.find(
            (tile) => getBaseTile(tile) === option.discard,
          );
          if (tile === undefined) return [];
          return [
            {
              tile,
              shanten: option.shanten,
              effectiveTiles: option.effectiveTiles,
              ukeire: countRemaining(option.effectiveTiles, visible),
              danger: hasThreat ? dangerFor(state, 0, tile, visible) : null,
            },
          ];
        })
        .sort(
          (a, b) =>
            a.shanten - b.shanten ||
            b.ukeire - a.ukeire ||
            (a.danger ?? 0) - (b.danger ?? 0) ||
            a.tile - b.tile,
        )
        .slice(0, 3)
    : [];
  const best = candidates[0];
  return {
    shanten: best?.shanten ?? analysis.shanten,
    ukeire: best?.ukeire ?? countRemaining(analysis.effectiveTiles, visible),
    effectiveTiles: analysis.effectiveTiles,
    candidates,
    locked: state.riichiDeclared[0],
    remaining: (tile: number) => remainingOf(getBaseTile(tile), visible),
  };
}

export type TrainingAdvice = ReturnType<typeof getTrainingAdvice>;

/** The replay uses only the player's hand and information visible at that step. */
export function getDiscardAdvice(
  state: RiichiGameState,
  tile: number,
  analysis = analyzeRiichiHand({ hand: state.hands[0], melds: state.melds[0] }),
) {
  const option = analysis.discardOptions.find(
    (item) => item.discard === getBaseTile(tile),
  );
  if (!option) return null;
  const visible = visibleCountsFor(state, 0);
  return {
    shanten: option.shanten,
    ukeire: countRemaining(option.effectiveTiles, visible),
    danger: dangerFor(state, 0, tile, visible, 'expert'),
  };
}

export type ReviewReason = 'shanten' | 'ukeire' | 'dealIn' | 'riichi' | 'dama';

export function reviewReasonMessage(reason: ReviewReason) {
  return `riichi.review.reason.${reason}`;
}
