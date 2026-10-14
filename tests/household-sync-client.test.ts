import { beforeEach, describe, expect, it } from 'rstack/test';
import {
  clearReceiptsForMember,
  getPendingReceiptCount,
  getPendingReceipts,
} from '../src/lib/household/offlineDb';
import {
  getSyncState,
  performSync,
  queueOfflineArcade,
  refreshPendingCount,
} from '../src/lib/household/sync';
import type { MemberSnapshot } from '../shared/contracts/member';
import { createEmptySnapshot } from '../server/src/snapshot';

describe('P11 Client Sync State Machine Tests', () => {
  const originalFetch = globalThis.fetch;
  const memberId = 'mem-test-sync';
  const deviceId = 'dev-test-sync';

  beforeEach(async () => {
    globalThis.fetch = originalFetch;
    await clearReceiptsForMember(memberId);
    await refreshPendingCount(memberId);
  });

  it('queues offline arcade and updates sync state to pending', async () => {
    expect(getSyncState().pendingCount).toBe(0);

    await queueOfflineArcade(memberId, deviceId, 'round-1', {
      gameId: 'snake',
      difficulty: 'normal',
      score: 100,
      outcome: 'win',
    });

    const count = await getPendingReceiptCount(memberId);
    expect(count).toBe(1);
    expect(getSyncState().pendingCount).toBe(1);
    expect(getSyncState().kind).toBe('pending');
  });

  it('performs sync batch and drains pending receipts on server success', async () => {
    await queueOfflineArcade(memberId, deviceId, 'round-2', {
      gameId: '2048',
      difficulty: 'normal',
      score: 512,
      outcome: 'win',
    });

    const mockSnapshot = createEmptySnapshot(memberId, 'Synced Member');
    mockSnapshot.revision = 2;

    const pendingBefore = await getPendingReceipts(memberId);
    const queuedEventId = pendingBefore[0].eventId;

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          accepted: [
            {
              eventId: queuedEventId,
              matchId: 'round-2',
              source: 'arcade',
              coinsEarned: 20,
              pointsEarned: 0,
            },
          ],
          duplicates: [],
          rejected: [],
          snapshot: mockSnapshot,
        }),
        { status: 200 },
      );

    let updatedSnapshot: MemberSnapshot | null = null;
    const response = await performSync(memberId, 1, (s) => {
      updatedSnapshot = s;
    });

    expect(response).not.toBeNull();
    expect(response?.accepted).toHaveLength(1);
    expect((updatedSnapshot as MemberSnapshot | null)?.revision).toBe(2);

    const remaining = await getPendingReceiptCount(memberId);
    expect(remaining).toBe(0);
    expect(getSyncState().pendingCount).toBe(0);
    expect(getSyncState().kind).toBe('idle');
  });

  it('transitions to error state on network or server 500 failure without clearing queue', async () => {
    await queueOfflineArcade(memberId, deviceId, 'round-3', {
      gameId: 'tetris',
      difficulty: 'hard',
      score: 1200,
      outcome: 'win',
    });

    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    const response = await performSync(memberId, 1);
    expect(response).toBeNull();

    // 凭据仍留在离线队列中等待重试
    const remaining = await getPendingReceiptCount(memberId);
    expect(remaining).toBe(1);
    expect(getSyncState().kind).toBe('error');
    expect(getSyncState().pendingCount).toBe(1);
  });
});
