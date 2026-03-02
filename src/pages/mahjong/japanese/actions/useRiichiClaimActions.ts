import { type RefObject, useCallback } from 'react';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import {
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
  shouldAbortOnSuukaikan,
} from '@/lib/riichiAbortiveDraw';
import { resolveClaimPass } from '@/lib/riichiClaimFlow';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import { canSeatRonByRules, clearSeatDoujunStates } from '../helpers';
import type { RiichiGameState } from '../types';

type SetGame = (
  updater:
    | RiichiGameState
    | null
    | ((prev: RiichiGameState | null) => RiichiGameState | null),
) => void;

type UseRiichiClaimActionsParams = {
  game: RiichiGameState | null;
  setGame: SetGame;
  addLog: (msg: string) => void;
  sounds: {
    playDiscard: () => void;
    playChi: () => void;
    playPon: () => void;
    playKan: () => void;
    playRyuukyoku: () => void;
  };
  consumeSeatTimeBank: (state: RiichiGameState, seat: number) => number[];
  turnClockRef: RefObject<{ player: number; startedAt: number } | null>;
};

export function useRiichiClaimActions({
  game,
  setGame,
  addLog,
  sounds,
  consumeSeatTimeBank,
  turnClockRef,
}: UseRiichiClaimActionsParams) {
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
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
        lastClaimMsg: null,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLog('流局（四家立直）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        });
        return;
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLog('流局（四风连打）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        });
        return;
      }
      setGame(nextState);
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
    if (passResult.type === 'next') {
      addLog('自家 过');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        claimIndex: passResult.nextClaimIndex,
        lastClaimMsg: null,
      });
      return;
    }
    const nextPlayer = (game.lastDiscardFrom + 1) % 4;
    if (passResult.type === 'ryuukyoku') {
      addLog('流局（荒牌）');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '荒牌',
      });
      return;
    }
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[nextPlayer].push(draw);
    newHands[nextPlayer].sort(
      (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
    );
    setGame({
      ...game,
      timeBanks: timedBanks,
      hands: newHands,
      wall: newWall,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: nextPlayer,
      drawnTile: draw,
      lastClaimMsg: null,
    });
  }, [game, addLog, consumeSeatTimeBank, setGame, turnClockRef]);

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
      const ib = h0.indexOf(b);
      if (ia === -1 || ib === -1) return;
      h0.splice(Math.max(ia, ib), 1);
      h0.splice(Math.min(ia, ib), 1);
      melds[0] = [
        ...melds[0],
        {
          type: 'chi' as const,
          tiles: [a, b, game.lastDiscard].sort(
            (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
          ),
          fromPlayer: game.lastDiscardFrom,
        },
      ];
      const piles = game.discardPiles.map((q) => [...q]);
      if (piles[game.lastDiscardFrom].length > 0)
        piles[game.lastDiscardFrom].pop();
      addLog(`自家 吃 ${getTileLabel(a)}${getTileLabel(b)}`);
      sounds.playChi();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        hands,
        melds,
        discardPiles: piles,
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
    const tiles = [game.lastDiscard, ...indices.map((i) => h0[i])];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const handAfterKan = [...h0];
    const rinshan = game.wall[0];
    const newWall = game.wall.slice(1);
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
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
        hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
        melds,
        discardPiles: piles,
        wall: game.wall,
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
