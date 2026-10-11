import type { RiichiWinResult } from '@/pages/mahjong/japanese/types';

export type ScoreTier =
  | 'mangan'
  | 'haneman'
  | 'baiman'
  | 'sanbaiman'
  | 'yakuman'
  | 'doubleYakuman';

/** Use the same basic-point cap as settlement, including 3 han 70 fu. */
export function getScoreTier(
  win: Pick<RiichiWinResult, 'han' | 'fu' | 'yakuman'>,
): ScoreTier | null {
  if (win.yakuman >= 2) return 'doubleYakuman';
  if (win.yakuman > 0 || win.han >= 13) return 'yakuman';
  if (win.han >= 11) return 'sanbaiman';
  if (win.han >= 8) return 'baiman';
  if (win.han >= 6) return 'haneman';
  if (win.han >= 5 || win.fu * 2 ** (win.han + 2) >= 2000) return 'mangan';
  return null;
}

export const BONUS_YAKU_IDS = new Set(['53', '54']);

export function winTimeline(wins: RiichiWinResult[]) {
  const yakuCount = Math.max(
    0,
    ...wins.map(
      (win) => win.yaku.filter((yaku) => !BONUS_YAKU_IDS.has(yaku.id)).length,
    ),
  );
  const bonusAt = 400 + yakuCount * 180;
  const scoreAt = bonusAt + 300;
  return { bonusAt, scoreAt, finalAt: scoreAt + 400 };
}

/** Pull exactly one winning tile out of the sorted hand, preserving red fives. */
export function winningHand(
  win: Pick<RiichiWinResult, 'hand' | 'winningTile'>,
) {
  const tiles = [...win.hand];
  const index = tiles.lastIndexOf(win.winningTile);
  if (index >= 0) tiles.splice(index, 1);
  return tiles;
}
