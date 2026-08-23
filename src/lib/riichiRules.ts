import { calc, type RiichiResult } from 'riichi-rs-bundlers';
import { getBaseTile } from '@/lib/mahjongRiichi';
import {
  buildRiichiHairiInput,
  buildRiichiInput,
  type GameStateForRs,
  rsHairiTileToOur,
  rsResultToYakuList,
} from '@/lib/riichiRsAdapter';

export type RiichiRulesMeld = GameStateForRs['melds'][number];

export interface RiichiDiscardAnalysis {
  /** 弃牌的本项目基础牌 id（赤五在结构分析中归一为普通五） */
  discard: number;
  shanten: number;
  effectiveTiles: number[];
  isOptimal: boolean;
}

export interface RiichiHandAnalysis {
  /** -1 为已和牌，0 为听牌；其余为通常意义的向听数。 */
  shanten: number;
  /** 13 张逻辑牌时的进张；14 张逻辑牌时为空，改看 discardOptions。 */
  effectiveTiles: number[];
  /** 14 张逻辑牌时列出所有不同牌型的弃牌结果。 */
  discardOptions: RiichiDiscardAnalysis[];
}

export interface AnalyzeRiichiHandInput {
  /** 只包含门前部分；副露牌不得重复放入 hand。 */
  hand: number[];
  melds?: RiichiRulesMeld[];
}

export interface RiichiYakuResult {
  id: string;
  name: string;
  han: number;
}

export interface RiichiWinEvaluation {
  structuralAgari: boolean;
  legalWin: boolean;
  yaku: RiichiYakuResult[];
  fu: number;
  han: number;
  yakuman: number;
  totalPoints: number;
  uraDoraHan: number;
  /** WASM 的 (庄家支付或庄家自摸时全员支付, 闲家支付)；荣和时为 null。 */
  tsumoPayments: { dealerOrAll: number; nonDealer: number } | null;
}

export interface EvaluateRiichiWinInput {
  state: GameStateForRs;
  isTsumo: boolean;
  /** 荣和牌或自摸牌；自摸时用于把该牌移动到 closed_part 末尾。 */
  winningTile: number;
  /** 立直和牌时参与同一次 WASM 计算的里宝牌表示牌。 */
  uraDoraIndicators?: number[];
}

export class RiichiRulesError extends Error {
  override readonly name = 'RiichiRulesError';
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

function normalizeHairiResult(result: RiichiResult): {
  shanten: number;
  effectiveTiles: number[];
} {
  if (!result.hairi) {
    if (result.is_agari) return { shanten: -1, effectiveTiles: [] };
    throw new RiichiRulesError('riichi-rs returned no hairi analysis');
  }
  return {
    shanten: result.hairi.now,
    effectiveTiles: [...new Set(result.hairi.wait.map(rsHairiTileToOur))].sort(
      (a, b) => a - b,
    ),
  };
}

function analyzeThirteenTileState(
  hand: number[],
  melds: RiichiRulesMeld[],
): { shanten: number; effectiveTiles: number[] } {
  try {
    return normalizeHairiResult(calc(buildRiichiHairiInput(hand, melds)));
  } catch (error) {
    if (error instanceof RiichiRulesError) throw error;
    throw new RiichiRulesError('riichi-rs hand analysis failed', error);
  }
}

function removeFirstBaseTile(hand: number[], base: number): number[] {
  const index = hand.findIndex((tile) => getBaseTile(tile) === base);
  if (index < 0) {
    throw new RiichiRulesError(`Tile ${base} is not present in the hand`);
  }
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

/**
 * 使用 riichi-rs 的 calc_hairi 做纯牌形分析。
 * 杠按一个三张逻辑面子计数，因此一组副露后的合法门前张数为 10/11，
 * 无论该副露是吃碰还是四张杠。
 */
export function analyzeRiichiHand(
  input: AnalyzeRiichiHandInput,
): RiichiHandAnalysis {
  const melds = input.melds ?? [];
  const logicalTileCount = input.hand.length + melds.length * 3;
  if (logicalTileCount !== 13 && logicalTileCount !== 14) {
    throw new RiichiRulesError(
      `Expected 13 or 14 logical tiles, got ${logicalTileCount}`,
    );
  }

  if (logicalTileCount === 13) {
    const analysis = analyzeThirteenTileState(input.hand, melds);
    return { ...analysis, discardOptions: [] };
  }

  const discardTypes = [...new Set(input.hand.map(getBaseTile))].sort(
    (a, b) => a - b,
  );
  const rawOptions = discardTypes.map((discard) => {
    const analysis = analyzeThirteenTileState(
      removeFirstBaseTile(input.hand, discard),
      melds,
    );
    return { discard, ...analysis };
  });
  const bestShanten = Math.min(...rawOptions.map((option) => option.shanten));
  return {
    shanten: bestShanten,
    effectiveTiles: [],
    discardOptions: rawOptions.map((option) => ({
      ...option,
      isOptimal: option.shanten === bestShanten,
    })),
  };
}

function normalizePreWinHand(
  state: GameStateForRs,
  winningTile: number,
): number[] {
  const meldCount = state.melds.length;
  const expectedBeforeWin = 13 - meldCount * 3;
  if (state.hand.length === expectedBeforeWin) return [...state.hand];
  if (state.hand.length === expectedBeforeWin + 1) {
    return removeFirstBaseTile(state.hand, getBaseTile(winningTile));
  }
  throw new RiichiRulesError(
    `Expected ${expectedBeforeWin} or ${expectedBeforeWin + 1} concealed tiles before win evaluation, got ${state.hand.length}`,
  );
}

function emptyWinEvaluation(structuralAgari: boolean): RiichiWinEvaluation {
  return {
    structuralAgari,
    legalWin: false,
    yaku: [],
    fu: 0,
    han: 0,
    yakuman: 0,
    totalPoints: 0,
    uraDoraHan: 0,
    tsumoPayments: null,
  };
}

function isNoYakuError(error: unknown): boolean {
  return error instanceof Error && /no yaku/i.test(error.message);
}

/**
 * 精确判定和牌并直接返回 WASM 的役、符、番、总点数及自摸支付。
 * 本函数不会调用旧 TypeScript 役种或点数公式作为回退。
 */
export function evaluateRiichiWin(
  input: EvaluateRiichiWinInput,
): RiichiWinEvaluation {
  const preWinHand = normalizePreWinHand(input.state, input.winningTile);
  const beforeWin = analyzeRiichiHand({
    hand: preWinHand,
    melds: input.state.melds,
  });
  const structuralAgari =
    beforeWin.shanten === 0 &&
    beforeWin.effectiveTiles.includes(getBaseTile(input.winningTile));
  if (!structuralAgari) return emptyWinEvaluation(false);

  const winner = input.state.winnerSeat ?? 0;
  const doraIndicators = [...input.state.doraIndicators];
  if (input.state.riichiDeclared[winner]) {
    doraIndicators.push(...(input.uraDoraIndicators ?? []));
  }

  let result: RiichiResult;
  try {
    result = calc(
      buildRiichiInput(
        { ...input.state, doraIndicators },
        input.isTsumo,
        input.winningTile,
      ),
    );
  } catch (error) {
    if (isNoYakuError(error)) return emptyWinEvaluation(true);
    throw new RiichiRulesError('riichi-rs win evaluation failed', error);
  }

  if (!result.is_agari) return emptyWinEvaluation(true);
  const outgoing = result.outgoing_ten;
  let yaku = rsResultToYakuList(result);
  let uraDoraHan = 0;
  if (
    input.state.riichiDeclared[winner] &&
    (input.uraDoraIndicators?.length ?? 0) > 0 &&
    result.yakuman === 0
  ) {
    let withoutUra: RiichiResult;
    try {
      withoutUra = calc(
        buildRiichiInput(input.state, input.isTsumo, input.winningTile),
      );
    } catch (error) {
      throw new RiichiRulesError(
        'riichi-rs ura-dora baseline evaluation failed',
        error,
      );
    }
    uraDoraHan = Math.max(0, result.han - withoutUra.han);
    if (uraDoraHan > 0) {
      yaku = yaku
        .map((item) =>
          item.id === '53' ? { ...item, han: item.han - uraDoraHan } : item,
        )
        .filter((item) => item.han > 0);
      yaku.push({ id: '54', name: '里宝牌', han: uraDoraHan });
    }
  }
  return {
    structuralAgari: true,
    legalWin: true,
    yaku,
    fu: result.fu,
    han: result.han,
    yakuman: result.yakuman,
    totalPoints: result.ten,
    uraDoraHan,
    tsumoPayments:
      input.isTsumo && outgoing
        ? { dealerOrAll: outgoing[0], nonDealer: outgoing[1] }
        : null,
  };
}

export const RiichiRules = {
  analyzeHand: analyzeRiichiHand,
  evaluateWin: evaluateRiichiWin,
} as const;
