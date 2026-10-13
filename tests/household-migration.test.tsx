import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'rstack/test';
import { HouseholdProvider, useHousehold } from '@/contexts/HouseholdContext';
import { createEmptySnapshot } from '../server/src/snapshot';
import { setStorageDriver } from '@/lib/storage';

const memberId = 'c77e174a-98a2-4281-9e4b-3afae8a5ed5a';
const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalAnchorClick = HTMLAnchorElement.prototype.click;

function mockHouseholdRequests() {
  const member = createEmptySnapshot(memberId, 'Cloud member');
  const imports: unknown[] = [];
  let loggedIn = false;
  globalThis.fetch = async (input, options) => {
    const path = String(input);
    if (path === '/healthz')
      return Response.json({ status: 'ok' });
    if (path === '/api/v1/members')
      return Response.json([{ id: memberId, nickname: 'Cloud member', avatarPresetId: member.profile.avatarPresetId, avatarUploadDataUrl: null }]);
    if (path === '/api/v1/session' && options?.method === 'POST') {
      loggedIn = true;
      return Response.json({ memberId, deviceId: 'device', expiresAt: new Date().toISOString() });
    }
    if (path === '/api/v1/me')
      return loggedIn
        ? Response.json({ snapshot: member, deviceId: 'device' })
        : Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
    if (path === '/api/v1/me/import' && options?.method === 'POST') {
      const body = JSON.parse(String(options.body)) as { save: unknown };
      imports.push(body.save);
      return Response.json({ snapshot: { ...member, revision: 1 } });
    }
    return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  };
  return imports;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  HTMLAnchorElement.prototype.click = originalAnchorClick;
  setStorageDriver(null);
  localStorage.clear();
});

describe('P10 guest migration boundary', () => {
  it('backs up and imports the guest save after member login', async () => {
    localStorage.setItem('game-hub-wallet-v1', JSON.stringify({ coins: 321 }));
    const imports = mockHouseholdRequests();
    let downloaded: Blob | null = null;
    URL.createObjectURL = (blob) => {
      downloaded = blob as Blob;
      return 'blob:guest-backup';
    };
    HTMLAnchorElement.prototype.click = () => {};

    const hook = renderHook(() => useHousehold(), { wrapper: HouseholdProvider });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await act(async () => hook.result.current.login(memberId, '1234'));
    await act(async () => hook.result.current.importLocalSave());

    expect(imports).toHaveLength(1);
    const imported = imports[0] as { data: Record<string, string> };
    expect(JSON.parse(imported.data['game-hub-wallet-v1']).coins).toBe(321);
    expect(JSON.parse(localStorage.getItem('game-hub-wallet-v1')!).coins).toBe(321);
    expect(downloaded).not.toBeNull();
    expect(JSON.parse(await downloaded!.text())).toEqual(imports[0]);
    hook.unmount();
  });

  it('does not import when the guest backup cannot be downloaded', async () => {
    localStorage.setItem('game-hub-wallet-v1', JSON.stringify({ coins: 321 }));
    const imports = mockHouseholdRequests();
    URL.createObjectURL = () => {
      throw new Error('Downloads unavailable');
    };

    const hook = renderHook(() => useHousehold(), { wrapper: HouseholdProvider });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await act(async () => hook.result.current.login(memberId, '1234'));
    await expect(act(async () => hook.result.current.importLocalSave())).rejects.toThrow('Downloads unavailable');
    expect(imports).toHaveLength(0);
    hook.unmount();
  });
});
