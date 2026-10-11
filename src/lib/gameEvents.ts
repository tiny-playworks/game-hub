import { games } from '@/data/games';
import {
  ACHIEVEMENTS,
  type AchievementUnlockedEventDetail,
  checkAndUnlockFromStats,
  checkArcadeAchievements,
  getAchievementMeta,
  getUnlockedIds,
} from '@/lib/achievements';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import { recordDailyTaskEvent, type TaskRewardSummary } from '@/lib/dailyTasks';
import { recordGameStart } from '@/lib/playerStats';
import {
  ARCADE_DAILY_COIN_CAP,
  addArcadeCoins,
  addCoins,
  getRiichiMatchCoins,
  getWalletState,
} from '@/lib/wallet';
import { recordWeeklyTaskEvent } from '@/lib/weeklyTasks';
import type { ArcadeRecord } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';

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
  record?: ArcadeRecord;
  arcadeCapReached?: boolean;
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
  const game = games.find(game => game.id === event.gameId);
  if (!game) return result;
  const arcade = event.gameId !== 'mahjong-japanese';
  const difficulty = normalizeArcadeDifficulty(event.gameId, event.difficulty);
  const roundId = event.meta?.roundId;
  if (
    arcade &&
    typeof roundId === 'string' &&
    !useGameStore.getState().consumeEvent(`${roundId}:${event.type}`)
  )
    return result;
  if (event.type === 'start') recordGameStart(event.gameId);
  if (arcade) {
    if (event.type === 'start')
      useGameStore.getState().incrementPlayCount(event.gameId, difficulty);
    if (event.type === 'finish')
      result.record = useGameStore
        .getState()
        .recordResult(
          event.gameId,
          difficulty,
          event.score ?? 0,
          event.meta?.outcome === 'win'
            ? 'win'
            : event.meta?.outcome === 'draw'
              ? 'draw'
              : 'lose',
          event.meta,
        );
    const coins =
      event.type === 'finish'
        ? 5
        : event.type === 'win'
          ? 15 * (difficulty === 'hard' ? 2 : 1)
          : event.type === 'best'
            ? 20
            : 0;
    result.coinsEarned = addArcadeCoins(
      coins,
      `wallet.reason.arcade.${event.type}`,
    );
    result.arcadeCapReached =
      getWalletState().dailyArcadeEarned.amount >= ARCADE_DAILY_COIN_CAP;
  }
  if (event.gameId === 'mahjong-japanese' && event.type === 'finish') {
    const { placement, matchLength, ranked, matchId, forfeit } =
      event.meta ?? {};
    if (
      typeof placement === 'number' &&
      forfeit !== true &&
      (matchLength === 'east' || matchLength === 'south')
    ) {
      result.coinsEarned = addCoins(
        Math.round(
          getRiichiMatchCoins(placement, matchLength) *
            (ranked === true ? 1.2 : 1),
        ),
        `wallet.reason.riichi.${matchLength}`,
        Date.now(),
        typeof matchId === 'string' ? matchId : undefined,
      );
    }
  }
  if (arcade) {
    const category = game.categoryId;
    const trigger = {
      scope: 'arcade' as const,
      gameId: event.gameId,
      category,
      type: event.type,
      difficulty,
      meta: event.meta,
    };
    recordDailyTaskEvent(trigger);
    recordWeeklyTaskEvent(trigger);
  }
  // Hand-level riichi events retain their existing channel.
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
  if (arcade) checkArcadeAchievements({ ...event, difficulty });
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
