import { randomUUID } from 'node:crypto';
import { hashPin, validatePin } from '../auth';
import { getMember, openDatabase, transaction } from '../db';
import { createEmptySnapshot } from '../snapshot';
import { sanitizeNickname } from '@/lib/playerProfile';

function readPin(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('PIN entry requires an interactive terminal');
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error?: Error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (data: Buffer) => {
      for (const char of data.toString('utf8')) {
        if (char === '\u0003') return done(new Error('Cancelled'));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f') value = value.slice(0, -1);
        else if (/\d/.test(char) && value.length < 4) value += char;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function confirmedPin(): Promise<string> {
  const pin = await readPin('输入 4 位 PIN：');
  const repeat = await readPin('再输入一次 PIN：');
  if (!validatePin(pin) || pin !== repeat) throw new Error('PIN 不匹配或不是 4 位数字');
  return pin;
}

const db = openDatabase();
try {
  const [command, argument] = process.argv.slice(2);
  if (command === 'list') {
    const rows = db.prepare('SELECT id, snapshot FROM members ORDER BY created_at').all() as
      { id: string; snapshot: string }[];
    for (const row of rows) {
      const snapshot = JSON.parse(row.snapshot) as { profile: { nickname: string } };
      console.log(`${row.id}  ${snapshot.profile.nickname}`);
    }
  } else if (command === 'create') {
    if (!argument?.trim()) throw new Error('用法：member create "昵称"');
    const nickname = sanitizeNickname(argument);
    const pin = await confirmedPin();
    const id = randomUUID();
    const hashed = hashPin(pin);
    const snapshot = createEmptySnapshot(id, nickname);
    transaction(db, () => {
      db.prepare(`
        INSERT INTO members(id, pin_salt, pin_hash, snapshot, revision, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(id, hashed.salt, hashed.hash, JSON.stringify(snapshot), snapshot.updatedAt);
    });
    console.log(`已创建成员：${nickname} (${id})`);
  } else if (command === 'reset-pin') {
    if (!argument || !getMember(db, argument)) throw new Error('成员不存在');
    const pin = await confirmedPin();
    const hashed = hashPin(pin);
    transaction(db, () => {
      db.prepare('UPDATE members SET pin_salt = ?, pin_hash = ? WHERE id = ?')
        .run(hashed.salt, hashed.hash, argument);
      db.prepare('DELETE FROM sessions WHERE member_id = ?').run(argument);
      db.prepare('DELETE FROM pin_failures WHERE member_id = ?').run(argument);
    });
    console.log('PIN 已重置，旧设备会话已失效');
  } else {
    throw new Error('用法：member list | create "昵称" | reset-pin <memberId>');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '操作失败');
  process.exitCode = 1;
} finally {
  db.close();
}
