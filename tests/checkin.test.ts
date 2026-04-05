import { expect, test } from '@rstest/core';
import {
  checkinToday,
  claimMonthMilestone,
  claimWeekMilestone,
  createDefaultCheckinState,
  getBeijingDateKey,
  getCheckinState,
  saveCheckinState,
} from '../src/lib/checkin';
import { getGrowthState } from '../src/lib/growth';

test('checkin：北京时间换日 key 计算正确', () => {
  const beforeMidnightUtc = Date.parse('2026-04-02T15:59:59.000Z');
  const atMidnightUtc = Date.parse('2026-04-02T16:00:00.000Z');
  expect(getBeijingDateKey(beforeMidnightUtc)).toBe('2026-04-02');
  expect(getBeijingDateKey(atMidnightUtc)).toBe('2026-04-03');
});

test('checkin：同一天不能重复签到', () => {
  localStorage.clear();
  const now = Date.parse('2026-04-03T12:00:00.000Z');

  const first = checkinToday(now);
  expect(first.ok).toBe(true);
  expect(first.awardedPoints).toBe(10);

  const second = checkinToday(now);
  expect(second.ok).toBe(false);
  expect(second.awardedPoints).toBe(0);

  const state = getCheckinState();
  expect(state.totalDays).toBe(1);
  expect(state.streakDays).toBe(1);
  expect(state.signedDateKeys).toEqual(['2026-04-03']);
});

test('checkin：跨天连续签到 + 断签重置', () => {
  localStorage.clear();
  const day1 = Date.parse('2026-04-03T12:00:00.000Z');
  const day2 = Date.parse('2026-04-04T12:00:00.000Z');
  const day4 = Date.parse('2026-04-06T12:00:00.000Z');

  checkinToday(day1);
  checkinToday(day2);
  let state = getCheckinState();
  expect(state.totalDays).toBe(2);
  expect(state.streakDays).toBe(2);

  checkinToday(day4);
  state = getCheckinState();
  expect(state.totalDays).toBe(3);
  expect(state.streakDays).toBe(1);
  expect(state.signedDateKeys).toEqual([
    '2026-04-03',
    '2026-04-04',
    '2026-04-06',
  ]);
});

test('checkin：7 天与 30 天里程碑奖励不可重复领取', () => {
  localStorage.clear();
  saveCheckinState({
    ...createDefaultCheckinState(),
    streakDays: 7,
    totalDays: 30,
  });

  const weekClaim = claimWeekMilestone(7);
  expect(weekClaim.ok).toBe(true);
  expect(weekClaim.awardedPoints).toBe(70);

  const weekClaimAgain = claimWeekMilestone(7);
  expect(weekClaimAgain.ok).toBe(false);
  expect(weekClaimAgain.awardedPoints).toBe(0);

  const monthClaim = claimMonthMilestone(30);
  expect(monthClaim.ok).toBe(true);
  expect(monthClaim.awardedPoints).toBe(300);

  const monthClaimAgain = claimMonthMilestone(30);
  expect(monthClaimAgain.ok).toBe(false);
  expect(monthClaimAgain.awardedPoints).toBe(0);

  const growth = getGrowthState();
  expect(growth.taskPoints).toBe(370);
});
