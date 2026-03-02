import { useEffect } from 'react';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import { applyDrawOneTile } from '../shared/drawFlowTransitions';
import { getRng, getScheduler } from '../shared/flowDeps';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
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
  ]);

  // 人类摸牌（从牌墙摸一张）
  useEffect(() => {
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
  ]);

  // AI 摸牌（从牌墙摸一张）
  useEffect(() => {
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
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length, game, setGame]);

  // AI 要牌后打出（11 张时立即打一张）
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.hands[game.currentPlayer].length !== 11
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
      if (hp.length !== 11) return g;
      const hand = [...hp];
      const toDiscard = hand[0];
      hand.shift();
      const piles = g.discardPiles.map((q) => [...q]);
      piles[p].push(toDiscard);
      const elapsed = getElapsedSecondsForSeat(p);
      const nextTimeBanks = g.timeBanks.map((tb, i) =>
        i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      turnClockRef.current = null;
      return {
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
    });
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.hands,
    game,
    getElapsedSecondsForSeat,
    setGame,
    turnClockRef,
  ]);

  // AI 摸牌后：自摸 / 暗杠 / 立直 / 打牌（延迟执行）
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile === null
    )
      return;
    const cancel = runAiAfterDraw(ctx, game, schedule, rng);
    return () => cancel();
  }, [game?.currentPlayer, game?.drawnTile, game]);
}
