/**
 * 出牌阶段 AI 摸牌后：自摸判定 / 暗杠 / 立直 / 防守打牌。
 * 由 useRiichiDrawAiFlow 在 currentPlayer !== 0 且 drawnTile !== null 时调用。
 */
import {
  getAngangOptionsRiichi,
  getTileLabel,
  isMenzhen,
} from '@/lib/mahjongRiichi';
import {
  applyAiRiichiState,
  chooseAiDefensiveDiscardWithMeta,
  shouldAiDeclareRiichi,
} from '@/lib/riichiAi';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { SEAT_NAMES } from '../constants';
import { createRiichiWinResult, evaluateGameWin } from '../gameLogic/winResult';
import { clearSeatDoujunStates } from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import { stripLastSettlementWhenRoundVisible } from '../shared/lastSettlementStrip';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';

export function runAiAfterDraw(
  ctx: RiichiRuntimeContext,
  game: RiichiGameState,
  schedule: (fn: () => void, ms: number) => () => void,
  rng: () => number,
): () => void {
  const {
    setGame,
    setWinResult,
    addLogRef,
    sounds,
    getWaitingTilesRiichi,
    getElapsedSecondsForSeat,
    turnClockRef,
  } = ctx;
  const p = game.currentPlayer;

  const cancel = schedule(() => {
    setGame((g) => {
      if (!g || g.currentPlayer !== p || g.drawnTile === null) return g;
      const hand = [...g.hands[p]];
      let tsumoEvaluation: ReturnType<typeof evaluateGameWin>;
      try {
        tsumoEvaluation = evaluateGameWin({
          state: g,
          winner: p,
          isTsumo: true,
          winningTile: g.drawnTile,
        });
      } catch {
        addLogRef.current(`${SEAT_NAMES[p]} 规则计算失败，本次行动已暂停`);
        return g;
      }
      if (tsumoEvaluation.legalWin) {
        addLogRef.current(`${SEAT_NAMES[p]} 自摸！`);
        sounds.playTsumo();
        recordRiichiProgressEvent('win-hand');
        recordRiichiProgressEvent('tsumo-win');
        recordRiichiProgressEvent('finish-round');
        setWinResult(createRiichiWinResult(g, p, true, tsumoEvaluation));
        return g;
      }

      const doAiRiichi = shouldAiDeclareRiichi({
        alreadyRiichi: g.riichiDeclared[p],
        isMenzen: isMenzhen(g.melds[p]),
        score: g.scores[p],
        waitingCount: getWaitingTilesRiichi(hand, g.melds[p], g, {
          seat: p,
          isTsumo: false,
          treatAsRiichi: true,
        }).length,
        random: rng(),
      });

      const angOpts = getAngangOptionsRiichi(hand);
      if (angOpts.length > 0 && g.wall.length >= 2 && rng() < 0.2) {
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
        if (h.length !== 10 || g.wall.length < 2) return g;
        const handAfterKan = [...h];
        const melds = g.melds.map((m, i) =>
          i === p ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
        );
        addLogRef.current(
          `${SEAT_NAMES[p]} 暗杠 ${getTileLabel(fourTiles[0])}`,
        );
        sounds.playKan();
        const elapsed = getElapsedSecondsForSeat(p);
        const timedBanks = g.timeBanks.map((tb, i) =>
          i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
        );
        turnClockRef.current = null;
        const nextState: RiichiGameState = {
          ...g,
          timeBanks: timedBanks,
          hands: g.hands.map((h0, i) => (i === p ? handAfterKan : h0)),
          melds,
          ippatsuPossible: [false, false, false, false],
          furitenStates: clearSeatDoujunStates(g.furitenStates, p),
          currentPlayer: (p + 1) % 4,
          drawnTile: null,
          lastDrawWasRinshan: false,
          phase: 'claim',
          lastDiscard: fourTiles[0],
          lastDiscardFrom: p,
          claimIndex: 0,
          lastClaimMsg: `${SEAT_NAMES[p]} 暗杠 ${getTileLabel(fourTiles[0])}`,
          lastClaimWasKakan: true,
        };
        const cleared = stripLastSettlementWhenRoundVisible(g, nextState);
        const { state: afterAbortive } = applyAbortiveDrawChecks(cleared);
        if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
          addLogRef.current(`流局（${afterAbortive.ryuukyokuReason}）`);
          sounds.playRyuukyoku();
          recordRiichiProgressEvent('finish-round');
          return afterAbortive;
        }
        return cleared;
      }
      const aiRiichiLocked = g.riichiDeclared[p];
      const defensiveChoice = !aiRiichiLocked
        ? chooseAiDefensiveDiscardWithMeta({
            hand,
            aiSeat: p,
            riichiDeclared: g.riichiDeclared,
            discardPiles: g.discardPiles,
            doraIndicators: g.doraIndicators,
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
        ippatsuPossible: (
          g.ippatsuPossible ?? g.riichiDeclared.map(() => false)
        ).map((v, i) => (i === p && doAiRiichi ? true : v)),
        hands: g.hands.map((h, i) => (i === p ? hand : h)),
        discardPiles: piles,
        currentPlayer: next,
        drawnTile: null,
        lastDrawWasRinshan: false,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: p,
        claimIndex: 0,
        lastClaimMsg: doAiRiichi
          ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
          : null,
      };
      const cleared = stripLastSettlementWhenRoundVisible(g, nextState);
      const { state: afterAbortive } = applyAbortiveDrawChecks(cleared);
      if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
        addLogRef.current(`流局（${afterAbortive.ryuukyokuReason}）`);
        sounds.playRyuukyoku();
        recordRiichiProgressEvent('finish-round');
        return afterAbortive;
      }
      return cleared;
    });
  }, 500);
  return cancel;
}
