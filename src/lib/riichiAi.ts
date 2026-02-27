import {
  getBaseTile,
  getDoraFromIndicator,
  isAkaFive,
} from '@/lib/mahjongRiichi';

export interface AiRiichiDecisionInput {
  alreadyRiichi: boolean;
  isMenzen: boolean;
  score: number;
  waitingCount: number;
  random: number;
}

/** AI 是否应在当前摸打回合宣告立直。 */
export function shouldAiDeclareRiichi(input: AiRiichiDecisionInput): boolean {
  return (
    !input.alreadyRiichi &&
    input.isMenzen &&
    input.score >= 1000 &&
    input.waitingCount > 0 &&
    input.random < 0.35
  );
}

/** 应用立直扣点与棒池入账。 */
export function applyAiRiichiState(
  scores: number[],
  riichiDeclared: boolean[],
  riichiPot: number,
  player: number,
): { scores: number[]; riichiDeclared: boolean[]; riichiPot: number } {
  return {
    scores: scores.map((v, i) => (i === player ? v - 1000 : v)),
    riichiDeclared: riichiDeclared.map((r, i) => (i === player ? true : r)),
    riichiPot: riichiPot + 1000,
  };
}

/** AI 要牌轮是否应优先荣和。 */
export function canAiRonOnClaim(params: {
  fromPlayer: number;
  aiSeat: number;
  isWinShape: boolean;
  hasYaku: boolean;
}): boolean {
  return (
    params.fromPlayer !== params.aiSeat && params.isWinShape && params.hasYaku
  );
}

function isSujiSafer(tileBase: number, discardPile: number[]): boolean {
  if (tileBase >= 27) return false;
  const suitStart = Math.floor(tileBase / 9) * 9;
  const num = tileBase % 9;
  const sujiA = num - 3;
  const sujiB = num + 3;
  return discardPile.some((t) => {
    const b = getBaseTile(t);
    if (b < suitStart || b > suitStart + 8) return false;
    const n = b % 9;
    return n === sujiA || n === sujiB;
  });
}

/** 估算某张牌对单个立直对手的放铳危险度（越小越安全）。 */
export function evaluateTileDangerVsRiichi(
  tile: number,
  opponentDiscardPile: number[],
): number {
  const base = getBaseTile(tile);
  const isGenbutsu = opponentDiscardPile.some((t) => getBaseTile(t) === base);
  if (isGenbutsu) return 0;
  if (base >= 27) return 0.6; // 字牌：通常较中张更安全
  if (isSujiSafer(base, opponentDiscardPile)) return 0.45;
  const num = base % 9;
  if (num === 0 || num === 8) return 0.9; // 幺九牌
  if (num === 1 || num === 7) return 1.05; // 2/8 边张附近
  return 1.2; // 中张默认最危险
}

function evaluateDiscardEfficiencyPenalty(input: {
  tile: number;
  hand: number[];
  doraIndicators?: number[];
}): number {
  const base = getBaseTile(input.tile);
  const baseCounts = new Map<number, number>();
  for (const t of input.hand) {
    const b = getBaseTile(t);
    baseCounts.set(b, (baseCounts.get(b) ?? 0) + 1);
  }

  let keepValue = 0;
  const sameCount = baseCounts.get(base) ?? 0;
  if (sameCount >= 3) keepValue += 0.45;
  else if (sameCount === 2) keepValue += 0.28;

  if (base < 27) {
    const suitStart = Math.floor(base / 9) * 9;
    const inSuit = (b: number) => b >= suitStart && b <= suitStart + 8;
    const hasNear1 =
      (inSuit(base - 1) && (baseCounts.get(base - 1) ?? 0) > 0) ||
      (inSuit(base + 1) && (baseCounts.get(base + 1) ?? 0) > 0);
    const hasNear2 =
      (inSuit(base - 2) && (baseCounts.get(base - 2) ?? 0) > 0) ||
      (inSuit(base + 2) && (baseCounts.get(base + 2) ?? 0) > 0);
    if (hasNear1) keepValue += 0.2;
    if (hasNear2) keepValue += 0.08;
    // 孤张数牌更适合在防守局面先切，尤其是幺九孤张。
    if (!hasNear1 && !hasNear2) {
      const num = base % 9;
      keepValue -= num === 0 || num === 8 ? 0.14 : 0.08;
    }
  } else if (sameCount <= 1) {
    // 单张字牌通常最该先处理（仅用于同安全度下的轻微排序）。
    keepValue -= 0.2;
  } else {
    // 对子字牌有一定价值，略保留。
    keepValue += 0.12;
  }

  if (isAkaFive(input.tile)) keepValue += 0.2;
  if ((input.doraIndicators?.length ?? 0) > 0) {
    const doraTypes = input.doraIndicators?.map(getDoraFromIndicator) ?? [];
    if (doraTypes.includes(base)) keepValue += 0.18;
  }

  return Math.max(-0.3, keepValue);
}

/** 在存在立直对手时，选择更偏防守的舍牌（现物优先）。 */
export function chooseAiDefensiveDiscard(input: {
  hand: number[];
  aiSeat: number;
  riichiDeclared: boolean[];
  discardPiles: number[][];
  doraIndicators?: number[];
}): number | null {
  return chooseAiDefensiveDiscardWithMeta(input).tile;
}

export function chooseAiDefensiveDiscardWithMeta(input: {
  hand: number[];
  aiSeat: number;
  riichiDeclared: boolean[];
  discardPiles: number[][];
  doraIndicators?: number[];
}): { tile: number | null; riichiOpponents: number[]; reason: string } {
  const riichiOpponents = input.riichiDeclared
    .map((declared, seat) => (declared && seat !== input.aiSeat ? seat : -1))
    .filter((seat) => seat >= 0);
  if (riichiOpponents.length === 0 || input.hand.length === 0) {
    return { tile: null, riichiOpponents, reason: '' };
  }

  let bestTile = input.hand[0];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDangerScore = Number.POSITIVE_INFINITY;
  let bestEfficiencyPenalty = Number.POSITIVE_INFINITY;
  let bestGenbutsuCount = -1;
  const offenseWeight =
    riichiOpponents.length >= 3
      ? 0.06
      : riichiOpponents.length === 2
        ? 0.1
        : 0.18;
  for (const tile of input.hand) {
    const base = getBaseTile(tile);
    let dangerScore = 0;
    let genbutsuCount = 0;
    for (const opp of riichiOpponents) {
      const oppPile = input.discardPiles[opp] ?? [];
      if (oppPile.some((t) => getBaseTile(t) === base)) genbutsuCount++;
      dangerScore += evaluateTileDangerVsRiichi(tile, oppPile);
    }
    const efficiencyPenalty = evaluateDiscardEfficiencyPenalty({
      tile,
      hand: input.hand,
      doraIndicators: input.doraIndicators,
    });
    const score = dangerScore + offenseWeight * efficiencyPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestTile = tile;
      bestDangerScore = dangerScore;
      bestEfficiencyPenalty = efficiencyPenalty;
      bestGenbutsuCount = genbutsuCount;
    }
  }

  let reason = `防守切牌：对 ${riichiOpponents.length} 家立直总危险度最低`;
  if (bestGenbutsuCount > 0) {
    reason += `（${bestGenbutsuCount} 家现物）`;
  } else {
    const b = getBaseTile(bestTile);
    if (b >= 27) reason += '（字牌相对安全）';
    else if (
      riichiOpponents.some((opp) =>
        isSujiSafer(b, input.discardPiles[opp] ?? []),
      )
    ) {
      reason += '（筋相对安全）';
    }
  }
  if (bestEfficiencyPenalty <= 0) reason += '，顺带处理低价值孤张';
  else if (bestEfficiencyPenalty >= 0.3 && bestDangerScore <= 0.6) {
    reason += '，同时保留了较高价值牌';
  }
  return { tile: bestTile, riichiOpponents, reason };
}
