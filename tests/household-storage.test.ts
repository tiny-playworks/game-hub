import { describe, expect, it } from 'rstack/test';
import type { MemberSnapshot } from '../shared/contracts/member';
import {
  createStorageFromSnapshot,
  MemoryStorage,
} from '@/lib/household/snapshotStorage';
import { gameStorage, setStorageDriver } from '@/lib/storage';

function makeMockSnapshot(nickname: string, coins: number): MemberSnapshot {
  return {
    schema: 1,
    memberId: 'mem-123',
    revision: 1,
    updatedAt: new Date().toISOString(),
    profile: {
      nickname,
      avatarMode: 'preset',
      avatarPresetId: 'default-1',
      avatarUploadDataUrl: null,
      activeTitle: null,
      audioVolumes: { master: 0.8, sfx: 0.8, voice: 0.8, music: 0.8 },
      riichiSettings: {
        autoDraw: false,
        autoDiscard: false,
        autoRon: true,
        bgmTrack: 'classic',
        dangerHighlight: true,
        performanceMode: 'full',
      },
      updatedAt: Date.now(),
    },
    growth: { exp: 0, level: 1, points: 0, spent: 0 },
    characters: { selectedCharacterId: 'aoi', bondExp: {}, unlocked: ['aoi'] },
    wallet: {
      coins,
      lifetimeEarned: coins,
      ledger: [],
      dailyArcadeEarned: { dateKey: '', amount: 0 },
      rewardedMatchIds: [],
    },
    cosmetics: {
      owned: ['felt-venue', 'back-vermilion'],
      equipped: {
        'table-felt': 'felt-venue',
        'tile-back': 'back-vermilion',
        'avatar-frame': 'frame-simple',
        'riichi-stick': 'stick-classic',
      },
    },
    achievements: ['ach-1'],
    arcade: { stats: {}, receipts: [] },
    stats: { matches: 0, wins: 0, totalScore: 0 },
    dailyTasks: { dateKey: '2026-10-13', tasks: [] },
    weeklyTasks: { weekKey: '2026-W42', tasks: [] },
    checkin: { lastDate: '', streak: 0 },
    ranked: { pt: 100, rankTier: 'novice', maxPt: 100 },
    preferences: {
      locale: 'zh',
      riichiTheme: 'dark',
      venueTheme: 'classic',
      arcadePrefs: { sound: true },
    },
    legacyData: { 'game-hub-custom-data': 'hello' },
  };
}

describe('P10 Household Storage & Snapshot Isolation', () => {
  it('MemoryStorage handles standard Storage API operations', () => {
    const memory = new MemoryStorage();
    expect(memory.length).toBe(0);
    expect(memory.getItem('key1')).toBeNull();

    memory.setItem('key1', 'value1');
    memory.setItem('key2', 'value2');
    expect(memory.length).toBe(2);
    expect(memory.getItem('key1')).toBe('value1');
    expect(memory.key(0)).toBe('key1');

    memory.removeItem('key1');
    expect(memory.length).toBe(1);
    expect(memory.getItem('key1')).toBeNull();

    memory.clear();
    expect(memory.length).toBe(0);
  });

  it('createStorageFromSnapshot maps all member snapshot fields to known keys', () => {
    const snapshot = makeMockSnapshot('Alice', 2500);
    const storage = createStorageFromSnapshot(snapshot);

    const profile = JSON.parse(storage.getItem('game-hub-player-profile')!);
    expect(profile.nickname).toBe('Alice');

    const wallet = JSON.parse(storage.getItem('game-hub-wallet-v1')!);
    expect(wallet.coins).toBe(2500);

    const cosmetics = JSON.parse(storage.getItem('game-hub-cosmetics-v1')!);
    expect(cosmetics.owned).toContain('back-vermilion');

    expect(storage.getItem('game-hub-locale')).toBe('zh');
    expect(storage.getItem('game-hub-custom-data')).toBe('hello');
  });

  it('switching storage driver isolates member data from guest localStorage', () => {
    try {
      // 1. 游客模式：在本地写入游客数据
      setStorageDriver(null);
      gameStorage.setItem('game-hub-player-profile', JSON.stringify({ nickname: 'GuestUser' }));
      gameStorage.setItem('game-hub-wallet-v1', JSON.stringify({ coins: 100 }));

      expect(JSON.parse(gameStorage.getItem('game-hub-player-profile')!).nickname).toBe('GuestUser');
      expect(JSON.parse(gameStorage.getItem('game-hub-wallet-v1')!).coins).toBe(100);

      // 2. 登录成员 A：切换到成员 A 的快照驱动
      const memberA = makeMockSnapshot('MemberA', 8888);
      const driverA = createStorageFromSnapshot(memberA);
      setStorageDriver(driverA);

      expect(JSON.parse(gameStorage.getItem('game-hub-player-profile')!).nickname).toBe('MemberA');
      expect(JSON.parse(gameStorage.getItem('game-hub-wallet-v1')!).coins).toBe(8888);

      // 3. 登录成员 B：切换到成员 B 的快照驱动
      const memberB = makeMockSnapshot('MemberB', 300);
      const driverB = createStorageFromSnapshot(memberB);
      setStorageDriver(driverB);

      expect(JSON.parse(gameStorage.getItem('game-hub-player-profile')!).nickname).toBe('MemberB');
      expect(JSON.parse(gameStorage.getItem('game-hub-wallet-v1')!).coins).toBe(300);

      // 4. 退出登录：切回游客驱动，游客原始数据完好无损
      setStorageDriver(null);
      expect(JSON.parse(gameStorage.getItem('game-hub-player-profile')!).nickname).toBe('GuestUser');
      expect(JSON.parse(gameStorage.getItem('game-hub-wallet-v1')!).coins).toBe(100);
    } finally {
      setStorageDriver(null);
    }
  });
});
