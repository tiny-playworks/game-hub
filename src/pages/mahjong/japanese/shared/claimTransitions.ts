import { getBaseTile } from '@/lib/mahjongRiichi';
import type { ClaimPassResolution } from '@/lib/riichiClaimFlow';
import { clearSeatDoujunStates } from '../helpers';
import type { RiichiGameState } from '../types';

export interface ApplyClaimPassOptions {
  timeBanks?: number[];
  furitenStates?: RiichiGameState['furitenStates'];
  lastClaimMsg?: string | null;
}

/**
 * 纯函数：根据要牌阶段「过」的结果，得到下一状态。
 * 用于人类自动过、超时自动过等路径，避免在 flow/action 中重复分支。
 */
export function applyClaimPassToState(
  g: RiichiGameState,
  passResult: ClaimPassResolution,
  opts?: ApplyClaimPassOptions,
): RiichiGameState {
  const timeBanks = opts?.timeBanks ?? g.timeBanks;
  const furitenStates = opts?.furitenStates ?? g.furitenStates;
  const lastClaimMsg = opts?.lastClaimMsg ?? null;
  const fromPlayer = g.lastDiscardFrom ?? 0;
  const nextPlayer = (fromPlayer + 1) % 4;

  if (passResult.type === 'next') {
    return {
      ...g,
      timeBanks,
      furitenStates,
      claimIndex: passResult.nextClaimIndex,
      lastClaimMsg,
    };
  }

  if (passResult.type === 'ryuukyoku') {
    return {
      ...g,
      timeBanks,
      furitenStates,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: nextPlayer,
      lastClaimMsg,
      ryuukyoku: true,
      ryuukyokuReason: '荒牌',
    };
  }

  // passResult.type === 'draw'
  const draw = g.wall[0];
  const newWall = g.wall.slice(1);
  const newHands = g.hands.map((h) => [...h]);
  newHands[nextPlayer].push(draw);
  newHands[nextPlayer].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
  const ippatsuPossible = (
    g.ippatsuPossible ?? g.riichiDeclared.map(() => false)
  ).map((v, i) => (i === nextPlayer ? false : v));
  return {
    ...g,
    timeBanks,
    hands: newHands,
    wall: newWall,
    ippatsuPossible,
    furitenStates: clearSeatDoujunStates(furitenStates, nextPlayer),
    phase: 'discard',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
    currentPlayer: nextPlayer,
    drawnTile: draw,
    lastClaimMsg,
  };
}

/**
 * 加杠后全员过：加杠者摸岭上牌，翻杠宝牌，进入打牌阶段。
 * 仅在 lastClaimWasKakan 且 wall.length >= 2 时使用。
 */
export function applyKakanRinshanAfterPass(
  g: RiichiGameState,
  opts?: ApplyClaimPassOptions,
): RiichiGameState {
  const timeBanks = opts?.timeBanks ?? g.timeBanks;
  const furitenStates = opts?.furitenStates ?? g.furitenStates;
  const kanPlayer = g.lastDiscardFrom ?? 0;
  if (g.wall.length < 2) return g;
  const rinshan = g.wall[0];
  const kanDoraIndicator = g.wall[1];
  const newWall = g.wall.slice(2);
  const newDoraIndicators = [...g.doraIndicators, kanDoraIndicator];
  const newHands = g.hands.map((h) => [...h]);
  newHands[kanPlayer].push(rinshan);
  newHands[kanPlayer].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
  return {
    ...g,
    timeBanks,
    furitenStates: clearSeatDoujunStates(furitenStates, kanPlayer),
    hands: newHands,
    wall: newWall,
    doraIndicators: newDoraIndicators,
    ippatsuPossible: [false, false, false, false],
    phase: 'discard',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
    currentPlayer: kanPlayer,
    drawnTile: rinshan,
    lastClaimMsg: null,
    lastClaimWasKakan: undefined,
  };
}
