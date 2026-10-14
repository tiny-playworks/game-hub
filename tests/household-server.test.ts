import { describe, expect, it } from 'rstack/test';
import { hashPin, validatePin } from '../server/src/auth';
import {
  openDatabase,
  readSnapshot,
  saveSnapshot,
  type MemberRow,
} from '../server/src/db';
import {
  createEmptySnapshot,
  parseLegacyImport,
} from '../server/src/snapshot';

describe('P10 Household Server Auth & Authority Logic', () => {
  it('validatePin enforces exactly 4 numeric digits', () => {
    expect(validatePin('1234')).toBe(true);
    expect(validatePin('0000')).toBe(true);
    expect(validatePin('9876')).toBe(true);

    expect(validatePin('123')).toBe(false);
    expect(validatePin('12345')).toBe(false);
    expect(validatePin('abcd')).toBe(false);
    expect(validatePin('12a4')).toBe(false);
    expect(validatePin(null)).toBe(false);
  });

  it('hashPin generates salted scrypt hashes correctly', () => {
    const { salt, hash } = hashPin('1234');
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(64);

    const rehashed = hashPin('1234', salt);
    expect(rehashed.hash).toBe(hash);

    const wrong = hashPin('4321', salt);
    expect(wrong.hash).not.toBe(hash);
  });

  it('parseLegacyImport validates standard Game Hub save and rejects partial recovery', () => {
    const validSave = {
      app: 'game-hub',
      schema: 1,
      exportedAt: new Date().toISOString(),
      data: {
        'game-hub-player-profile': JSON.stringify({ nickname: 'LegacyPlayer' }),
        'game-hub-wallet-v1': JSON.stringify({ coins: 300 }),
      },
    };

    const snapshot = parseLegacyImport(validSave, 'mem-test', 'DefaultNick');
    expect(snapshot.profile.nickname).toBe('LegacyPlayer');
    expect(snapshot.wallet.coins).toBe(300);
    expect(snapshot.revision).toBe(0);

    // 拒绝 partial=true 的损坏备份
    const partialSave = {
      ...validSave,
      recovery: { partial: true, pendingCount: 1 },
    };
    expect(() => parseLegacyImport(partialSave, 'mem-test', 'DefaultNick')).toThrow(
      'Invalid or partial save file',
    );
  });

  it('in-memory database maintains revision increment and transactional integrity', () => {
    process.env.GAME_HUB_DB_PATH = ':memory:';
    const db = openDatabase();
    try {
      const id = 'mem-unit-1';
      const initial = createEmptySnapshot(id, 'Alice');
      initial.wallet.coins = 500;

      db.prepare(`
        INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES (?, 'salt', 'hash', ?, 0, ?)
      `).run(id, JSON.stringify(initial), initial.updatedAt);

      const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as unknown as MemberRow;
      expect(row.revision).toBe(0);

      const loaded = readSnapshot(row);
      expect(loaded.wallet.coins).toBe(500);

      // 保存新版本
      const updated = saveSnapshot(db, row, {
        ...loaded,
        wallet: { ...loaded.wallet, coins: 400 },
      });
      expect(updated.revision).toBe(1);

      // 再次读取
      const updatedRow = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as unknown as MemberRow;
      expect(updatedRow.revision).toBe(1);
      expect(readSnapshot(updatedRow).wallet.coins).toBe(400);

      // 旧 revision 尝试写入抛出冲突异常
      expect(() =>
        saveSnapshot(db, row, { ...loaded, wallet: { ...loaded.wallet, coins: 300 } }),
      ).toThrow('Member revision conflict');
    } finally {
      db.close();
    }
  });
});
