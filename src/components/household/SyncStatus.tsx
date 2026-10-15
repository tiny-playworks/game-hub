import React, { useEffect, useState } from 'react';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  getSyncState,
  performSync,
  refreshPendingCount,
  subscribeSyncState,
  type SyncState,
} from '@/lib/household/sync';

export const SyncStatus: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentMember, mode, snapshot, applySnapshot } = useHousehold();
  const { locale } = useLocale();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());

  useEffect(() => {
    return subscribeSyncState(setSyncState);
  }, []);

  useEffect(() => {
    if (currentMember) {
      void refreshPendingCount(currentMember.id);
    }
  }, [currentMember]);

  // 仅在成员模式下显示同步状态
  if (mode === 'guest-local' || !currentMember) {
    return null;
  }

  const handleManualSync = () => {
    if (snapshot && syncState.kind !== 'syncing') {
      void performSync(
        currentMember.id,
        snapshot.revision,
        applySnapshot,
      );
    }
  };

  const isZh = locale === 'zh';

  if (syncState.kind === 'offline') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 ${className}`}
        title={isZh ? '网络未连接，本地游玩进度将离线缓存' : 'Offline mode, gameplay is cached locally'}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span>{isZh ? '离线模式' : 'Offline'}</span>
        {syncState.pendingCount > 0 && (
          <span className="font-mono font-medium">({syncState.pendingCount})</span>
        )}
      </div>
    );
  }

  if (syncState.kind === 'syncing') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        <span>{isZh ? '同步中...' : 'Syncing...'}</span>
      </div>
    );
  }

  if (syncState.pendingCount > 0 || syncState.kind === 'error') {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer ${
          syncState.kind === 'error'
            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20'
        } ${className}`}
        title={
          isZh
            ? syncState.kind === 'error'
              ? `同步遇到错误: ${syncState.lastError}，点击重试`
              : `有 ${syncState.pendingCount} 笔离线记录待同步，点击同步`
            : 'Click to sync pending records'
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            syncState.kind === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
          }`}
        />
        <span>
          {syncState.kind === 'error'
            ? isZh
              ? '同步失败'
              : 'Sync Failed'
            : isZh
              ? `待同步 (${syncState.pendingCount})`
              : `Pending (${syncState.pendingCount})`}
        </span>
      </button>
    );
  }

  return null;
};
