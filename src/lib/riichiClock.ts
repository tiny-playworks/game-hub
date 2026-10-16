import type {
  RiichiAiSpeed,
  RiichiTurnTimeLimit,
} from '@/lib/playerProfile';

export const RIICHI_TURN_SECONDS = 5;
export const RIICHI_TIME_BANK_INITIAL_SECONDS = 30;

export function getTurnTotalSeconds(timeBankSeconds: number): number {
  return Math.max(0, timeBankSeconds) + RIICHI_TURN_SECONDS;
}

/**
 * 计算玩家当前决策点（出牌或吃碰杠荣响应）的可用读秒上限（秒）。
 * 返回 null 表示不限时（unlimited）。
 */
export function getDecisionTotalSeconds(
  timeBankSeconds: number,
  phase: 'discard' | 'claim' | 'end' = 'discard',
  turnTimeLimit: RiichiTurnTimeLimit = 'standard',
): number | null {
  if (turnTimeLimit === 'unlimited') return null;
  const baseTotal = getTurnTotalSeconds(timeBankSeconds);
  if (turnTimeLimit === 'long') {
    return phase === 'claim'
      ? Math.max(60, baseTotal + 55)
      : Math.max(60, baseTotal + 55);
  }
  if (turnTimeLimit === 'relaxed') {
    return phase === 'claim'
      ? Math.max(45, baseTotal + 35)
      : Math.max(35, baseTotal + 25);
  }
  return phase === 'claim'
    ? Math.max(30, baseTotal + 15)
    : Math.max(20, baseTotal);
}

/** 根据 AI 速度设置返回 AI 摸打或鸣牌响应延迟（毫秒） */
export function getAiDelayMs(
  aiSpeed: RiichiAiSpeed = 'normal',
  phase: 'discard' | 'claim' = 'discard',
): number {
  if (aiSpeed === 'slow') {
    return phase === 'claim' ? 850 : 1400;
  }
  if (aiSpeed === 'fast') {
    return phase === 'claim' ? 320 : 450;
  }
  return phase === 'claim' ? 560 : 900;
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
