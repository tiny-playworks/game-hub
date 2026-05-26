import { useCallback } from 'react';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import { shouldAbortOnSuukaikan } from '@/lib/riichiAbortiveDraw';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { canSeatRonByRules, clearSeatDoujunStates } from '../helpers';
import { applyAbortiveDrawChecks } from '../shared/abortiveDrawChecks';
import {
  applyClaimPassToState,
  applyKakanRinshanAfterPass,
} from '../shared/claimTransitions';
import { stripLastSettlementWhenRoundVisible } from '../shared/lastSettlementStrip';
import type { RiichiRuntimeContext } from '../shared/riichiRuntimeContext';
import type { RiichiGameState } from '../types';

export function useRiichiClaimActions(ctx: RiichiRuntimeContext) {
  const { game, setGame, addLog, sounds, consumeSeatTimeBank, turnClockRef } =
    ctx;
  const discard = useCallback(
    (player: number, tile: number) => {
      if (!game || game.phase !== 'discard') return;
      const hands = game.hands.map((h) => [...h]);
      const piles = game.discardPiles.map((p) => [...p]);
      const idx = hands[player].indexOf(tile);
      if (idx === -1) return;
      hands[player].splice(idx, 1);
      piles[player].push(tile);
      addLog(`自家 打出 ${getTileLabel(tile)}`);
      if (player === 0) sounds.playDiscard();
      const nextTimeBanks = consumeSeatTimeBank(game, player);
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...game,
        timeBanks: nextTimeBanks,
        hands,
        discardPiles: piles,
        currentPlayer: (player + 1) % 4,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
        lastClaimMsg: null,
      };
      const cleared = stripLastSettlementWhenRoundVisible(game, nextState);
      const { state: afterAbortive } = applyAbortiveDrawChecks(cleared);
      if (afterAbortive.ryuukyoku && afterAbortive.ryuukyokuReason) {
        addLog(`流局（${afterAbortive.ryuukyokuReason}）`);
        sounds.playRyuukyoku();
        recordRiichiProgressEvent('finish-round');
        setGame(afterAbortive);
        return;
      }
      setGame(cleared);
    },
    [game, addLog, sounds, consumeSeatTimeBank, setGame, turnClockRef],
  );

  const passClaim = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscardFrom === null)
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const passResult = resolveClaimPass(game.claimIndex, game.wall.length);
    const next =
      game.lastClaimWasKakan && passResult.type === 'draw'
        ? applyKakanRinshanAfterPass(game, {
            timeBanks: timedBanks,
            furitenStates: nextFuritenStates,
            lastClaimMsg: null,
          })
        : applyClaimPassToState(game, passResult, {
            timeBanks: timedBanks,
            furitenStates: nextFuritenStates,
            lastClaimMsg: null,
          });
    if (next.ryuukyoku && next.ryuukyokuReason === '荒牌') {
      addLog('流局（荒牌）');
      recordRiichiProgressEvent('finish-round');
    } else {
      addLog('自家 过');
    }
    setGame(next);
  }, [game, addLog, setGame, consumeSeatTimeBank, turnClockRef]);

  const doChi = useCallback(
    (option: [number, number]) => {
      if (
        !game ||
        game.phase !== 'claim' ||
        game.lastDiscard === null ||
        game.lastDiscardFrom === null
      )
        return;
      const ronDeclined = canSeatRonByRules(game, 0);
      const timedBanks = consumeSeatTimeBank(game, 0);
      turnClockRef.current = null;
      const nextFuritenStates = ronDeclined
        ? game.furitenStates.map((s, i) =>
            i === 0
              ? applyRonDeclinedFuriten(
                  s ?? createInitialFuritenState(),
                  game.riichiDeclared[0],
                )
              : s,
          )
        : game.furitenStates;
      const [a, b] = option;
      const hands = game.hands.map((h) => [...h]);
      const melds = game.melds.map((m) => [...m]);
      const h0 = hands[0];
      const ia = h0.indexOf(a);
      const ib = h0.findIndex((x, i) => i !== ia && x === b);
      if (ia === -1 || ib === -1) return;
      const hi = Math.max(ia, ib);
      const lo = Math.min(ia, ib);
      h0.splice(hi, 1);
      h0.splice(lo, 1);
      const meldTiles = [a, b, game.lastDiscard].sort(
        (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
      );
      melds[0] = [
        ...melds[0],
        {
          type: 'chi' as const,
          tiles: meldTiles,
          fromPlayer: game.lastDiscardFrom,
        },
      ];
      const piles = game.discardPiles.map((q) => [...q]);
      if (piles[game.lastDiscardFrom].length > 0)
        piles[game.lastDiscardFrom].pop();
      addLog(`自家 吃 ${meldTiles.map(getTileLabel).join('')}`);
      sounds.playChi();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        hands,
        melds,
        discardPiles: piles,
        ippatsuPossible: [false, false, false, false],
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        lastClaimMsg: null,
      });
    },
    [game, addLog, sounds, consumeSeatTimeBank, setGame, turnClockRef],
  );

  const doPeng = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 2; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 2) return;
    const tiles = [game.lastDiscard, h0[indices[0]], h0[indices[1]]];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'peng' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog('自家 碰');
    sounds.playPon();
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: nextFuritenStates,
      hands,
      melds,
      discardPiles: piles,
      ippatsuPossible: [false, false, false, false],
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds, consumeSeatTimeBank, setGame, turnClockRef]);

  const doMingang = useCallback(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      game.lastDiscard === null ||
      game.wall.length === 0
    )
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 3; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 3) return;
    if (game.wall.length < 2) return;
    const tiles = [game.lastDiscard, ...indices.map((i) => h0[i])];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const handAfterKan = [...h0];
    const rinshan = game.wall[0];
    const kanDoraIndicator = game.wall[1];
    const newWall = game.wall.slice(2);
    const newDoraIndicators = [...game.doraIndicators, kanDoraIndicator];
    h0.push(rinshan);
    h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'mingang' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog(`自家 明杠 ${getTileLabel(game.lastDiscard)}`);
    sounds.playKan();
    if (shouldAbortOnSuukaikan(melds)) {
      addLog('流局（四开杠）');
      sounds.playRyuukyoku();
      recordRiichiProgressEvent('finish-round');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
        hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
        melds,
        discardPiles: piles,
        wall: newWall,
        doraIndicators: newDoraIndicators,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        drawnTile: null,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '四开杠',
      });
      return;
    }
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
      hands,
      melds,
      discardPiles: piles,
      wall: newWall,
      doraIndicators: newDoraIndicators,
      ippatsuPossible: [false, false, false, false],
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      drawnTile: rinshan,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds, consumeSeatTimeBank, setGame, turnClockRef]);

  return {
    discard,
    passClaim,
    doChi,
    doPeng,
    doMingang,
  };
}
