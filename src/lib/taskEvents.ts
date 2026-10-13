import type { CategoryId } from '@/data/games';
import type { GameEventType } from '@/lib/gameEvents';
export type RiichiTaskEvent =
  'enter-game' | 'finish-round' | 'declare-riichi' | 'win-hand' | 'tsumo-win';
export type TaskTrigger =
  | { scope: 'riichi'; event: RiichiTaskEvent }
  | {
      scope: 'arcade';
      gameId?: string;
      category?: CategoryId;
      type: GameEventType;
      difficulty?: string;
      metric?: string;
      distinct?: boolean;
    };
export type TaskEvent =
  | RiichiTaskEvent
  | { scope: 'riichi'; event: RiichiTaskEvent }
  | {
      scope: 'arcade';
      gameId: string;
      category: CategoryId;
      type: GameEventType;
      difficulty?: string;
      meta?: Record<string, unknown>;
    };
export function isArcadeTask(trigger: RiichiTaskEvent | TaskTrigger): boolean {
  return typeof trigger === 'object' && trigger.scope === 'arcade';
}
export function matchesTask(
  trigger: RiichiTaskEvent | TaskTrigger,
  event: TaskEvent,
): boolean {
  if (typeof trigger === 'string')
    return typeof event === 'string'
      ? trigger === event
      : event.scope === 'riichi' && trigger === event.event;
  if (trigger.scope === 'riichi')
    return typeof event === 'string'
      ? trigger.event === event
      : event.scope === 'riichi' && trigger.event === event.event;
  return (
    typeof event !== 'string' &&
    event.scope === 'arcade' &&
    trigger.type === event.type &&
    (!trigger.gameId || trigger.gameId === event.gameId) &&
    (!trigger.category || trigger.category === event.category) &&
    (!trigger.difficulty || trigger.difficulty === event.difficulty)
  );
}
export function advanceTask<
  T extends {
    eventType: RiichiTaskEvent | TaskTrigger;
    target: number;
    progress: number;
    completed: boolean;
    distinctGames?: string[];
  },
>(task: T, event: TaskEvent): T {
  const trigger = task.eventType;
  if (task.completed || !matchesTask(trigger, event)) return task;
  let progress = task.progress + 1;
  let distinctGames = task.distinctGames;
  if (
    typeof trigger === 'object' &&
    trigger.scope === 'arcade' &&
    typeof event !== 'string' &&
    event.scope === 'arcade'
  ) {
    if (trigger.distinct) {
      distinctGames = [...new Set([...(distinctGames ?? []), event.gameId])];
      progress = distinctGames.length;
    }
    if (trigger.metric) {
      const value = event.meta?.[trigger.metric];
      progress = Math.max(
        task.progress,
        typeof value === 'number' && Number.isFinite(value) ? value : 0,
      );
    }
  }
  progress = Math.min(task.target, Math.max(0, Math.floor(progress)));
  return {
    ...task,
    progress,
    distinctGames,
    completed: progress >= task.target,
  };
}
