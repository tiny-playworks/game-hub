import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { games } from '@/data/games';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { useGameStore } from '@/store/gameStore';
import type {
  ArcadeMemberEvent,
  ArcadeMemberResult,
} from '../../../shared/contracts/member';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';

type StoredRound = {
  game_id: string;
  difficulty: string;
  finished_at: number | null;
  result_json: string | null;
};

function parseEvent(body: unknown): { baseRevision: number; event: ArcadeMemberEvent } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw apiError(400, 'BAD_REQUEST');
  const { baseRevision, event } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(baseRevision) || !event ||
    typeof event !== 'object' || Array.isArray(event))
    throw apiError(400, 'BAD_REQUEST');
  const value = event as Record<string, unknown>;
  const gameId = value.gameId;
  const difficulty = value.difficulty;
  if ((value.type !== 'start' && value.type !== 'finish') ||
    typeof value.roundId !== 'string' ||
    !/^arcade:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.roundId) ||
    typeof gameId !== 'string' ||
    !games.some((game) => game.id === gameId && game.id !== 'mahjong-japanese') ||
    typeof difficulty !== 'string' ||
    normalizeArcadeDifficulty(gameId, difficulty) !== difficulty)
    throw apiError(400, 'BAD_REQUEST');
  if (value.type === 'finish' &&
    (typeof value.score !== 'number' || !Number.isFinite(value.score) ||
      value.score < 0 || value.score > 1_000_000_000 ||
      (value.outcome !== 'win' && value.outcome !== 'lose' && value.outcome !== 'draw')))
    throw apiError(400, 'BAD_REQUEST');
  if (value.meta !== undefined &&
    (!value.meta || typeof value.meta !== 'object' || Array.isArray(value.meta) ||
      JSON.stringify(value.meta).length > 10_000))
    throw apiError(400, 'BAD_REQUEST');
  return { baseRevision: baseRevision as number, event: value as ArcadeMemberEvent };
}

function settle(snapshot: ReturnType<typeof readSnapshot>, event: ArcadeMemberEvent): {
  snapshot: ReturnType<typeof readSnapshot>;
  result: ArcadeMemberResult;
} {
  const updated = runSnapshotMutation(snapshot, () => {
    useGameStore.setState({
      stats: snapshot.arcade.stats,
      receipts: snapshot.arcade.receipts,
    });
    const common = {
      gameId: event.gameId,
      difficulty: event.difficulty,
      score: event.score,
      meta: { ...event.meta, outcome: event.outcome, roundId: event.roundId },
    };
    const first = emitGameEvent({ ...common, type: event.type });
    if (event.type === 'start')
      return { coinsEarned: 0, capReached: false };
    const won = event.outcome === 'win'
      ? emitGameEvent({ ...common, type: 'win' }) : null;
    const best = first.record?.isNewBest
      ? emitGameEvent({ ...common, type: 'best' }) : null;
    return {
      coinsEarned: first.coinsEarned + (won?.coinsEarned ?? 0) +
        (best?.coinsEarned ?? 0),
      capReached: first.arcadeCapReached === true ||
        won?.arcadeCapReached === true || best?.arcadeCapReached === true,
      record: first.record,
    };
  });
  return updated;
}

export function registerArcadeRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.post('/api/v1/me/arcade/events', async (request) => {
    const { member } = requireSession(db, request);
    const { baseRevision, event } = parseEvent(request.body);
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      const snapshot = readSnapshot(current);
      const existing = db.prepare(
        'SELECT game_id, difficulty, finished_at, result_json FROM arcade_rounds WHERE member_id = ? AND round_id = ?',
      ).get(member.id, event.roundId) as StoredRound | undefined;
      if (existing && (existing.game_id !== event.gameId ||
        existing.difficulty !== event.difficulty))
        throw apiError(409, 'ROUND_CONFLICT');
      if (event.type === 'start' && existing)
        return { snapshot, result: { coinsEarned: 0, capReached: false } };
      if (event.type === 'finish' && existing?.finished_at !== null && existing?.finished_at !== undefined)
        return { snapshot, result: JSON.parse(existing.result_json ?? '{}') as ArcadeMemberResult };
      if (current.revision !== baseRevision)
        throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      if (event.type === 'finish' && !existing)
        throw apiError(409, 'ROUND_NOT_STARTED');
      const updated = settle(snapshot, event);
      const next = saveSnapshot(db, current, updated.snapshot);
      if (event.type === 'start') {
        db.prepare(
          'INSERT INTO arcade_rounds(member_id, round_id, game_id, difficulty, started_at) VALUES (?, ?, ?, ?, ?)',
        ).run(member.id, event.roundId, event.gameId, event.difficulty, Date.now());
      } else {
        db.prepare(
          'UPDATE arcade_rounds SET finished_at = ?, result_json = ? WHERE member_id = ? AND round_id = ?',
        ).run(Date.now(), JSON.stringify(updated.result), member.id, event.roundId);
      }
      return { snapshot: next, result: updated.result };
    });
  });
}
