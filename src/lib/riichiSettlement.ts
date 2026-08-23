export const RIICHI_INITIAL_POINTS = 25000;
const NOTEN_PENALTY_TOTAL = 3000;

export interface WinSettlementInput {
  scores: number[];
  winner: number;
  isTsumo: boolean;
  baseTen: number;
  dealer: number;
  honba: number;
  riichiPot: number;
  ronFrom?: number | null;
  /** 精确自摸支付额；由规则引擎给出，避免从总点数反推时产生舍入误差。 */
  tsumoPayments?: {
    dealerOrAll: number;
    nonDealer: number;
  } | null;
}

export interface PaymentDetail {
  from: number;
  to: number;
  amount: number;
  reason: 'ron' | 'tsumo' | 'honba' | 'riichi' | 'noten';
}

export interface SettlementResult {
  newScores: number[];
  deltas: number[];
  payments: PaymentDetail[];
  nextRiichiPot: number;
}

function ceilTo100(v: number): number {
  return Math.ceil(v / 100) * 100;
}

function applyPayment(
  scores: number[],
  payments: PaymentDetail[],
  from: number,
  to: number,
  amount: number,
  reason: PaymentDetail['reason'],
): void {
  if (amount <= 0 || from === to) return;
  scores[from] -= amount;
  scores[to] += amount;
  payments.push({ from, to, amount, reason });
}

/** 胡牌结算：支持荣和/自摸、本场棒、立直棒。 */
export function settleWin(input: WinSettlementInput): SettlementResult {
  const scores = [...input.scores];
  const payments: PaymentDetail[] = [];
  const winnerIsDealer = input.winner === input.dealer;

  if (input.isTsumo) {
    const fallbackShare = winnerIsDealer
      ? ceilTo100(input.baseTen / 3)
      : ceilTo100(input.baseTen / 4);
    const fallbackDealerShare = winnerIsDealer
      ? fallbackShare
      : ceilTo100(input.baseTen / 2);
    for (let seat = 0; seat < 4; seat++) {
      if (seat === input.winner) continue;
      const loss = input.tsumoPayments
        ? winnerIsDealer || seat === input.dealer
          ? input.tsumoPayments.dealerOrAll
          : input.tsumoPayments.nonDealer
        : seat === input.dealer
          ? fallbackDealerShare
          : fallbackShare;
      applyPayment(scores, payments, seat, input.winner, loss, 'tsumo');
      if (input.honba > 0) {
        applyPayment(
          scores,
          payments,
          seat,
          input.winner,
          input.honba * 100,
          'honba',
        );
      }
    }
  } else {
    const from = input.ronFrom;
    if (from == null || from === input.winner) {
      throw new Error('Ron settlement requires valid ronFrom');
    }
    applyPayment(scores, payments, from, input.winner, input.baseTen, 'ron');
    if (input.honba > 0) {
      applyPayment(
        scores,
        payments,
        from,
        input.winner,
        input.honba * 300,
        'honba',
      );
    }
  }

  if (input.riichiPot > 0) {
    for (let i = 0; i < input.riichiPot / 1000; i++) {
      payments.push({
        from: -1,
        to: input.winner,
        amount: 1000,
        reason: 'riichi',
      });
    }
    scores[input.winner] += input.riichiPot;
  }

  return {
    newScores: scores,
    deltas: scores.map((s, i) => s - input.scores[i]),
    payments,
    nextRiichiPot: 0,
  };
}

/** 荒牌流局结算：听牌者收 3000，不听者均摊支付。立直棒留场。 */
export function settleRyuukyoku(
  scores: number[],
  tenpaiSeats: number[],
  riichiPot: number,
): SettlementResult {
  const nextScores = [...scores];
  const payments: PaymentDetail[] = [];
  const tenpaiSet = new Set(tenpaiSeats);
  const tenpaiCount = tenpaiSet.size;
  const notenCount = 4 - tenpaiCount;

  if (tenpaiCount > 0 && notenCount > 0) {
    const payPerNoten = Math.floor(NOTEN_PENALTY_TOTAL / notenCount);
    const gainPerTenpai = Math.floor(NOTEN_PENALTY_TOTAL / tenpaiCount);
    for (let from = 0; from < 4; from++) {
      if (tenpaiSet.has(from)) continue;
      for (let to = 0; to < 4; to++) {
        if (!tenpaiSet.has(to)) continue;
        // 将 noten->tenpai 的总额拆分为可读流水，避免丢失来源信息
        const perPair = Math.floor(payPerNoten / tenpaiCount);
        applyPayment(nextScores, payments, from, to, perPair, 'noten');
      }
    }

    // 修正整数除法造成的误差到第一位听牌者
    const expectedDelta = new Array(4).fill(0);
    for (let i = 0; i < 4; i++) {
      expectedDelta[i] = tenpaiSet.has(i) ? gainPerTenpai : -payPerNoten;
    }
    const actualDelta = nextScores.map((s, i) => s - scores[i]);
    const fixSeat = tenpaiSeats[0];
    if (fixSeat != null) {
      const fix = expectedDelta[fixSeat] - actualDelta[fixSeat];
      nextScores[fixSeat] += fix;
    }
  }

  return {
    newScores: nextScores,
    deltas: nextScores.map((s, i) => s - scores[i]),
    payments,
    nextRiichiPot: riichiPot,
  };
}
