import { expect, test } from '@rstest/core';
import {
  buildDailyTaskSetForDate,
  claimDailyTask,
  ensureDailyTaskState,
  getBeijingDateKey,
  recordDailyTaskEvent,
} from '../src/lib/dailyTasks';
import { getGrowthState } from '../src/lib/growth';

test('dailyTasks：北京时间换日 key 计算正确', () => {
  // 2026-04-02 23:59:59（北京时间）
  const beforeMidnightUtc = Date.parse('2026-04-02T15:59:59.000Z');
  // 2026-04-03 00:00:00（北京时间）
  const atMidnightUtc = Date.parse('2026-04-02T16:00:00.000Z');

  expect(getBeijingDateKey(beforeMidnightUtc)).toBe('2026-04-02');
  expect(getBeijingDateKey(atMidnightUtc)).toBe('2026-04-03');
});

test('dailyTasks：每日任务 5 选 3 且同日生成稳定', () => {
  const a = buildDailyTaskSetForDate('2026-04-03');
  const b = buildDailyTaskSetForDate('2026-04-03');

  expect(a.length).toBe(3);
  expect(a.map((item) => item.id)).toEqual(b.map((item) => item.id));
  expect(new Set(a.map((item) => item.id)).size).toBe(3);
});

test('dailyTasks：进度推进与领取奖励闭环', () => {
  localStorage.clear();
  const now = Date.parse('2026-04-03T12:00:00.000Z');
  const initial = ensureDailyTaskState(now);
  const firstTask = initial.items[0];
  expect(firstTask).toBeTruthy();

  const progressed = recordDailyTaskEvent(firstTask.eventType, now);
  const progressedTask = progressed.items.find(
    (item) => item.id === firstTask.id,
  );
  expect(progressedTask?.completed).toBe(true);

  const claimed = claimDailyTask(firstTask.id, now);
  expect(claimed.ok).toBe(true);
  expect(claimed.awardedPoints).toBe(firstTask.rewardPoints);

  const growth = getGrowthState();
  expect(growth.taskPoints).toBe(firstTask.rewardPoints);

  const claimAgain = claimDailyTask(firstTask.id, now);
  expect(claimAgain.ok).toBe(false);
  expect(claimAgain.awardedPoints).toBe(0);
});

test('dailyTasks：跨北京时间 0 点后自动刷新任务', () => {
  localStorage.clear();
  const beforeMidnightUtc = Date.parse('2026-04-02T15:59:59.000Z');
  const afterMidnightUtc = Date.parse('2026-04-02T16:00:01.000Z');

  const before = ensureDailyTaskState(beforeMidnightUtc);
  const after = ensureDailyTaskState(afterMidnightUtc);

  expect(before.dateKey).toBe('2026-04-02');
  expect(after.dateKey).toBe('2026-04-03');
  expect(after.items.every((item) => item.progress === 0)).toBe(true);
});
