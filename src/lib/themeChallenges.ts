import {
  normalizeThemeChallengeState,
  THEME_CHALLENGE_SET_ID,
  THEME_CHALLENGE_TARGETS,
  type ThemeChallengeId,
  type ThemeChallengeState,
} from '../../shared/contracts/challenge';
import { gameStorage, commitStorageChanges } from '@/lib/storage';
import { GROWTH_POINTS_GAINED_EVENT, GROWTH_STORAGE_KEY, getGrowthState } from '@/lib/growth';
import { replayMatch, toReplayFile, type RiichiMatchState } from '@/pages/mahjong/japanese/engine/match';
import { normalizeWalletState, WALLET_CHANGED_EVENT, WALLET_STORAGE_KEY, COINS_GAINED_EVENT } from '@/lib/wallet';

export {
  THEME_CHALLENGE_SET_ID,
  THEME_CHALLENGE_TARGETS,
  type ThemeChallengeId,
  type ThemeChallengeState,
};

export const THEME_CHALLENGES_STORAGE_KEY = 'game-hub-theme-challenges-v1';
export const THEME_CHALLENGES_CHANGED_EVENT = 'game-hub:theme-challenges-changed';
export const THEME_CHALLENGE_REWARD_COINS = 40;
export const THEME_CHALLENGE_REWARD_POINTS = 30;

export interface ThemeChallengeMatchResult {
  state: ThemeChallengeState;
  newlyCompleted: ThemeChallengeId[];
  duplicate: boolean;
}

export function getThemeChallengeState(): ThemeChallengeState {
  try {
    return normalizeThemeChallengeState(
      JSON.parse(gameStorage.getItem(THEME_CHALLENGES_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return normalizeThemeChallengeState(null);
  }
}

function dispatchProgressEvents(coins: number, points: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(THEME_CHALLENGES_CHANGED_EVENT));
  if (coins > 0) {
    const wallet = normalizeWalletState(
      JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null'),
    );
    window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
    window.dispatchEvent(
      new CustomEvent(COINS_GAINED_EVENT, {
        detail: { coins, balance: wallet.coins },
      }),
    );
  }
  if (points > 0) {
    window.dispatchEvent(
      new CustomEvent(GROWTH_POINTS_GAINED_EVENT, { detail: { points } }),
    );
  }
}

/**
 * Apply one verified, finished free or AI ranked game. Online callers invoke this
 * inside the member snapshot transaction; local callers persist the same rules.
 */
export function recordThemeChallengeMatch(
  match: RiichiMatchState,
  matchId: string,
  source: 'free' | 'ai-ranked',
  authoritativeCompletedIds: readonly ThemeChallengeId[] = [],
): ThemeChallengeMatchResult {
  if (
    match.status !== 'matchEnd' ||
    !match.matchEnd ||
    !matchId ||
    (source === 'ai-ranked') !== Boolean(match.ranked)
  ) {
    return { state: getThemeChallengeState(), newlyCompleted: [], duplicate: true };
  }

  const current = getThemeChallengeState();
  const authoritative = new Set(authoritativeCompletedIds);
  const completedIds = new Set([
    ...current.completedIds,
    ...authoritative,
  ]);
  const seededState = normalizeThemeChallengeState({
    ...current,
    completedIds: [...completedIds],
  });
  if (seededState.creditedMatchIds.includes(matchId)) {
    return { state: seededState, newlyCompleted: [], duplicate: true };
  }

  const frames = replayMatch(toReplayFile(match));
  let wonClosedHand = false;
  let completedSafeSouth = match.matchLength === 'south';
  for (const frame of frames) {
    const result = frame.round.result;
    if (frame.round.phase !== 'end' || !result) continue;
    if (result.type !== 'win') continue;
    if (
      result.wins.some(
        (win) =>
          win.winner === 0 && win.melds.every((meld) => meld.type === 'angang'),
      )
    ) {
      wonClosedHand = true;
    }
    if (result.wins.some((win) => win.ronFrom === 0)) {
      completedSafeSouth = false;
    }
  }

  const progress = { ...seededState.progress };
  progress['three-matches'] = Math.min(
    THEME_CHALLENGE_TARGETS['three-matches'],
    progress['three-matches'] + 1,
  );
  if (wonClosedHand) progress['menzen-win'] = 1;
  if (completedSafeSouth) progress['safe-south'] = 1;

  const nextCompleted = new Set(seededState.completedIds);
  const newlyCompleted: ThemeChallengeId[] = [];
  for (const id of Object.keys(THEME_CHALLENGE_TARGETS) as ThemeChallengeId[]) {
    if (
      progress[id] >= THEME_CHALLENGE_TARGETS[id] &&
      !nextCompleted.has(id)
    ) {
      nextCompleted.add(id);
      newlyCompleted.push(id);
    }
  }

  const nextState = normalizeThemeChallengeState({
    schema: 1,
    challengeSetId: THEME_CHALLENGE_SET_ID,
    progress,
    completedIds: [...nextCompleted],
    creditedMatchIds: [...seededState.creditedMatchIds, matchId],
    updatedAt: Date.now(),
  });
  const rewardCoins = newlyCompleted.length * THEME_CHALLENGE_REWARD_COINS;
  const rewardPoints = newlyCompleted.length * THEME_CHALLENGE_REWARD_POINTS;
  const wallet = normalizeWalletState(
    JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null'),
  );
  const growth = getGrowthState();
  if (
    !Number.isSafeInteger(wallet.coins + rewardCoins) ||
    !Number.isSafeInteger(wallet.lifetimeEarned + rewardCoins) ||
    !Number.isSafeInteger(growth.taskPoints + rewardPoints)
  ) {
    throw new Error('Theme challenge reward exceeds safe storage limits');
  }

  commitStorageChanges({
    [THEME_CHALLENGES_STORAGE_KEY]: JSON.stringify(nextState),
    ...(rewardCoins > 0
      ? {
          [WALLET_STORAGE_KEY]: JSON.stringify({
            ...wallet,
            coins: wallet.coins + rewardCoins,
            lifetimeEarned: wallet.lifetimeEarned + rewardCoins,
            ledger: [
              ...wallet.ledger,
              {
                at: Date.now(),
                delta: rewardCoins,
                reasonKey: 'wallet.reason.themeChallenge',
              },
            ].slice(-50),
          }),
        }
      : {}),
    ...(rewardPoints > 0
      ? {
          [GROWTH_STORAGE_KEY]: JSON.stringify({
            ...growth,
            taskPoints: growth.taskPoints + rewardPoints,
            updatedAt: Date.now(),
          }),
        }
      : {}),
  });
  dispatchProgressEvents(rewardCoins, rewardPoints);
  return { state: nextState, newlyCompleted, duplicate: false };
}
