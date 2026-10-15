import type { DatabaseSync } from 'node:sqlite';
import type { RiichiMatchState } from '@/pages/mahjong/japanese/engine/match';
import type { RoomCommand, RoomSummary } from '../../../shared/contracts/room';

export interface RecoveredRoomData {
  summary: RoomSummary;
  match: RiichiMatchState | null;
  serverDeadline: number | null;
  isPaused: boolean;
}

export function saveRoomState(
  db: DatabaseSync,
  summary: RoomSummary,
  match: RiichiMatchState | null,
  serverDeadline: number | null,
  isPaused: boolean = false,
): void {
  if (summary.status === 'finished') {
    deleteRoomState(db, summary.id);
    return;
  }
  const summaryJson = JSON.stringify(summary);
  const matchJson = match ? JSON.stringify(match) : null;
  const now = Date.now();

  db.prepare(
    `INSERT INTO active_rooms(room_id, summary_json, match_json, server_deadline, is_paused, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       summary_json = excluded.summary_json,
       match_json = excluded.match_json,
       server_deadline = excluded.server_deadline,
       is_paused = excluded.is_paused,
       updated_at = excluded.updated_at`,
  ).run(
    summary.id,
    summaryJson,
    matchJson,
    serverDeadline,
    isPaused ? 1 : 0,
    now,
  );
}

export function recordRoomCommand(
  db: DatabaseSync,
  roomId: string,
  command: RoomCommand,
  memberId: string,
  deviceId: string,
): void {
  try {
    db.prepare(
      `INSERT OR IGNORE INTO room_commands(room_id, command_id, member_id, device_id, revision, command_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      roomId,
      command.commandId,
      memberId,
      deviceId,
      command.expectedRevision,
      JSON.stringify(command),
      Date.now(),
    );
  } catch {
    // ignore duplicate key
  }
}

export function deleteRoomState(db: DatabaseSync, roomId: string): void {
  try {
    db.prepare('DELETE FROM active_rooms WHERE room_id = ?').run(roomId);
  } catch {
    // ignore
  }
}

export function loadActiveRooms(db: DatabaseSync): RecoveredRoomData[] {
  try {
    const rows = db
      .prepare('SELECT summary_json, match_json, server_deadline, is_paused FROM active_rooms')
      .all() as unknown as Array<{
      summary_json: string;
      match_json: string | null;
      server_deadline: number | null;
      is_paused: number;
    }>;

    return rows.map((row) => ({
      summary: JSON.parse(row.summary_json) as RoomSummary,
      match: row.match_json ? (JSON.parse(row.match_json) as RiichiMatchState) : null,
      serverDeadline: row.server_deadline,
      isPaused: Boolean(row.is_paused),
    }));
  } catch {
    return [];
  }
}
