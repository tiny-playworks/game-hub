import { expect, test } from '@rstest/core';
import {
  ACHIEVEMENTS,
  checkAndUnlockFromStats,
  getAchievementProgress,
  getAchievementSummary,
  unlock,
} from '../src/lib/achievements';
import { addGrowthPoints, getGrowthOverview } from '../src/lib/growth';

test('achievements：进度计算与百分比正确', () => {
  localStorage.clear();
  localStorage.setItem('game-2048-best', '1024');

  const achievement2048 = ACHIEVEMENTS.find((item) => item.id === '2048-2048');
  if (!achievement2048) {
    throw new Error('缺少 2048-2048 成就定义');
  }
  const progress = getAchievementProgress(achievement2048);

  expect(progress.current).toBe(1024);
  expect(progress.target).toBe(2048);
  expect(progress.progressPercent).toBe(50);
  expect(progress.rarity).toBe('legendary');
});

test('achievements：自动解锁后点数与稀有度统计正确', () => {
  localStorage.clear();
  localStorage.setItem('game-2048-best', '1024');

  checkAndUnlockFromStats();
  const summary = getAchievementSummary();

  expect(summary.total).toBe(14);
  expect(summary.unlocked).toBe(3);
  expect(summary.unlockedPoints).toBe(280);
  expect(summary.rarityCounts).toEqual({
    common: 5,
    rare: 5,
    epic: 3,
    legendary: 1,
  });
});

test('growth：总成长点=成就点+任务点', () => {
  localStorage.clear();
  unlock('gomoku-first-win');
  addGrowthPoints(40);

  const overview = getGrowthOverview();
  expect(overview.achievementPoints).toBe(60);
  expect(overview.taskPoints).toBe(40);
  expect(overview.totalPoints).toBe(100);
});
