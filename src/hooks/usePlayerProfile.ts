import { useSyncExternalStore } from 'react';
import {
  getPlayerProfile,
  type PlayerProfile,
  subscribePlayerProfile,
} from '@/lib/playerProfile';

function getServerSnapshot(): PlayerProfile {
  return getPlayerProfile();
}

/**
 * 与 localStorage 中的玩家档案同步；保存档案后同页即时更新，其它标签页通过 storage 事件同步。
 */
export function usePlayerProfile(): PlayerProfile {
  return useSyncExternalStore(
    subscribePlayerProfile,
    getPlayerProfile,
    getServerSnapshot,
  );
}
