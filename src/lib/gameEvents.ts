import { games } from '@/data/games';
import {
  ACHIEVEMENTS,
  type AchievementUnlockedEventDetail,
  checkAndUnlockFromStats,
  getAchievementMeta,
  getUnlockedIds,
} from '@/lib/achievements';
import { recordDailyTaskEvent, type TaskRewardSummary } from '@/lib/dailyTasks';
import { recordGameStart } from '@/lib/playerStats';
import { addCoins, getRiichiMatchCoins } from '@/lib/wallet';
import { recordWeeklyTaskEvent } from '@/lib/weeklyTasks';

export type GameEventType = 'start' | 'finish' | 'win' | 'best';
export interface GameEvent {
  gameId: string;
  type: GameEventType;
  score?: number;
  difficulty?: string;
  meta?: Record<string, unknown>;
}
export interface GameEventResult {
  coinsEarned: number;
  unlockedAchievements: AchievementUnlockedEventDetail[];
  taskRewards: TaskRewardSummary[];
}

const listeners = new Set<
  (event: GameEvent, result: GameEventResult) => void
>();

export function emitGameEvent(event: GameEvent): GameEventResult {
  const result: GameEventResult = {
    coinsEarned: 0,
    unlockedAchievements: [],
    taskRewards: [],
  };
  if (!games.some((game) => game.id === event.gameId)) return result;
  // start currently means entering a game; P6 moves arcade reporting to actual rounds.
  if (event.type === 'start') recordGameStart(event.gameId);
  if (event.gameId === 'mahjong-japanese' && event.type === 'finish') {
    const { placement, matchLength, ranked, matchId, forfeit } = event.meta ?? {};
    if (
      typeof placement === 'number' &&
      forfeit !== true &&
      (matchLength === 'east' || matchLength === 'south')
    ) {
      result.coinsEarned = addCoins(
        Math.round(getRiichiMatchCoins(placement, matchLength) * (ranked === true ? 1.2 : 1)),
        `wallet.reason.riichi.${matchLength}`,
        Date.now(),
        typeof matchId === 'string' ? matchId : undefined,
      );
    }
  }
  // Hand-level riichi events retain their existing channel. Arcade tasks arrive in P6.
  if (event.gameId === 'mahjong-japanese' && event.type === 'start') {
    const daily = recordDailyTaskEvent('enter-game');
    const weekly = recordWeeklyTaskEvent('enter-game');
    result.taskRewards = [
      ...daily.autoClaimedRewards,
      ...weekly.autoClaimedRewards,
    ];
    result.coinsEarned += result.taskRewards.reduce(
      (sum, reward) => sum + (reward.scope === 'daily' ? 40 : 150),
      0,
    );
  }
  const before = new Set(getUnlockedIds());
  checkAndUnlockFromStats();
  const after = new Set(getUnlockedIds());
  result.unlockedAchievements = ACHIEVEMENTS.filter(
    (achievement) => !before.has(achievement.id) && after.has(achievement.id),
  ).map((achievement) => ({
    ...getAchievementMeta(achievement),
    nameKey: achievement.nameKey,
  }));
  for (const listener of listeners) {
    try {
      listener(event, result);
    } catch (error) {
      console.error('[gameEvents] Listener failed', error);
    }
  }
  return result;
}

export function subscribeGameEvents(
  listener: (event: GameEvent, result: GameEventResult) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
