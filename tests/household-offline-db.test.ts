import { beforeEach, describe, expect, it } from 'rstack/test';
import {
  clearReceiptsForMember,
  deleteLocalResume,
  enqueueReceipt,
  getLocalResume,
  getPendingReceiptCount,
  getPendingReceipts,
  listLocalResumes,
  removeReceipts,
  saveLocalResume,
} from '../src/lib/household/offlineDb';
import type { OfflineReceipt, ResumeSaveRecord } from '../shared/contracts/sync';

describe('P11 Client OfflineDb (IndexedDB / Memory fallback)', () => {
  beforeEach(async () => {
    await clearReceiptsForMember('mem-1');
    await clearReceiptsForMember('mem-2');
  });

  it('enqueues and retrieves receipts isolated by memberId', async () => {
    const receipt1: OfflineReceipt = {
      schema: 1,
      eventId: 'evt-1',
      memberId: 'mem-1',
      deviceId: 'dev-1',
      matchId: 'match-1',
      matchSource: 'arcade',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'arcade',
        arcade: { gameId: 'snake', difficulty: 'normal', score: 100, outcome: 'win' },
      },
    };

    const receipt2: OfflineReceipt = {
      schema: 1,
      eventId: 'evt-2',
      memberId: 'mem-2',
      deviceId: 'dev-2',
      matchId: 'match-2',
      matchSource: 'arcade',
      occurredAt: new Date().toISOString(),
      payload: {
        source: 'arcade',
        arcade: { gameId: '2048', difficulty: 'normal', score: 500, outcome: 'win' },
      },
    };

    await enqueueReceipt(receipt1);
    await enqueueReceipt(receipt2);

    expect(await getPendingReceiptCount('mem-1')).toBe(1);
    expect(await getPendingReceiptCount('mem-2')).toBe(1);

    const mem1Receipts = await getPendingReceipts('mem-1');
    expect(mem1Receipts).toHaveLength(1);
    expect(mem1Receipts[0].eventId).toBe('evt-1');

    await removeReceipts(['evt-1']);
    expect(await getPendingReceiptCount('mem-1')).toBe(0);
    expect(await getPendingReceiptCount('mem-2')).toBe(1);
  });

  it('manages local resume records properly', async () => {
    const resumeRecord: ResumeSaveRecord = {
      schema: 1,
      memberId: 'mem-1',
      deviceId: 'dev-1',
      saveId: 'save-local-1',
      source: 'free',
      updatedAt: new Date().toISOString(),
      replay: {
        version: 1,
        seed: 42,
        rules: {} as any,
        matchLength: 'east',
        seatCharacters: [null, 'mio', 'rin', 'sora'],
        seatAiLevels: ['standard', 'standard', 'standard', 'standard'],
        events: [],
      },
      processedProgress: [],
    };

    await saveLocalResume(resumeRecord);
    const retrieved = await getLocalResume('save-local-1');
    expect(retrieved?.saveId).toBe('save-local-1');
    expect(retrieved?.memberId).toBe('mem-1');

    const list = await listLocalResumes('mem-1');
    expect(list).toHaveLength(1);

    await deleteLocalResume('save-local-1');
    expect(await getLocalResume('save-local-1')).toBeNull();
  });
});
