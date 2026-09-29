import { describe, expect, test } from '@rstest/core';
import {
  countAllTiles,
  getPendingSeats,
  replayMatch,
  toReplayFile,
} from '../src/pages/mahjong/japanese/engine';
import { simulateMatch } from './helpers/riichiSim';

const TOTAL_POINTS = 100000;

describe('日麻引擎：固定种子无头模拟', () => {
  for (const seed of [1, 2, 3, 20260928]) {
    test(`种子 ${seed}：半庄完整结束且每步守恒`, () => {
      let rounds = 0;
      const match = simulateMatch({
        seed,
        onStep: (_before, event, after) => {
          const round = after.round;
          expect(countAllTiles(round)).toBe(136);
          if (after.status === 'playing') {
            const sum =
              round.scores.reduce((a, b) => a + b, 0) + round.riichiPot;
            expect(sum).toBe(TOTAL_POINTS);
            expect(getPendingSeats(round).length).toBeGreaterThan(0);
          }
          if (after.status !== 'playing' && round.result) {
            const s = round.result.settlement;
            expect(
              s.newScores.reduce((a, b) => a + b, 0) + s.nextRiichiPot,
            ).toBe(TOTAL_POINTS);
          }
          if (event.type === 'nextRound') rounds++;
        },
      });
      expect(match.status).toBe('matchEnd');
      expect(match.matchEnd?.ranking).toHaveLength(4);
      expect(rounds).toBeGreaterThanOrEqual(4);
    });
  }

  test('东风战与初级 AI 同样可以跑完', () => {
    const match = simulateMatch({
      seed: 7,
      matchLength: 'east',
      levels: ['beginner', 'standard', 'beginner', 'standard'],
    });
    expect(match.status).toBe('matchEnd');
  });

  test('相同种子与事件序列可完整重放', () => {
    const match = simulateMatch({ seed: 99, matchLength: 'east' });
    const frames = replayMatch(toReplayFile(match));
    expect(frames).toHaveLength(match.events.length + 1);
    const last = frames[frames.length - 1];
    expect(last.matchEnd).toEqual(match.matchEnd);
    expect(last.round.scores).toEqual(match.round.scores);
  });
});
