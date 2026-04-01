/**
 * 出牌阶段 AI 摸牌后：自摸判定 / 暗杠 / 立直 / 防守打牌。
 * 由 useRiichiDrawAiFlow 在 currentPlayer !== 0 且 drawnTile !== null 时调用。
 */
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
import {
  buildRiichiInput,
  calcWithRiichiRs,
  type GameStateForRs,
} from '@/lib/riichiRsAdapter';
import { SEAT_NAMES } from '../constants';
import { enrichWinResultWithUra } from '../gameLogic/winResult';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
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
    buildYakuCtx,
    getWaitingTilesRiichi,
    getElapsedSecondsForSeat,
    turnClockRef,
  } = ctx;
  const p = game.currentPlayer;

  const cancel = schedule(() => {
    setGame((g) => {
      if (!g || g.currentPlayer !== p || g.drawnTile === null) return g;
      const hand = [...g.hands[p]];
      const tsumoCtx = buildYakuCtx(p, hand, true);
      if (isWinShapeRiichi(hand, g.melds[p]) && tsumoCtx && hasYaku(tsumoCtx)) {
        const stateForRs: GameStateForRs = {
          hand,
          melds: g.melds[p],
          doraIndicators: g.doraIndicators,
          roundWind: g.roundWind,
          dealer: g.dealer,
          riichiDeclared: g.riichiDeclared,
          wallLength: g.wall.length,
          lastDiscard: g.lastDiscard,
          ippatsu: g.riichiDeclared[p] && (g.ippatsuPossible?.[p] ?? false),
          winnerSeat: p,
        };
        const rs = calcWithRiichiRs(buildRiichiInput(stateForRs, true));
        const yaku = rs && rs.yaku.length > 0 ? rs.yaku : computeYaku(tsumoCtx);
        const han = rs && rs.yaku.length > 0 ? rs.han : getTotalHan(yaku);
        const fu =
          rs && rs.yaku.length > 0
            ? rs.fu
            : calcFu({
                isTsumo: true,
                isMenzhen: g.melds[p].every((m) => m.type === 'angang'),
                hasPinfu: yaku.some((y) => y.id === 'pinfu'),
                isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
              });
        addLogRef.current(`${SEAT_NAMES[p]} 自摸！`);
        sounds.playTsumo();
        const ten =
          rs && rs.yaku.length > 0
            ? rs.ten
            : calcScore(fu, han, g.dealer === p, true);
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
        const rinshan = g.wall[0];
        const kanDoraIndicator = g.wall[1];
        const newWall = g.wall.slice(2);
        const newDoraIndicators = [...g.doraIndicators, kanDoraIndicator];
        h.push(rinshan);
        h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
        const aiRiichiLocked = g.riichiDeclared[p];
        const defensiveChoice = !aiRiichiLocked
          ? chooseAiDefensiveDiscardWithMeta({
              hand: h,
              aiSeat: p,
              riichiDeclared: g.riichiDeclared,
              discardPiles: g.discardPiles,
              doraIndicators: g.doraIndicators,
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
          ippatsuPossible: (
            g.ippatsuPossible ?? g.riichiDeclared.map(() => false)
          ).map((v, i) => (i === p ? true : v)),
          hands: g.hands.map((h0, i) => (i === p ? h : h0)),
          melds,
          wall: newWall,
          doraIndicators: newDoraIndicators,
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
  return cancel;
}
