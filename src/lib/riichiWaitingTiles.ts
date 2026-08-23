import { analyzeRiichiHand } from '@/lib/riichiRules';

/** 听牌计算所需场况；暂保留以兼容现有调用点。结构分析不依赖场况。 */
export type RiichiWaitingTilesGameSlice = {
  roundWind: number;
  dealer: number;
  riichiDeclared: boolean[];
};

export type RiichiMeldLike = {
  type: 'chi' | 'peng' | 'mingang' | 'angang' | 'kakan';
  tiles: number[];
};

/**
 * 纯牌形听牌：不把役、立直或自摸条件混入待牌集合。
 * 13 张逻辑牌返回当前待牌；14 张逻辑牌返回所有能打到听牌的弃牌选项之并集。
 */
export function computeWaitingTilesRiichi(
  hand: number[],
  melds: RiichiMeldLike[],
  _gameState?: RiichiWaitingTilesGameSlice | null,
  _options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
): number[] {
  const logicalTileCount = hand.length + melds.length * 3;
  // 吃碰后的短暂行牌状态可能不是 13/14 张；这不是规则引擎故障。
  if (logicalTileCount !== 13 && logicalTileCount !== 14) return [];

  const analysis = analyzeRiichiHand({ hand, melds });
  if (analysis.discardOptions.length === 0) {
    return analysis.shanten === 0 ? analysis.effectiveTiles : [];
  }
  const waiting = new Set<number>();
  for (const option of analysis.discardOptions) {
    if (option.shanten !== 0) continue;
    for (const tile of option.effectiveTiles) waiting.add(tile);
  }
  return [...waiting].sort((a, b) => a - b);
}
