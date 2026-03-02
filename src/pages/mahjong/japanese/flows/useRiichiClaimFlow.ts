import { useEffect } from 'react';
import {
  calcFu,
  calcScore,
  canMingangRiichi,
  canPengRiichi,
  computeYaku,
  getBaseTile,
  getChiOptionsRiichi,
  getTileLabel,
  getTotalHan,
  hasYaku,
  isWinShapeRiichi,
} from '@/lib/mahjongRiichi';
import {
  canAiRonOnClaim,
  chooseAiClaimActionAgainstRiichi,
  shouldAiFoldClaimAgainstRiichi,
} from '@/lib/riichiAi';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import { SEAT_NAMES } from '../constants';
import { enrichWinResultWithUra } from '../gameLogic/winResult';
import { clearSeatDoujunStates, getSeatWind } from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import { applyClaimPassToState } from '../shared/claimTransitions';
import { getRng, getScheduler } from '../shared/flowDeps';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';

type IsSeatFuriten = (seat: number, state: RiichiGameState) => boolean;

interface ClaimFlowExtra {
  claimPlayer: number | null;
  hasAnyClaimOption: boolean;
  canRon: boolean;
  isSeatFuriten: IsSeatFuriten;
  flowDeps?: import('../shared/flowDeps').RiichiFlowDeps | null;
}

export function useRiichiClaimFlow(
  ctx: RiichiRuntimeContext,
  extra: ClaimFlowExtra,
) {
  const { game, setGame, setWinResult, addLogRef, sounds, buildYakuCtx } = ctx;
  const { claimPlayer, hasAnyClaimOption, canRon, isSeatFuriten, flowDeps } =
    extra;
  const rng = getRng(flowDeps);
  const schedule = getScheduler(flowDeps);
  useEffect(() => {
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
      const next = applyClaimPassToState(g, passResult);
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
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer === null ||
      claimPlayer === 0 ||
      canRon
    )
      return;
    const p = claimPlayer;
    const last = game.lastDiscard;
    const from = game.lastDiscardFrom;
    if (last === null || from === null) return;
    const hand = game.hands[p];
    const handWithClaim = [...hand, last];
    const ronCtx = buildYakuCtx(p, handWithClaim, false);
    const furitenBlocked = isSeatFuriten(p, game);
    const aiCanRon = canAiRonOnClaim({
      fromPlayer: from,
      aiSeat: p,
      isWinShape: isWinShapeRiichi(handWithClaim, game.melds[p]),
      hasYaku: (ronCtx ? hasYaku(ronCtx) : false) && !furitenBlocked,
    });
    const aiRiichiLocked = game.riichiDeclared[p];
    const foldClaimByRiichi =
      !aiRiichiLocked &&
      shouldAiFoldClaimAgainstRiichi({
        aiSeat: p,
        riichiDeclared: game.riichiDeclared,
      });
    const chiOpts = aiRiichiLocked
      ? []
      : getChiOptionsRiichi(hand, last, from, p);
    const peng = aiRiichiLocked ? false : canPengRiichi(hand, last);
    const gang =
      aiRiichiLocked || foldClaimByRiichi
        ? false
        : canMingangRiichi(hand, last);
    const claimDefensePlan = foldClaimByRiichi
      ? chooseAiClaimActionAgainstRiichi({
          aiSeat: p,
          hand,
          chiOptions: chiOpts,
          canPeng: peng,
          lastTile: last,
          riichiDeclared: game.riichiDeclared,
          discardPiles: game.discardPiles,
          doraIndicators: game.doraIndicators,
          seatWind: getSeatWind(game.roundWind, p, game.dealer),
          roundWind: game.roundWind,
        })
      : null;
    const forcedChiOption =
      claimDefensePlan?.action === 'chi' ? claimDefensePlan.chiOption : null;
    const forcedPengDiscard =
      claimDefensePlan?.action === 'peng' ? claimDefensePlan.discardTile : null;
    const allowRandomClaim = !foldClaimByRiichi;
    const cancel = schedule(() => {
      if (aiCanRon) {
        const yaku = ronCtx ? computeYaku(ronCtx) : [];
        const han = getTotalHan(yaku);
        const fu = calcFu({
          isTsumo: false,
          isMenzhen: game.melds[p].every((m) => m.type === 'angang'),
          hasPinfu: yaku.some((y) => y.id === 'pinfu'),
          isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
        });
        addLogRef.current(`${SEAT_NAMES[p]} 荣和 ${getTileLabel(last)}！`);
        sounds.playRon();
        const ten = calcScore(fu, han, game.dealer === p, false);
        const enriched = enrichWinResultWithUra({
          state: game,
          winner: p,
          isTsumo: false,
          handWithWin: handWithClaim,
          yaku,
          han,
          fu,
          ten,
        });
        setWinResult({
          winner: p,
          isTsumo: false,
          yaku: enriched.yaku,
          han: enriched.han,
          fu: enriched.fu,
          ten: enriched.ten,
          uraHan: enriched.uraHan,
          uraDoraIndicators: enriched.uraDoraIndicators,
        });
        return;
      }
      if (
        (forcedChiOption || chiOpts.length > 0) &&
        (forcedChiOption || (allowRandomClaim && rng() < 0.6))
      ) {
        const [a, b] = forcedChiOption ?? chiOpts[0];
        const hands = game.hands.map((h) => [...h]);
        const melds = game.melds.map((m) => [...m]);
        const hp = hands[p];
        const ia = hp.indexOf(a);
        const ib = hp.indexOf(b);
        if (ia !== -1 && ib !== -1) {
          hp.splice(Math.max(ia, ib), 1);
          hp.splice(Math.min(ia, ib), 1);
          melds[p] = [
            ...melds[p],
            {
              type: 'chi' as const,
              tiles: [a, b, last].sort(
                (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
              ),
              fromPlayer: from,
            },
          ];
          const pilesChi = game.discardPiles.map((q) => [...q]);
          if (pilesChi[from].length > 0) pilesChi[from].pop();
          const plannedDiscard =
            claimDefensePlan?.action === 'chi'
              ? claimDefensePlan.discardTile
              : null;
          const discardIdx =
            plannedDiscard !== null ? hp.indexOf(plannedDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? hp[discardIdx] : hp[0];
          if (discardIdx >= 0) hp.splice(discardIdx, 1);
          else hp.shift();
          pilesChi[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'chi' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesChi,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      if (
        (forcedPengDiscard !== null || peng) &&
        (forcedPengDiscard !== null || (allowRandomClaim && rng() < 0.4))
      ) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 2; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 2) {
          const tiles = [last, h[indices[0]], h[indices[1]]];
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'peng' as const, tiles }] : m,
          );
          const pilesPeng = game.discardPiles.map((q) => [...q]);
          if (pilesPeng[from].length > 0) pilesPeng[from].pop();
          const discardIdx =
            forcedPengDiscard !== null ? h.indexOf(forcedPengDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? h[discardIdx] : h[0];
          if (discardIdx >= 0) h.splice(discardIdx, 1);
          else h.shift();
          pilesPeng[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'peng' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesPeng,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      if (gang && rng() < 0.3 && game.wall.length >= 2) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 3; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 3) {
          const tiles = [last, ...indices.map((i) => h[i])];
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const handAfterKan = [...h];
          const rinshan = game.wall[0];
          const kanDoraIndicator = game.wall[1];
          const newWall = game.wall.slice(2);
          const newDoraIndicators = [...game.doraIndicators, kanDoraIndicator];
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'mingang' as const, tiles }] : m,
          );
          const pilesGang = game.discardPiles.map((q) => [...q]);
          if (pilesGang[from].length > 0) pilesGang[from].pop();
          addLogRef.current(`${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`);
          const stateForAbortive: RiichiGameState = {
            ...game,
            hands: game.hands.map((h0, i) => (i === p ? handAfterKan : h0)),
            melds,
            discardPiles: pilesGang,
            wall: newWall,
            doraIndicators: newDoraIndicators,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
            drawnTile: null,
            lastClaimMsg: null,
          };
          const { state: afterAbortive } =
            applyAbortiveDrawChecks(stateForAbortive);
          if (
            afterAbortive.ryuukyoku &&
            afterAbortive.ryuukyokuReason === '四开杠'
          ) {
            addLogRef.current('流局（四开杠）');
            sounds.playRyuukyoku();
            setGame(afterAbortive);
            return;
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesGang,
            wall: newWall,
            doraIndicators: newDoraIndicators,
            furitenStates: clearSeatDoujunStates(game.furitenStates, p),
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
            drawnTile: rinshan,
            lastClaimMsg: `${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      addLogRef.current(
        foldClaimByRiichi
          ? `${SEAT_NAMES[p]} 过（${claimDefensePlan?.reason || '他家立直，防守优先'}）`
          : `${SEAT_NAMES[p]} 过`,
      );
      setGame((g) => {
        if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        const next = applyClaimPassToState(g, passResult);
        if (next.ryuukyoku && next.ryuukyokuReason === '荒牌') {
          addLogRef.current('流局（荒牌）');
        }
        return next;
      });
    }, 400);
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
  ]);
}
