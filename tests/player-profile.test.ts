import { expect, test } from '@rstest/core';
import {
  createDefaultPlayerProfile,
  DEFAULT_AUDIO_VOLUMES,
  getCenterSquareCrop,
  getPlayerProfile,
  normalizeAudioVolumes,
  PLAYER_NICKNAME_FALLBACK,
  PLAYER_NICKNAME_MAX_LENGTH,
  PLAYER_PROFILE_STORAGE_KEY,
  sanitizeNickname,
  savePlayerProfile,
  updatePlayerProfile,
} from '../src/lib/playerProfile';

test('playerProfile：昵称规则（trim/空值回退/最大长度）', () => {
  localStorage.clear();
  expect(sanitizeNickname('  阿明  ')).toBe('阿明');
  expect(sanitizeNickname('   ')).toBe(PLAYER_NICKNAME_FALLBACK);
  expect(sanitizeNickname('abcdefghijklmnopq').length).toBe(
    PLAYER_NICKNAME_MAX_LENGTH,
  );
});

test('playerProfile：读取无效存储时回退默认值', () => {
  localStorage.clear();
  localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, '{bad-json');
  const profile = getPlayerProfile();
  expect(profile.nickname).toBe(PLAYER_NICKNAME_FALLBACK);
  expect(profile.avatarMode).toBe('preset');
});

test('playerProfile：保存与更新本地档案', () => {
  localStorage.clear();
  const defaults = createDefaultPlayerProfile();
  const saved = savePlayerProfile({ ...defaults, nickname: '  玩家A  ' });
  expect(saved.nickname).toBe('玩家A');

  const updated = updatePlayerProfile({
    nickname: '  ',
    avatarMode: 'preset',
    avatarPresetId: defaults.avatarPresetId,
  });
  expect(updated.nickname).toBe(PLAYER_NICKNAME_FALLBACK);
  expect(getPlayerProfile().nickname).toBe(PLAYER_NICKNAME_FALLBACK);
});

test('playerProfile：audioVolumes 默认与归一化', () => {
  localStorage.clear();
  expect(getPlayerProfile().audioVolumes).toEqual(DEFAULT_AUDIO_VOLUMES);
  expect(normalizeAudioVolumes({ bgm: 2, sfx: -0.5, voice: 0.25 })).toEqual({
    bgm: 1,
    sfx: 0,
    voice: 0.25,
  });
});

test('playerProfile：updatePlayerProfile 部分合并 audioVolumes', () => {
  localStorage.clear();
  updatePlayerProfile({ audioVolumes: { sfx: 0.5 } });
  const p = getPlayerProfile();
  expect(p.audioVolumes.sfx).toBe(0.5);
  expect(p.audioVolumes.bgm).toBe(1);
  expect(p.audioVolumes.voice).toBe(1);
});

test('playerProfile：中心裁剪框始终为方形', () => {
  const landscape = getCenterSquareCrop(640, 360);
  expect(landscape.size).toBe(360);
  expect(landscape.x).toBe(140);
  expect(landscape.y).toBe(0);

  const portrait = getCenterSquareCrop(300, 500);
  expect(portrait.size).toBe(300);
  expect(portrait.x).toBe(0);
  expect(portrait.y).toBe(100);
});
