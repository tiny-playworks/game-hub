import { getBaseTile } from '@/lib/mahjongRiichi';
import { clearSeatDoujunStates } from '../helpers';
import type { RiichiGameState } from '../types';

/**
 * 纯函数：某家从牌墙摸一张牌，更新 hands/wall/drawnTile/ippatsuPossible/furitenStates。
 * 用于 DrawAiFlow 人类与 AI 摸牌，避免重复逻辑。
 */
export function applyDrawOneTile(
  g: RiichiGameState,
  seat: number,
): RiichiGameState {
  const draw = g.wall[0];
  const newWall = g.wall.slice(1);
  const newHands = g.hands.map((h) => [...h]);
  newHands[seat].push(draw);
  newHands[seat].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
  const ippatsuPossible = (
    g.ippatsuPossible ?? g.riichiDeclared.map(() => false)
  ).map((v, i) => (i === seat ? false : v));
  const furitenStates = clearSeatDoujunStates(g.furitenStates, seat);
  return {
    ...g,
    hands: newHands,
    wall: newWall,
    drawnTile: draw,
    lastDrawWasRinshan: false,
    ippatsuPossible,
    furitenStates,
  };
}
