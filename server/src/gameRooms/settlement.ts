import type { DatabaseSync } from 'node:sqlite';
import { addCoins } from '@/lib/wallet';
import type {
  FamilyHeadToHead,
  GameRoomResult,
  GameRoomSummary,
} from '../../../shared/contracts/gameRoom';
import type { AdapterResult } from './adapter';
import { appendFamilyFeed, getMember, readSnapshot, saveSnapshot } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';

/** Called inside the same transaction as the durable room and command. */
export function settleGameRoom(
  db: DatabaseSync,
  room: GameRoomSummary,
  result: GameRoomResult,
  teams: number[],
): void {
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO family_arcade_matches
    (match_id, room_id, game_id, source, result_json, created_at) VALUES (?, ?, ?, 'family-arcade', ?, ?)`,
    )
    .run(
      result.matchId,
      room.id,
      room.gameId,
      JSON.stringify(result),
      Date.now(),
    );
  if (!inserted.changes || !result.counted || !result.outcomes) return;
  const dateKey = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
  }).format(Date.now());
  for (const seat of room.seats) {
    if (seat.type !== 'human' || seat.exited) continue;
    const outcome = result.outcomes[seat.seatIndex];
    db.prepare(
      `INSERT INTO family_arcade_results
      (member_id, match_id, source, game_id, nickname, outcome, team)
      VALUES (?, ?, 'family-arcade', ?, ?, ?, ?)`,
    ).run(
      seat.memberId,
      result.matchId,
      room.gameId,
      seat.nickname,
      outcome,
      teams[seat.seatIndex],
    );
    const coins = result.coinsByMember[seat.memberId] ?? 0;
    if (coins) {
      const member = getMember(db, seat.memberId);
      if (!member) throw new Error('MEMBER_NOT_FOUND');
      const updated = runSnapshotMutation(readSnapshot(member), () => {
        addCoins(
          coins,
          'gameRoom.reward',
          Date.now(),
          `family-arcade:${result.matchId}`,
        );
      });
      saveSnapshot(db, member, updated.snapshot);
    }
    db.prepare(
      `INSERT INTO family_results
      (member_id, match_id, room_id, placement, score, coins, date_key, created_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'family-arcade')`,
    ).run(
      seat.memberId,
      result.matchId,
      room.id,
      outcome === 'win' ? 1 : outcome === 'draw' ? 2 : 3,
      Number(outcome === 'win'),
      coins,
      dateKey,
      Date.now(),
    );
  }
  const winner = room.seats.find(
    (seat) =>
      seat.type === 'human' && result.outcomes?.[seat.seatIndex] === 'win',
  );
  appendFamilyFeed(db, {
    kind: 'family-arcade',
    gameId: room.gameId,
    memberId: winner?.type === 'human' ? winner.memberId : room.hostMemberId,
  });
}

export function makeGameResult(
  db: DatabaseSync,
  room: GameRoomSummary,
  reason: GameRoomResult['reason'],
  adapterResult: AdapterResult | null,
  actedSeats: number[],
): GameRoomResult {
  const humans = room.seats.filter(
    (seat) => seat.type === 'human' && !seat.exited,
  );
  const counted = humans.length >= 2 && adapterResult !== null;
  const dateKey = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
  }).format(Date.now());
  const coinsByMember: Record<string, number> = {};
  for (const seat of humans) {
    if (seat.type !== 'human') continue;
    const previous = db
      .prepare(
        'SELECT COALESCE(SUM(coins), 0) AS coins FROM family_results WHERE member_id = ? AND date_key = ?',
      )
      .get(seat.memberId, dateKey) as { coins: number };
    // Same finish + win formula as personal arcade, without best/streak rewards.
    const reward =
      5 +
      (adapterResult?.outcomes[seat.seatIndex] === 'win'
        ? 15 * (room.settings.difficulty === 'hard' ? 2 : 1)
        : 0);
    const eligible =
      counted &&
      (room.gameId !== 'doudizhu' || actedSeats.includes(seat.seatIndex));
    coinsByMember[seat.memberId] = eligible
      ? Math.min(reward, Math.max(0, 200 - previous.coins))
      : 0;
  }
  return {
    source: 'family-arcade',
    matchId: room.matchId!,
    reason,
    outcomes: adapterResult?.outcomes ?? null,
    counted,
    coinsByMember,
    ...(adapterResult?.spring !== undefined
      ? { spring: adapterResult.spring, multiplier: adapterResult.multiplier }
      : {}),
  };
}

export function listHeadToHead(
  db: DatabaseSync,
  memberId: string,
): FamilyHeadToHead[] {
  return db
    .prepare(
      `SELECT a.game_id AS gameId, a.member_id AS memberId, a.nickname,
      b.member_id AS opponentId, b.nickname AS opponentNickname,
      CASE WHEN a.game_id != 'doudizhu' THEN 'duel' WHEN a.team = b.team THEN 'team' ELSE 'opponent' END AS relation,
      SUM(a.outcome = 'win') AS wins, SUM(a.outcome = 'lose') AS losses, SUM(a.outcome = 'draw') AS draws
    FROM family_arcade_results a JOIN family_arcade_results b
      ON a.match_id = b.match_id AND a.member_id != b.member_id
    WHERE a.member_id = ? GROUP BY a.game_id, b.member_id, relation ORDER BY a.game_id, b.nickname`,
    )
    .all(memberId) as unknown as FamilyHeadToHead[];
}
