import type {
  OfflineReceipt,
  ResumeSaveRecord,
} from '../../../shared/contracts/sync';

const DB_NAME = 'game-hub-offline-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

// 内存后备存储，供无法使用 IndexedDB 的环境（如部分测试环境）
const memoryReceipts = new Map<string, OfflineReceipt>();
const memorySaves = new Map<string, ResumeSaveRecord>();

function getIndexedDB(): IDBFactory | null {
  try {
    return typeof globalThis.indexedDB !== 'undefined'
      ? globalThis.indexedDB
      : null;
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'eventId' });
        store.createIndex('memberId', 'memberId', { unique: false });
        store.createIndex('occurredAt', 'occurredAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('saves')) {
        const store = db.createObjectStore('saves', { keyPath: 'saveId' });
        store.createIndex('memberId', 'memberId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function enqueueReceipt(receipt: OfflineReceipt): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('receipts', 'readwrite');
      tx.objectStore('receipts').put(receipt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryReceipts.set(receipt.eventId, receipt);
  }
}

export async function getPendingReceipts(
  memberId: string,
): Promise<OfflineReceipt[]> {
  try {
    const db = await openDb();
    return await new Promise<OfflineReceipt[]>((resolve, reject) => {
      const tx = db.transaction('receipts', 'readonly');
      const store = tx.objectStore('receipts');
      const index = store.index('memberId');
      const req = index.getAll(IDBKeyRange.only(memberId));
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memoryReceipts.values()).filter(
      (r) => r.memberId === memberId,
    );
  }
}

export async function getPendingReceiptCount(
  memberId: string,
): Promise<number> {
  try {
    const receipts = await getPendingReceipts(memberId);
    return receipts.length;
  } catch {
    return 0;
  }
}

export async function removeReceipts(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('receipts', 'readwrite');
      const store = tx.objectStore('receipts');
      for (const id of eventIds) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    for (const id of eventIds) {
      memoryReceipts.delete(id);
    }
  }
}

export async function clearReceiptsForMember(memberId: string): Promise<void> {
  const receipts = await getPendingReceipts(memberId);
  await removeReceipts(receipts.map((r) => r.eventId));
}

export async function saveLocalResume(record: ResumeSaveRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memorySaves.set(record.saveId, record);
  }
}

export async function getLocalResume(
  saveId: string,
): Promise<ResumeSaveRecord | null> {
  try {
    const db = await openDb();
    return await new Promise<ResumeSaveRecord | null>((resolve, reject) => {
      const tx = db.transaction('saves', 'readonly');
      const req = tx.objectStore('saves').get(saveId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memorySaves.get(saveId) ?? null;
  }
}

export async function listLocalResumes(
  memberId: string,
): Promise<ResumeSaveRecord[]> {
  try {
    const db = await openDb();
    return await new Promise<ResumeSaveRecord[]>((resolve, reject) => {
      const tx = db.transaction('saves', 'readonly');
      const store = tx.objectStore('saves');
      const index = store.index('memberId');
      const req = index.getAll(IDBKeyRange.only(memberId));
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memorySaves.values()).filter(
      (s) => s.memberId === memberId,
    );
  }
}

export async function deleteLocalResume(saveId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').delete(saveId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memorySaves.delete(saveId);
  }
}
