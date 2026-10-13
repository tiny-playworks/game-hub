import type { MemberSnapshot } from '../../shared/contracts/member';
import { createStorageFromSnapshot } from '@/lib/household/snapshotStorage';
import { getStorageDriver, setStorageDriver } from '@/lib/storage';
import { parseLegacyImport } from './snapshot';

/** Run synchronous shared rules against one member without exposing a browser storage driver. */
export function runSnapshotMutation<T>(
  snapshot: MemberSnapshot,
  action: () => T,
): { snapshot: MemberSnapshot; result: T } {
  const previous = getStorageDriver();
  const storage = createStorageFromSnapshot(snapshot);
  setStorageDriver(storage);
  try {
    const result = action();
    const parsed = parseLegacyImport(
      {
        app: 'game-hub',
        schema: 1,
        exportedAt: new Date().toISOString(),
        data: Object.fromEntries(storage.toMap()),
      },
      snapshot.memberId,
      snapshot.profile.nickname,
    );
    return {
      result,
      snapshot: {
        ...parsed,
        revision: snapshot.revision,
        updatedAt: snapshot.updatedAt,
      },
    };
  } finally {
    setStorageDriver(previous);
  }
}
