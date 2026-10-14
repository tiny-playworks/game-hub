import type { MemberSnapshot } from '../../../shared/contracts/member';
import type {
  ArcadeOfflinePayload,
  OfflineReceipt,
  RiichiOfflinePayload,
  SyncBatchResponse,
} from '../../../shared/contracts/sync';
import { createUuid } from '@/lib/uuid';
import { syncBatchReceipts } from './api';
import {
  enqueueReceipt,
  getPendingReceiptCount,
  getPendingReceipts,
  removeReceipts,
} from './offlineDb';

export type SyncStateKind = 'idle' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncState {
  kind: SyncStateKind;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

let currentState: SyncState = {
  kind: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set<(state: SyncState) => void>();

function updateState(patch: Partial<SyncState>): void {
  currentState = { ...currentState, ...patch };
  for (const listener of listeners) {
    try {
      listener(currentState);
    } catch {
      // ignore listener error
    }
  }
}

export function getSyncState(): SyncState {
  return currentState;
}

export function subscribeSyncState(
  listener: (state: SyncState) => void,
): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshPendingCount(memberId: string): Promise<number> {
  const count = await getPendingReceiptCount(memberId);
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  updateState({
    pendingCount: count,
    kind: isOffline ? 'offline' : count > 0 ? 'pending' : 'idle',
  });
  return count;
}

export async function queueOfflineRiichi(
  memberId: string,
  deviceId: string,
  matchId: string,
  riichi: RiichiOfflinePayload,
): Promise<OfflineReceipt> {
  const receipt: OfflineReceipt = {
    schema: 1,
    eventId: createUuid(),
    memberId,
    deviceId,
    matchId,
    matchSource: 'free',
    occurredAt: new Date().toISOString(),
    payload: { source: 'free', riichi },
  };

  await enqueueReceipt(receipt);
  await refreshPendingCount(memberId);
  return receipt;
}

export async function queueOfflineArcade(
  memberId: string,
  deviceId: string,
  roundId: string,
  arcade: ArcadeOfflinePayload,
): Promise<OfflineReceipt> {
  const receipt: OfflineReceipt = {
    schema: 1,
    eventId: createUuid(),
    memberId,
    deviceId,
    matchId: roundId,
    matchSource: 'arcade',
    occurredAt: new Date().toISOString(),
    payload: { source: 'arcade', arcade },
  };

  await enqueueReceipt(receipt);
  await refreshPendingCount(memberId);
  return receipt;
}

export async function performSync(
  memberId: string,
  baseRevision: number,
  onSnapshotUpdated?: (snapshot: MemberSnapshot) => void,
): Promise<SyncBatchResponse | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateState({ kind: 'offline' });
    return null;
  }

  const receipts = await getPendingReceipts(memberId);
  if (receipts.length === 0) {
    updateState({ kind: 'idle', pendingCount: 0 });
    return null;
  }

  updateState({ kind: 'syncing' });

  try {
    const response = await syncBatchReceipts(baseRevision, receipts);

    // 成功受理和重复发送的凭据均已落库，从待办队列移除
    const settledIds = [
      ...response.accepted.map((a) => a.eventId),
      ...response.duplicates,
      // 永久拒绝的项也从主重试队列移除，避免死循环重试
      ...response.rejected.map((r) => r.eventId),
    ];

    await removeReceipts(settledIds);
    const remaining = await getPendingReceiptCount(memberId);

    if (onSnapshotUpdated && response.snapshot) {
      onSnapshotUpdated(response.snapshot);
    }

    updateState({
      kind: remaining > 0 ? 'pending' : 'idle',
      pendingCount: remaining,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SYNC_FAILED';
    const remaining = await getPendingReceiptCount(memberId);
    updateState({
      kind: 'error',
      pendingCount: remaining,
      lastError: message,
    });
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateState({
      kind: currentState.pendingCount > 0 ? 'pending' : 'idle',
      lastError: null,
    });
  });

  window.addEventListener('offline', () => {
    updateState({ kind: 'offline' });
  });
}
