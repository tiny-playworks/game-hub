export const RIICHI_INITIAL_POINTS = 25000;
const NOTEN_PENALTY_TOTAL = 3000;

export interface TsumoPayments {
  dealerOrAll: number;
  nonDealer: number;
}

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
  tsumoPayments?: TsumoPayments | null;
  paoSeat?: number | null;
  paoShare?: number;
}

export interface WinnerSettlementInput {
  winner: number;
  isTsumo: boolean;
  baseTen: number;
  tsumoPayments?: TsumoPayments | null;
  /** 包牌责任者（大三元 / 大四喜） */
  paoSeat?: number | null;
  /** 由包牌责任者承担的点数比例 0–1（复合役满时只承担包牌役满部分） */
  paoShare?: number;
}

export interface MultiWinSettlementInput {
  scores: number[];
  dealer: number;
  honba: number;
  riichiPot: number;
  ronFrom?: number | null;
  /** 按放铳者下家起的顺序排列；本场棒与立直棒归第一位（上家取り） */
  wins: WinnerSettlementInput[];
}

export interface PaymentDetail {
  from: number;
  to: number;
  amount: number;
  reason: 'ron' | 'tsumo' | 'honba' | 'riichi' | 'noten' | 'pao' | 'nagashi';
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

function tsumoShareFor(
  seat: number,
  win: WinnerSettlementInput,
  dealer: number,
): number {
  const winnerIsDealer = win.winner === dealer;
  if (win.tsumoPayments) {
    return winnerIsDealer || seat === dealer
      ? win.tsumoPayments.dealerOrAll
      : win.tsumoPayments.nonDealer;
  }
  if (winnerIsDealer) return ceilTo100(win.baseTen / 3);
  const nonDealer = ceilTo100(win.baseTen / 4);
  return seat === dealer ? win.baseTen - nonDealer * 2 : nonDealer;
}

function settleOneWin(
  scores: number[],
  payments: PaymentDetail[],
  win: WinnerSettlementInput,
  input: MultiWinSettlementInput,
  receivesSticks: boolean,
): void {
  const honba = receivesSticks ? input.honba : 0;
  const paoSeat =
    win.paoSeat != null && win.paoSeat !== win.winner ? win.paoSeat : null;
  const paoShare = paoSeat === null ? 0 : Math.min(1, win.paoShare ?? 1);

  if (win.isTsumo) {
    const shares = [0, 1, 2, 3]
      .filter((seat) => seat !== win.winner)
      .map((seat) => ({
        seat,
        amount: tsumoShareFor(seat, win, input.dealer),
      }));
    const total = shares.reduce((sum, s) => sum + s.amount, 0);
    if (paoSeat !== null && paoShare > 0) {
      const paoAmount = ceilTo100(total * paoShare);
      applyPayment(scores, payments, paoSeat, win.winner, paoAmount, 'pao');
      if (paoShare < 1) {
        for (const s of shares) {
          applyPayment(
            scores,
            payments,
            s.seat,
            win.winner,
            ceilTo100(s.amount * (1 - paoShare)),
            'tsumo',
          );
        }
      }
      if (honba > 0) {
        applyPayment(
          scores,
          payments,
          paoSeat,
          win.winner,
          honba * 300,
          'honba',
        );
      }
    } else {
      for (const s of shares) {
        applyPayment(scores, payments, s.seat, win.winner, s.amount, 'tsumo');
        if (honba > 0) {
          applyPayment(
            scores,
            payments,
            s.seat,
            win.winner,
            honba * 100,
            'honba',
          );
        }
      }
    }
  } else {
    const from = input.ronFrom;
    if (from == null || from === win.winner) {
      throw new Error('Ron settlement requires valid ronFrom');
    }
    if (paoSeat !== null && paoSeat !== from && paoShare > 0) {
      const paoAmount = ceilTo100((win.baseTen * paoShare) / 2);
      applyPayment(scores, payments, paoSeat, win.winner, paoAmount, 'pao');
      applyPayment(
        scores,
        payments,
        from,
        win.winner,
        win.baseTen - paoAmount,
        'ron',
      );
    } else {
      applyPayment(scores, payments, from, win.winner, win.baseTen, 'ron');
    }
    if (honba > 0) {
      applyPayment(scores, payments, from, win.winner, honba * 300, 'honba');
    }
  }

  if (receivesSticks && input.riichiPot > 0) {
    for (let i = 0; i < input.riichiPot / 1000; i++) {
      payments.push({
        from: -1,
        to: win.winner,
        amount: 1000,
        reason: 'riichi',
      });
    }
    scores[win.winner] += input.riichiPot;
  }
}

/** 和了结算：支持一人或多人和了（双响）、本场棒、立直棒与包牌。 */
export function settleWins(input: MultiWinSettlementInput): SettlementResult {
  if (input.wins.length === 0) throw new Error('No winners to settle');
  const scores = [...input.scores];
  const payments: PaymentDetail[] = [];
  input.wins.forEach((win, index) => {
    settleOneWin(scores, payments, win, input, index === 0);
  });
  return {
    newScores: scores,
    deltas: scores.map((s, i) => s - input.scores[i]),
    payments,
    nextRiichiPot: 0,
  };
}

/** 单人和了结算（settleWins 的便捷封装）。 */
export function settleWin(input: WinSettlementInput): SettlementResult {
  return settleWins({
    scores: input.scores,
    dealer: input.dealer,
    honba: input.honba,
    riichiPot: input.riichiPot,
    ronFrom: input.ronFrom,
    wins: [
      {
        winner: input.winner,
        isTsumo: input.isTsumo,
        baseTen: input.baseTen,
        tsumoPayments: input.tsumoPayments,
        paoSeat: input.paoSeat,
        paoShare: input.paoShare,
      },
    ],
  });
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
    const payPerNoten = NOTEN_PENALTY_TOTAL / notenCount;
    const perPair = payPerNoten / tenpaiCount;
    for (let from = 0; from < 4; from++) {
      if (tenpaiSet.has(from)) continue;
      for (let to = 0; to < 4; to++) {
        if (!tenpaiSet.has(to)) continue;
        applyPayment(nextScores, payments, from, to, perPair, 'noten');
      }
    }
  }

  return {
    newScores: nextScores,
    deltas: nextScores.map((s, i) => s - scores[i]),
    payments,
    nextRiichiPot: riichiPot,
  };
}

/** 流局满贯：每位达成者按满贯自摸收取，不再执行不听罚符。立直棒留场。 */
export function settleNagashiMangan(
  scores: number[],
  dealer: number,
  nagashiSeats: number[],
  riichiPot: number,
): SettlementResult {
  const nextScores = [...scores];
  const payments: PaymentDetail[] = [];
  for (const winner of nagashiSeats) {
    for (let seat = 0; seat < 4; seat++) {
      if (seat === winner) continue;
      const amount = winner === dealer || seat === dealer ? 4000 : 2000;
      applyPayment(nextScores, payments, seat, winner, amount, 'nagashi');
    }
  }
  return {
    newScores: nextScores,
    deltas: nextScores.map((s, i) => s - scores[i]),
    payments,
    nextRiichiPot: riichiPot,
  };
}
