import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { hashPin } from '../auth';
import { openDatabase } from '../db';
import { createEmptySnapshot } from '../snapshot';
import { GameRoomManager } from '../gameRooms/GameRoomManager';
import type { GameRoomCommand } from '../../../shared/contracts/gameRoom';

// This CLI is bundled to server/dist/demo.mjs. Never accept an arbitrary database.
const path = fileURLToPath(
  new URL('../data/demo/household.sqlite', import.meta.url),
);
const marker = fileURLToPath(
  new URL('../data/demo/.demo-only', import.meta.url),
);
if (
  process.env.GAME_HUB_DEMO !== '1' ||
  resolve(process.env.GAME_HUB_DB_PATH ?? '') !== path ||
  !existsSync(marker) ||
  readFileSync(marker, 'utf8') !== 'game-hub-local-demo-v1'
) {
  throw new Error(
    'Demo CLI only accepts the marked, isolated demo database. Use pnpm demo.',
  );
}
const db = openDatabase();
let manager: GameRoomManager | undefined;
try {
  const count = db.prepare('SELECT COUNT(*) AS count FROM members').get() as {
    count: number;
  };
  db.exec('CREATE TABLE IF NOT EXISTS demo_metadata (ready INTEGER NOT NULL)');
  if (count.count) {
    if (!db.prepare('SELECT ready FROM demo_metadata WHERE ready = 1').get())
      throw new Error('演示初始化未完成，请运行 pnpm demo:reset 后重试。');
    console.log('保留已有演示数据。使用 pnpm demo:reset 可重置演示库。');
  } else {
    {
      const members = ['演示甲', '演示乙', '演示棋友', '演示牌友'].map(
        (nickname) => {
          const id = randomUUID();
          const pin = hashPin('1234');
          const snapshot = createEmptySnapshot(id, nickname);
          db.prepare(
            'INSERT INTO members(id,pin_salt,pin_hash,snapshot,revision,created_at) VALUES (?,?,?,?,0,?)',
          ).run(
            id,
            pin.salt,
            pin.hash,
            JSON.stringify(snapshot),
            snapshot.updatedAt,
          );
          return id;
        },
      );
      const devices = members.map(() => randomUUID());
      manager = new GameRoomManager(db, (error) => {
        throw error;
      });
      const roomId = manager.create('gomoku', members[0], devices[0], {
        firstPlayer: 'host',
        clock: null,
      }).room.id;
      const send = (
        seat: number,
        type: GameRoomCommand['type'],
        payload?: GameRoomCommand['payload'],
      ) => {
        const view = manager!.view(roomId, members[seat], devices[seat])!;
        const ack = manager!.command(roomId, members[seat], devices[seat], {
          protocol: 1,
          roomId,
          commandId: randomUUID(),
          expectedRevision: view.room.revision,
          type,
          payload,
        });
        if (!ack.accepted) throw new Error(`Demo seed failed: ${ack.code}`);
      };
      send(1, 'join', { seatIndex: 1 });
      members
        .slice(0, 2)
        .forEach((id, seat) =>
          manager!.connection(roomId, id, devices[seat], true),
        );
      send(1, 'ready', { ready: true });
      send(0, 'start');
      [108, 0, 109, 2, 110, 4, 111, 6].forEach((index, ply) =>
        send(ply % 2, 'action', { action: { type: 'place', index } }),
      );
      members
        .slice(0, 2)
        .forEach((id, seat) =>
          manager!.connection(roomId, id, devices[seat], false),
        );
      manager.create('xiangqi', members[2], devices[2], {
        firstPlayer: 'host',
      });
      manager.create('doudizhu', members[3], devices[3]);
      db.exec('INSERT INTO demo_metadata(ready) VALUES (1)');
      console.log(
        '已创建四名演示成员，PIN 均为 1234；五子棋一步可结束，象棋和斗地主等待入座。',
      );
    }
  }
} finally {
  manager?.close();
  db.close();
}
