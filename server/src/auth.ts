import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorBody } from '../../shared/contracts/api';
import { getMember, type MemberRow, type SessionRow } from './db';

const COOKIE = 'gh_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const LOCK_SECONDS = 5 * 60;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.code);
  }
}

export function apiError(
  status: number,
  code: string,
  retryable = false,
  revision?: number,
): ApiError {
  return new ApiError(status, {
    code,
    messageKey: `household.error.${code}`,
    retryable,
    ...(revision === undefined ? {} : { revision }),
  });
}

export function validatePin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')): {
  salt: string;
  hash: string;
} {
  if (!validatePin(pin)) throw new Error('PIN must contain exactly four digits');
  return {
    salt,
    hash: scryptSync(pin, Buffer.from(salt, 'hex'), 32).toString('hex'),
  };
}

function pinMatches(pin: string, row: MemberRow): boolean {
  const expected = Buffer.from(row.pin_hash, 'hex');
  const actual = Buffer.from(hashPin(pin, row.pin_salt).hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieToken(request: FastifyRequest): string | null {
  const header = request.headers.cookie ?? '';
  const part = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`));
  return part ? part.slice(COOKIE.length + 1) : null;
}

export function assertSameOrigin(request: FastifyRequest): void {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') {
    throw apiError(403, 'ORIGIN_DENIED');
  }
  try {
    const parsed = new URL(origin);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.host !== host ||
      parsed.pathname !== '/'
    ) {
      throw apiError(403, 'ORIGIN_DENIED');
    }
  } catch {
    throw apiError(403, 'ORIGIN_DENIED');
  }
}

export interface AuthenticatedSession {
  member: MemberRow;
  session: SessionRow;
}

export function requireSession(
  db: DatabaseSync,
  request: FastifyRequest,
): AuthenticatedSession {
  const token = cookieToken(request);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw apiError(401, 'UNAUTHORIZED');
  }
  const session = db.prepare(
    'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?',
  ).get(tokenHash(token), Date.now()) as unknown as SessionRow | undefined;
  if (!session) throw apiError(401, 'UNAUTHORIZED');
  const member = getMember(db, session.member_id);
  if (!member) throw apiError(401, 'UNAUTHORIZED');
  return { member, session };
}

function setCookie(reply: FastifyReply, token: string, maxAge: number, secure: boolean): void {
  reply.header(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`,
  );
}

export function createSession(
  db: DatabaseSync,
  request: FastifyRequest,
  reply: FastifyReply,
  memberId: string,
  pin: string,
  deviceId: string,
): { memberId: string; deviceId: string; expiresAt: string } {
  const row = getMember(db, memberId);
  if (!row) throw apiError(401, 'INVALID_PIN');
  const ip = request.ip;
  const now = Date.now();
  const failure = db.prepare(
    'SELECT failures, locked_until FROM pin_failures WHERE member_id = ? AND ip = ?',
  ).get(memberId, ip) as { failures: number; locked_until: number } | undefined;
  if (failure && failure.locked_until > now) {
    throw apiError(429, 'PIN_LOCKED', true);
  }
  if (!pinMatches(pin, row)) {
    const failures = (failure?.locked_until && failure.locked_until <= now ? 0 : failure?.failures ?? 0) + 1;
    db.prepare(`
      INSERT INTO pin_failures(member_id, ip, failures, locked_until)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(member_id, ip) DO UPDATE SET failures = excluded.failures,
        locked_until = excluded.locked_until
    `).run(memberId, ip, failures, failures >= 5 ? now + LOCK_SECONDS * 1000 : 0);
    throw apiError(failures >= 5 ? 429 : 401, failures >= 5 ? 'PIN_LOCKED' : 'INVALID_PIN', failures >= 5);
  }
  db.prepare('DELETE FROM pin_failures WHERE member_id = ? AND ip = ?').run(memberId, ip);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + SESSION_SECONDS * 1000;
  db.prepare('INSERT INTO sessions(token_hash, member_id, device_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), memberId, deviceId, expiresAt);
  setCookie(reply, token, SESSION_SECONDS, request.protocol === 'https');
  return { memberId, deviceId, expiresAt: new Date(expiresAt).toISOString() };
}

export function destroySession(
  db: DatabaseSync,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const token = cookieToken(request);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  setCookie(reply, '', 0, request.protocol === 'https');
}
