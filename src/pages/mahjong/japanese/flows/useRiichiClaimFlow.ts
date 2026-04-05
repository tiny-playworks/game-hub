import { useEffect } from 'react';
import {
  canMingangRiichi,
  canPengRiichi,
  getChiOptionsRiichi,
} from '@/lib/mahjongRiichi';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import {
  applyClaimPassToState,
  applyKakanRinshanAfterPass,
} from '../shared/claimTransitions';
import { getRng, getScheduler } from '../shared/flowDeps';
import type {
  ClaimFlowExtra,
  RiichiRuntimeContext,
} from '../shared/riichiRuntimeContext';
import { runAiClaimPhase } from './claimFlowAi';

export type { ClaimFlowExtra } from '../shared/riichiRuntimeContext';

export function useRiichiClaimFlow(
  ctx: RiichiRuntimeContext,
  extra: ClaimFlowExtra,
) {
  const { game, winResult, setGame, addLogRef } = ctx;
  const { claimPlayer, hasAnyClaimOption, canRon, flowDeps } = extra;
  const rng = getRng(flowDeps);
  const schedule = getScheduler(flowDeps);

  // 人类（seat 0）无任何可选项时自动过
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer !== 0 ||
      hasAnyClaimOption
    )
      return;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'claim' ||
        g.lastDiscardFrom === null ||
        g.lastDiscard === null
      )
        return g;
      const lastTile = g.lastDiscard;
      const chiOpts = getChiOptionsRiichi(
        g.hands[0],
        lastTile,
        g.lastDiscardFrom,
        0,
      );
      const peng = canPengRiichi(g.hands[0], lastTile);
      const gang = canMingangRiichi(g.hands[0], lastTile);
      if (chiOpts.length > 0 || peng || gang) return g;
      const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
      const next =
        g.lastClaimWasKakan && passResult.type === 'draw'
          ? applyKakanRinshanAfterPass(g)
          : applyClaimPassToState(g, passResult);
      if (next.ryuukyoku && next.ryuukyokuReason === '荒牌') {
        addLogRef.current('流局（荒牌）');
      }
      return next;
    });
  }, [
    game?.phase,
    game?.claimIndex,
    game?.lastDiscardFrom,
    claimPlayer,
    hasAnyClaimOption,
    game,
    setGame,
    addLogRef,
    winResult,
  ]);

  // AI（claimPlayer 1/2/3）要牌：延迟后执行决策
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer === null ||
      claimPlayer === 0 ||
      canRon
    )
      return;
    const cancel = runAiClaimPhase(ctx, extra, game, schedule, rng);
    return () => cancel();
  }, [
    game?.phase,
    game?.claimIndex,
    claimPlayer,
    canRon,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.discardPiles?.map,
    game?.hands?.map,
    game?.wall?.slice,
    game?.wall?.length,
    game?.wall?.[0],
    game?.hands?.[claimPlayer ?? 0],
    game,
    winResult,
  ]);
}
