import type { ApiErrorBody } from '../../../shared/contracts/api';
import type {
  MemberSnapshot,
  MemberSummary,
} from '../../../shared/contracts/member';

export class HouseholdApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly revision?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.code);
    this.name = 'HouseholdApiError';
    this.status = status;
    this.code = body.code;
    this.messageKey = body.messageKey;
    this.retryable = body.retryable;
    this.revision = body.revision;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {
        code: `HTTP_${response.status}`,
        messageKey: `household.error.HTTP_${response.status}`,
        retryable: response.status >= 500,
      };
    }
    throw new HouseholdApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const data = await request<{ status: string }>('/healthz');
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function listMembers(): Promise<MemberSummary[]> {
  return request<MemberSummary[]>('/api/v1/members');
}

export async function loginSession(
  memberId: string,
  pin: string,
  deviceId?: string,
): Promise<{ memberId: string; deviceId: string; expiresAt: string }> {
  return request<{ memberId: string; deviceId: string; expiresAt: string }>(
    '/api/v1/session',
    {
      method: 'POST',
      body: JSON.stringify({ memberId, pin, deviceId }),
    },
  );
}

export async function logoutSession(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/v1/session', {
    method: 'DELETE',
  });
}

export async function fetchCurrentMe(): Promise<{
  snapshot: MemberSnapshot;
  deviceId: string;
}> {
  return request<{ snapshot: MemberSnapshot; deviceId: string }>(
    '/api/v1/me',
  );
}

export async function updatePreferences(
  baseRevision: number,
  changes: Partial<MemberSnapshot['preferences']>,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, changes }),
  });
}

export async function updateProfile(
  baseRevision: number,
  changes: Record<string, unknown>,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, changes }),
  });
}

export async function importLegacySave(
  save: unknown,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/import', {
    method: 'POST',
    body: JSON.stringify({ save }),
  });
}

export async function purchaseCosmeticItem(
  itemId: string,
): Promise<{ snapshot: MemberSnapshot; itemId: string }> {
  return request<{ snapshot: MemberSnapshot; itemId: string }>(
    '/api/v1/shop/purchases',
    {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    },
  );
}
