/**
 * 要牌阶段 AI 决策与状态更新：荣和 / 吃 / 碰 / 明杠 / 过。
 * 由 useRiichiClaimFlow 在 claimPlayer !== 0 时调用，避免主 flow 文件体积过大。
 */
import {
  canMingangRiichi,
  canPengRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getTileLabel,
} from '@/lib/mahjongRiichi';
import {
  canAiRonOnClaim,
  chooseAiClaimActionAgainstRiichi,
  shouldAiFoldClaimAgainstRiichi,
} from '@/lib/riichiAi';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { SEAT_NAMES } from '../constants';
import { createRiichiWinResult, evaluateGameWin } from '../gameLogic/winResult';
import { clearSeatDoujunStates, getSeatWind } from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import {
  applyClaimPassToState,
  applyKakanRinshanAfterPass,
} from '../shared/claimTransitions';
import type {
  ClaimFlowExtra,
  RiichiRuntimeContext,
} from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';

export function runAiClaimPhase(
  ctx: RiichiRuntimeContext,
  extra: ClaimFlowExtra,
  game: RiichiGameState,
  schedule: (fn: () => void, ms: number) => () => void,
  rng: () => number,
): () => void {
  const { setGame, setWinResult, addLogRef, sounds } = ctx;
  const p = extra.claimPlayer;
  const isSeatFuriten = extra.isSeatFuriten;
  if (p === null) return () => {};
  const seat = p;
  const last = game.lastDiscard;
  const from = game.lastDiscardFrom;
  if (last === null || from === null) return () => {};

  const hand = game.hands[seat];
  const onlyRonAllowed = game.lastClaimWasKakan ?? false;
  const furitenBlocked = isSeatFuriten(seat, game);
  let ronEvaluation: ReturnType<typeof evaluateGameWin>;
  try {
    ronEvaluation = evaluateGameWin({
      state: game,
      winner: seat,
      isTsumo: false,
      winningTile: last,
      afterKan: game.lastClaimWasKakan ?? false,
    });
  } catch {
    addLogRef.current(`${SEAT_NAMES[seat]} 规则计算失败，本次响应已暂停`);
    return () => {};
  }
  const aiCanRon = canAiRonOnClaim({
    fromPlayer: from,
    aiSeat: seat,
    isWinShape: ronEvaluation.structuralAgari,
    hasYaku: ronEvaluation.legalWin && !furitenBlocked,
  });
  const aiRiichiLocked = game.riichiDeclared[seat];
  const foldClaimByRiichi =
    !aiRiichiLocked &&
    shouldAiFoldClaimAgainstRiichi({
      aiSeat: seat,
      riichiDeclared: game.riichiDeclared,
    });
  const chiOpts =
    aiRiichiLocked || onlyRonAllowed
      ? []
      : getChiOptionsRiichi(hand, last, from, seat);
  const peng =
    aiRiichiLocked || onlyRonAllowed ? false : canPengRiichi(hand, last);
  const gang =
    aiRiichiLocked || onlyRonAllowed || foldClaimByRiichi
      ? false
      : canMingangRiichi(hand, last);
  const claimDefensePlan = foldClaimByRiichi
    ? onlyRonAllowed
      ? null
      : chooseAiClaimActionAgainstRiichi({
          aiSeat: seat,
          hand,
          chiOptions: chiOpts,
          canPeng: peng,
          lastTile: last,
          riichiDeclared: game.riichiDeclared,
          discardPiles: game.discardPiles,
          doraIndicators: game.doraIndicators,
          seatWind: getSeatWind(game.roundWind, seat, game.dealer),
          roundWind: game.roundWind,
        })
    : null;
  const forcedChiOption =
    claimDefensePlan?.action === 'chi' ? claimDefensePlan.chiOption : null;
  const forcedPengDiscard =
    claimDefensePlan?.action === 'peng' ? claimDefensePlan.discardTile : null;
  const allowRandomClaim = !foldClaimByRiichi && !onlyRonAllowed;

  const cancel = schedule(() => {
    if (aiCanRon) {
      addLogRef.current(`${SEAT_NAMES[seat]} 荣和 ${getTileLabel(last)}！`);
      sounds.playRon();
      recordRiichiProgressEvent('win-hand');
      recordRiichiProgressEvent('finish-round');
      setWinResult(createRiichiWinResult(game, seat, false, ronEvaluation));
      return;
    }
    if (
      (forcedChiOption || chiOpts.length > 0) &&
      (forcedChiOption || (allowRandomClaim && rng() < 0.6))
    ) {
      const [a, b] = forcedChiOption ?? chiOpts[0];
      const hands = game.hands.map((h) => [...h]);
      const melds = game.melds.map((m) => [...m]);
      const hp = hands[seat];
      const ia = hp.indexOf(a);
      const ib = hp.findIndex((x, i) => i !== ia && x === b);
      if (ia !== -1 && ib !== -1) {
        const hi = Math.max(ia, ib);
        const lo = Math.min(ia, ib);
        hp.splice(hi, 1);
        hp.splice(lo, 1);
        const meldTiles = [a, b, last].sort(
          (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
        );
        melds[seat] = [
          ...melds[seat],
          {
            type: 'chi' as const,
            tiles: meldTiles,
            fromPlayer: from,
          },
        ];
        const pilesChi = game.discardPiles.map((q) => [...q]);
        if (pilesChi[from].length > 0) pilesChi[from].pop();
        // 与人类 doChi 一致：只完成副露，手牌 11 张；打牌由 useRiichiDrawAiFlow 的 11 张分支处理。
        addLogRef.current(
          `${SEAT_NAMES[seat]} 吃 ${meldTiles.map((t) => getTileLabel(t)).join('')}`,
        );
        sounds.playChi();
        if (claimDefensePlan?.action === 'chi' && claimDefensePlan.reason) {
          addLogRef.current(`${SEAT_NAMES[seat]} ${claimDefensePlan.reason}`);
        }
        setGame({
          ...game,
          hands,
          melds,
          discardPiles: pilesChi,
          ippatsuPossible: [false, false, false, false],
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: seat,
          lastClaimMsg: null,
          drawnTile: null,
          lastDrawWasRinshan: false,
          lastClaimWasKakan: undefined,
        });
        return;
      }
    }
    if (
      (forcedPengDiscard !== null || peng) &&
      (forcedPengDiscard !== null || (allowRandomClaim && rng() < 0.4))
    ) {
      const base = getBaseTile(last);
      const h = [...game.hands[seat]];
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
        const hands = game.hands.map((h0, i) => (i === seat ? h : h0));
        const melds = game.melds.map((m, i) =>
          i === seat ? [...m, { type: 'peng' as const, tiles }] : m,
        );
        const pilesPeng = game.discardPiles.map((q) => [...q]);
        if (pilesPeng[from].length > 0) pilesPeng[from].pop();
        // 与人类 doPeng 一致：只完成副露，手牌 11 张；打牌由 useRiichiDrawAiFlow 的 11 张分支处理。
        addLogRef.current(`${SEAT_NAMES[seat]} 碰`);
        sounds.playPon();
        if (claimDefensePlan?.action === 'peng' && claimDefensePlan.reason) {
          addLogRef.current(`${SEAT_NAMES[seat]} ${claimDefensePlan.reason}`);
        }
        setGame({
          ...game,
          hands,
          melds,
          discardPiles: pilesPeng,
          ippatsuPossible: [false, false, false, false],
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: seat,
          lastClaimMsg: null,
          drawnTile: null,
          lastDrawWasRinshan: false,
          lastClaimWasKakan: undefined,
        });
        return;
      }
    }
    if (gang && rng() < 0.3 && game.wall.length >= 2) {
      const base = getBaseTile(last);
      const h = [...game.hands[seat]];
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
        const hands = game.hands.map((h0, i) => (i === seat ? h : h0));
        const melds = game.melds.map((m, i) =>
          i === seat ? [...m, { type: 'mingang' as const, tiles }] : m,
        );
        const pilesGang = game.discardPiles.map((q) => [...q]);
        if (pilesGang[from].length > 0) pilesGang[from].pop();
        addLogRef.current(`${SEAT_NAMES[seat]} 杠了 ${getTileLabel(last)}`);
        const stateForAbortive: RiichiGameState = {
          ...game,
          hands: game.hands.map((h0, i) => (i === seat ? handAfterKan : h0)),
          melds,
          discardPiles: pilesGang,
          wall: newWall,
          doraIndicators: newDoraIndicators,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: seat,
          drawnTile: null,
          lastDrawWasRinshan: false,
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
          recordRiichiProgressEvent('finish-round');
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
          ippatsuPossible: [false, false, false, false],
          furitenStates: clearSeatDoujunStates(game.furitenStates, seat),
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: seat,
          drawnTile: rinshan,
          lastDrawWasRinshan: true,
          lastClaimMsg: `${SEAT_NAMES[seat]} 杠了 ${getTileLabel(last)}`,
        });
        return;
      }
    }
    addLogRef.current(
      foldClaimByRiichi
        ? `${SEAT_NAMES[seat]} 过（${claimDefensePlan?.reason || '他家立直，防守优先'}）`
        : `${SEAT_NAMES[seat]} 过`,
    );
    setGame((g) => {
      if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
      const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
      const next =
        g.lastClaimWasKakan && passResult.type === 'draw'
          ? applyKakanRinshanAfterPass(g)
          : applyClaimPassToState(g, passResult);
      if (next.ryuukyoku && next.ryuukyokuReason === '荒牌') {
        addLogRef.current('流局（荒牌）');
        recordRiichiProgressEvent('finish-round');
      }
      return next;
    });
  }, 400);
  return cancel;
}
