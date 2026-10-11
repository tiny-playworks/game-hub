import { describe, expect, test } from '@rstest/core';
import { getMessage } from '../src/lib/i18n';
import { getBaseTile } from '../src/lib/mahjongRiichi';
import { CHARACTER_DEFS } from '../src/lib/playerCharacters';
import { normalizeRiichiSettings } from '../src/lib/playerProfile';
import { buildMatchReview } from '../src/lib/riichiMatchReview';
import {
  getScoreTier,
  winningHand,
  winTimeline,
} from '../src/lib/riichiPresentation';
import { mulberry32 } from '../src/lib/seededRandom';
import {
  CHATTER_TRIGGERS,
  ChatterController,
} from '../src/pages/mahjong/japanese/chatter';
import {
  applyEvent,
  createMatch,
  replayMatch,
  toReplayFile,
} from '../src/pages/mahjong/japanese/engine';
import { getDiscardAdvice } from '../src/pages/mahjong/japanese/trainingAdvice';
import { nextAutoEvent, simulateMatch } from './helpers/riichiSim';

describe('P4 win presentation', () => {
  test('tiers use basic-point caps, and small hands have no badge', () => {
    expect(getScoreTier({ han: 1, fu: 30, yakuman: 0 })).toBeNull();
    expect(getScoreTier({ han: 4, fu: 30, yakuman: 0 })).toBeNull();
    expect(getScoreTier({ han: 3, fu: 70, yakuman: 0 })).toBe('mangan');
    for (const [han, tier] of [
      [5, 'mangan'],
      [6, 'haneman'],
      [8, 'baiman'],
      [11, 'sanbaiman'],
      [13, 'yakuman'],
    ] as const) {
      expect(getScoreTier({ han, fu: 30, yakuman: 0 })).toBe(tier);
    }
    expect(getScoreTier({ han: 0, fu: 0, yakuman: 2 })).toBe('doubleYakuman');
  });
  test('winning red five is separated without changing the hand', () => {
    const hand = [4, 4, 34, 6];
    expect(winningHand({ hand, winningTile: 34 })).toEqual([4, 4, 6]);
    expect(hand).toEqual([4, 4, 34, 6]);
  });
});

describe('P4 chatter', () => {
  test('old profiles default chatter on, explicitly disabled profiles stay off', () => {
    expect(normalizeRiichiSettings({ presentation: 'simple' }).chatter).toBe(
      true,
    );
    expect(normalizeRiichiSettings({ chatter: false }).chatter).toBe(false);
  });
  test('all eight roles have two translated lines for every trigger', () => {
    for (const character of CHARACTER_DEFS)
      for (const trigger of CHATTER_TRIGGERS)
        for (let index = 0; index < 2; index++) {
          const key = `character.chatter.${character.id}.${trigger}.${index}`;
          expect(getMessage('zh', key)).not.toBe(key);
          expect(getMessage('en', key)).not.toBe(key);
        }
  });
  test('table/seat cooldowns and cut-ins defer rather than consume a line', () => {
    let now = 0;
    const controller = new ChatterController(
      () => now,
      () => 0,
    );
    const match = createMatch({ seed: 1, matchLength: 'east' }).match;
    controller.trigger('other-riichi', [1], 0);
    expect(controller.next(match, 'mio', [], true)).toBeNull();
    expect(controller.next(match, 'mio', [1])).toBeNull();
    expect(controller.next(match, 'mio', [])?.seat).toBe(1);
    now = 5000;
    controller.trigger('stalled', [2], 0);
    expect(controller.next(match, 'mio', [])).toBeNull();
    now = 8000;
    expect(controller.next(match, 'mio', [])?.seat).toBe(2);
    now = 16000;
    controller.trigger('stalled', [1], 0);
    expect(controller.next(match, 'mio', [])).toBeNull();
    now = 20000;
    expect(controller.next(match, 'mio', [])?.seat).toBe(1);
    controller.trigger('stalled', [3], 0);
    controller.clearPending();
    now = 28000;
    expect(controller.next(match, 'mio', [])).toBeNull();
  });
  test('riichi reactions exclude the declarer and expired triggers are dropped', () => {
    let now = 0;
    const controller = new ChatterController(
      () => now,
      () => 0,
    );
    const match = createMatch({ seed: 2, matchLength: 'east' }).match;
    controller.observeEffects(match, [
      { type: 'moment', kind: 'riichi', seat: 0 },
    ]);
    expect(controller.next(match, 'mio', [])?.seat).toBe(1);
    controller.trigger('other-win', [2], 0);
    now = 9000;
    expect(controller.next(match, 'mio', [])).toBeNull();
  });
});

describe('P4 offline match review', () => {
  test('inefficient legal discards are selected using information from their own snapshot', async () => {
    let match = createMatch({ seed: 42, matchLength: 'east' }).match;
    for (let index = 0; index < 3000 && match.status !== 'matchEnd'; index++) {
      let event = nextAutoEvent(match);
      if (!event) break;
      if (
        (event.type === 'discard' || event.type === 'riichi') &&
        event.seat === 0 &&
        !match.round.riichiDeclared[0]
      ) {
        const worst = (match.round.turnOptions?.discardable ?? [])
          .map((tile) => ({
            tile,
            advice: getDiscardAdvice(match.round, tile),
          }))
          .sort(
            (a, b) =>
              (b.advice?.shanten ?? 0) - (a.advice?.shanten ?? 0) ||
              (a.advice?.ukeire ?? 0) - (b.advice?.ukeire ?? 0),
          )[0];
        if (worst) event = { type: 'discard', seat: 0, tile: worst.tile };
      }
      const step = applyEvent(match, event);
      expect(step).not.toBeNull();
      if (!step) break;
      match = step.match;
    }
    const review = await buildMatchReview(toReplayFile(match));
    const inefficient = review.decisions.filter(
      (decision) =>
        decision.reason === 'shanten' || decision.reason === 'ukeire',
    );
    expect(inefficient.length).toBeGreaterThan(0);
    for (const decision of inefficient) {
      expect(getBaseTile(decision.played)).not.toBe(
        getBaseTile(decision.recommended),
      );
      expect(
        decision.shantenDifference > 0 || decision.ukeireDifference >= 4,
      ).toBe(true);
    }
  }, 30000);
  test('replays match exactly, selects every deal-in and jumps to the decision hand', async () => {
    const match = simulateMatch({
      seed: 7,
      matchLength: 'east',
      levels: ['beginner', 'standard', 'strong', 'expert'],
    });
    expect(match.status).toBe('matchEnd');
    const file = toReplayFile(match);
    const original = JSON.stringify(file);
    const progress: number[] = [];
    const review = await buildMatchReview(file, {
      onProgress: (value) => progress.push(value),
    });
    expect(review.frames.at(-1)).toEqual(match);
    expect(JSON.stringify(file)).toBe(original);
    expect(review.decisions.length).toBeLessThanOrEqual(8);
    const endings = review.frames.filter(
      (frame, index) =>
        frame.round.phase === 'end' &&
        index > 0 &&
        review.frames[index - 1].round.phase !== 'end',
    );
    const dealIns = endings.filter(
      (frame) =>
        frame.round.result?.type === 'win' &&
        frame.round.result.wins.some((win) => win.ronFrom === 0),
    );
    expect(dealIns.length).toBeGreaterThan(0);
    expect(review.stats.rounds).toBe(endings.length);
    expect(review.stats.dealIns).toBe(dealIns.length);
    expect(
      review.decisions.filter((decision) => decision.reason === 'dealIn')
        .length,
    ).toBe(dealIns.length);
    for (const decision of review.decisions) {
      const frame = review.frames[decision.frameIndex];
      expect(frame.round.hands[0]).toEqual(decision.hand);
      expect(frame.events.length).toBe(decision.frameIndex);
      expect(decision.hand).toContain(decision.played);
      expect(frame.round.turnOptions?.discardable).toContain(
        decision.recommended,
      );
    }
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress.length).toBeGreaterThan(2);
    const win = endings.find((frame) => frame.round.result?.type === 'win')
      ?.round.result;
    if (win?.type === 'win')
      expect(winTimeline(win.wins).finalAt).toBeGreaterThanOrEqual(1100);
  }, 30000);
  test('unfinished and cancelled reviews cannot produce misleading results', async () => {
    const file = toReplayFile(
      createMatch({ seed: 42, matchLength: 'east' }).match,
    );
    expect(replayMatch(file)).toHaveLength(1);
    await expect(buildMatchReview(file)).rejects.toThrow(
      'Match is not complete',
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildMatchReview(file, { signal: controller.signal }),
    ).rejects.toThrow('Review cancelled');
  });
  test('an east match produces occasional chatter without changing any replay event', () => {
    let now = 0;
    const controller = new ChatterController(() => now, mulberry32(42));
    let count = 0;
    const match = simulateMatch({
      seed: 2026,
      matchLength: 'east',
      onStep: (before, event, after) => {
        now += 750;
        controller.observeMatch(before, after);
        if (event.type === 'riichi')
          controller.observeEffects(after, [
            { type: 'moment', kind: 'riichi', seat: event.seat },
          ]);
        const cutIn =
          event.type === 'riichi' ||
          (before.round.phase !== 'end' && after.round.result?.type === 'win');
        if (controller.next(after, 'mio', [], cutIn)) count++;
      },
    });
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(10);
    expect(replayMatch(toReplayFile(match)).at(-1)).toEqual(match);
  }, 30000);
});
