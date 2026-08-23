/** 副露中牌张总数（含暗杠 4 张） */
export function sumMeldTileCount(melds: { tiles: number[] }[]): number {
  return melds.reduce((s, m) => s + m.tiles.length, 0);
}

/**
 * 副露在和牌牌形中占用的逻辑张数。
 *
 * 杠子虽然实际持有 4 张牌，但在「四面子一雀头」的牌形里仍只占一个
 * 3 张面子；不能用物理牌张数推导门前应有张数。
 */
export function sumMeldShapeTileCount(melds: { tiles: number[] }[]): number {
  return melds.length * 3;
}

/**
 * 听牌时门前应有张数：手牌 + 副露 = 13（未摸和了牌）
 * tc = 13 - M
 */
export function tenpaiConcealedCount(melds: { tiles: number[] }[]): number {
  return 13 - sumMeldShapeTileCount(melds);
}

/**
 * 摸牌后出牌阶段门前应有张数：手牌 + 副露 = 14
 */
export function afterDrawConcealedCount(melds: { tiles: number[] }[]): number {
  return 14 - sumMeldShapeTileCount(melds);
}

/** 从 n 个位置中选 k 个索引的所有组合（字典序） */
export function combinationsOfSize(n: number, k: number): number[][] {
  if (k < 0 || k > n) return [];
  if (k === 0) return [[]];
  const out: number[][] = [];
  const path: number[] = [];
  function dfs(start: number) {
    if (path.length === k) {
      out.push([...path]);
      return;
    }
    for (let i = start; i < n; i++) {
      path.push(i);
      dfs(i + 1);
      path.pop();
    }
  }
  dfs(0);
  return out;
}

/** 按索引降序移除，避免 splice 错位 */
export function removeHandIndices(hand: number[], indices: number[]): number[] {
  const sorted = [...indices].sort((a, b) => b - a);
  const copy = [...hand];
  for (const idx of sorted) {
    copy.splice(idx, 1);
  }
  return copy;
}

/**
 * 枚举「从当前门前手牌打出 extra 张后」所有长度为 tc 的门前牌组（extra = hand.length - tc）。
 * extra < 0 时返回 []。
 */
export function enumerateTenpaiConcealedStates(
  hand: number[],
  melds: { tiles: number[] }[],
): number[][] {
  const tc = tenpaiConcealedCount(melds);
  const extra = hand.length - tc;
  if (extra < 0) return [];
  if (extra === 0) return [hand];
  const out: number[][] = [];
  for (const idxCombo of combinationsOfSize(hand.length, extra)) {
    out.push(removeHandIndices(hand, idxCombo));
  }
  return out;
}
