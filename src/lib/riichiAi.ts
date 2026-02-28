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

/** 有他家立直时，AI 在要牌阶段是否应转入防守（优先过牌）。 */
export function shouldAiFoldClaimAgainstRiichi(input: {
  aiSeat: number;
  riichiDeclared: boolean[];
}): boolean {
  return input.riichiDeclared.some((declared, seat) => {
    return seat !== input.aiSeat && declared;
  });
}

function evaluateHandStructureScore(hand: number[]): number {
  const counts = new Map<number, number>();
  for (const t of hand) {
    const b = getBaseTile(t);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  let score = 0;
  for (const [b, c] of counts) {
    if (c >= 2) score += 0.35;
    if (c >= 3) score += 0.2;
    if (b >= 27) continue;
    const suitStart = Math.floor(b / 9) * 9;
    const inSuit = (x: number) => x >= suitStart && x <= suitStart + 8;
    if (inSuit(b - 1) && (counts.get(b - 1) ?? 0) > 0) score += 0.18;
    if (inSuit(b + 1) && (counts.get(b + 1) ?? 0) > 0) score += 0.18;
    if (inSuit(b - 2) && (counts.get(b - 2) ?? 0) > 0) score += 0.08;
    if (inSuit(b + 2) && (counts.get(b + 2) ?? 0) > 0) score += 0.08;
  }
  return score;
}

function removeConsumedTiles(hand: number[], consumed: number[]): number[] {
  const rest = [...hand];
  for (const c of consumed) {
    const i = rest.indexOf(c);
    if (i === -1) return [];
    rest.splice(i, 1);
  }
  return rest;
}

function sumDangerAgainstRiichiOpponents(
  tile: number,
  riichiOpponents: number[],
  discardPiles: number[][],
): number {
  return riichiOpponents.reduce((sum, opp) => {
    return sum + evaluateTileDangerVsRiichi(tile, discardPiles[opp] ?? []);
  }, 0);
}

export type AiClaimDecision =
  | { action: 'pass'; reason: string }
  | {
      action: 'chi';
      chiOption: [number, number];
      discardTile: number;
      reason: string;
    }
  | { action: 'peng'; discardTile: number; reason: string };

/**
 * 中间档要牌策略：立直压制下，只有“牌效提升明显 + 打出仍相对安全”才吃/碰，否则过。
 */
export function chooseAiClaimActionAgainstRiichi(input: {
  aiSeat: number;
  hand: number[];
  chiOptions: [number, number][];
  canPeng: boolean;
  lastTile: number;
  riichiDeclared: boolean[];
  discardPiles: number[][];
  doraIndicators?: number[];
  seatWind?: number;
  roundWind?: number;
}): AiClaimDecision {
  const riichiOpponents = input.riichiDeclared
    .map((declared, seat) => (declared && seat !== input.aiSeat ? seat : -1))
    .filter((seat) => seat >= 0);
  if (riichiOpponents.length === 0) {
    return { action: 'pass', reason: '' };
  }

  const baseScore = evaluateHandStructureScore(input.hand);
  const lastBase = getBaseTile(input.lastTile);
  const seatWindBase =
    input.seatWind === undefined || input.seatWind < 0
      ? -1
      : input.seatWind + 27;
  const roundWindBase =
    input.roundWind === undefined || input.roundWind < 0
      ? -1
      : input.roundWind + 27;
  const yakuhaiTypes = new Set<number>([
    31,
    32,
    33,
    seatWindBase,
    roundWindBase,
  ]);
  const isYakuhaiPeng = yakuhaiTypes.has(lastBase);
  let best:
    | {
        action: 'chi';
        chiOption: [number, number];
        discardTile: number;
        score: number;
      }
    | { action: 'peng'; discardTile: number; score: number }
    | null = null;

  for (const option of input.chiOptions) {
    const afterClaim = removeConsumedTiles(input.hand, [option[0], option[1]]);
    if (afterClaim.length === 0) continue;
    const discardChoice = chooseAiDefensiveDiscardWithMeta({
      hand: afterClaim,
      aiSeat: input.aiSeat,
      riichiDeclared: input.riichiDeclared,
      discardPiles: input.discardPiles,
      doraIndicators: input.doraIndicators,
    });
    if (discardChoice.tile === null) continue;
    const afterDiscard = removeConsumedTiles(afterClaim, [discardChoice.tile]);
    if (afterDiscard.length === 0) continue;
    const improvement =
      evaluateHandStructureScore(afterDiscard) + 0.56 - baseScore;
    const danger = sumDangerAgainstRiichiOpponents(
      discardChoice.tile,
      riichiOpponents,
      input.discardPiles,
    );
    if (improvement < 0.65 || danger > 1.1) continue;
    const score = improvement + 0.1 - 0.35 * danger;
    if (!best || score > best.score) {
      best = {
        action: 'chi',
        chiOption: option,
        discardTile: discardChoice.tile,
        score,
      };
    }
  }

  if (input.canPeng) {
    const base = getBaseTile(input.lastTile);
    const candidates = input.hand
      .filter((t) => getBaseTile(t) === base)
      .slice(0, 2);
    if (candidates.length >= 2) {
      const afterClaim = removeConsumedTiles(input.hand, candidates);
      const discardChoice = chooseAiDefensiveDiscardWithMeta({
        hand: afterClaim,
        aiSeat: input.aiSeat,
        riichiDeclared: input.riichiDeclared,
        discardPiles: input.discardPiles,
        doraIndicators: input.doraIndicators,
      });
      if (discardChoice.tile !== null) {
        const afterDiscard = removeConsumedTiles(afterClaim, [
          discardChoice.tile,
        ]);
        const improvement =
          evaluateHandStructureScore(afterDiscard) + 1.08 - baseScore;
        const danger = sumDangerAgainstRiichiOpponents(
          discardChoice.tile,
          riichiOpponents,
          input.discardPiles,
        );
        const threshold = input.chiOptions.length > 0 ? 0.18 : 0.35;
        if (improvement >= threshold && danger <= 1.25) {
          const actionValue = isYakuhaiPeng ? 0.58 : 0.28;
          const score = improvement + actionValue - 0.3 * danger;
          if (!best || score > best.score) {
            best = {
              action: 'peng',
              discardTile: discardChoice.tile,
              score,
            };
          }
        }
      }
    }
  }

  if (!best) {
    return { action: 'pass', reason: '他家立直，牌效提升不足，继续防守' };
  }
  if (best.action === 'chi') {
    return {
      action: 'chi',
      chiOption: best.chiOption,
      discardTile: best.discardTile,
      reason: '他家立直但吃后牌效明显改善（价值较低），谨慎推进',
    };
  }
  return {
    action: 'peng',
    discardTile: best.discardTile,
    reason: isYakuhaiPeng
      ? '他家立直但役牌碰价值高且相对安全，谨慎推进'
      : '他家立直但碰后牌效明显改善（高于吃），谨慎推进',
  };
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
