import { useEffect } from 'react';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { SEAT_NAMES } from '../constants';
import { countTotalTilesHeld } from '../helpers';
import { applyDrawOneTile } from '../shared/drawFlowTransitions';
import { getRng, getScheduler } from '../shared/flowDeps';
import { stripLastSettlementWhenRoundVisible } from '../shared/lastSettlementStrip';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';
import { runAiAfterDraw } from './drawAiFlowAfterDraw';

interface DrawAiFlowOpts {
  /** 可选：注入 rng/schedule 便于测试 */
  flowDeps?: import('../shared/flowDeps').RiichiFlowDeps | null;
}

export function useRiichiDrawAiFlow(
  ctx: RiichiRuntimeContext,
  opts?: DrawAiFlowOpts,
) {
  const {
    game,
    winResult,
    setGame,
    addLog,
    sounds,
    getElapsedSecondsForSeat,
    turnClockRef,
  } = ctx;
  const rng = getRng(opts?.flowDeps);
  const schedule = getScheduler(opts?.flowDeps);

  // 荒牌：人类第一巡摸牌前牌墙已空
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.ryuukyoku ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length !== 0 ||
      game.hands[0].length !== 13
    )
      return;
    addLog('流局（荒牌）');
    sounds.playRyuukyoku();
    recordRiichiProgressEvent('finish-round');
    setGame((g) =>
      !g ? g : { ...g, ryuukyoku: true, ryuukyokuReason: '荒牌' },
    );
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall?.length,
    game?.hands?.[0]?.length,
    game?.ryuukyoku,
    game,
    addLog,
    sounds,
    setGame,
    winResult,
  ]);

  // 人类摸牌（从牌墙摸一张）
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[0].length !== 13
    )
      return;
    sounds.playDraw();
    setGame((g) => (!g ? g : applyDrawOneTile(g, 0)));
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game?.hands[0]?.length,
    game,
    sounds,
    setGame,
    winResult,
  ]);

  // AI 摸牌（从牌墙摸一张）
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[game.currentPlayer].length !== 13
    )
      return;
    const p = game.currentPlayer;
    setGame((g) => (!g ? g : applyDrawOneTile(g, p)));
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game,
    setGame,
    winResult,
  ]);

  // AI 吃/碰后打出：门前+副露合计 14 张且未标记摸牌（与 needsDiscardDecision 一致）
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      countTotalTilesHeld(game, game.currentPlayer) !== 14
    )
      return;
    const p = game.currentPlayer;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'discard' ||
        g.currentPlayer !== p ||
        g.drawnTile !== null
      )
        return g;
      const hp = g.hands[p];
      if (countTotalTilesHeld(g, p) !== 14) return g;
      const hand = [...hp];
      const toDiscard = hand[0];
      hand.shift();
      addLog(`${SEAT_NAMES[p]} 打出 ${getTileLabel(toDiscard)}`);
      sounds.playDiscard();
      const piles = g.discardPiles.map((q) => [...q]);
      piles[p].push(toDiscard);
      const elapsed = getElapsedSecondsForSeat(p);
      const nextTimeBanks = g.timeBanks.map((tb, i) =>
        i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...g,
        timeBanks: nextTimeBanks,
        hands: g.hands.map((h, i) => (i === p ? hand : h)),
        discardPiles: piles,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: p,
        claimIndex: 0,
        currentPlayer: (p + 1) % 4,
        lastClaimMsg: null,
      };
      return stripLastSettlementWhenRoundVisible(g, nextState);
    });
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.hands,
    game,
    addLog,
    sounds,
    getElapsedSecondsForSeat,
    setGame,
    turnClockRef,
    winResult,
  ]);

  // AI 摸牌后：自摸 / 暗杠 / 立直 / 打牌（延迟执行）
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (winResult) return;
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile === null
    )
      return;
    const cancel = runAiAfterDraw(ctx, game, schedule, rng);
    return () => cancel();
    // winResult：结算弹窗期间不得继续 AI 摸打；deps 刻意不含 ctx/schedule/rng，与既有粒度一致
  }, [game?.currentPlayer, game?.drawnTile, game, winResult]);
}
