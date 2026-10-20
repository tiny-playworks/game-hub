import { randomInt, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  FAMILY_GAME_IDS, type FamilyGameId, type GameRoomAck, type GameRoomCommand,
  type GameRoomResult, type GameRoomSeat, type GameRoomSettings,
  type GameRoomSummary, type GameRoomView,
} from '../../../shared/contracts/gameRoom';
import { ApiError, apiError } from '../auth';
import { getMember, readSnapshot, transaction } from '../db';
import type { AdapterResult, GameAdapter } from './adapter';
import { gomokuAdapter } from './adapters/gomoku';
import { xiangqiAdapter } from './adapters/xiangqi';
import { doudizhuAdapter } from './adapters/doudizhu';
import { assertNoActiveMatch } from './activeMatch';
import { makeGameResult, settleGameRoom } from './settlement';

type Human = Extract<GameRoomSeat, { type: 'human' }>;
interface PrivateHuman extends Human {
  leaseDeviceId: string;
  disconnectedAt: number | null;
}
interface RoomRecord {
  schema: 1;
  room: Omit<GameRoomSummary, 'seats'> & { seats: (Exclude<GameRoomSeat, Human> | PrivateHuman)[] };
  state: unknown | null;
  history: { seat: number; state: unknown; clock: number[] | null }[];
  clock: number[] | null;
  clockStartedAt: number | null;
  deadline: number | null;
  decisionAt: number;
  actedSeats: number[];
  undoUsed: number[];
  lastOfferPly: number[];
  offer: { kind: 'draw' | 'undo'; seat: number; historyIndex: number } | null;
}

const defaults: GameRoomSettings = {
  difficulty: 'normal', firstPlayer: 'random', clock: null, undoLimit: 3, turnSeconds: 15,
};
const adapters = new Map<FamilyGameId, GameAdapter>([
  ['gomoku', gomokuAdapter], ['xiangqi', xiangqiAdapter], ['doudizhu', doudizhuAdapter],
]);
export function registerGameAdapter(adapter: GameAdapter): void { adapters.set(adapter.gameId, adapter); }

function adapterFor(gameId: FamilyGameId): GameAdapter {
  const adapter = adapters.get(gameId);
  if (!adapter) throw apiError(400, 'GAME_NOT_AVAILABLE');
  return adapter;
}

export function parseGameSettings(input: Partial<GameRoomSettings> = {}): GameRoomSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw apiError(400, 'BAD_REQUEST');
  const value = { ...defaults, ...input };
  if (!['easy', 'normal', 'hard'].includes(value.difficulty) ||
    !['random', 'host', 'opponent'].includes(value.firstPlayer) ||
    ![0, 1, 3].includes(value.undoLimit) || ![10, 15, 30].includes(value.turnSeconds) ||
    (value.clock !== null && (!value.clock ||
      ![180, 600, 1200].includes(value.clock.totalSeconds) ||
      ![0, 2, 5].includes(value.clock.incrementSeconds)))) throw apiError(400, 'BAD_REQUEST');
  return value;
}

export class GameRoomManager {
  private rooms = new Map<string, RoomRecord>();
  private listeners = new Map<string, Set<() => void>>();
  private connections = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;

  constructor(private db: DatabaseSync, private onError: (error: unknown) => void = console.error) {
    const rows = db.prepare('SELECT record_json FROM game_rooms WHERE schema_version = 1')
      .all() as { record_json: string }[];
    for (const row of rows) {
      const record = JSON.parse(row.record_json) as RoomRecord;
      if (record.schema !== 1 || !FAMILY_GAME_IDS.includes(record.room.gameId)) throw new Error('INVALID_GAME_ROOM_SAVE');
      adapterFor(record.room.gameId);
      for (const seat of record.room.seats) if (seat.type === 'human') {
        seat.connected = false;
        seat.disconnectedAt ??= Date.now();
      }
      record.room.spectators = [];
      if (record.room.status === 'playing') {
        // A restarted service freezes at its last committed state; no offline clock loss.
        this.chargeClock(record, record.room.updatedAt);
        record.room.status = 'paused';
        record.room.pausedAt ??= record.room.updatedAt;
      }
      record.clockStartedAt = null;
      record.deadline = null;
      record.room.revision++;
      this.rooms.set(record.room.id, record);
      this.persist(record);
    }
    this.timer = setInterval(() => this.tick(), 250);
    this.timer.unref();
  }

  close(): void { clearInterval(this.timer); }

  private identity(memberId: string) {
    const member = getMember(this.db, memberId);
    if (!member) throw apiError(401, 'UNAUTHORIZED');
    const profile = readSnapshot(member).profile;
    return { memberId, nickname: profile.nickname, avatarPresetId: profile.avatarPresetId };
  }

  private human(memberId: string, deviceId: string, seatIndex: number, ready = false, roomId = ''): PrivateHuman {
    return { type: 'human', ...this.identity(memberId), seatIndex, ready,
      connected: this.connected(roomId, memberId, deviceId), autoplay: false, exited: false,
      leaseDeviceId: deviceId, disconnectedAt: Date.now() };
  }

  create(gameId: FamilyGameId, memberId: string, deviceId: string, settings?: Partial<GameRoomSettings>): GameRoomView {
    assertNoActiveMatch(this.db, memberId);
    const adapter = adapterFor(gameId);
    const seat = this.human(memberId, deviceId, 0, true);
    const now = Date.now();
    const id = randomUUID();
    const record: RoomRecord = {
      schema: 1,
      room: { schema: 1, id, gameId, hostMemberId: memberId, hostNickname: seat.nickname,
        status: 'waiting', settings: parseGameSettings(settings), revision: 1,
        seats: Array.from({ length: adapter.seats }, (_, seatIndex) => seatIndex === 0 ? seat : { type: 'empty', seatIndex }),
        spectators: [], matchId: null, firstSeat: 0, roundNumber: 0, pausedAt: null,
        createdAt: now, updatedAt: now, result: null },
      state: null, history: [], clock: null, clockStartedAt: null, deadline: null,
      decisionAt: now, actedSeats: [], undoUsed: Array(adapter.seats).fill(0),
      lastOfferPly: Array(adapter.seats).fill(-4), offer: null,
    };
    this.persist(record);
    this.rooms.set(id, record);
    return this.view(id, memberId, deviceId)!;
  }

  private summary(record: RoomRecord): GameRoomSummary {
    return { ...record.room, seats: record.room.seats.map((seat) => {
      if (seat.type !== 'human') return { ...seat };
      const { leaseDeviceId: _lease, disconnectedAt: _disconnected, ...publicSeat } = seat;
      return publicSeat;
    }) };
  }

  list(): GameRoomSummary[] {
    return [...this.rooms.values()].sort((a, b) => b.room.updatedAt - a.room.updatedAt)
      .slice(0, 100).map((record) => this.summary(record));
  }

  view(roomId: string, memberId: string, deviceId: string): GameRoomView | null {
    const record = this.rooms.get(roomId);
    if (!record) return null;
    const seat = record.room.seats.find((item): item is PrivateHuman => item.type === 'human' && item.memberId === memberId);
    const isSpectator = record.room.spectators.some((item) => item.memberId === memberId);
    const canView = Boolean(seat || isSpectator);
    return { room: this.summary(record), viewerSeat: seat?.seatIndex ?? null, isSpectator,
      hasControl: Boolean(seat && seat.leaseDeviceId === deviceId && !seat.exited),
      board: canView && record.state ? adapterFor(record.room.gameId).projectView(record.state, seat?.seatIndex ?? null) : null,
      deadline: canView ? record.deadline : null,
      clockRemaining: canView ? record.clock : null, serverNow: Date.now(),
      offer: record.offer ? { kind: record.offer.kind, seat: record.offer.seat } : null,
      undoUsed: record.undoUsed };
  }

  watch(roomId: string, memberId: string, active: boolean): void {
    this.mutate(roomId, (record) => {
      if (!adapterFor(record.room.gameId).spectators) throw apiError(403, 'SPECTATING_NOT_ALLOWED');
      if (record.room.seats.some((seat) => seat.type === 'human' && seat.memberId === memberId)) throw apiError(400, 'ALREADY_IN_ROOM');
      record.room.spectators = record.room.spectators.filter((item) => item.memberId !== memberId);
      if (active) record.room.spectators.push(this.identity(memberId));
    });
  }

  subscribe(roomId: string, listener: () => void): () => void {
    const set = this.listeners.get(roomId) ?? new Set<() => void>();
    this.listeners.set(roomId, set);
    set.add(listener);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(roomId); };
  }

  private connectionKey(roomId: string, memberId: string, deviceId: string): string {
    return `${roomId}:${memberId}:${deviceId}`;
  }
  private connected(roomId: string, memberId: string, deviceId: string): boolean {
    return (this.connections.get(this.connectionKey(roomId, memberId, deviceId)) ?? 0) > 0;
  }

  connection(roomId: string, memberId: string, deviceId: string, active: boolean): void {
    const key = this.connectionKey(roomId, memberId, deviceId);
    const count = Math.max(0, (this.connections.get(key) ?? 0) + (active ? 1 : -1));
    if (count) this.connections.set(key, count); else this.connections.delete(key);
    const record = this.rooms.get(roomId);
    const seat = record?.room.seats.find((item): item is PrivateHuman => item.type === 'human' && item.memberId === memberId);
    if (!record || !seat || seat.leaseDeviceId !== deviceId || seat.exited || seat.connected === Boolean(count)) return;
    this.mutate(roomId, (next) => {
      const player = next.room.seats[seat.seatIndex] as PrivateHuman;
      player.connected = Boolean(count);
      player.disconnectedAt = count ? null : Date.now();
      this.updatePause(next);
    });
  }

  command(roomId: string, memberId: string, deviceId: string, command: GameRoomCommand): GameRoomAck {
    const reject = (code: string): GameRoomAck => ({ accepted: false,
      commandId: typeof command?.commandId === 'string' ? command.commandId : '',
      code, revision: this.rooms.get(roomId)?.room.revision ?? 0, view: this.view(roomId, memberId, deviceId) });
    if (!command || command.protocol !== 1 || command.roomId !== roomId ||
      typeof command.commandId !== 'string' || !command.commandId || command.commandId.length > 128 ||
      !Number.isSafeInteger(command.expectedRevision) ||
      (command.payload !== undefined && (!command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)))) return reject('BAD_REQUEST');
    const record = this.rooms.get(roomId);
    if (!record) return reject('ROOM_NOT_FOUND');
    const previous = this.db.prepare('SELECT member_id, device_id, command_json FROM game_room_commands WHERE room_id = ? AND command_id = ?')
      .get(roomId, command.commandId) as { member_id: string; device_id: string; command_json: string } | undefined;
    if (previous) {
      if (previous.member_id !== memberId || previous.device_id !== deviceId || previous.command_json !== JSON.stringify(command)) return reject('COMMAND_CONFLICT');
      return { accepted: true, commandId: command.commandId, revision: record.room.revision, view: this.view(roomId, memberId, deviceId) };
    }
    if (command.expectedRevision !== record.room.revision) return reject('ROOM_REVISION_CONFLICT');
    try {
      this.mutate(roomId, (next) => {
        this.applyCommand(next, memberId, deviceId, command);
        this.db.prepare(`INSERT INTO game_room_commands
          (room_id, command_id, member_id, device_id, command_json, revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(roomId, command.commandId, memberId, deviceId, JSON.stringify(command), next.room.revision + 1, Date.now());
      });
      return { accepted: true, commandId: command.commandId,
        revision: this.rooms.get(roomId)!.room.revision, view: this.view(roomId, memberId, deviceId) };
    } catch (error) {
      if (!(error instanceof ApiError)) this.onError(error);
      return reject(error instanceof ApiError ? error.body.code : 'INTERNAL_ERROR');
    }
  }

  private applyCommand(record: RoomRecord, memberId: string, deviceId: string, command: GameRoomCommand): void {
    const room = record.room;
    const adapter = adapterFor(room.gameId);
    const payload = command.payload ?? {};
    const seat = room.seats.find((item): item is PrivateHuman => item.type === 'human' && item.memberId === memberId);
    if (room.spectators.some((item) => item.memberId === memberId)) throw apiError(403, 'SPECTATOR_READ_ONLY');
    if (command.type === 'join') {
      if (room.status !== 'waiting') throw apiError(400, 'GAME_ALREADY_STARTED');
      if (seat) throw apiError(400, 'ALREADY_IN_ROOM');
      assertNoActiveMatch(this.db, memberId, room.id);
      const index = payload.seatIndex;
      if (!Number.isInteger(index) || index! < 0 || index! >= adapter.seats) throw apiError(400, 'INVALID_SEAT_INDEX');
      if (room.seats[index!].type === 'human') throw apiError(400, 'SEAT_OCCUPIED');
      room.seats[index!] = this.human(memberId, deviceId, index!, false, room.id);
      return;
    }
    if (!seat) throw apiError(403, 'SEAT_NOT_FOUND');
    if (command.type === 'takeover') {
      seat.leaseDeviceId = deviceId;
      seat.connected = this.connected(room.id, memberId, deviceId);
      seat.disconnectedAt = seat.connected ? null : Date.now();
      this.updatePause(record);
      return;
    }
    if (seat.leaseDeviceId !== deviceId || seat.exited) throw apiError(409, 'CONTROL_LEASE_LOST');
    if (command.type === 'leave') {
      if (room.status === 'playing' || room.status === 'paused') {
        seat.exited = true;
        seat.connected = false;
        seat.disconnectedAt = Date.now() - 60_000;
        if (adapter.timeoutPolicy === 'pause-on-disconnect') this.forfeit(record, seat.seatIndex, 'resign');
        else { seat.autoplay = true; this.updatePause(record); }
      } else {
        room.seats[seat.seatIndex] = { type: 'empty', seatIndex: seat.seatIndex };
        const host = room.seats.find((item): item is PrivateHuman => item.type === 'human');
        if (host) { room.hostMemberId = host.memberId; room.hostNickname = host.nickname; host.ready = true; }
        else { room.status = 'finished'; }
      }
      return;
    }
    if (command.type === 'ready') {
      if (room.status !== 'waiting') throw apiError(400, 'GAME_ALREADY_STARTED');
      seat.ready = payload.ready === true;
      return;
    }
    if (command.type === 'ai' || command.type === 'settings' || command.type === 'start' || command.type === 'rematch') {
      if (room.hostMemberId !== memberId) throw apiError(403, 'ONLY_HOST_CAN_START');
      if (command.type === 'rematch') {
        if (room.status !== 'finished' || !room.matchId) throw apiError(400, 'MATCH_NOT_FINISHED');
        assertNoActiveMatch(this.db, memberId, room.id);
        room.status = 'waiting';
        room.result = null;
        record.state = null;
        room.firstSeat = (room.firstSeat + 1) % adapter.seats;
        for (const item of room.seats) if (item.type === 'human') {
          if (item.exited) room.seats[item.seatIndex] = { type: 'empty', seatIndex: item.seatIndex };
          else { item.ready = item.memberId === memberId; item.autoplay = false; }
        }
        return;
      }
      if (room.status !== 'waiting') throw apiError(400, 'GAME_ALREADY_STARTED');
      if (command.type === 'settings') {
        room.settings = parseGameSettings({ ...room.settings, ...payload.settings });
        for (const item of room.seats) if (item.type === 'human' && item.memberId !== memberId) item.ready = false;
        return;
      }
      if (command.type === 'ai') {
        const index = payload.seatIndex;
        if (!Number.isInteger(index) || index! < 0 || index! >= adapter.seats || room.seats[index!].type === 'human') throw apiError(400, 'INVALID_SEAT_INDEX');
        room.seats[index!] = payload.remove ? { type: 'empty', seatIndex: index! } : { type: 'ai', seatIndex: index!, difficulty: room.settings.difficulty };
        return;
      }
      for (const item of room.seats) if (item.type === 'human') {
        assertNoActiveMatch(this.db, item.memberId, room.id);
        if (!item.ready || !item.connected) throw apiError(400, 'PLAYERS_NOT_READY');
      }
      if (!room.roundNumber) room.firstSeat = room.settings.firstPlayer === 'random' ? randomInt(adapter.seats)
        : room.settings.firstPlayer === 'host' ? seat.seatIndex : (seat.seatIndex + 1) % adapter.seats;
      room.seats = room.seats.map((item) => item.type === 'empty'
        ? { type: 'ai', seatIndex: item.seatIndex, difficulty: room.settings.difficulty } : item);
      room.matchId = randomUUID();
      room.roundNumber++;
      room.status = 'playing';
      room.pausedAt = null;
      room.result = null;
      record.state = adapter.init(randomInt(0x1_0000_0000), room.settings, room.firstSeat);
      record.history = [];
      record.actedSeats = [];
      record.offer = null;
      record.undoUsed = Array(adapter.seats).fill(0);
      record.lastOfferPly = Array(adapter.seats).fill(-4);
      record.clock = adapter.negotiation && room.settings.clock ? Array(adapter.seats).fill(room.settings.clock.totalSeconds * 1000) : null;
      this.startDecision(record);
      return;
    }
    if (!record.state || (room.status !== 'playing' && room.status !== 'paused')) throw apiError(400, 'MATCH_NOT_PLAYING');
    if (command.type === 'resign') {
      if (!adapter.negotiation) throw apiError(400, 'ACTION_REJECTED');
      record.actedSeats.push(seat.seatIndex);
      this.forfeit(record, seat.seatIndex, 'resign');
      return;
    }
    if (command.type === 'end') {
      if (room.status !== 'paused' || room.pausedAt === null || Date.now() - room.pausedAt < 600_000 || !seat.connected || !adapter.negotiation) throw apiError(400, 'PAUSE_TOO_SHORT');
      this.finish(record, 'abandoned', null);
      return;
    }
    if (room.status === 'paused') throw apiError(400, 'GAME_PAUSED');
    if (record.deadline !== null && Date.now() >= record.deadline) throw apiError(409, 'DEADLINE_PASSED');
    if (command.type === 'offer') {
      if (!adapter.negotiation || record.offer || (payload.kind !== 'draw' && payload.kind !== 'undo')) throw apiError(400, 'ACTION_REJECTED');
      const ply = adapter.ply(record.state);
      if (ply - record.lastOfferPly[seat.seatIndex] < 4) throw apiError(400, 'OFFER_COOLDOWN');
      const index = record.history.map((entry) => entry.seat).lastIndexOf(seat.seatIndex);
      if (payload.kind === 'undo' && (record.undoUsed[seat.seatIndex] >= room.settings.undoLimit || index < 0)) throw apiError(400, 'UNDO_NOT_AVAILABLE');
      record.offer = { kind: payload.kind, seat: seat.seatIndex, historyIndex: index };
      record.lastOfferPly[seat.seatIndex] = ply;
      const opponent = room.seats[1 - seat.seatIndex];
      if (opponent.type === 'ai') this.respondOffer(record, payload.kind === 'undo');
      return;
    }
    if (command.type === 'respond') {
      if (!record.offer || record.offer.seat === seat.seatIndex) throw apiError(400, 'ACTION_REJECTED');
      this.respondOffer(record, payload.accept === true);
      return;
    }
    if (command.type === 'action') {
      const action = payload.action;
      if (!action || typeof action !== 'object' || !adapter.validate(record.state, seat.seatIndex, action)) throw apiError(400, 'ILLEGAL_ACTION');
      if (!record.actedSeats.includes(seat.seatIndex)) record.actedSeats.push(seat.seatIndex);
      this.applyAction(record, seat.seatIndex, action);
      return;
    }
    throw apiError(400, 'BAD_REQUEST');
  }

  private respondOffer(record: RoomRecord, accepted: boolean): void {
    const offer = record.offer!;
    record.offer = null;
    if (!accepted) return;
    if (offer.kind === 'draw') {
      this.finish(record, 'draw', { outcomes: ['draw', 'draw'], teams: [0, 1] });
      return;
    }
    this.chargeClock(record);
    const entry = record.history[offer.historyIndex];
    record.state = entry.state;
    if (record.clock && entry.clock) record.clock = record.clock.map((time, index) => Math.min(time, entry.clock![index]));
    record.history = record.history.slice(0, offer.historyIndex);
    record.undoUsed[offer.seat]++;
    this.startDecision(record);
  }

  private applyAction(record: RoomRecord, seat: number, action: Parameters<GameAdapter['apply']>[2]): void {
    const adapter = adapterFor(record.room.gameId);
    this.chargeClock(record);
    if (adapter.negotiation) record.history.push({ seat, state: record.state, clock: record.clock ? [...record.clock] : null });
    if (record.offer?.seat !== seat) record.offer = null;
    record.state = adapter.apply(record.state, seat, action);
    if (record.clock) record.clock[seat] += (record.room.settings.clock?.incrementSeconds ?? 0) * 1000;
    const result = adapter.result(record.state);
    if (result) this.finish(record, 'board', result);
    else this.startDecision(record);
  }

  private forfeit(record: RoomRecord, seat: number, reason: 'resign' | 'timeout'): void {
    this.finish(record, reason, { outcomes: record.room.seats.map((_, index) => index === seat ? 'lose' : 'win'), teams: [0, 1] });
  }

  private finish(record: RoomRecord, reason: GameRoomResult['reason'], result: AdapterResult | null): void {
    this.chargeClock(record);
    const summary = this.summary(record);
    record.room.result = makeGameResult(this.db, summary, reason, result, record.actedSeats);
    record.room.status = 'finished';
    record.room.pausedAt = null;
    record.deadline = null;
    record.clockStartedAt = null;
    record.offer = null;
    settleGameRoom(this.db, summary, record.room.result, result?.teams ?? []);
  }

  private chargeClock(record: RoomRecord, now = Date.now()): void {
    if (record.clock && record.clockStartedAt !== null && record.state) {
      const actor = adapterFor(record.room.gameId).currentActors(record.state)[0];
      record.clock[actor] = Math.max(0, record.clock[actor] - Math.max(0, now - record.clockStartedAt));
    }
    record.clockStartedAt = null;
  }

  private startDecision(record: RoomRecord): void {
    const now = Date.now();
    const adapter = adapterFor(record.room.gameId);
    const actor = adapter.currentActors(record.state)[0];
    record.decisionAt = now;
    record.clockStartedAt = record.clock ? now : null;
    record.deadline = record.clock ? now + record.clock[actor]
      : adapter.timeoutPolicy === 'autoplay-after-grace' ? now + record.room.settings.turnSeconds * 1000 : null;
  }

  private updatePause(record: RoomRecord): void {
    if (record.room.status !== 'playing' && record.room.status !== 'paused') return;
    const humans = record.room.seats.filter((seat) => seat.type === 'human');
    const chess = adapterFor(record.room.gameId).timeoutPolicy === 'pause-on-disconnect';
    const shouldPause = chess ? humans.some((seat) => !seat.connected) : humans.every((seat) => !seat.connected);
    if (shouldPause && record.room.status === 'playing') {
      this.chargeClock(record);
      record.room.status = 'paused';
      record.room.pausedAt = Date.now();
      record.deadline = null;
    } else if (!shouldPause && record.room.status === 'paused') {
      record.room.status = 'playing';
      record.room.pausedAt = null;
      this.startDecision(record);
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const [roomId, original] of this.rooms) {
      try {
        const { room } = original;
        if (room.status === 'paused') {
          if (room.pausedAt !== null && now - room.pausedAt >= 86_400_000) this.mutate(roomId, (record) => this.finish(record, 'expired', null));
          continue;
        }
        if (room.status !== 'playing' || !original.state) continue;
        const adapter = adapterFor(room.gameId);
        const actor = adapter.currentActors(original.state)[0];
        const seat = room.seats[actor];
        const auto = seat.type === 'ai' || (seat.type === 'human' &&
          (!seat.connected && seat.disconnectedAt !== null && now - seat.disconnectedAt >= 60_000));
        const expired = original.deadline !== null && now >= original.deadline;
        if (seat.type === 'human' && seat.connected && seat.autoplay) {
          this.mutate(roomId, (record) => { (record.room.seats[actor] as PrivateHuman).autoplay = false; });
        }
        if (auto && now - original.decisionAt >= 600) {
          this.mutate(roomId, (record) => {
            const player = record.room.seats[actor];
            if (player.type === 'human') player.autoplay = true;
            const action = adapter.aiAction(record.state, actor, room.settings);
            if (!adapter.validate(record.state, actor, action)) throw new Error('INVALID_AI_ACTION');
            this.applyAction(record, actor, action);
          });
        } else if (expired) {
          this.mutate(roomId, (record) => {
            if (adapter.negotiation) this.forfeit(record, actor, 'timeout');
            else this.applyAction(record, actor, adapter.defaultTimeoutAction(record.state, actor));
          });
        }
      } catch (error) { this.onError(error); }
    }
  }

  private persist(record: RoomRecord): void {
    this.db.prepare(`INSERT INTO game_rooms(room_id, schema_version, record_json, updated_at) VALUES (?, 1, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at`)
      .run(record.room.id, JSON.stringify(record), record.room.updatedAt);
  }

  private mutate(roomId: string, operation: (record: RoomRecord) => void): void {
    const original = this.rooms.get(roomId);
    if (!original) throw apiError(404, 'ROOM_NOT_FOUND');
    const next = structuredClone(original);
    transaction(this.db, () => {
      operation(next);
      next.room.revision++;
      next.room.updatedAt = Date.now();
      this.persist(next);
    });
    this.rooms.set(roomId, next);
    for (const listener of this.listeners.get(roomId) ?? []) {
      try { listener(); } catch (error) { this.onError(error); }
    }
  }
}
