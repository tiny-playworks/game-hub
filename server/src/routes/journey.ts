import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import {
  isJourneyAttemptId,
  isJourneyStageId,
  isJourneyVariation,
  JOURNEY_CONTENT_VERSION,
  recordJourneyEvaluation,
  type JourneyAttemptInput,
  type JourneyEvaluation,
} from '../../../shared/contracts/journey';
import { validateJourneyAttempt, getJourneyStage } from '@/lib/riichiJourney';
import { CHARACTER_DEFS, normalizePlayerCharacterState } from '@/lib/playerCharacters';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';

function readAttempt(body: unknown): { baseRevision: number; input: JourneyAttemptInput } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw apiError(400, 'BAD_REQUEST');
  const value = body as Record<string, unknown>;
  if (!Number.isSafeInteger(value.baseRevision) || Number(value.baseRevision) < 0 ||
    !isJourneyAttemptId(value.attemptId) || !isJourneyStageId(value.stageId) ||
    value.contentVersion !== JOURNEY_CONTENT_VERSION ||
    (value.variation !== undefined && !isJourneyVariation(value.variation)) ||
    !value.replay || typeof value.replay !== 'object' || Array.isArray(value.replay) ||
    Object.keys(value).some((key) =>
      !['baseRevision', 'attemptId', 'stageId', 'contentVersion', 'replay', 'variation'].includes(key)))
    throw apiError(400, 'BAD_REQUEST');
  return {
    baseRevision: value.baseRevision as number,
    input: {
      attemptId: value.attemptId,
      stageId: value.stageId,
      contentVersion: value.contentVersion,
      replay: value.replay as JourneyAttemptInput['replay'],
      ...(isJourneyVariation(value.variation) ? { variation: value.variation } : {}),
    },
  };
}

/** Object key order is irrelevant to the identity of a retry. */
function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 12) throw apiError(400, 'BAD_REQUEST');
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(object[key], depth + 1)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function registerJourneyRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.post('/api/v1/me/journey/attempts', async (request) => {
    const { member } = requireSession(db, request);
    const { baseRevision, input } = readAttempt(request.body);
    const payloadHash = createHash('sha256').update(canonicalJson(input)).digest('hex');

    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      const snapshot = readSnapshot(current);
      const existing = db.prepare(`
        SELECT payload_hash, evaluation_json FROM journey_attempts
        WHERE member_id = ? AND attempt_id = ?
      `).get(member.id, input.attemptId) as {
        payload_hash: string;
        evaluation_json: string;
      } | undefined;
      if (existing) {
        if (existing.payload_hash !== payloadHash)
          throw apiError(409, 'BAD_REQUEST');
        return {
          snapshot,
          evaluation: JSON.parse(existing.evaluation_json) as JourneyEvaluation,
        };
      }
      if (current.revision !== baseRevision)
        throw apiError(409, 'REVISION_CONFLICT', true, current.revision);

      let evaluation: JourneyEvaluation;
      try {
        if (input.variation && !snapshot.journey.stages[input.stageId].completed)
          throw new Error('Main stage is not complete');
        evaluation = validateJourneyAttempt(input);
      } catch {
        throw apiError(400, 'BAD_REQUEST');
      }
      const now = Date.now();
      const journey = recordJourneyEvaluation(snapshot.journey,
        input.attemptId, input.stageId, evaluation, now, input.variation);
      const stage = getJourneyStage(input.stageId);
      const unlockedByJourney = CHARACTER_DEFS.filter(
        (character) =>
          character.unlockRule.type === 'journey-stage' &&
          journey.stages[character.unlockRule.target as keyof typeof journey.stages]?.completed,
      ).map((character) => character.id);
      const characters = normalizePlayerCharacterState({
        ...snapshot.characters,
        unlockedCharacterIds: [
          ...snapshot.characters.unlockedCharacterIds,
          ...unlockedByJourney,
        ],
        encounteredCharacterIds: [
          ...snapshot.characters.encounteredCharacterIds,
          ...(stage ? stage.opponents : []),
        ],
        updatedAt: now,
      });
      const updated = saveSnapshot(db, current, { ...snapshot, journey, characters });
      db.prepare(`
        INSERT INTO journey_attempts(
          member_id, attempt_id, stage_id, content_version,
          payload_hash, evaluation_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(member.id, input.attemptId, input.stageId, input.contentVersion,
        payloadHash, JSON.stringify(evaluation), now);
      return { snapshot: updated, evaluation };
    });
  });
}
