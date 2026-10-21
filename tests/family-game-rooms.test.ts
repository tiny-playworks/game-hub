import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, rs } from 'rstack/test';
import type {
  FamilyGameId,
  GameRoomCommand,
  GameRoomSettings,
} from '../shared/contracts/gameRoom';
import { getMember, openDatabase, readSnapshot } from '../server/src/db';
import { GameRoomManager } from '../server/src/gameRooms/GameRoomManager';
import { assertNoActiveMatch } from '../server/src/gameRooms/activeMatch';
import { doudizhuAdapter } from '../server/src/gameRooms/adapters/doudizhu';
import { listHeadToHead } from '../server/src/gameRooms/settlement';
import { createEmptySnapshot } from '../server/src/snapshot';

const resources: {
  manager: GameRoomManager;
  db: ReturnType<typeof openDatabase>;
}[] = [];
afterEach(() => {
  for (const item of resources.splice(0)) {
    item.manager.close();
    item.db.close();
  }
  rs.restoreAllMocks();
});

function fixture(
  gameId: FamilyGameId = 'gomoku',
  humans = 2,
  settings: Partial<GameRoomSettings> = {},
) {
  const previousPath = process.env.GAME_HUB_DB_PATH;
  process.env.GAME_HUB_DB_PATH = ':memory:';
  const db = openDatabase();
  if (previousPath === undefined) delete process.env.GAME_HUB_DB_PATH;
  else process.env.GAME_HUB_DB_PATH = previousPath;
  const members = Array.from({ length: 4 }, () => randomUUID());
  const devices = members.map(() => randomUUID());
  for (const [index, id] of members.entries()) {
    const snapshot = createEmptySnapshot(id, `QA ${index}`);
    db.prepare(
      `INSERT INTO members(id,pin_salt,pin_hash,snapshot,revision,created_at)
      VALUES (?,'s','h',?,0,?)`,
    ).run(id, JSON.stringify(snapshot), snapshot.updatedAt);
  }
  const onError = rs.fn();
  const resource = { manager: new GameRoomManager(db, onError), db };
  resources.push(resource);
  const roomId = resource.manager.create(gameId, members[0], devices[0], {
    firstPlayer: 'host',
    ...settings,
  }).room.id;
  const view = (index = 0, device = devices[index]) =>
    resource.manager.view(roomId, members[index], device)!;
  const command = (
    index: number,
    type: GameRoomCommand['type'],
    payload?: GameRoomCommand['payload'],
    device = devices[index],
  ) => {
    const envelope: GameRoomCommand = {
      protocol: 1,
      roomId,
      commandId: randomUUID(),
      expectedRevision: view(index).room.revision,
      type,
      payload,
    };
    return {
      envelope,
      ack: resource.manager.command(roomId, members[index], device, envelope),
    };
  };
  const send = (
    index: number,
    type: GameRoomCommand['type'],
    payload?: GameRoomCommand['payload'],
  ) => {
    const result = command(index, type, payload);
    expect(result.ack.accepted, result.ack.code).toBe(true);
    return result.envelope;
  };
  for (let index = 0; index < humans; index++) {
    if (index) send(index, 'join', { seatIndex: index });
    resource.manager.connection(roomId, members[index], devices[index], true);
    if (index) send(index, 'ready', { ready: true });
  }
  send(0, 'start');
  const tick = () => (resource.manager as unknown as { tick(): void }).tick();
  const row = () =>
    JSON.parse(
      (
        db
          .prepare('SELECT record_json FROM game_rooms WHERE room_id=?')
          .get(roomId) as { record_json: string }
      ).record_json,
    );
  return {
    db,
    members,
    devices,
    resource,
    roomId,
    view,
    command,
    send,
    tick,
    row,
    onError,
  };
}

function finishGomoku(f: ReturnType<typeof fixture>) {
  let last!: GameRoomCommand;
  for (const [turn, index] of [0, 15, 1, 16, 2, 17, 3, 18, 4].entries())
    last = f.send(turn % 2, 'action', { action: { type: 'place', index } });
  return last;
}

describe('family arcade room release gates', () => {
  it('finishes a real board once and keeps rewards out of personal arcade and ranked records', () => {
    const f = fixture();
    const ranked = readSnapshot(getMember(f.db, f.members[0])!).ranked;
    const last = finishGomoku(f);
    const result = f.view().room.result!;
    expect(result.outcomes).toEqual(['win', 'lose']);
    expect(result.coinsByMember).toEqual({
      [f.members[0]]: 20,
      [f.members[1]]: 5,
    });
    expect(
      f.resource.manager.command(f.roomId, f.members[0], f.devices[0], last)
        .accepted,
    ).toBe(true);
    expect(
      f.db.prepare('SELECT COUNT(*) n FROM family_arcade_matches').get(),
    ).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM family_results').get()).toEqual(
      { n: 2 },
    );
    expect(f.db.prepare('SELECT COUNT(*) n FROM arcade_rounds').get()).toEqual({
      n: 0,
    });
    expect(
      f.db.prepare('SELECT COUNT(*) n FROM leaderboard_entries').get(),
    ).toEqual({ n: 0 });
    expect(listHeadToHead(f.db, f.members[0])[0]).toMatchObject({
      wins: 1,
      losses: 0,
      relation: 'duel',
    });
    expect(readSnapshot(getMember(f.db, f.members[0])!).ranked).toEqual(ranked);
  });

  it('rejects stale, illegal, conflicting and non-controlling commands without changing the board', () => {
    const f = fixture();
    const before = f.view().board;
    expect(
      f.command(1, 'action', { action: { type: 'place', index: 0 } }).ack.code,
    ).toBe('ILLEGAL_ACTION');
    expect(
      f.command(
        0,
        'action',
        { action: { type: 'place', index: 0 } },
        randomUUID(),
      ).ack.code,
    ).toBe('CONTROL_LEASE_LOST');
    const { envelope } = f.command(0, 'action', {
      action: { type: 'place', index: 0 },
    });
    const stale = { ...envelope, commandId: randomUUID() };
    expect(
      f.resource.manager.command(f.roomId, f.members[0], f.devices[0], stale)
        .code,
    ).toBe('ROOM_REVISION_CONFLICT');
    expect(
      f.resource.manager.command(f.roomId, f.members[0], f.devices[0], {
        ...envelope,
        payload: { action: { type: 'place', index: 1 } },
      }).code,
    ).toBe('COMMAND_CONFLICT');
    expect(f.view().board).not.toEqual(before);
    expect(f.view().board?.ply).toBe(1);
    expect(f.onError).not.toHaveBeenCalled();
  });

  it('transfers control and ignores a disconnected old device', () => {
    const f = fixture();
    const nextDevice = randomUUID();
    f.resource.manager.connection(f.roomId, f.members[0], nextDevice, true);
    expect(f.command(0, 'takeover', undefined, nextDevice).ack.accepted).toBe(
      true,
    );
    f.resource.manager.connection(f.roomId, f.members[0], f.devices[0], false);
    expect(f.view(0, nextDevice).hasControl).toBe(true);
    expect(f.view().room.status).toBe('playing');
    expect(
      f.command(0, 'action', { action: { type: 'place', index: 0 } }).ack.code,
    ).toBe('CONTROL_LEASE_LOST');
    expect(
      f.command(
        0,
        'action',
        { action: { type: 'place', index: 0 } },
        nextDevice,
      ).ack.accepted,
    ).toBe(true);
  });

  it('pauses immediately, permits uncounted ending after ten minutes and expires after a day', () => {
    let now = Date.now();
    rs.spyOn(Date, 'now').mockImplementation(() => now);
    const f = fixture();
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], false);
    expect(f.view().room.status).toBe('paused');
    now += 599_999;
    expect(f.command(0, 'end').ack.code).toBe('PAUSE_TOO_SHORT');
    now++;
    f.send(0, 'end');
    expect(f.view().room.result).toMatchObject({
      reason: 'abandoned',
      counted: false,
    });
    expect(listHeadToHead(f.db, f.members[0])).toEqual([]);
    const other = fixture();
    other.resource.manager.connection(
      other.roomId,
      other.members[1],
      other.devices[1],
      false,
    );
    now += 86_400_000;
    other.tick();
    expect(other.view().room.result).toMatchObject({
      reason: 'expired',
      counted: false,
    });
    expect(
      other.db.prepare('SELECT COUNT(*) n FROM family_results').get(),
    ).toEqual({ n: 0 });
  });

  it('restores a committed board after restart and deduplicates commands across recovery', () => {
    const f = fixture();
    const last = f.send(0, 'action', { action: { type: 'place', index: 0 } });
    const board = f.view().board;
    f.resource.manager.close();
    f.resource.manager = new GameRoomManager(f.db, f.onError);
    expect(f.view().board).toEqual(board);
    expect(f.view().room.status).toBe('paused');
    expect(
      f.resource.manager.command(f.roomId, f.members[0], f.devices[0], last)
        .accepted,
    ).toBe(true);
    for (let i = 0; i < 2; i++)
      f.resource.manager.connection(f.roomId, f.members[i], f.devices[i], true);
    expect(f.view().room.status).toBe('playing');
    f.send(1, 'action', { action: { type: 'place', index: 15 } });
    expect(f.view().board?.ply).toBe(2);
  });

  it('shares the household daily cap and keeps a completed match stable after recovery', () => {
    const f = fixture();
    const date = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
    }).format(Date.now());
    for (const [index, coins] of [195, 200].entries())
      f.db
        .prepare(
          `INSERT INTO family_results(member_id,match_id,room_id,placement,score,coins,date_key,created_at)
        VALUES (?,?,?,1,25000,?,?,?)`,
        )
        .run(
          f.members[index],
          randomUUID(),
          randomUUID(),
          coins,
          date,
          Date.now(),
        );
    const last = finishGomoku(f);
    expect(f.view().room.result?.coinsByMember).toEqual({
      [f.members[0]]: 5,
      [f.members[1]]: 0,
    });
    const snapshots = f.members
      .slice(0, 2)
      .map((id) => getMember(f.db, id)!.snapshot);
    f.resource.manager.close();
    f.resource.manager = new GameRoomManager(f.db, f.onError);
    expect(
      f.resource.manager.command(f.roomId, f.members[0], f.devices[0], last)
        .accepted,
    ).toBe(true);
    expect(
      f.members.slice(0, 2).map((id) => getMember(f.db, id)!.snapshot),
    ).toEqual(snapshots);
  });

  it('keeps spectators read only and excludes them from active-match locks', () => {
    const f = fixture('xiangqi');
    f.resource.manager.watch(f.roomId, f.members[2], true);
    expect(f.view(2)).toMatchObject({ isSpectator: true, hasControl: false });
    expect(f.view(2).board).toEqual(f.view().board);
    expect(f.command(2, 'resign').ack.code).toBe('SPECTATOR_READ_ONLY');
    expect(() => assertNoActiveMatch(f.db, f.members[2])).not.toThrow();
    expect(() => assertNoActiveMatch(f.db, f.members[0])).toThrow(
      'GAME_MATCH_ACTIVE',
    );
    f.send(0, 'resign');
    expect(f.view().room.result?.outcomes).toEqual(['lose', 'win']);
  });

  it('withdraws pending draw offers on play and restores only the requested undo history', () => {
    const f = fixture();
    f.send(0, 'action', { action: { type: 'place', index: 0 } });
    f.send(1, 'action', { action: { type: 'place', index: 15 } });
    f.send(0, 'offer', { kind: 'undo' });
    f.send(1, 'respond', { accept: true });
    expect(f.view().board?.ply).toBe(0);
    expect(f.view().undoUsed).toEqual([1, 0]);
    expect(f.command(0, 'offer', { kind: 'undo' }).ack.accepted).toBe(false);
    f.send(1, 'offer', { kind: 'draw' });
    f.send(0, 'action', { action: { type: 'place', index: 1 } });
    expect(f.view().offer).toBeNull();
  });

  it('freezes chess clocks while disconnected and adjudicates the real deadline once', () => {
    let now = Date.now();
    rs.spyOn(Date, 'now').mockImplementation(() => now);
    const f = fixture('xiangqi', 2, {
      clock: { totalSeconds: 180, incrementSeconds: 2 },
    });
    now += 10_000;
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], false);
    expect(f.view().clockRemaining).toEqual([170_000, 180_000]);
    now += 3_600_000;
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], true);
    expect(f.view().deadline).toBe(now + 170_000);
    now += 170_000;
    f.tick();
    f.tick();
    expect(f.view().room.result).toMatchObject({
      reason: 'timeout',
      outcomes: ['lose', 'win'],
    });
    expect(
      f.db.prepare('SELECT COUNT(*) n FROM family_arcade_matches').get(),
    ).toEqual({ n: 1 });
  });

  it('keeps all hidden doudizhu hands private through bidding, redeal and finish', () => {
    const f = fixture('doudizhu', 3);
    expect(() =>
      f.resource.manager.watch(f.roomId, f.members[3], true),
    ).toThrow('SPECTATING_NOT_ALLOWED');
    expect(f.view(3).board).toBeNull();
    for (let i = 0; i < 3; i++)
      f.send(i, 'action', { action: { type: 'bid', score: 0 } });
    expect(f.view().board).toMatchObject({
      dealNumber: 2,
      bottomCards: [],
      landlord: null,
    });
    let actions = 0;
    while (f.view().room.status === 'playing' && actions++ < 300) {
      const state = f.row().state;
      const actor = doudizhuAdapter.currentActors(state)[0];
      for (let index = 0; index < 3; index++) {
        const board = f.view(index).board!;
        expect(board).not.toHaveProperty('hands');
        expect(board).not.toHaveProperty('seed');
        if (board.gameId === 'doudizhu') {
          expect(board.hand).toEqual(state.game.hands[index]);
          if (board.phase === 'bidding') expect(board.bottomCards).toEqual([]);
        }
      }
      f.send(actor, 'action', {
        action: doudizhuAdapter.aiAction(state, actor, f.view().room.settings),
      });
    }
    expect(f.view().room.status).toBe('finished');
    expect(f.view().room.result?.counted).toBe(true);
    expect(f.db.prepare('SELECT COUNT(*) n FROM family_results').get()).toEqual(
      { n: 3 },
    );
    expect(f.onError).not.toHaveBeenCalled();
  });

  it('gives no rewards or head-to-head results to a one-human table', () => {
    let now = Date.now();
    rs.spyOn(Date, 'now').mockImplementation(() => now);
    const f = fixture('doudizhu', 1);
    let actions = 0;
    while (f.view().room.status === 'playing' && actions++ < 300) {
      const state = f.row().state;
      const actor = doudizhuAdapter.currentActors(state)[0];
      if (actor === 0)
        f.send(0, 'action', {
          action: doudizhuAdapter.aiAction(
            state,
            actor,
            f.view().room.settings,
          ),
        });
      else {
        now += 601;
        f.tick();
      }
    }
    expect(f.view().room.status).toBe('finished');
    expect(f.view().room.result?.counted).toBe(false);
    expect(f.db.prepare('SELECT COUNT(*) n FROM family_results').get()).toEqual(
      { n: 0 },
    );
    expect(listHeadToHead(f.db, f.members[0])).toEqual([]);
  });

  it('waits sixty seconds for autoplay, returns control at a decision and pauses when everyone leaves', () => {
    let now = Date.now();
    rs.spyOn(Date, 'now').mockImplementation(() => now);
    const f = fixture('doudizhu', 2);
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], false);
    const disconnectedAt = now;
    let sawAutoplay = false;
    for (
      let steps = 0;
      steps < 200 && f.view().room.status === 'playing';
      steps++
    ) {
      const state = f.row().state;
      const actor = doudizhuAdapter.currentActors(state)[0];
      if (actor === 0)
        f.send(0, 'action', {
          action: doudizhuAdapter.aiAction(
            state,
            actor,
            f.view().room.settings,
          ),
        });
      else {
        now += 1000;
        f.tick();
      }
      const seat = f.view().room.seats[1];
      if (seat.type === 'human' && seat.autoplay) {
        sawAutoplay = true;
        break;
      }
      if (now - disconnectedAt < 60_000)
        expect(seat).toMatchObject({ autoplay: false });
    }
    expect(sawAutoplay).toBe(true);
    expect(now - disconnectedAt).toBeGreaterThanOrEqual(60_000);
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], true);
    for (
      let steps = 0;
      steps < 50 && f.view().room.status === 'playing';
      steps++
    ) {
      const state = f.row().state;
      const actor = doudizhuAdapter.currentActors(state)[0];
      if (actor === 1) {
        f.tick();
        break;
      }
      if (actor === 0)
        f.send(0, 'action', {
          action: doudizhuAdapter.aiAction(
            state,
            actor,
            f.view().room.settings,
          ),
        });
      else {
        now += 601;
        f.tick();
      }
    }
    expect(f.view(1).room.seats[1]).toMatchObject({
      autoplay: false,
      connected: true,
    });
    f.resource.manager.connection(f.roomId, f.members[0], f.devices[0], false);
    f.resource.manager.connection(f.roomId, f.members[1], f.devices[1], false);
    expect(f.view().room.status).toBe('paused');
    const board = f.view().board;
    now += 120_000;
    f.tick();
    expect(f.view().board).toEqual(board);
    expect(f.onError).not.toHaveBeenCalled();
  });

  it('preserves seats, rotates the starter and requires readiness for rematches', () => {
    const f = fixture();
    finishGomoku(f);
    const oldMatch = f.view().room.matchId;
    f.send(0, 'rematch');
    expect(f.view().room.firstSeat).toBe(1);
    expect(f.command(0, 'start').ack.code).toBe('PLAYERS_NOT_READY');
    f.send(1, 'ready', { ready: true });
    f.send(0, 'start');
    expect(f.view().room.matchId).not.toBe(oldMatch);
    expect(
      f.view().room.seats.filter((seat) => seat.type === 'human'),
    ).toHaveLength(2);
    expect(f.view().board).toMatchObject({ currentSeat: 1, ply: 0 });
  });
});
