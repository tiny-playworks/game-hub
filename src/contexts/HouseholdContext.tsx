import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  HouseholdMode,
  MemberSnapshot,
  MemberSummary,
} from '../../shared/contracts/member';
import {
  checkServerHealth,
  fetchCurrentMe,
  HouseholdApiError,
  importLegacySave,
  listMembers,
  loginSession,
  logoutSession,
  purchaseCosmeticItem,
  updatePreferences as apiUpdatePreferences,
  updateProfile as apiUpdateProfile,
} from '@/lib/household/api';
import {
  createStorageFromSnapshot,
  notifyStorageStateChanged,
} from '@/lib/household/snapshotStorage';
import { createSaveFile, downloadSaveFile } from '@/lib/saveTransfer';
import { setStorageDriver } from '@/lib/storage';

const DEVICE_ID_KEY = 'game-hub-device-id';

function getOrCreateDeviceId(): string {
  try {
    const existing = globalThis.localStorage?.getItem(DEVICE_ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const generated =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    globalThis.localStorage?.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

export interface HouseholdContextValue {
  mode: HouseholdMode;
  isServerAvailable: boolean;
  isLoading: boolean;
  deviceId: string;
  members: MemberSummary[];
  currentMember: MemberSummary | null;
  snapshot: MemberSnapshot | null;
  error: HouseholdApiError | Error | null;
  login: (memberId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  switchToGuest: () => void;
  refreshMe: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  purchaseCosmetic: (
    itemId: string,
  ) => Promise<{ snapshot: MemberSnapshot; itemId: string }>;
  updatePreferences: (
    changes: Partial<MemberSnapshot['preferences']>,
  ) => Promise<void>;
  updateProfile: (changes: Record<string, unknown>) => Promise<void>;
  importLocalSave: () => Promise<{ snapshot: MemberSnapshot }>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [deviceId] = useState(getOrCreateDeviceId);
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<HouseholdMode>('guest-local');
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [currentMember, setCurrentMember] = useState<MemberSummary | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<MemberSnapshot | null>(null);
  const [error, setError] = useState<HouseholdApiError | Error | null>(null);

  const applySnapshot = useCallback((next: MemberSnapshot | null) => {
    setSnapshot(next);
    if (next) {
      const storage = createStorageFromSnapshot(next);
      setStorageDriver(storage);
    } else {
      setStorageDriver(null);
    }
    notifyStorageStateChanged();
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      const list = await listMembers();
      setMembers(list);
    } catch {
      // 成员拉取失败不阻断游客模式
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { snapshot: freshSnapshot } = await fetchCurrentMe();
      applySnapshot(freshSnapshot);
      setMode('member-online');
      setCurrentMember((prev: MemberSummary | null) => {
        if (prev && prev.id === freshSnapshot.memberId) {
          return {
            ...prev,
            nickname: freshSnapshot.profile.nickname,
            avatarPresetId: freshSnapshot.profile.avatarPresetId,
            avatarUploadDataUrl: freshSnapshot.profile.avatarUploadDataUrl,
          };
        }
        return {
          id: freshSnapshot.memberId,
          nickname: freshSnapshot.profile.nickname,
          avatarPresetId: freshSnapshot.profile.avatarPresetId,
          avatarUploadDataUrl: freshSnapshot.profile.avatarUploadDataUrl,
        };
      });
      setError(null);
    } catch (err) {
      if (err instanceof HouseholdApiError && err.status === 401) {
        applySnapshot(null);
        setMode('guest-local');
        setCurrentMember(null);
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [applySnapshot]);

  const login = useCallback(
    async (memberId: string, pin: string) => {
      setError(null);
      await loginSession(memberId, pin, deviceId);
      const { snapshot: freshSnapshot } = await fetchCurrentMe();
      applySnapshot(freshSnapshot);
      setMode('member-online');
      const found = members.find((m) => m.id === memberId);
      setCurrentMember(
        found ?? {
          id: freshSnapshot.memberId,
          nickname: freshSnapshot.profile.nickname,
          avatarPresetId: freshSnapshot.profile.avatarPresetId,
          avatarUploadDataUrl: freshSnapshot.profile.avatarUploadDataUrl,
        },
      );
    },
    [deviceId, members, applySnapshot],
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await logoutSession();
    } finally {
      applySnapshot(null);
      setMode('guest-local');
      setCurrentMember(null);
    }
  }, [applySnapshot]);

  const switchToGuest = useCallback(() => {
    applySnapshot(null);
    setMode('guest-local');
    setCurrentMember(null);
    setError(null);
  }, [applySnapshot]);

  const purchaseCosmetic = useCallback(
    async (itemId: string) => {
      const result = await purchaseCosmeticItem(itemId);
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot],
  );

  const updatePreferences = useCallback(
    async (changes: Partial<MemberSnapshot['preferences']>) => {
      if (!snapshot) return;
      const result = await apiUpdatePreferences(snapshot.revision, changes);
      applySnapshot(result.snapshot);
    },
    [snapshot, applySnapshot],
  );

  const updateProfile = useCallback(
    async (changes: Record<string, unknown>) => {
      if (!snapshot) return;
      const result = await apiUpdateProfile(snapshot.revision, changes);
      applySnapshot(result.snapshot);
    },
    [snapshot, applySnapshot],
  );

  const importLocalSave = useCallback(async () => {
    if (!snapshot) throw new Error('Not logged in');
    // 导入前先触发一次本地数据备份下载，确保万无一失
    try {
      downloadSaveFile();
    } catch {
      // 容错处理
    }
    const save = createSaveFile();
    const result = await importLegacySave(save);
    applySnapshot(result.snapshot);
    return result;
  }, [snapshot, applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setIsLoading(true);
      const healthy = await checkServerHealth();
      if (cancelled) return;
      setIsServerAvailable(healthy);
      if (healthy) {
        await Promise.all([refreshMembers(), refreshMe()]);
      } else {
        applySnapshot(null);
      }
      setIsLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [refreshMembers, refreshMe, applySnapshot]);

  const value = useMemo(
    () => ({
      mode,
      isServerAvailable,
      isLoading,
      deviceId,
      members,
      currentMember,
      snapshot,
      error,
      login,
      logout,
      switchToGuest,
      refreshMe,
      refreshMembers,
      purchaseCosmetic,
      updatePreferences,
      updateProfile,
      importLocalSave,
    }),
    [
      mode,
      isServerAvailable,
      isLoading,
      deviceId,
      members,
      currentMember,
      snapshot,
      error,
      login,
      logout,
      switchToGuest,
      refreshMe,
      refreshMembers,
      purchaseCosmetic,
      updatePreferences,
      updateProfile,
      importLocalSave,
    ],
  );

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
