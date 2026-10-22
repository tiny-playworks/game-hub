import { LOCAL_RESUME_PREFIX } from './localResume';

/** 普通进度允许会话内暂存；购买/导入等必须使用 commitStorageChanges。 */
export interface StorageStatus {
  pendingCount: number;
  readFailed: boolean;
  failed: boolean;
  conflicted: boolean;
}

const cached = new Map<string, string>();
const pending = new Map<string, string | null>();
const readable = new Set<string>();
const listeners = new Set<() => void>();
let status: StorageStatus = {
  pendingCount: 0,
  readFailed: false,
  failed: false,
  conflicted: false,
};
let notificationQueued = false;

function updateStatus(
  failed = status.failed,
  readFailed = status.readFailed,
  conflicted = status.conflicted,
) {
  if (
    status.failed === failed &&
    status.readFailed === readFailed &&
    status.pendingCount === pending.size &&
    status.conflicted === conflicted
  )
    return;
  status = { failed, readFailed, pendingCount: pending.size, conflicted };
  if (notificationQueued) return;
  notificationQueued = true;
  queueMicrotask(() => {
    notificationQueued = false;
    for (const listener of listeners) listener();
  });
}

let activeDriver: Storage | null = null;

export function setStorageDriver(driver: Storage | null): void {
  activeDriver = driver;
  cached.clear();
  pending.clear();
  readable.clear();
  updateStatus(false, false, false);
}

export function getStorageDriver(): Storage | null {
  return activeDriver;
}

function persistent(): Storage {
  if (activeDriver) return activeDriver;
  const storage = globalThis.localStorage;
  if (!storage) throw new Error('Browser storage is unavailable');
  return storage;
}

function remember(key: string, value: string | null) {
  if (value === null) cached.delete(key);
  else cached.set(key, value);
}

function keys(): string[] {
  try {
    const storage = persistent();
    const current = new Set<string>();
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key !== null) current.add(key);
    }
    for (const key of cached.keys()) if (!current.has(key)) cached.delete(key);
    for (const key of pending.keys()) current.add(key);
    return [...current].filter(
      (key) => !pending.has(key) || pending.get(key) !== null,
    );
  } catch {
    updateStatus(true, true);
    return [...new Set([...cached.keys(), ...pending.keys()])].filter(
      (key) => !pending.has(key) || pending.get(key) !== null,
    );
  }
}

export const gameStorage: Storage = {
  get length() {
    return keys().length;
  },
  key: (index) => keys()[index] ?? null,
  getItem(key) {
    if (pending.has(key)) return pending.get(key) ?? null;
    try {
      const value = persistent().getItem(key);
      readable.add(key);
      remember(key, value);
      return value;
    } catch {
      updateStatus(true, true);
      return cached.get(key) ?? null;
    }
  },
  setItem(key, value) {
    pending.set(key, String(value));
    if (status.readFailed || status.conflicted) {
      updateStatus(true);
      return;
    }
    try {
      persistent().setItem(key, String(value));
      remember(key, String(value));
      readable.add(key);
      pending.delete(key);
      updateStatus(pending.size > 0 || status.readFailed);
    } catch {
      updateStatus(true);
    }
  },
  removeItem(key) {
    pending.set(key, null);
    if (status.readFailed || status.conflicted) {
      updateStatus(true);
      return;
    }
    try {
      persistent().removeItem(key);
      remember(key, null);
      pending.delete(key);
      updateStatus(pending.size > 0 || status.readFailed);
    } catch {
      updateStatus(true);
    }
  },
  clear() {
    for (const key of keys()) {
      if (key.startsWith('game-hub-') && !key.startsWith(LOCAL_RESUME_PREFIX)) gameStorage.removeItem(key);
    }
  },
};

export const getStorageStatus = (): StorageStatus => status;
export function subscribeStorageStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 导出包括本页未写成功的最新内容；读取受限时调用方必须标明备份不完整。 */
export function readGameSaveData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of keys()) {
    if (!key.startsWith('game-hub-') || key.startsWith(LOCAL_RESUME_PREFIX)) continue;
    const value = gameStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

/** 恢复读取能力并按原意重试；任一失败仍保留剩余待写内容。 */
export function retryPendingStorage(): boolean {
  try {
    const storage = persistent();
    // 空队列也探测写权限，防止把“能读取”误判为“能保存”。
    const probe = '__game_hub_storage_probe__';
    const previous = storage.getItem(probe);
    storage.setItem(probe, '1');
    if (previous === null) storage.removeItem(probe);
    else storage.setItem(probe, previous);
    // 未读出的旧记录不能被从默认值开始的新进度自动覆盖。
    for (const key of pending.keys()) {
      if (!readable.has(key) && storage.getItem(key) !== null) {
        updateStatus(true, false, true);
        return false;
      }
    }
    for (const [key, value] of pending) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
      remember(key, value);
      readable.add(key);
      pending.delete(key);
    }
    updateStatus(false, false, false);
    return true;
  } catch {
    updateStatus(true);
    return false;
  }
}

/** 严格事务：失败不提交内存购买；回滚失败的原值进入待写队列等待恢复。 */
export function commitStorageChanges(
  changes: Record<string, string | null>,
): void {
  if (pending.size > 0 || status.readFailed || status.conflicted) {
    throw new Error('Retry pending storage before this operation');
  }
  const previous = new Map<string, string | null>();
  let storage: Storage;
  try {
    storage = persistent();
    for (const key of Object.keys(changes))
      previous.set(key, storage.getItem(key));
  } catch (error) {
    updateStatus(true, true);
    throw error;
  }
  try {
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
  } catch (error) {
    for (const [key, value] of previous) {
      remember(key, value);
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        pending.set(key, value);
      }
    }
    updateStatus(true);
    throw error;
  }
  for (const [key, value] of Object.entries(changes)) {
    remember(key, value);
    readable.add(key);
  }
  updateStatus(false, false, false);
}
