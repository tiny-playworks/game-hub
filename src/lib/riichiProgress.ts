import { type RiichiDailyEvent, recordDailyTaskEvent } from '@/lib/dailyTasks';
import { recordGameStart, recordRiichiStatEvent } from '@/lib/playerStats';
import { recordWeeklyTaskEvent } from '@/lib/weeklyTasks';

export type RiichiProgressEvent = RiichiDailyEvent;

export function recordRiichiProgressEvent(event: RiichiProgressEvent): void {
  recordDailyTaskEvent(event);
  recordWeeklyTaskEvent(event);
  recordRiichiStatEvent(event);
  if (event === 'enter-game') {
    recordGameStart('mahjong-japanese');
  }
}
