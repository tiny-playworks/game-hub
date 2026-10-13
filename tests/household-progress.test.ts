import { afterEach, describe, expect, it } from 'rstack/test';
import { createEmptySnapshot } from '../server/src/snapshot';
import { runSnapshotMutation } from '../server/src/snapshotRuntime';
import {
  checkinToday,
  claimWeekMilestone,
  getBeijingDateKey,
} from '@/lib/checkin';
import { claimDailyTask, createDailyTaskState } from '@/lib/dailyTasks';
import { getStorageDriver, setStorageDriver } from '@/lib/storage';

const day = Date.UTC(2026, 9, 13, 4);

afterEach(() => setStorageDriver(null));

describe('P10 member progress transactions', () => {
  it('applies one check-in to the member snapshot and refuses a duplicate', () => {
    const initial = createEmptySnapshot('member-a', 'Alice');
    const first = runSnapshotMutation(initial, () => checkinToday(day));
    expect(first.result.ok).toBe(true);
    expect(first.snapshot.checkin.dateKey).toBe(getBeijingDateKey(day));
    expect(first.snapshot.wallet.coins).toBe(initial.wallet.coins + 30);
    expect(first.snapshot.growth.taskPoints).toBe(initial.growth.taskPoints + 10);
    expect(getStorageDriver()).toBeNull();

    const duplicate = runSnapshotMutation(first.snapshot, () => checkinToday(day));
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.snapshot.wallet.coins).toBe(first.snapshot.wallet.coins);
    expect(duplicate.snapshot.growth.taskPoints).toBe(first.snapshot.growth.taskPoints);
  });

  it('claims a task and a milestone only once without touching guest storage', () => {
    const initial = createEmptySnapshot('member-b', 'Bob');
    const daily = createDailyTaskState(day);
    const task = daily.items[daily.items.length - 1];
    initial.dailyTasks = {
      ...daily,
      items: daily.items.map((item) =>
        item.id === task.id ? { ...item, progress: item.target, completed: true } : item),
    };
    initial.checkin = {
      ...initial.checkin,
      streakDays: 7,
      totalDays: 7,
    };
    const taskClaim = runSnapshotMutation(initial, () => claimDailyTask(task.id, day));
    expect(taskClaim.result.ok).toBe(true);
    expect(taskClaim.snapshot.dailyTasks.items.find((item) => item.id === task.id)?.claimed).toBe(true);
    const duplicate = runSnapshotMutation(taskClaim.snapshot, () => claimDailyTask(task.id, day));
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.snapshot.wallet.coins).toBe(taskClaim.snapshot.wallet.coins);

    const weekClaim = runSnapshotMutation(taskClaim.snapshot, () => claimWeekMilestone(7));
    expect(weekClaim.result.ok).toBe(true);
    expect(weekClaim.snapshot.growth.taskPoints).toBe(taskClaim.snapshot.growth.taskPoints + 70);
    const weekDuplicate = runSnapshotMutation(weekClaim.snapshot, () => claimWeekMilestone(7));
    expect(weekDuplicate.result.ok).toBe(false);
    expect(weekDuplicate.snapshot.growth.taskPoints).toBe(weekClaim.snapshot.growth.taskPoints);
    expect(getStorageDriver()).toBeNull();
  });
});
