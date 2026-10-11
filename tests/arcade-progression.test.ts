import { beforeEach, expect, test } from '@rstest/core';
import { games } from '../src/data/games';
import {
  ACHIEVEMENTS,
  checkArcadeAchievements,
  getUnlockedIds,
  migrateLegacyArcadeStats,
} from '../src/lib/achievements';
import { getArcadeDifficulty, setArcadeDifficulty } from '../src/lib/arcade';
import {
  claimDailyTask,
  ensureDailyTaskState,
  recordDailyTaskEvent,
  saveDailyTaskState,
} from '../src/lib/dailyTasks';
import { createInitialState, moveBoard } from '../src/lib/game2048';
import { emitGameEvent } from '../src/lib/gameEvents';
import { getGrowthState } from '../src/lib/growth';
import { createInitialMemoryState } from '../src/lib/memory';
import { applyTetrisAction, createInitialTetrisState } from '../src/lib/tetris';
import {
  applyMove,
  chooseTicDifficultyMove,
  getWinner,
  type TicMove,
} from '../src/lib/tictactoe';
import { addArcadeCoins, addCoins, getWalletState } from '../src/lib/wallet';
import {
  ensureWeeklyTaskState,
  recordWeeklyTaskEvent,
  saveWeeklyTaskState,
} from '../src/lib/weeklyTasks';
import { normalizeGameState, useGameStore } from '../src/store/gameStore';

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ stats: {}, receipts: [] });
});
test('16 arcade games define metrics; the 14 legacy achievement ids remain in 64 arcade achievements', () => {
  expect(games.filter((game) => game.categoryId !== 'mahjong')).toHaveLength(
    16,
  );
  expect(
    ACHIEVEMENTS.filter((def) => def.gameId !== 'mahjong-japanese'),
  ).toHaveLength(64);
  for (const id of [
    '2048-256',
    '2048-512',
    '2048-1024',
    '2048-2048',
    'snake-25',
    'snake-50',
    'snake-100',
    'tetris-10',
    'tetris-50',
    'tetris-100',
    'chess-first-win',
    'xiangqi-first-win',
    'gomoku-first-win',
    'breakout-first-win',
  ])
    expect(ACHIEVEMENTS.some((def) => def.id === id)).toBe(true);
});
test('old records migrate into normal without erasing existing newer fields', () => {
  const result = normalizeGameState({
    stats: {
      '2048:normal': { highScore: 900, maxTile: 512 },
      '2048': { highScore: 500 },
      snake: { highScore: 88 },
      tetris: { highScore: 42 },
    },
  });
  expect(result.stats['2048:normal'].highScore).toBe(900);
  expect(result.stats['2048:normal'].maxTile).toBe(512);
  expect(result.stats['snake:normal'].highScore).toBe(88);
  expect(result.stats['tetris:normal'].maxLines).toBe(42);
  expect(result.stats['tetris:normal'].highScore).toBe(42);
});
test('standalone legacy scores and unlocked achievements survive migration', () => {
  localStorage.setItem('game-snake-best', '100');
  localStorage.setItem('game-2048-best', '1024');
  localStorage.setItem('game-tetris-best-lines', '25');
  localStorage.setItem('game-hub-unlocked-achievements', '["snake-50"]');
  migrateLegacyArcadeStats();
  expect(useGameStore.getState().stats['snake:normal'].highScore).toBe(100);
  expect(useGameStore.getState().stats['2048:normal'].maxTile).toBe(1024);
  expect(useGameStore.getState().stats['tetris:normal'].maxLines).toBe(25);
  expect(getUnlockedIds()).toContain('snake-50');
});
test('difficulty defaults, persistence and poker restrictions', () => {
  expect(getArcadeDifficulty('snake')).toBe('normal');
  setArcadeDifficulty('snake', 'hard');
  expect(getArcadeDifficulty('snake')).toBe('hard');
  setArcadeDifficulty('doudizhu', 'easy');
  expect(getArcadeDifficulty('doudizhu')).toBe('normal');
});
test('maximum score records are independent per difficulty', () => {
  const store = useGameStore.getState();
  expect(store.recordResult('snake', 'normal', 25, 'lose').isNewBest).toBe(
    true,
  );
  expect(store.recordResult('snake', 'normal', 20, 'lose').isNewBest).toBe(
    false,
  );
  const hard = store.recordResult('snake', 'hard', 10, 'lose');
  expect(hard.previousBest).toBeNull();
  expect(hard.currentBest).toBe(10);
});
test('minimum attempts only records successful rounds and improves downwards', () => {
  const store = useGameStore.getState();
  expect(
    store.recordResult('guess-number', 'normal', 1, 'lose').currentBest,
  ).toBeNull();
  expect(
    store.recordResult('guess-number', 'normal', 7, 'win').currentBest,
  ).toBe(7);
  expect(store.recordResult('guess-number', 'normal', 4, 'win').isNewBest).toBe(
    true,
  );
  expect(store.recordResult('guess-number', 'normal', 6, 'win').isNewBest).toBe(
    false,
  );
});
test('wins and streaks accumulate, while draws reset winning streaks', () => {
  const store = useGameStore.getState();
  for (let round = 0; round < 3; round++)
    store.recordResult('gomoku', 'normal', 0, 'win');
  store.recordResult('gomoku', 'normal', 0, 'draw');
  expect(useGameStore.getState().stats['gomoku:normal']).toMatchObject({
    wins: 3,
    bestStreak: 3,
    streak: 0,
    drawStreak: 1,
  });
});
test('a real round emits start, finish, win and best once even when replayed', () => {
  const event = {
    gameId: 'guess-number',
    difficulty: 'hard',
    score: 9,
    meta: { roundId: 'round-a', outcome: 'win', range: 1000, guesses: 9 },
  };
  const start = emitGameEvent({ ...event, type: 'start' });
  expect(start.coinsEarned).toBe(0);
  const finish = emitGameEvent({ ...event, type: 'finish' });
  expect(finish.coinsEarned).toBe(5);
  expect(finish.record?.isNewBest).toBe(true);
  expect(emitGameEvent({ ...event, type: 'win' }).coinsEarned).toBe(30);
  expect(emitGameEvent({ ...event, type: 'best' }).coinsEarned).toBe(20);
  for (const type of ['start', 'finish', 'win', 'best'] as const)
    expect(emitGameEvent({ ...event, type }).coinsEarned).toBe(0);
  expect(getWalletState().coins).toBe(55);
  expect(useGameStore.getState().stats['guess-number:hard'].playCount).toBe(1);
  expect(getUnlockedIds()).toContain('guess-number-hard-10');
});
test('arcade coins cap at 200 and reset on Beijing midnight; riichi coins remain independent', () => {
  const day = Date.parse('2026-10-11T15:59:00Z');
  expect(addArcadeCoins(195, 'arcade', day)).toBe(195);
  expect(addArcadeCoins(30, 'arcade', day)).toBe(5);
  expect(addArcadeCoins(20, 'arcade', day)).toBe(0);
  addCoins(100, 'riichi', day);
  expect(getWalletState().coins).toBe(300);
  expect(addArcadeCoins(15, 'arcade', Date.parse('2026-10-11T16:00:00Z'))).toBe(
    15,
  );
  expect(getWalletState().dailyArcadeEarned.amount).toBe(15);
});
test('daily arcade completion awaits claim and cannot be claimed twice', () => {
  const now = Date.now();
  const state = ensureDailyTaskState(now);
  const arcade = state.items.find((item) => typeof item.eventType === 'object');
  if (!arcade) throw new Error('arcade task missing');
  const trigger = arcade.eventType;
  if (typeof trigger === 'string' || trigger.scope !== 'arcade')
    throw new Error('arcade trigger missing');
  saveDailyTaskState({
    ...state,
    items: state.items.map((item) =>
      item.id === arcade.id
        ? {
            ...item,
            eventType: { scope: 'arcade', category: 'mini', type: 'best' },
            id: 'arcade-best',
            titleKey: 'daily.arcade.best.title',
            descKey: 'daily.arcade.best.desc',
            target: 1,
          }
        : item,
    ),
  });
  recordDailyTaskEvent(
    { scope: 'arcade', gameId: '2048', category: 'mini', type: 'best' },
    now,
  );
  const ready = ensureDailyTaskState(now).items.find(
    (item) => item.id === 'arcade-best',
  );
  expect(ready).toMatchObject({ completed: true, claimed: false });
  expect(getGrowthState().taskPoints).toBe(0);
  expect(claimDailyTask('arcade-best', now).ok).toBe(true);
  expect(getGrowthState().taskPoints).toBe(30);
  expect(claimDailyTask('arcade-best', now).ok).toBe(false);
  expect(getWalletState().coins).toBe(40);
});
test('weekly distinct-game task does not count repeated bests in the same game', () => {
  const state = ensureWeeklyTaskState();
  const task = {
    id: 'weekly-arcade-best',
    titleKey: 'weekly.arcade.best.title',
    descKey: 'weekly.arcade.best.desc',
    eventType: {
      scope: 'arcade' as const,
      category: 'mini' as const,
      type: 'best' as const,
      distinct: true,
    },
    target: 3,
    rewardPoints: 100,
    progress: 0,
    completed: false,
    claimed: false,
  };
  saveWeeklyTaskState({
    ...state,
    items: [
      ...state.items.filter((item) => typeof item.eventType === 'string'),
      task,
    ],
  });
  for (const id of ['2048', '2048', 'snake', 'tetris'])
    recordWeeklyTaskEvent({
      scope: 'arcade',
      gameId: id,
      category: 'mini',
      type: 'best',
    });
  expect(
    ensureWeeklyTaskState().items.find((item) => item.id === task.id),
  ).toMatchObject({ progress: 3, completed: true, claimed: false });
});
test('AI-specific hard achievements require an AI opponent', () => {
  checkArcadeAchievements({
    gameId: 'chess',
    type: 'win',
    difficulty: 'hard',
    meta: { opponent: 'human', moves: 5 },
  });
  expect(getUnlockedIds()).not.toContain('chess-hard-win');
  checkArcadeAchievements({
    gameId: 'chess',
    type: 'win',
    difficulty: 'hard',
    meta: { opponent: 'ai', moves: 5 },
  });
  expect(getUnlockedIds()).toContain('chess-hard-win');
});
test('2048 respects all three board sizes', () => {
  let index = 0;
  for (const size of [3, 4, 5]) {
    const state = createInitialState(
      () => 0.5,
      () => String(index++),
      size,
    );
    const next = moveBoard(
      state,
      'left',
      () => 0.5,
      () => String(index++),
    );
    expect(next.state.size).toBe(size);
    expect(
      Object.values(next.state.tiles).every(
        (tile) => tile.r < size && tile.c < size,
      ),
    ).toBe(true);
  }
});
test('hard memory has 18 distinct pairs', () => {
  const state = createInitialMemoryState(() => 0.5, 18);
  expect(state.cards).toHaveLength(36);
  expect(new Set(state.cards.map((card) => card.emoji)).size).toBe(18);
});
test('Tetris starts at the selected level and retains it through reset', () => {
  const state = createInitialTetrisState(() => 0.5, 10);
  expect(state.level).toBe(10);
  expect(state.lines).toBe(0);
  expect(applyTetrisAction(state, { type: 'reset' }).state.level).toBe(10);
});
test('hard classic minimax never loses across all reachable human choices', () => {
  const seen = new Set<string>();
  const visit = (moves: TicMove[]) => {
    const key = moves.map((move) => move.player + move.index).join('');
    if (seen.has(key) || getWinner(moves)) return;
    seen.add(key);
    for (let cell = 0; cell < 9; cell++) {
      const next = applyMove(moves, 'X', cell, 'classic');
      if (!next) continue;
      expect(getWinner(next)).not.toBe('X');
      const reply = chooseTicDifficultyMove(next, 'O', 'hard');
      if (reply === null) continue;
      const after = applyMove(next, 'O', reply, 'classic');
      if (after && !getWinner(after)) visit(after);
    }
  };
  visit([]);
  expect(seen.size).toBeGreaterThan(10);
});
