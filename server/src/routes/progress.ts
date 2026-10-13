import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import {
  checkinToday,
  claimMonthMilestone,
  claimWeekMilestone,
} from '@/lib/checkin';
import { claimDailyTask } from '@/lib/dailyTasks';
import { claimWeeklyTask } from '@/lib/weeklyTasks';
import type { ProgressAction } from '../../../shared/contracts/member';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';

function readAction(body: unknown): { baseRevision: number; action: ProgressAction } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw apiError(400, 'BAD_REQUEST');
  const { baseRevision, action } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(baseRevision) || !action ||
    typeof action !== 'object' || Array.isArray(action))
    throw apiError(400, 'BAD_REQUEST');
  const value = action as Record<string, unknown>;
  switch (value.type) {
    case 'checkin':
    case 'checkin-week':
    case 'checkin-month':
      if (Object.keys(value).length !== 1) throw apiError(400, 'BAD_REQUEST');
      return { baseRevision: baseRevision as number, action: value as ProgressAction };
    case 'claim-daily-task':
    case 'claim-weekly-task':
      if (Object.keys(value).length !== 2 || typeof value.taskId !== 'string' ||
        value.taskId.length === 0 || value.taskId.length > 100)
        throw apiError(400, 'BAD_REQUEST');
      return { baseRevision: baseRevision as number, action: value as ProgressAction };
    default:
      throw apiError(400, 'BAD_REQUEST');
  }
}

function perform(action: ProgressAction) {
  switch (action.type) {
    case 'checkin': {
      const result = checkinToday();
      return { ok: result.ok, awardedPoints: result.awardedPoints,
        awardedCoins: result.awardedCoins };
    }
    case 'checkin-week': {
      const result = claimWeekMilestone(7);
      return { ok: result.ok, awardedPoints: result.awardedPoints, awardedCoins: 0 };
    }
    case 'checkin-month': {
      const result = claimMonthMilestone(30);
      return { ok: result.ok, awardedPoints: result.awardedPoints, awardedCoins: 0 };
    }
    case 'claim-daily-task': {
      const result = claimDailyTask(action.taskId);
      return { ok: result.ok, awardedPoints: result.awardedPoints, awardedCoins: 0 };
    }
    case 'claim-weekly-task': {
      const result = claimWeeklyTask(action.taskId);
      return { ok: result.ok, awardedPoints: result.awardedPoints, awardedCoins: 0 };
    }
  }
}

export function registerProgressRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.post('/api/v1/me/progress/actions', async (request) => {
    const { member } = requireSession(db, request);
    const { baseRevision, action } = readAction(request.body);
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      if (current.revision !== baseRevision)
        throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      const snapshot = readSnapshot(current);
      const updated = runSnapshotMutation(snapshot, () => perform(action));
      if (!updated.result.ok) return { snapshot, result: updated.result };
      return {
        snapshot: saveSnapshot(db, current, updated.snapshot),
        result: updated.result,
      };
    });
  });
}
