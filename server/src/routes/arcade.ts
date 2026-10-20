import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { games } from '@/data/games';
import { ARCADE_CHALLENGE_ID, recordArcadeChallenge } from '../../../shared/contracts/arcadeChallenge';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { gameStore } from '@/store/gameStoreCore';
import type {
  ArcadeMemberEvent,
  ArcadeMemberResult,
} from '../../../shared/contracts/member';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';
import { exceedsArcadeScoreCap } from '../services/arcadeLimits';
import { recordRankedResult, statsFor } from '../services/leaderboard';

type StoredRound = {
  challenge_id: string | null;
  game_id: string;
  difficulty: string;
  started_at: number;
  finished_at: number | null;
  result_json: string | null;
};

const MAX_ROUND_AGE_MS = 24 * 60 * 60 * 1000;

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function validatePlausibleFinish(
  gameId: string,
  outcome: 'win' | 'lose' | 'draw',
  score: number,
  meta: Record<string, unknown> | undefined,
): void {
  if (!isIntInRange(score, 0, 10_000_000) || exceedsArcadeScoreCap(gameId, score))
    throw apiError(400, 'BAD_REQUEST');

  if (meta?.maxCombo !== undefined && !isIntInRange(meta.maxCombo, 0, 100_000))
    throw apiError(400, 'BAD_REQUEST');

  switch (gameId) {
    case '2048': {
      if (outcome === 'win' && score < 256)
        throw apiError(400, 'BAD_REQUEST');
      if (meta?.maxTile !== undefined) {
        const tile = meta.maxTile;
        if (
          !isIntInRange(tile, 2, 131_072) ||
          (tile & (tile - 1)) !== 0 ||
          score < tile ||
          (outcome === 'win' && tile < 256)
        )
          throw apiError(400, 'BAD_REQUEST');
      }
      break;
    }
    case 'guess-number': {
      if (outcome === 'win' && !isIntInRange(score, 1, 1000))
        throw apiError(400, 'BAD_REQUEST');
      if (
        meta?.guesses !== undefined &&
        (!isIntInRange(meta.guesses, 1, 1000) || meta.guesses !== score)
      )
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'memory': {
      if (outcome === 'win' && !isIntInRange(score, 1, 10_000))
        throw apiError(400, 'BAD_REQUEST');
      if (meta?.mistakes !== undefined && !isIntInRange(meta.mistakes, 0, 1000))
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'snake': {
      if (score > 10_000) throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'tetris': {
      if (
        meta?.lines !== undefined &&
        (!isIntInRange(meta.lines, 0, 10_000) || score < meta.lines)
      )
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'breakout': {
      if (
        meta?.lives !== undefined &&
        (!isIntInRange(meta.lives, 0, 10) || (outcome === 'win' && meta.lives < 1))
      )
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'shooter': {
      if (meta?.kills !== undefined && !isIntInRange(meta.kills, 0, 100_000))
        throw apiError(400, 'BAD_REQUEST');
      if (
        meta?.survivalSeconds !== undefined &&
        (typeof meta.survivalSeconds !== 'number' ||
          !Number.isFinite(meta.survivalSeconds) ||
          meta.survivalSeconds < 0 ||
          meta.survivalSeconds > 86_400)
      )
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'tank': {
      if (
        meta?.baseDamaged !== undefined &&
        (typeof meta.baseDamaged !== 'boolean' ||
          (outcome === 'win' && meta.baseDamaged === true))
      )
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'rubiks': {
      if (outcome === 'win' && !isIntInRange(score, 1, 86_400))
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'go':
    case 'xiangqi':
    case 'chess':
    case 'gomoku':
    case 'tictactoe': {
      if (
        meta?.opponent !== undefined &&
        meta.opponent !== 'ai' &&
        meta.opponent !== 'human'
      )
        throw apiError(400, 'BAD_REQUEST');
      if (meta?.moves !== undefined && !isIntInRange(meta.moves, 1, 10_000))
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'doudizhu': {
      if (outcome === 'draw') throw apiError(400, 'BAD_REQUEST');
      if (meta?.spring !== undefined && typeof meta.spring !== 'boolean')
        throw apiError(400, 'BAD_REQUEST');
      if (meta?.landlord !== undefined && typeof meta.landlord !== 'boolean')
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
    case 'shengji': {
      if (meta?.upgrade !== undefined && !isIntInRange(meta.upgrade, 0, 20))
        throw apiError(400, 'BAD_REQUEST');
      break;
    }
  }
}

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
    (value.challengeId !== undefined && value.challengeId !== ARCADE_CHALLENGE_ID) ||
    typeof value.roundId !== 'string' ||
    !/^arcade:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.roundId) ||
    typeof gameId !== 'string' ||
    !games.some((game) => game.id === gameId && game.id !== 'mahjong-japanese') ||
    typeof difficulty !== 'string' ||
    normalizeArcadeDifficulty(gameId, difficulty) !== difficulty)
    throw apiError(400, 'BAD_REQUEST');
  if (value.meta !== undefined &&
    (!value.meta || typeof value.meta !== 'object' || Array.isArray(value.meta) ||
      JSON.stringify(value.meta).length > 10_000))
    throw apiError(400, 'BAD_REQUEST');
  if (value.type === 'finish') {
    if (
      typeof value.score !== 'number' ||
      (value.outcome !== 'win' && value.outcome !== 'lose' && value.outcome !== 'draw')
    )
      throw apiError(400, 'BAD_REQUEST');
    validatePlausibleFinish(
      gameId,
      value.outcome,
      value.score,
      value.meta as Record<string, unknown> | undefined,
    );
  }
  return { baseRevision: baseRevision as number, event: value as ArcadeMemberEvent };
}

function settle(snapshot: ReturnType<typeof readSnapshot>, event: ArcadeMemberEvent): {
  snapshot: ReturnType<typeof readSnapshot>;
  result: ArcadeMemberResult;
} {
  if (event.challengeId) {
    if (event.type === 'start') return { snapshot, result: { coinsEarned: 0, capReached: false } };
    const { state, result } = recordArcadeChallenge(snapshot.arcadeChallenges, event.roundId, {
      gameId: event.gameId, difficulty: event.difficulty, outcome: event.outcome!, score: event.score!, meta: event.meta,
    }, Date.now());
    return { snapshot: { ...snapshot, arcadeChallenges: state }, result: { coinsEarned: 0, capReached: false, challenge: result } };
  }
  const updated = runSnapshotMutation(snapshot, () => {
    gameStore.setState({
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
        'SELECT game_id, difficulty, challenge_id, started_at, finished_at, result_json FROM arcade_rounds WHERE member_id = ? AND round_id = ?',
      ).get(member.id, event.roundId) as StoredRound | undefined;
      if (existing && (existing.game_id !== event.gameId ||
        existing.difficulty !== event.difficulty || existing.challenge_id !== (event.challengeId ?? null)))
        throw apiError(409, 'ROUND_CONFLICT');
      if (event.type === 'start' && existing)
        return { snapshot, result: { coinsEarned: 0, capReached: false } };
      if (event.type === 'finish' && existing?.finished_at !== null && existing?.finished_at !== undefined)
        return { snapshot, result: JSON.parse(existing.result_json ?? '{}') as ArcadeMemberResult };
      if (current.revision !== baseRevision)
        throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      if (event.type === 'finish' && !existing)
        throw apiError(409, 'ROUND_NOT_STARTED');
      const now = Date.now();
      if (
        event.type === 'finish' &&
        existing &&
        (now < existing.started_at - 5_000 || now - existing.started_at > MAX_ROUND_AGE_MS)
      )
        throw apiError(400, 'BAD_REQUEST');
      let finishEvent = event;
      if (event.type === 'finish' && existing) {
        const elapsed = Math.max(0, now - existing.started_at);
        const reported = event.meta?.durationMs;
        // Retried starts may reach the server only after the challenge ended.
        const durationMs = event.challengeId && isIntInRange(reported, 0, MAX_ROUND_AGE_MS)
          ? Math.max(elapsed, reported)
          : elapsed;
        finishEvent = { ...event, meta: { ...event.meta, durationMs } };
      }
      const updated = settle(snapshot, finishEvent);
      const next = saveSnapshot(db, current, updated.snapshot);
      if (event.type === 'start') {
        db.prepare(
          'INSERT INTO arcade_rounds(member_id, round_id, game_id, difficulty, challenge_id, started_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(member.id, event.roundId, event.gameId, event.difficulty, event.challengeId ?? null, now);
      } else {
        const standing = event.challengeId ? null : recordRankedResult(db, {
          memberId: member.id,
          roundId: event.roundId,
          gameId: event.gameId,
          difficulty: event.difficulty,
          outcome: event.outcome!,
          score: event.score!,
          stats: statsFor(updated.snapshot, event.gameId, event.difficulty),
          occurredAt: now,
          durationMs: existing ? now - existing.started_at : null,
          now,
        });
        if (standing) updated.result.leaderboard = standing;
        db.prepare(
          'UPDATE arcade_rounds SET finished_at = ?, result_json = ? WHERE member_id = ? AND round_id = ?',
        ).run(now, JSON.stringify(updated.result), member.id, event.roundId);
      }
      return { snapshot: next, result: updated.result };
    });
  });
}
