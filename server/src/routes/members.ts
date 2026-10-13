import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { normalizeAudioVolumes, normalizePlayerProfile, normalizeRiichiSettings, sanitizeNickname } from '@/lib/playerProfile';
import type { MemberSummary } from '../../../shared/contracts/member';
import { apiError, createSession, destroySession, requireSession, validatePin } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction, type MemberRow } from '../db';
import { parseLegacyImport } from '../snapshot';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw apiError(400, 'BAD_REQUEST');
  }
  return value as Record<string, unknown>;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function summary(row: MemberRow): MemberSummary {
  const profile = readSnapshot(row).profile;
  return {
    id: row.id,
    nickname: profile.nickname,
    avatarPresetId: profile.avatarPresetId,
    avatarUploadDataUrl: profile.avatarUploadDataUrl,
  };
}

export function registerMemberRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get('/api/v1/members', async () => {
    const rows = db.prepare('SELECT * FROM members ORDER BY created_at').all() as unknown as MemberRow[];
    return rows.map(summary);
  });

  app.post('/api/v1/session', async (request, reply) => {
    const body = object(request.body);
    if (!isUuid(body.memberId) || !validatePin(body.pin)) {
      throw apiError(400, 'BAD_REQUEST');
    }
    const deviceId = isUuid(body.deviceId) ? body.deviceId : randomUUID();
    return createSession(db, request, reply, body.memberId, body.pin, deviceId);
  });

  app.delete('/api/v1/session', async (request, reply) => {
    destroySession(db, request, reply);
    return { ok: true };
  });

  app.get('/api/v1/me', async (request) => {
    const { member, session } = requireSession(db, request);
    return { snapshot: readSnapshot(member), deviceId: session.device_id };
  });

  app.patch('/api/v1/me/preferences', async (request) => {
    const { member } = requireSession(db, request);
    const body = object(request.body);
    const baseRevision = body.baseRevision;
    const changes = object(body.changes);
    if (!Number.isSafeInteger(baseRevision)) throw apiError(400, 'BAD_REQUEST');
    const allowed = new Set(['locale', 'riichiTheme', 'venueTheme', 'arcadePrefs']);
    if (Object.keys(changes).some((key) => !allowed.has(key))) throw apiError(400, 'BAD_REQUEST');
    if (changes.locale !== undefined && changes.locale !== 'zh' && changes.locale !== 'en')
      throw apiError(400, 'BAD_REQUEST');
    for (const key of ['riichiTheme', 'venueTheme']) {
      if (changes[key] !== undefined && changes[key] !== null && typeof changes[key] !== 'string')
        throw apiError(400, 'BAD_REQUEST');
    }
    if (changes.arcadePrefs !== undefined) object(changes.arcadePrefs);
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      if (current.revision !== baseRevision) throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      const snapshot = readSnapshot(current);
      const next = saveSnapshot(db, current, {
        ...snapshot,
        preferences: { ...snapshot.preferences, ...changes },
      });
      return { snapshot: next };
    });
  });

  app.patch('/api/v1/me/profile', async (request) => {
    const { member } = requireSession(db, request);
    const body = object(request.body);
    const changes = object(body.changes);
    if (!Number.isSafeInteger(body.baseRevision)) throw apiError(400, 'BAD_REQUEST');
    const allowed = new Set(['nickname', 'avatarMode', 'avatarPresetId', 'avatarUploadDataUrl', 'activeTitle', 'audioVolumes', 'riichiSettings']);
    if (Object.keys(changes).some((key) => !allowed.has(key))) throw apiError(400, 'BAD_REQUEST');
    if (changes.nickname !== undefined && (typeof changes.nickname !== 'string' || changes.nickname.length > 64))
      throw apiError(400, 'BAD_REQUEST');
    if (changes.avatarUploadDataUrl !== undefined && changes.avatarUploadDataUrl !== null &&
      (typeof changes.avatarUploadDataUrl !== 'string' || changes.avatarUploadDataUrl.length > 500_000))
      throw apiError(400, 'BAD_REQUEST');
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      if (current.revision !== body.baseRevision) throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      const snapshot = readSnapshot(current);
      const patch = {
        ...changes,
        ...(changes.nickname !== undefined ? { nickname: sanitizeNickname(changes.nickname as string) } : {}),
        audioVolumes: changes.audioVolumes === undefined
          ? snapshot.profile.audioVolumes
          : normalizeAudioVolumes({ ...snapshot.profile.audioVolumes, ...object(changes.audioVolumes) }),
        riichiSettings: changes.riichiSettings === undefined
          ? snapshot.profile.riichiSettings
          : normalizeRiichiSettings({ ...snapshot.profile.riichiSettings, ...object(changes.riichiSettings) }),
      };
      const profile = normalizePlayerProfile({ ...snapshot.profile, ...patch, updatedAt: Date.now() });
      const next = saveSnapshot(db, current, { ...snapshot, profile });
      return { snapshot: next };
    });
  });

  app.post('/api/v1/me/import', async (request) => {
    const { member } = requireSession(db, request);
    const body = object(request.body);
    let imported;
    try {
      imported = parseLegacyImport(body.save, member.id, readSnapshot(member).profile.nickname);
    } catch {
      throw apiError(400, 'INVALID_SAVE');
    }
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      if (current.revision !== 0 || current.imported_at !== null)
        throw apiError(409, 'ALREADY_IMPORTED', false, current.revision);
      const next = saveSnapshot(db, current, imported);
      db.prepare('UPDATE members SET imported_at = ? WHERE id = ?').run(next.updatedAt, member.id);
      db.prepare('INSERT INTO import_backups(member_id, exported_at, save_json, imported_at) VALUES (?, ?, ?, ?)')
        .run(member.id, object(body.save).exportedAt as string, JSON.stringify(body.save), next.updatedAt);
      return { snapshot: next };
    });
  });
}
