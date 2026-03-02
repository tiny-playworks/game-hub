import type { AbortiveDrawReason } from '@/lib/riichiAbortiveDraw';
import {
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
  shouldAbortOnSuukaikan,
} from '@/lib/riichiAbortiveDraw';
import type { RiichiGameState } from '../types';

/** 检查顺序：四家立直 → 四风连打 → 四开杠（先命中先返回）。 */
export function applyAbortiveDrawChecks(state: RiichiGameState): {
  state: RiichiGameState;
  ryuukyokuReason?: AbortiveDrawReason;
} {
  if (shouldAbortOnSuuchaRiichi(state.riichiDeclared)) {
    return {
      state: {
        ...state,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        ryuukyoku: true,
        ryuukyokuReason: '四家立直',
      },
      ryuukyokuReason: '四家立直',
    };
  }
  if (shouldAbortOnSuufonRenda(state.discardPiles, state.melds)) {
    return {
      state: {
        ...state,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        ryuukyoku: true,
        ryuukyokuReason: '四风连打',
      },
      ryuukyokuReason: '四风连打',
    };
  }
  if (shouldAbortOnSuukaikan(state.melds)) {
    return {
      state: {
        ...state,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        ryuukyoku: true,
        ryuukyokuReason: '四开杠',
      },
      ryuukyokuReason: '四开杠',
    };
  }
  return { state };
}
