import { expect, test } from '@rstest/core';
import { CHARACTER_DEFS } from '../src/lib/playerCharacters';

test('CHARACTER_DEFS：每条定义含档案与挂载占位字段', () => {
  expect(CHARACTER_DEFS.length).toBeGreaterThan(0);
  for (const def of CHARACTER_DEFS) {
    expect(def.id).toBeTruthy();
    expect(def.name).toBeTruthy();
    expect(def.tagline).toBeTruthy();
    expect(def.accent).toBeTruthy();
    expect(def.unlockRule).toBeTruthy();
    expect('portraitKey' in def).toBe(true);
    expect('voicePackId' in def).toBe(true);
    expect('themeToken' in def).toBe(true);
    expect(
      def.portraitKey === null || typeof def.portraitKey === 'string',
    ).toBe(true);
    expect(
      def.voicePackId === null || typeof def.voicePackId === 'string',
    ).toBe(true);
    expect(def.themeToken === null || typeof def.themeToken === 'string').toBe(
      true,
    );
    if (def.bioKey !== undefined) {
      expect(def.bioKey.startsWith('character.bio.')).toBe(true);
    }
  }
});
