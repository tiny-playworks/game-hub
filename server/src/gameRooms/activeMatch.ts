import type { DatabaseSync } from 'node:sqlite';
import type { GameRoomSummary } from '../../../shared/contracts/gameRoom';
import type { RoomSummary } from '../../../shared/contracts/room';
import { apiError } from '../auth';
import { getMember, readSnapshot } from '../db';

/** All entry points use this guard; waiting rooms and spectators never lock play. */
export function assertNoActiveMatch(
  db: DatabaseSync,
  memberId: string,
  exceptRoomId?: string,
): void {
  const member = getMember(db, memberId);
  if (member && readSnapshot(member).ranked.activeMatchId)
    throw apiError(409, 'RANKED_MATCH_ACTIVE');
  const riichi = db
    .prepare('SELECT room_id, summary_json FROM active_rooms')
    .all() as { room_id: string; summary_json: string }[];
  for (const row of riichi) {
    if (row.room_id === exceptRoomId) continue;
    const room = JSON.parse(row.summary_json) as RoomSummary;
    if (
      room.status === 'playing' &&
      room.seats.some(
        (seat) => seat.type === 'human' && seat.memberId === memberId,
      )
    ) {
      throw apiError(409, 'FAMILY_MATCH_ACTIVE');
    }
  }
  const arcade = db
    .prepare('SELECT room_id, record_json FROM game_rooms')
    .all() as { room_id: string; record_json: string }[];
  for (const row of arcade) {
    if (row.room_id === exceptRoomId) continue;
    const room = (JSON.parse(row.record_json) as { room: GameRoomSummary })
      .room;
    if (
      (room.status === 'playing' || room.status === 'paused') &&
      room.seats.some(
        (seat) => seat.type === 'human' && seat.memberId === memberId,
      )
    ) {
      throw apiError(409, 'GAME_MATCH_ACTIVE');
    }
  }
}
