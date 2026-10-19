import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'rstack/test';
import { openDatabase } from '../server/src/db';
import { createEmptySnapshot } from '../server/src/snapshot';

const ID = '00000000-0000-4000-8000-0000000000e1';
const digest = (db: DatabaseSync) => {
  const row = db.prepare('SELECT snapshot, revision FROM members WHERE id = ?').get(ID) as
    { snapshot: string; revision: number };
  return `${row.revision}:${createHash('sha256').update(row.snapshot).digest('hex')}`;
};

describe('P22 pre-release migration rehearsal (local, non-NAS)', () => {
  it('upgrades a pre-P19/P20/P23 database without touching member snapshots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p22-'));
    process.env.GAME_HUB_DB_PATH = join(dir, 'household.sqlite');
    try {
      // Create current schema, then roll it back to the pre-round-3/4 shape.
      const seed = openDatabase();
      const snapshot = createEmptySnapshot(ID, 'Legacy');
      snapshot.arcade.stats['snake:normal'] = {
        highScore: 777, playCount: 3, maxCombo: 0, minValue: null, wins: 0, streak: 0,
        bestStreak: 0, drawStreak: 0, landlordStreak: 0, maxTile: 0, maxLines: 0,
      };
      seed.prepare(`INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES (?, 's', 'h', ?, 7, ?)`).run(ID, JSON.stringify(snapshot), snapshot.updatedAt);
      seed.exec(`
        DROP TABLE journey_attempts;
        CREATE TABLE journey_attempts (
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          attempt_id TEXT NOT NULL,
          stage_id TEXT NOT NULL CHECK(stage_id IN ('aoi-balance', 'rin-tempo', 'mio-defense')),
          content_version INTEGER NOT NULL CHECK(content_version = 1),
          payload_hash TEXT NOT NULL,
          evaluation_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY(member_id, attempt_id)
        );
        INSERT INTO journey_attempts VALUES ('${ID}', 'a1', 'aoi-balance', 1, 'h', '{}', 1);
        DROP TABLE family_cup_matches;
        DROP TABLE family_cups;
        DROP TABLE leaderboard_entries;
        DROP TABLE leaderboard_week_settlements;
        DROP TABLE weekly_champions;
        DROP TABLE family_feed;
      `);
      const before = digest(seed);
      seed.close();

      const migrated = openDatabase();
      expect(digest(migrated)).toBe(before);
      const tables = (migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as
        Array<{ name: string }>).map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining([
        'family_cups', 'family_cup_matches', 'leaderboard_entries',
        'leaderboard_week_settlements', 'weekly_champions', 'family_feed',
      ]));
      // Old journey attempt survives and the new stages are writable.
      expect(migrated.prepare('SELECT count(*) AS n FROM journey_attempts').get()).toEqual({ n: 1 });
      migrated.prepare(`INSERT INTO journey_attempts VALUES (?, 'a2', 'yoru-reading', 1, 'h', '{}', 2)`).run(ID);
      // P23 seeds the existing personal best for the all-time board.
      expect(migrated.prepare('SELECT value FROM leaderboard_entries WHERE member_id = ?').get(ID))
        .toEqual({ value: 777 });
      expect(migrated.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      migrated.close();

      // Idempotent: reopening changes nothing.
      const again = openDatabase();
      expect(digest(again)).toBe(before);
      expect(again.prepare('SELECT count(*) AS n FROM leaderboard_entries').get()).toEqual({ n: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHARACTER_DEFS,
  CHARACTER_LINE_TRIGGERS,
  PLAYER_CHARACTER_STORAGE_KEY,
  getCharacterById,
  getPlayerCharacterState,
  syncPlayerCharacterUnlocks,
  setActiveCharacter,
  getCharacterLines,
} from '../src/lib/playerCharacters';
import { CHARACTER_STORIES, getCharacterStory } from '../src/lib/characterStories';
import { COSMETIC_DEFS } from '../src/lib/cosmetics';
import { getMessage } from '../src/lib/i18n';
import { tsubakiMessages } from '../src/lib/tsubakiMessages';
import {
  JOURNEY_PROGRESS_STORAGE_KEY,
  getJourneyProgress,
  recordJourneyEvaluation,
} from '../src/lib/journeyProgress';
import { createJourneyMatch } from '../src/lib/riichiJourney';
import { advancedStance } from '../src/pages/mahjong/japanese/engine/aiStrategy';

describe('P22.3: 10th Character (tsubaki / 椿) integration', () => {
  it('registers tsubaki as the 10th character with complete WebP assets and permanent cosmetics', () => {
    expect(CHARACTER_DEFS).toHaveLength(10);
    const tsubaki = getCharacterById('tsubaki');
    expect(tsubaki.id).toBe('tsubaki');
    expect(tsubaki.unlockRule).toEqual({ type: 'journey-stage', target: 'tsubaki-finale' });
    expect(tsubaki.style.comebackBias).toBeGreaterThanOrEqual(0.8);
    expect(tsubaki.rankBand).toBe('master');

    // Verify all 4 WebP files exist on disk
    const assetDir = resolve(__dirname, '../src/assets/characters/tsubaki');
    for (const file of ['avatar.webp', 'normal.webp', 'happy.webp', 'frustrated.webp']) {
      expect(existsSync(join(assetDir, file))).toBe(true);
    }

    // Verify permanent cosmetics generated at index 9 (win-tsubaki at stage 3, frame-tsubaki at stage 4)
    const winCosmetic = COSMETIC_DEFS.find((c) => c.id === 'win-tsubaki');
    const frameCosmetic = COSMETIC_DEFS.find((c) => c.id === 'frame-tsubaki');
    expect(winCosmetic).toBeDefined();
    expect(winCosmetic?.category).toBe('win-effect');
    expect(frameCosmetic).toBeDefined();
    expect(frameCosmetic?.category).toBe('avatar-frame');
  });

  it('has complete bilingual (zh/en) copy for profile, cosmetics, 4-stage stories, chatter, and lines', () => {
    expect(Object.keys(tsubakiMessages.zh).sort()).toEqual(Object.keys(tsubakiMessages.en).sort());
    for (const key of Object.keys(tsubakiMessages.zh)) {
      expect(getMessage('zh', key)).not.toBe(key);
      expect(getMessage('en', key)).not.toBe(key);
    }

    const tsubaki = getCharacterById('tsubaki');
    const tsubakiStories = CHARACTER_STORIES.filter((s) => s.characterId === 'tsubaki');
    expect(tsubakiStories).toHaveLength(4);
    for (const stage of [1, 2, 3, 4] as const) {
      const story = getCharacterStory('tsubaki', stage);
      expect(story).toBeDefined();
      expect(story!.lines.length).toBeGreaterThanOrEqual(3);
      for (const locale of ['zh', 'en'] as const) {
        expect(getMessage(locale, story!.titleKey)).not.toBe(story!.titleKey);
        for (const line of story!.lines) {
          expect(getMessage(locale, line.textKey)).not.toBe(line.textKey);
        }
      }
    }

    for (const locale of ['zh', 'en'] as const) {
      for (const trigger of CHARACTER_LINE_TRIGGERS) {
        const lines = getCharacterLines(tsubaki, trigger);
        expect(lines.length).toBeGreaterThanOrEqual(1);
        for (const key of lines) {
          expect(getMessage(locale, key)).not.toBe(key);
        }
        const affinityKey = `character.affinityLine.tsubaki.${trigger}`;
        expect(getMessage(locale, affinityKey)).not.toBe(affinityKey);
      }
    }
  });

  it('keeps tsubaki locked until tsubaki-finale is completed, then unlocks and allows selection', () => {
    localStorage.removeItem(JOURNEY_PROGRESS_STORAGE_KEY);
    localStorage.removeItem(PLAYER_CHARACTER_STORAGE_KEY);
    try {
      const beforeSync = syncPlayerCharacterUnlocks();
      expect(beforeSync.state.unlockedCharacterIds).not.toContain('tsubaki');

      // Cannot select while locked
      setActiveCharacter('aoi');
      const blocked = setActiveCharacter('tsubaki');
      expect(blocked.activeCharacterId).toBe('aoi');

      // Complete tsubaki-finale and persist journey state
      const nextJourney = recordJourneyEvaluation(
        getJourneyProgress(),
        'att-tsubaki-1',
        'tsubaki-finale',
        {
          completed: true,
          pointsDelta: 5200,
          playerDiscards: 8,
          openMelds: 0,
          reachedTenpai: true,
          survivedThreat: true,
          declaredRiichi: true,
          suitFocusCount: 6,
          failureReasonKey: null,
        },
        Date.now(),
      );
      localStorage.setItem(JOURNEY_PROGRESS_STORAGE_KEY, JSON.stringify(nextJourney));
      const afterSync = syncPlayerCharacterUnlocks();

      expect(afterSync.newlyUnlockedCharacters.map((c) => c.id)).toContain('tsubaki');
      expect(getPlayerCharacterState().unlockedCharacterIds).toContain('tsubaki');
      const selected = setActiveCharacter('tsubaki');
      expect(selected.activeCharacterId).toBe('tsubaki');
    } finally {
      localStorage.removeItem(JOURNEY_PROGRESS_STORAGE_KEY);
      localStorage.removeItem(PLAYER_CHARACTER_STORAGE_KEY);
    }
  });

  it('adjusts AI strategic stance based on public score differential via comebackBias', () => {
    const baseMatch = createJourneyMatch('tsubaki-finale');
    const tsubaki = getCharacterById('tsubaki');
    const attack = { points: 5200, waitTypes: 1, remaining: 3 };

    // Case 1: tsubaki (seat 1) is comfortably leading (+16000 over second place) -> folds with single-wait non-mangan tenpai against threat
    const leadingRound = {
      ...baseMatch.round,
      scores: [20000, 38000, 22000, 20000],
    };
    const leadingStance = advancedStance(leadingRound, 1, 0, attack, 1.85, false, tsubaki.style);

    // Case 2: tsubaki (seat 1) is trailing by 16000 -> comebackRelief lowers perceived pressure so she stays balanced instead of folding
    const trailingRound = {
      ...baseMatch.round,
      scores: [34000, 18000, 24000, 24000],
    };
    const trailingStance = advancedStance(trailingRound, 1, 0, attack, 1.85, false, tsubaki.style);

    expect(leadingStance).toBe('fold');
    expect(trailingStance).toBe('balanced');
  });
});

