import { describe, expect, test } from 'rstack/test';
import { getBaseTile } from '../src/lib/mahjongRiichi';
import { getCharacterById } from '../src/lib/playerCharacters';
import { evaluateDefensiveDanger } from '../src/lib/riichiAi';
import { emptyVisibleCounts, evaluateDiscards } from '../src/lib/riichiShanten';
import {
  applyEvent,
  createMatch,
  dangerFor,
  decideAiTurn,
  isReplayFile,
  restoreMatch,
  toReplayFile,
  visibleCountsFor,
} from '../src/pages/mahjong/japanese/engine';
import { nextAutoEvent } from './helpers/riichiSim';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

describe('P3 four-level AI', () => {
  test('per-seat levels survive replay and old saves inherit the table level', () => {
    const match = createMatch({
      seed: 903,
      matchLength: 'east',
      rules: { aiLevel: 'strong' },
      seatAiLevels: [undefined, 'beginner', 'standard', 'expert'],
    }).match;
    const file = toReplayFile(match);
    expect(isReplayFile(file)).toBe(true);
    expect(restoreMatch(file)?.seatAiLevels).toEqual([
      'strong',
      'beginner',
      'standard',
      'expert',
    ]);
    const legacy = { ...file, seatAiLevels: undefined };
    expect(isReplayFile(legacy)).toBe(true);
    expect(restoreMatch(legacy)?.seatAiLevels).toEqual([
      'strong',
      'strong',
      'strong',
      'strong',
    ]);
    expect(isReplayFile({ ...file, seatAiLevels: ['invalid'] })).toBe(false);
  });

  test('strong uses shanten then visible ukeire even with a value-heavy character', () => {
    const state = createTestRound();
    state.hands[0] = tiles('23467m345p2268s15z');
    const match = matchWithRound(state);
    const candidates = evaluateDiscards(
      state.hands[0],
      [],
      visibleCountsFor(state, 0),
    );
    const best = candidates.sort(
      (a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire,
    )[0];
    const event = decideAiTurn(
      match.round,
      0,
      'strong',
      getCharacterById('yoru').style,
    );
    expect(event?.type).toBe('discard');
    if (event?.type !== 'discard') throw new Error('Expected discard');
    const selected = candidates.find(
      (candidate) => candidate.base === getBaseTile(event.tile),
    );
    expect(selected?.shanten).toBe(best.shanten);
    expect(selected?.ukeire).toBe(best.ukeire);
    expect(applyEvent(match, event)).not.toBeNull();
  });

  test('advanced levels fold a cheap one-shanten hand using genbutsu', () => {
    const state = createTestRound();
    state.hands[0] = tiles('123456m23p67s55p1z9s');
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('1m')];
    const match = matchWithRound(state);
    for (const level of ['strong', 'expert'] as const) {
      expect(decideAiTurn(match.round, 0, level)).toEqual({
        type: 'discard',
        seat: 0,
        tile: tile('1m'),
      });
    }
  });

  test('strong keeps mangan dama and expert avoids late poor-wait riichi', () => {
    const state = createTestRound();
    state.hands[0] = tiles('1122445577889m1z');
    state.drawnTile = tile('1z');
    state.doraIndicators = [tile('9p')];
    expect(decideAiTurn(matchWithRound(state).round, 0, 'strong')?.type).toBe(
      'discard',
    );
    state.hands[0] = tiles('123456m789p678s5p1z');
    state.wall = state.wall.slice(0, 12);
    expect(decideAiTurn(matchWithRound(state).round, 0, 'expert')?.type).toBe(
      'discard',
    );
  });

  test('expert defends an All Last lead where strong pushes a good wait', () => {
    const state = createTestRound(0, 1, 4);
    state.hands[0] = tiles('123456m345p67s22p1z');
    state.drawnTile = tile('1z');
    state.doraIndicators = [tile('9p')];
    state.scores = [43000, 27000, 20000, 10000];
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('3m')];
    const round = matchWithRound(state).round;
    expect(decideAiTurn(round, 0, 'strong')).not.toEqual({
      type: 'discard',
      seat: 0,
      tile: tile('3m'),
    });
    expect(decideAiTurn(round, 0, 'expert')).toEqual({
      type: 'discard',
      seat: 0,
      tile: tile('3m'),
    });
  });

  test('defensive categories and flush reads preserve absolute genbutsu safety', () => {
    const visible = emptyVisibleCounts();
    const opponent = {
      discards: tiles('4m4p4s'),
      safeAfterRiichi: [],
      riichi: true,
      riichiIndex: 2,
      meldCount: 0,
    };
    visible[tile('1z')] = 3;
    visible[tile('1m')] = 2;
    visible[tile('2p')] = 4;
    visible[tile('2z')] = 2;
    const risks = ['4m', '1z', '1m', '1p', '1s', '2z', '5p'].map((name) =>
      evaluateDefensiveDanger(tile(name), opponent, visible),
    );
    expect(risks).toEqual([...risks].sort((a, b) => a - b));
    const state = createTestRound();
    state.discardPiles[1] = tiles('19p19s2z');
    state.melds[1] = [{ type: 'chi', tiles: tiles('123m'), fromPlayer: 0 }];
    const counts = visibleCountsFor(state, 0);
    expect(dangerFor(state, 0, tile('5m'), counts, 'expert')).toBeGreaterThan(
      dangerFor(state, 0, tile('5p'), counts, 'expert'),
    );
    expect(dangerFor(state, 0, tile('1p'), counts, 'expert')).toBe(0);
  });

  test('decisions are deterministic and never inspect concealed opponents or wall order', () => {
    const match = createMatch({ seed: 882, matchLength: 'east' }).match;
    const original = structuredClone(match.round);
    const hidden = structuredClone(original);
    hidden.hands[1] = tiles('1112223334445m');
    hidden.hands[2] = tiles('1112223334445p');
    hidden.hands[3] = tiles('1112223334445s');
    hidden.wall.reverse();
    hidden.uraDoraIndicators = tiles('123z');
    for (const level of ['strong', 'expert'] as const) {
      const event = decideAiTurn(match.round, 0, level);
      expect(decideAiTurn(hidden, 0, level)).toEqual(event);
      if (!event) throw new Error('Expected an AI decision');
      expect(applyEvent(match, event)).not.toBeNull();
    }
    expect(match.round).toEqual(original);
  });

  test('mixed levels finish seeded matches with legal decisions; measure decision latency', () => {
    const durations: number[] = [];
    for (const seed of [3101, 3102]) {
      let match = createMatch({ seed, matchLength: 'east' }).match;
      for (let step = 0; step < 12000 && match.status !== 'matchEnd'; step++) {
        const start = performance.now();
        const event = nextAutoEvent(match, [
          'strong',
          'expert',
          'strong',
          'expert',
        ]);
        durations.push(performance.now() - start);
        if (!event) throw new Error('AI stalled before match end');
        const next = applyEvent(match, event);
        if (!next)
          throw new Error(`Illegal AI event: ${JSON.stringify(event)}`);
        match = next.match;
      }
      expect(match.status).toBe('matchEnd');
    }
    durations.sort((a, b) => a - b);
    console.info(
      `P3 decision latency: n=${durations.length}, p95=${durations[Math.floor(durations.length * 0.95)].toFixed(2)}ms, max=${durations[durations.length - 1].toFixed(2)}ms`,
    );
  }, 60000);
});
