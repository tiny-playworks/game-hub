import { afterEach, beforeEach, describe, expect, it } from 'rstack/test';
import {
  checkServerHealth,
  fetchCurrentMe,
  HouseholdApiError,
  importLegacySave,
  listMembers,
  loginSession,
  logoutSession,
  purchaseCosmeticItem,
  updatePreferences,
} from '@/lib/household/api';

describe('P10 Household API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // 恢复初始 fetch
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('checkServerHealth returns true on 200 { status: "ok" }', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 });

    const healthy = await checkServerHealth();
    expect(healthy).toBe(true);
  });

  it('checkServerHealth returns false when network fails or non-200', async () => {
    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    const healthy = await checkServerHealth();
    expect(healthy).toBe(false);
  });

  it('listMembers parses member summaries properly', async () => {
    const mockList = [
      { id: '1', nickname: 'Alice', avatarPresetId: 'default-1', avatarUploadDataUrl: null },
      { id: '2', nickname: 'Bob', avatarPresetId: 'default-2', avatarUploadDataUrl: null },
    ];
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockList), { status: 200 });

    const list = await listMembers();
    expect(list).toEqual(mockList);
  });

  it('loginSession handles 401 INVALID_PIN with typed HouseholdApiError', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: 'INVALID_PIN',
          messageKey: 'household.error.INVALID_PIN',
          retryable: false,
        }),
        { status: 401 },
      );

    await expect(loginSession('mem-1', '1234')).rejects.toThrow(HouseholdApiError);
    try {
      await loginSession('mem-1', '1234');
    } catch (err) {
      expect(err).toBeInstanceOf(HouseholdApiError);
      const apiErr = err as HouseholdApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.code).toBe('INVALID_PIN');
    }
  });

  it('loginSession handles 429 PIN_LOCKED', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: 'PIN_LOCKED',
          messageKey: 'household.error.PIN_LOCKED',
          retryable: true,
        }),
        { status: 429 },
      );

    try {
      await loginSession('mem-1', '1234');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HouseholdApiError);
      const apiErr = err as HouseholdApiError;
      expect(apiErr.status).toBe(429);
      expect(apiErr.code).toBe('PIN_LOCKED');
      expect(apiErr.retryable).toBe(true);
    }
  });

  it('purchaseCosmeticItem returns updated snapshot on success', async () => {
    const mockResult = {
      itemId: 'back-gold',
      snapshot: { schema: 1, memberId: 'mem-1', revision: 2 },
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockResult), { status: 200 });

    const result = await purchaseCosmeticItem('back-gold');
    expect(result.itemId).toBe('back-gold');
    expect(result.snapshot.revision).toBe(2);
  });

  it('logoutSession sends DELETE /api/v1/session', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 });

    const result = await logoutSession();
    expect(result.ok).toBe(true);
  });

  it('fetchCurrentMe fetches /api/v1/me', async () => {
    const mockMe = {
      snapshot: { schema: 1, memberId: 'mem-1', revision: 3 },
      deviceId: 'dev-1',
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockMe), { status: 200 });

    const me = await fetchCurrentMe();
    expect(me.deviceId).toBe('dev-1');
    expect(me.snapshot.revision).toBe(3);
  });

  it('updatePreferences sends PATCH /api/v1/me/preferences', async () => {
    const mockResult = {
      snapshot: { schema: 1, memberId: 'mem-1', revision: 4 },
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockResult), { status: 200 });

    const result = await updatePreferences(3, { locale: 'en' });
    expect(result.snapshot.revision).toBe(4);
  });

  it('importLegacySave sends POST /api/v1/me/import', async () => {
    const mockResult = {
      snapshot: { schema: 1, memberId: 'mem-1', revision: 5 },
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockResult), { status: 200 });

    const result = await importLegacySave({ someData: 'legacy' });
    expect(result.snapshot.revision).toBe(5);
  });
});
