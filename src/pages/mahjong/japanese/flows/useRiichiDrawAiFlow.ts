import { useEffect } from 'react';
import {
  calcFu,
  calcScore,
  computeYaku,
  getAngangOptionsRiichi,
  getBaseTile,
  getTotalHan,
  hasYaku,
  isWinShapeRiichi,
} from '@/lib/mahjongRiichi';
import {
  applyAiRiichiState,
  chooseAiDefensiveDiscardWithMeta,
  shouldAiDeclareRiichi,
} from '@/lib/riichiAi';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import { SEAT_NAMES } from '../constants';
import { enrichWinResultWithUra } from '../gameLogic/winResult';
import { clearSeatDoujunStates } from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import { getRng, getScheduler } from '../shared/flowDeps';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';

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
    setWinResult,
    addLog,
    addLogRef,
    sounds,
    buildYakuCtx,
    getWaitingTilesRiichi,
    getElapsedSecondsForSeat,
    turnClockRef,
  } = ctx;
  const rng = getRng(opts?.flowDeps);
  const schedule = getScheduler(opts?.flowDeps);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
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
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[0].push(draw);
    newHands[0].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, 0),
          },
    );
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game?.hands[0]?.length,
    game,
    sounds,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
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
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[p].push(draw);
    newHands[p].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, p),
          },
    );
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length, game]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile === null
    )
      return;
    const p = game.currentPlayer;
    const cancel = schedule(() => {
      setGame((g) => {
        if (!g || g.currentPlayer !== p || g.drawnTile === null) return g;
        const hand = [...g.hands[p]];
        const tsumoCtx = buildYakuCtx(p, hand, true);
        if (
          isWinShapeRiichi(hand, g.melds[p]) &&
          tsumoCtx &&
          hasYaku(tsumoCtx)
        ) {
          const yaku = computeYaku(tsumoCtx);
          const han = getTotalHan(yaku);
          const fu = calcFu({
            isTsumo: true,
            isMenzhen: g.melds[p].every((m) => m.type === 'angang'),
            hasPinfu: yaku.some((y) => y.id === 'pinfu'),
            isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
          });
          addLogRef.current(`${SEAT_NAMES[p]} 自摸！`);
          sounds.playTsumo();
          const ten = calcScore(fu, han, g.dealer === p, true);
          const enriched = enrichWinResultWithUra({
            state: g,
            winner: p,
            isTsumo: true,
            handWithWin: hand,
            yaku,
            han,
            fu,
            ten,
          });
          setWinResult({
            winner: p,
            isTsumo: true,
            yaku: enriched.yaku,
            han: enriched.han,
            fu: enriched.fu,
            ten: enriched.ten,
            uraHan: enriched.uraHan,
            uraDoraIndicators: enriched.uraDoraIndicators,
          });
          return g;
        }

        const doAiRiichi = shouldAiDeclareRiichi({
          alreadyRiichi: g.riichiDeclared[p],
          isMenzen: g.melds[p].every((m) => m.type === 'angang'),
          score: g.scores[p],
          waitingCount: getWaitingTilesRiichi(hand, g.melds[p], g, {
            seat: p,
            isTsumo: false,
            treatAsRiichi: true,
          }).length,
          random: rng(),
        });

        const angOpts = getAngangOptionsRiichi(hand);
        if (angOpts.length > 0 && g.wall.length > 0 && rng() < 0.2) {
          const fourTiles = [...angOpts[0]];
          const consumed = [...fourTiles];
          const h = hand.filter((t) => {
            const i = consumed.indexOf(t);
            if (i >= 0) {
              consumed.splice(i, 1);
              return false;
            }
            return true;
          });
          if (h.length !== 10) return g;
          const rinshan = g.wall[0];
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const aiRiichiLocked = g.riichiDeclared[p];
          const defensiveChoice = !aiRiichiLocked
            ? chooseAiDefensiveDiscardWithMeta({
                hand: h,
                aiSeat: p,
                riichiDeclared: g.riichiDeclared,
                discardPiles: g.discardPiles,
                doraIndicators: [g.doraIndicator],
              })
            : null;
          const defensiveDiscard = defensiveChoice?.tile ?? null;
          const toDiscard = aiRiichiLocked
            ? rinshan
            : (defensiveDiscard ?? rinshan);
          const idx = h.indexOf(toDiscard);
          if (idx === -1) return g;
          h.splice(idx, 1);
          const melds = g.melds.map((m, i) =>
            i === p ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
          );
          const piles = g.discardPiles.map((q) => [...q]);
          piles[p].push(toDiscard);
          if (
            !aiRiichiLocked &&
            defensiveChoice &&
            defensiveChoice.tile !== null &&
            defensiveChoice.reason
          ) {
            addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
          }
          if (doAiRiichi) {
            addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
            sounds.playRiichi();
          }
          const elapsed = getElapsedSecondsForSeat(p);
          const timedBanks = g.timeBanks.map((tb, i) =>
            i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
          );
          turnClockRef.current = null;
          const nextRiichi = doAiRiichi
            ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
            : null;
          const nextState: RiichiGameState = {
            ...g,
            timeBanks: timedBanks,
            scores: nextRiichi?.scores ?? g.scores,
            riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
            riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
            hands: g.hands.map((h0, i) => (i === p ? h : h0)),
            melds,
            wall: g.wall.slice(1),
            discardPiles: piles,
            currentPlayer: (p + 1) % 4,
            drawnTile: null,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            lastClaimMsg: doAiRiichi
              ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
              : null,
          };
          const { state: afterAbortive } = applyAbortiveDrawChecks(nextState);
          if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
            addLogRef.current(`流局（${afterAbortive.ryuukyokuReason}）`);
            sounds.playRyuukyoku();
            return afterAbortive;
          }
          return nextState;
        }
        const aiRiichiLocked = g.riichiDeclared[p];
        const defensiveChoice = !aiRiichiLocked
          ? chooseAiDefensiveDiscardWithMeta({
              hand,
              aiSeat: p,
              riichiDeclared: g.riichiDeclared,
              discardPiles: g.discardPiles,
              doraIndicators: [g.doraIndicator],
            })
          : null;
        const defensiveDiscard = defensiveChoice?.tile ?? null;
        const toDiscard = aiRiichiLocked
          ? g.drawnTile
          : (defensiveDiscard ?? g.drawnTile);
        const idx = hand.indexOf(toDiscard);
        if (idx === -1) return g;
        hand.splice(idx, 1);
        const piles = g.discardPiles.map((q) => [...q]);
        piles[p].push(toDiscard);
        const next = (p + 1) % 4;
        if (
          !aiRiichiLocked &&
          defensiveChoice &&
          defensiveChoice.tile !== null &&
          defensiveChoice.reason
        ) {
          addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
        }
        if (doAiRiichi) {
          addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
          sounds.playRiichi();
        }
        const elapsed = getElapsedSecondsForSeat(p);
        const timedBanks = g.timeBanks.map((tb, i) =>
          i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
        );
        turnClockRef.current = null;
        const nextRiichi = doAiRiichi
          ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
          : null;
        const nextState: RiichiGameState = {
          ...g,
          timeBanks: timedBanks,
          scores: nextRiichi?.scores ?? g.scores,
          riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
          riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
          hands: g.hands.map((h, i) => (i === p ? hand : h)),
          discardPiles: piles,
          currentPlayer: next,
          drawnTile: null,
          phase: 'claim',
          lastDiscard: toDiscard,
          lastDiscardFrom: p,
          claimIndex: 0,
          lastClaimMsg: doAiRiichi
            ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
            : null,
        };
        const { state: afterAbortive } = applyAbortiveDrawChecks(nextState);
        if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
          addLogRef.current(`流局（${afterAbortive.ryuukyokuReason}）`);
          sounds.playRyuukyoku();
          return afterAbortive;
        }
        return nextState;
      });
    }, 500);
    return () => cancel();
  }, [game?.currentPlayer, game?.drawnTile, game]);
}
