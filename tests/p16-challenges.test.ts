import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'rstack/test';
import { openDatabase } from '../server/src/db';
import { getCharacterStory } from '../src/lib/characterStories';
import { familyMessages } from '../src/lib/familyMessages';
import { getMessage } from '../src/lib/i18n';
import { CHARACTER_DEFS } from '../src/lib/playerCharacters';
import { gameStorage, setStorageDriver } from '../src/lib/storage';
import {
  getThemeChallengeState,
  recordThemeChallengeMatch,
  THEME_CHALLENGES_STORAGE_KEY,
} from '../src/lib/themeChallenges';
import { GROWTH_STORAGE_KEY } from '../src/lib/growth';
import { WALLET_STORAGE_KEY } from '../src/lib/wallet';
import { createMatch } from '../src/pages/mahjong/japanese/engine/match';
import { simulateMatch } from './helpers/riichiSim';

afterEach(() => {
  delete process.env.GAME_HUB_DB_PATH;
  setStorageDriver(null);
  for (const key of [THEME_CHALLENGES_STORAGE_KEY, GROWTH_STORAGE_KEY, WALLET_STORAGE_KEY]) {
    localStorage.removeItem(key);
  }
});

test('pre-P16 server matches migrate as ineligible while new matches can opt in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'game-hub-p16-'));
  const path = join(dir, 'legacy.sqlite');
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE riichi_matches (
        member_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        source TEXT NOT NULL,
        state_json TEXT NOT NULL,
        player_character_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        finished_at INTEGER,
        PRIMARY KEY(member_id, match_id)
      );
      INSERT INTO riichi_matches
        (member_id, match_id, device_id, source, state_json, player_character_id, created_at, updated_at)
        VALUES ('old-member', 'old-match', 'old-device', 'free', '{}', 'aoi', 1, 1);
    `);
    legacy.close();

    process.env.GAME_HUB_DB_PATH = path;
    const db = openDatabase();
    try {
      const row = db.prepare('SELECT challenge_eligible FROM riichi_matches WHERE match_id = ?')
        .get('old-match') as { challenge_eligible: number };
      expect(row.challenge_eligible).toBe(0);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P16 story keys exist in both languages for every playable character, including Aoi', () => {
  expect(CHARACTER_DEFS.map((character) => character.id)).toContain('aoi');
  for (const character of CHARACTER_DEFS) {
    const story = getCharacterStory(character.id, 4);
    expect(story).toBeDefined();
    for (const key of [story!.titleKey, ...story!.lines.map((line) => line.textKey)]) {
      for (const locale of ['zh', 'en'] as const) {
        expect(getMessage(locale, key)).not.toBe(key);
      }
    }
  }
});

test('family lobby and room copy has matching Chinese and English keys', () => {
  expect(Object.keys(familyMessages.zh).sort()).toEqual(Object.keys(familyMessages.en).sort());
});

test('three new completed matches count once each and cannot award twice on refresh', () => {
  const match = simulateMatch({ seed: 602, matchLength: 'east' });
  expect(match.status).toBe('matchEnd');
  const first = recordThemeChallengeMatch(match, 'new-602-a', 'free');
  expect(first.duplicate).toBe(false);
  expect(first.state.progress['three-matches']).toBe(1);

  const coinsAfterFirst = JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null')?.coins ?? 0;
  const pointsAfterFirst = JSON.parse(gameStorage.getItem(GROWTH_STORAGE_KEY) ?? 'null')?.taskPoints ?? 0;
  const replayed = recordThemeChallengeMatch(match, 'new-602-a', 'free');
  expect(replayed.duplicate).toBe(true);
  expect(getThemeChallengeState().progress['three-matches']).toBe(1);
  expect(JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null')?.coins ?? 0).toBe(coinsAfterFirst);
  expect(JSON.parse(gameStorage.getItem(GROWTH_STORAGE_KEY) ?? 'null')?.taskPoints ?? 0).toBe(pointsAfterFirst);

  recordThemeChallengeMatch(match, 'new-602-b', 'free');
  const third = recordThemeChallengeMatch(match, 'new-602-c', 'free');
  expect(third.state.progress['three-matches']).toBe(3);
  expect(third.newlyCompleted).toContain('three-matches');
  const coinsAfterThird = JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null')?.coins ?? 0;
  const pointsAfterThird = JSON.parse(gameStorage.getItem(GROWTH_STORAGE_KEY) ?? 'null')?.taskPoints ?? 0;
  expect(coinsAfterThird - coinsAfterFirst).toBe(40);
  expect(pointsAfterThird - pointsAfterFirst).toBe(30);

  recordThemeChallengeMatch(match, 'new-602-d', 'free');
  expect(getThemeChallengeState().completedIds.filter((id) => id === 'three-matches')).toHaveLength(1);
  expect(JSON.parse(gameStorage.getItem(WALLET_STORAGE_KEY) ?? 'null')?.coins ?? 0).toBe(coinsAfterThird);
});

test('unfinished matches and a ranked/free source mismatch cannot advance challenges', () => {
  const unfinished = createMatch({ seed: 603, matchLength: 'east' }).match;
  expect(recordThemeChallengeMatch(unfinished, 'unfinished', 'free').duplicate).toBe(true);
  const finished = simulateMatch({ seed: 604, matchLength: 'east' });
  expect(recordThemeChallengeMatch(finished, 'wrong-source', 'ai-ranked').duplicate).toBe(true);
  expect(getThemeChallengeState().creditedMatchIds).toEqual([]);
});

test('a closed win and a full South match without dealing in complete their goals', () => {
  const closedMatch = simulateMatch({ seed: 1, matchLength: 'south' });
  expect(closedMatch.status).toBe('matchEnd');
  const closed = recordThemeChallengeMatch(closedMatch, 'closed-south-1', 'free');
  expect(closed.newlyCompleted).toContain('menzen-win');

  const safeMatch = simulateMatch({ seed: 2, matchLength: 'south' });
  expect(safeMatch.status).toBe('matchEnd');
  const safe = recordThemeChallengeMatch(safeMatch, 'safe-south-2', 'free');
  expect(safe.state.progress['safe-south']).toBe(1);
  expect(safe.state.completedIds).toContain('safe-south');
});
