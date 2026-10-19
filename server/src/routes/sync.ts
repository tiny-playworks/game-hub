import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type {
  OfflineReceipt,
  OfflineReceiptResult,
  ResumeSaveRecord,
  ResumeSaveSummary,
  SyncBatchRequest,
  SyncBatchResponse,
  SyncRejectedItem,
} from '../../../shared/contracts/sync';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import { apiError, requireSession } from '../auth';
import { archiveReplay, getMember, readSnapshot, saveSnapshot, transaction } from '../db';
import { isReplayFile, restoreMatch, toReplayFile, type RiichiMatchState } from '@/pages/mahjong/japanese/engine';
import { recordRankedResult, reportedDurationMs, statsFor } from '../services/leaderboard';
import { replayFreeContinuation } from '../riichi/continuation';
import {
  processOfflineArcadeReceipt,
  processOfflineRiichiReceipt,
  recordMemberThemeChallengeMatch,
} from '../services/progression';

export function registerSyncRoutes(app: FastifyInstance, db: DatabaseSync): void {
  // 批量同步离线凭据
  app.post('/api/v1/sync', async (request) => {
    const { member, session } = requireSession(db, request);
    const body = request.body as Partial<SyncBatchRequest> | undefined;

    if (!body || !Array.isArray(body.receipts) || body.receipts.length > 100) {
      throw apiError(400, 'BAD_REQUEST');
    }

    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');

      let snapshot = readSnapshot(current);
      const accepted: OfflineReceiptResult[] = [];
      const duplicates: string[] = [];
      const rejected: SyncRejectedItem[] = [];

      for (const receipt of body.receipts as OfflineReceipt[]) {
        if (!receipt || receipt.schema !== 1 || typeof receipt.eventId !== 'string' || !receipt.eventId || receipt.eventId.length > 128 ||
          typeof receipt.matchId !== 'string' || !receipt.matchId || receipt.matchId.length > 128 ||
          typeof receipt.deviceId !== 'string' || typeof receipt.occurredAt !== 'string' ||
          !Number.isFinite(Date.parse(receipt.occurredAt)) || !['free', 'arcade'].includes(receipt.matchSource) ||
          !receipt.payload || receipt.payload.source !== receipt.matchSource) {
          rejected.push({
            eventId: receipt?.eventId ?? 'unknown',
            code: 'INVALID_RECEIPT_STRUCTURE',
            messageKey: 'household.error.INVALID_RECEIPT_STRUCTURE',
          });
          continue;
        }

        // 成员 ID 隔离校验：严禁跨成员冒名提交凭据
        if (receipt.memberId !== member.id) {
          rejected.push({
            eventId: receipt.eventId,
            code: 'MEMBER_MISMATCH',
            messageKey: 'household.error.MEMBER_MISMATCH',
          });
          continue;
        }

        // 幂等防重检查：检查该 eventId 是否已被处理
        const existingEvent = db
          .prepare(
            'SELECT status, result_json FROM offline_receipts WHERE member_id = ? AND event_id = ?',
          )
          .get(member.id, receipt.eventId) as
          | { status: string; result_json: string | null }
          | undefined;

        if (existingEvent) {
          if (existingEvent.status === 'accepted' || existingEvent.status === 'duplicate') {
            duplicates.push(receipt.eventId);
          } else {
            rejected.push({
              eventId: receipt.eventId,
              code: 'ALREADY_REJECTED',
              messageKey: 'household.error.ALREADY_REJECTED',
            });
          }
          continue;
        }

        // 检查该 matchId + source 是否已被结算过（防止同一场对局生成多个 eventId 重复发奖）
        const existingMatch = db
          .prepare(
            "SELECT 1 FROM offline_receipts WHERE member_id = ? AND match_id = ? AND source = ? AND status = 'accepted'",
          )
          .get(member.id, receipt.matchId, receipt.matchSource);

        if (existingMatch) {
          duplicates.push(receipt.eventId);
          // 标记此重复 eventId 为 duplicate 记录
          db.prepare(
            `INSERT INTO offline_receipts (member_id, event_id, device_id, match_id, source, occurred_at, payload_json, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate', ?)`,
          ).run(
            member.id,
            receipt.eventId,
            receipt.deviceId,
            receipt.matchId,
            receipt.matchSource,
            receipt.occurredAt,
            JSON.stringify(receipt.payload),
            Date.now(),
          );
          continue;
        }

        const previousSnapshot = snapshot;
        db.exec('SAVEPOINT offline_receipt_settlement');
        try {
          let settleResult: {
            snapshot: typeof snapshot;
            result: OfflineReceiptResult;
          };

          if (receipt.matchSource === 'free') {
            const online = db.prepare('SELECT state_json, device_id, source, finished_at, challenge_eligible FROM riichi_matches WHERE member_id = ? AND match_id = ?')
              .get(member.id, receipt.matchId) as { state_json: string; device_id: string; source: string; finished_at: number | null; challenge_eligible: number } | undefined;
            if (online && (online.source !== 'free' || online.device_id !== session.device_id || receipt.deviceId !== session.device_id))
              throw new Error('DEVICE_NOT_OWNER');
            if (online?.finished_at != null) {
              db.exec('RELEASE SAVEPOINT offline_receipt_settlement');
              duplicates.push(receipt.eventId);
              continue;
            }
            const continuation = receipt.payload.source === 'free'
              ? replayFreeContinuation(receipt.payload.riichi.replay,
                online ? JSON.parse(online.state_json) as RiichiMatchState : undefined) : null;
            settleResult = processOfflineRiichiReceipt(snapshot, receipt, (match) =>
              (online ? online.challenge_eligible === 1 : receipt.payload.source === 'free' && receipt.payload.riichi.themeChallengeEligible === true)
                ? recordMemberThemeChallengeMatch(
                    db,
                    member.id,
                    receipt.matchId,
                    'free',
                    match,
                  )
                : 0,
              continuation?.effects);
            if (continuation && continuation.match.status === 'matchEnd' && continuation.match.matchEnd) {
              if (online) db.prepare('UPDATE riichi_matches SET state_json = ?, finished_at = ?, updated_at = ? WHERE member_id = ? AND match_id = ?')
                .run(JSON.stringify(continuation.match), Date.now(), Date.now(), member.id, receipt.matchId);
              const match = continuation.match;
              archiveReplay(db, member.id, { matchId: receipt.matchId, source: 'free', viewerSeat: 0,
                playerCharacterId: receipt.payload.source === 'free' ? receipt.payload.riichi.playerCharacterId : 'aoi',
                ranking: match.matchEnd!.ranking.indexOf(0) + 1, finalScore: match.matchEnd!.finalScores[0],
                matchLength: match.matchLength, replayJson: JSON.stringify(toReplayFile(match)) });
              db.prepare('DELETE FROM resume_saves WHERE member_id = ? AND save_id = ?').run(member.id, receipt.matchId);
            }
          } else if (receipt.matchSource === 'arcade') {
            settleResult = processOfflineArcadeReceipt(snapshot, receipt);
            if (receipt.payload.source === 'arcade') {
              const arcade = receipt.payload.arcade;
              recordRankedResult(db, {
                memberId: member.id,
                roundId: receipt.matchId,
                gameId: arcade.gameId,
                difficulty: normalizeArcadeDifficulty(arcade.gameId, arcade.difficulty),
                outcome: arcade.outcome,
                score: arcade.score,
                stats: statsFor(settleResult.snapshot, arcade.gameId,
                  normalizeArcadeDifficulty(arcade.gameId, arcade.difficulty)),
                occurredAt: Date.parse(receipt.occurredAt),
                durationMs: reportedDurationMs(arcade.meta),
              });
            }
          } else {
            throw new Error('UNKNOWN_MATCH_SOURCE');
          }

          db.prepare(
            `INSERT INTO offline_receipts (member_id, event_id, device_id, match_id, source, occurred_at, payload_json, status, result_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', ?, ?)`,
          ).run(
            member.id,
            receipt.eventId,
            receipt.deviceId,
            receipt.matchId,
            receipt.matchSource,
            receipt.occurredAt,
            JSON.stringify(receipt.payload),
            JSON.stringify(settleResult.result),
            Date.now(),
          );
          db.exec('RELEASE SAVEPOINT offline_receipt_settlement');
          snapshot = settleResult.snapshot;
          accepted.push(settleResult.result);
        } catch (err: unknown) {
          db.exec('ROLLBACK TO SAVEPOINT offline_receipt_settlement');
          db.exec('RELEASE SAVEPOINT offline_receipt_settlement');
          snapshot = previousSnapshot;
          const code = err instanceof Error ? err.message : 'SETTLEMENT_FAILED';
          rejected.push({
            eventId: receipt.eventId,
            code,
            messageKey: `household.error.${code}`,
          });

          db.prepare(
            `INSERT INTO offline_receipts (member_id, event_id, device_id, match_id, source, occurred_at, payload_json, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?)`,
          ).run(
            member.id,
            receipt.eventId,
            receipt.deviceId,
            receipt.matchId,
            receipt.matchSource,
            receipt.occurredAt,
            JSON.stringify(receipt.payload),
            Date.now(),
          );
        }
      }

      // 如果有被接受的凭据，递增 revision 并落库
      let finalSnapshot = snapshot;
      if (accepted.length > 0) {
        finalSnapshot = saveSnapshot(db, current, snapshot);
      }

      const response: SyncBatchResponse = {
        accepted,
        duplicates,
        rejected,
        snapshot: finalSnapshot,
      };

      return response;
    });
  });

  // 获取该成员所有未完成自由局续局列表（跨设备）
  app.get('/api/v1/saves', async (request) => {
    const { member } = requireSession(db, request);
    const rows = db
      .prepare(
        'SELECT save_id, device_id, save_json, updated_at FROM resume_saves WHERE member_id = ? ORDER BY updated_at DESC',
      )
      .all(member.id) as {
      save_id: string;
      device_id: string;
      save_json: string;
      updated_at: number;
    }[];

    const summaries: ResumeSaveSummary[] = [];
    for (const row of rows) {
      try {
        const data = JSON.parse(row.save_json) as ResumeSaveRecord;
        const summary: ResumeSaveSummary = {
          saveId: row.save_id,
          deviceId: row.device_id,
          updatedAt: new Date(row.updated_at).toISOString(),
          source: 'free',
          matchLength: data.replay?.matchLength ?? 'east',
          ...(data.roundSummary ? { roundSummary: data.roundSummary } : {}),
        };
        summaries.push(summary);
      } catch {
        // skip invalid
      }
    }

    const active = db.prepare("SELECT match_id, device_id, state_json, updated_at FROM riichi_matches WHERE member_id = ? AND source = 'free' AND finished_at IS NULL")
      .all(member.id) as Array<{ match_id: string; device_id: string; state_json: string; updated_at: number }>;
    for (const row of active) {
      if (summaries.some((save) => save.saveId === row.match_id)) continue;
      const match = JSON.parse(row.state_json) as RiichiMatchState;
      summaries.push({ saveId: row.match_id, deviceId: row.device_id, source: 'free',
        updatedAt: new Date(row.updated_at).toISOString(), matchLength: match.matchLength,
        roundSummary: { round: match.round.roundNumber, roundName: `${match.round.roundWind === 0 ? 'East' : 'South'} ${match.round.roundNumber + 1}`, scores: match.round.scores } });
    }

    return summaries;
  });

  // 获取特定自由局续局详情
  app.get('/api/v1/saves/:saveId', async (request) => {
    const { member } = requireSession(db, request);
    const { saveId } = request.params as { saveId: string };

    const row = db
      .prepare(
        'SELECT save_json FROM resume_saves WHERE member_id = ? AND save_id = ?',
      )
      .get(member.id, saveId) as { save_json: string } | undefined;

    if (!row) {
      const active = db.prepare("SELECT * FROM riichi_matches WHERE member_id = ? AND match_id = ? AND source = 'free' AND finished_at IS NULL")
        .get(member.id, saveId) as { device_id: string; state_json: string; player_character_id: string; updated_at: number; challenge_eligible: number } | undefined;
      if (!active) throw apiError(404, 'SAVE_NOT_FOUND');
      return { schema: 1, memberId: member.id, deviceId: active.device_id, saveId, source: 'free',
        replay: toReplayFile(JSON.parse(active.state_json)), processedProgress: [], playerCharacterId: active.player_character_id,
        themeChallengeEligible: active.challenge_eligible === 1, updatedAt: new Date(active.updated_at).toISOString() };
    }
    return JSON.parse(row.save_json) as ResumeSaveRecord;
  });

  // 上传或更新本设备的自由局续局
  app.put('/api/v1/saves/:saveId', async (request) => {
    const { member, session } = requireSession(db, request);
    const { saveId } = request.params as { saveId: string };
    const body = request.body as Partial<ResumeSaveRecord> | undefined;

    if (!body || !isReplayFile(body.replay) || body.replay.ranked || saveId.length > 128)
      throw apiError(400, 'BAD_REQUEST');
    const restored = restoreMatch(body.replay);
    if (!restored || restored.status === 'matchEnd') throw apiError(400, 'BAD_REQUEST');
    const active = db.prepare('SELECT device_id, finished_at FROM riichi_matches WHERE member_id = ? AND match_id = ?')
      .get(member.id, saveId) as { device_id: string; finished_at: number | null } | undefined;
    if (active && (active.device_id !== session.device_id || active.finished_at !== null)) throw apiError(409, 'MATCH_CONFLICT');

    const record: ResumeSaveRecord = {
      schema: 1,
      memberId: member.id,
      deviceId: session.device_id,
      saveId,
      source: 'free',
      updatedAt: new Date().toISOString(),
      replay: body.replay,
      processedProgress: Array.isArray(body.processedProgress)
        ? body.processedProgress
        : [],
      playerCharacterId: body.playerCharacterId,
      themeChallengeEligible: body.themeChallengeEligible === true,
      roundSummary: body.roundSummary,
    };

    db.prepare(
      `INSERT INTO resume_saves (member_id, device_id, save_id, source, save_json, updated_at)
       VALUES (?, ?, ?, 'free', ?, ?)
       ON CONFLICT(member_id, device_id, save_id) DO UPDATE SET
         save_json = excluded.save_json,
         updated_at = excluded.updated_at`,
    ).run(
      member.id,
      session.device_id,
      saveId,
      JSON.stringify(record),
      Date.now(),
    );

    return { ok: true, saveId, updatedAt: record.updatedAt };
  });

  // 删除自由局续局（完赛或放弃对局后）
  app.delete('/api/v1/saves/:saveId', async (request) => {
    const { member } = requireSession(db, request);
    const { saveId } = request.params as { saveId: string };

    db.prepare('DELETE FROM resume_saves WHERE member_id = ? AND save_id = ?').run(
      member.id,
      saveId,
    );
    db.prepare("UPDATE riichi_matches SET finished_at = ? WHERE member_id = ? AND match_id = ? AND source = 'free' AND finished_at IS NULL")
      .run(Date.now(), member.id, saveId);

    return { ok: true };
  });
}
