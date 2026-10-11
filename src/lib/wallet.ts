export const WALLET_STORAGE_KEY = 'game-hub-wallet-v1';
export const COINS_GAINED_EVENT = 'game-hub:coins-gained';
export const WALLET_CHANGED_EVENT = 'game-hub:wallet-changed';

export interface WalletState {
  coins: number;
  lifetimeEarned: number;
  ledger: { at: number; delta: number; reasonKey: string }[];
  dailyArcadeEarned: { dateKey: string; amount: number };
  rewardedMatchIds: string[];
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

export function normalizeWalletState(raw: unknown): WalletState {
  const state =
    raw && typeof raw === 'object' ? (raw as Partial<WalletState>) : {};
  return {
    rewardedMatchIds: Array.isArray(state.rewardedMatchIds) ? state.rewardedMatchIds.filter((id): id is string => typeof id === 'string').slice(-100) : [],
    coins: count(state.coins),
    lifetimeEarned: Math.max(count(state.coins), count(state.lifetimeEarned)),
    ledger: Array.isArray(state.ledger)
      ? state.ledger
          .filter(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              typeof entry.at === 'number' &&
              Number.isFinite(entry.at) &&
              Number.isSafeInteger(entry.delta) &&
              entry.delta !== 0 &&
              typeof entry.reasonKey === 'string',
          )
          .slice(-50)
      : [],
    dailyArcadeEarned: {
      dateKey:
        typeof state.dailyArcadeEarned?.dateKey === 'string'
          ? state.dailyArcadeEarned.dateKey
          : '',
      amount: count(state.dailyArcadeEarned?.amount),
    },
  };
}

export function getWalletState(): WalletState {
  try {
    return normalizeWalletState(
      JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return normalizeWalletState(null);
  }
}

export function addCoins(
  amount: number,
  reasonKey: string,
  at = Date.now(),
  matchId?: string,
): number {
  const delta = count(amount);
  if (!delta) return 0;
  const current = getWalletState();
  if (matchId && current.rewardedMatchIds.includes(matchId)) return 0;
  if (
    !Number.isSafeInteger(current.coins + delta) ||
    !Number.isSafeInteger(current.lifetimeEarned + delta)
  )
    return 0;
  const next = {
    ...current,
    rewardedMatchIds: matchId ? [...current.rewardedMatchIds, matchId].slice(-100) : current.rewardedMatchIds,
    coins: current.coins + delta,
    lifetimeEarned: current.lifetimeEarned + delta,
    ledger: [...current.ledger, { at, delta, reasonKey }].slice(-50),
  };
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALLET_CHANGED_EVENT));
    window.dispatchEvent(
      new CustomEvent(COINS_GAINED_EVENT, {
        detail: { coins: delta, balance: next.coins },
      }),
    );
  }
  return delta;
}

export function getRiichiMatchCoins(
  placement: number,
  matchLength: 'east' | 'south',
): number {
  if (!Number.isInteger(placement) || placement < 1 || placement > 4) return 0;
  const bonus = [60, 30, 10, 0][placement - 1];
  return matchLength === 'south' ? 100 + bonus * 1.5 : 60 + bonus;
}
