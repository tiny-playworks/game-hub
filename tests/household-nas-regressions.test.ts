import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, expect, test } from 'rstack/test';
import { openDatabase } from '../server/src/db';
import { RoomManager } from '../server/src/rooms/RoomManager';
import { createEmptySnapshot } from '../server/src/snapshot';
import { nextServerAiEvent, prepareRiichiRuntime } from '../server/src/riichi/runtime';
import { createMemberRiichiBridge } from '../src/lib/household/memberRiichi';
import { clearReceiptsForMember, deleteLocalResume, getPendingReceipts } from '../src/lib/household/offlineDb';
import { createMatch } from '../src/pages/mahjong/japanese/engine';
import type { RiichiOnlineBridge } from '../src/lib/household/riichiBridge';

beforeAll(prepareRiichiRuntime);
afterEach(() => { delete process.env.GAME_HUB_DB_PATH; });

test('member free play survives a network failure and queues its result without changing the confirmed wallet', async () => {
  const snapshot = createEmptySnapshot(randomUUID(), 'Offline QA');
  const matchId = randomUUID();
  const deviceId = randomUUID();
  let connected = true;
  const started = { ...createMatch({ seed: 602, matchLength: 'east' }), snapshot, matchId,
    playerCharacterId: snapshot.characters.activeCharacterId };
  const online: RiichiOnlineBridge = {
    start: async () => started,
    event: async () => { throw new TypeError('Failed to fetch'); },
    current: async () => started,
    forfeit: async () => { throw new Error('Not allowed'); },
  };
  const bridge = createMemberRiichiBridge({ online, snapshot: () => snapshot, deviceId,
    isOnline: () => connected, onOffline: () => { connected = false; } });
  try {
    let result = await bridge.start({ matchId, source: 'free', matchLength: 'east' });
    for (let i = 0; i < 10000 && result.match.status !== 'matchEnd'; i++) {
      const event = result.match.status === 'roundEnd' ? { type: 'nextRound' as const }
        : nextServerAiEvent(result.match, true);
      expect(event).not.toBeNull();
      result = await bridge.event({ matchId, expectedTurn: result.match.turn, event: event! });
    }
    expect(result.match.status).toBe('matchEnd');
    expect(connected).toBe(false);
    const receipts = await getPendingReceipts(snapshot.memberId);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].matchId).toBe(matchId);
    expect(receipts[0].deviceId).toBe(deviceId);
    expect(snapshot.wallet.coins).toBe(0);
    expect(snapshot.themeChallenges.progress['three-matches']).toBe(0);
  } finally {
    await clearReceiptsForMember(snapshot.memberId);
    await deleteLocalResume(matchId);
  }
});

test('stale room commands are rejected and durable retries do not execute again after restart', () => {
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  const member = randomUUID();
  const device = randomUUID();
  const snapshot = createEmptySnapshot(member, 'Room QA');
  db.prepare("INSERT INTO members(id,pin_salt,pin_hash,snapshot,created_at) VALUES (?,'salt','hash',?,?)")
    .run(member, JSON.stringify(snapshot), snapshot.updatedAt);
  const manager = new RoomManager(db);
  const room = manager.createRoom(member, 'Room QA', 'default-1', device);
  manager.startGame(room.id, member);
  try {
    const view = manager.getPlayerView(room.id, 0, device)!;
    const command = { protocol: 1 as const, commandId: randomUUID(), roomId: room.id,
      expectedRevision: view.revision, type: 'discard' as const,
      payload: { tile: view.seats[0].turnOptions!.discardable[0] } };
    expect(manager.dispatchAction(room.id, member, device, { ...command, expectedRevision: 0 }).code).toBe('ROOM_REVISION_CONFLICT');
    expect(manager.dispatchAction(room.id, member, device, command).accepted).toBe(true);
    manager.handleDisconnect(room.id, member, device);
    const recovered = new RoomManager(db);
    const revision = recovered.getRoom(room.id)!.revision;
    expect(recovered.dispatchAction(room.id, member, device, command).accepted).toBe(true);
    expect(recovered.getRoom(room.id)!.revision).toBe(revision);
    const observer = randomUUID();
    recovered.handleReconnect(room.id, member, device);
    recovered.handleDisconnect(room.id, member, observer);
    const seat = recovered.getRoom(room.id)!.seats[0];
    expect(seat.type === 'human' && seat.connected).toBe(true);
    recovered.handleDisconnect(room.id, member, device);
  } finally { manager.handleDisconnect(room.id, member, device); db.close(); }
});
