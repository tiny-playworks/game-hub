export const RIICHI_TURN_SECONDS = 5;
export const RIICHI_TIME_BANK_INITIAL_SECONDS = 30;

export function getTurnTotalSeconds(timeBankSeconds: number): number {
  return Math.max(0, timeBankSeconds) + RIICHI_TURN_SECONDS;
}

/** 本巡用时会先消耗 5 秒读秒，超出的部分才扣时间库。 */
export function consumeTimeBankSeconds(
  timeBankSeconds: number,
  elapsedSeconds: number,
): number {
  const overtime = Math.max(0, elapsedSeconds - RIICHI_TURN_SECONDS);
  const bankCost = Math.ceil(overtime);
  return Math.max(0, timeBankSeconds - bankCost);
}

export function isTurnTimeout(
  timeBankSeconds: number,
  elapsedSeconds: number,
): boolean {
  return elapsedSeconds >= getTurnTotalSeconds(timeBankSeconds);
}
