import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ArcadeMemberEvent,
  ArcadeMemberResult,
  HouseholdMode,
  MemberSnapshot,
  MemberSummary,
  ProgressAction,
  ProgressActionResult,
} from '../../shared/contracts/member';
import type { JourneyAttemptInput, JourneyEvaluation } from '../../shared/contracts/journey';
import {
  checkServerHealth,
  equipMemberCosmetic,
  fetchCurrentRiichiMatch,
  fetchCurrentMe,
  HouseholdApiError,
  importLegacySave,
  listMembers,
  loginSession,
  logoutSession,
  performMemberProgressAction,
  purchaseCosmeticItem,
  forfeitMemberRiichiMatch,
  startMemberRiichiMatch,
  submitMemberArcadeEvent,
  submitMemberJourneyAttempt,
  submitMemberRiichiEvent,
  updatePreferences as apiUpdatePreferences,
  updateProfile as apiUpdateProfile,
  updateMemberCharacter,
} from '@/lib/household/api';
import { setRiichiOnlineBridge } from '@/lib/household/riichiBridge';
import {
  createStorageFromSnapshot,
  notifyStorageStateChanged,
} from '@/lib/household/snapshotStorage';
import {
  createGuestSaveFile,
  downloadSaveFile,
  parseSaveFile,
} from '@/lib/saveTransfer';
import { setMemberProfileWriter, type PlayerProfilePatch } from '@/lib/playerProfile';
import { setStorageDriver } from '@/lib/storage';
import { createUuid } from '@/lib/uuid';
import { useGameStore } from '@/store/gameStore';
import { useRiichiStore } from '@/pages/mahjong/japanese/store/riichiMatchStore';

const DEVICE_ID_KEY = 'game-hub-device-id';
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrCreateDeviceId(): string {
  let existing: string | null = null;
  try {
    existing = globalThis.localStorage?.getItem(DEVICE_ID_KEY) ?? null;
  } catch {
    // Storage may be disabled while the browser still supports session cookies.
  }
  if (existing && DEVICE_ID_PATTERN.test(existing)) return existing;
  const generated = createUuid();
  try {
    globalThis.localStorage?.setItem(DEVICE_ID_KEY, generated);
  } catch {
    // Keep this device's generated ID for the current page session.
  }
  return generated;
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
  clearError: () => void;
  login: (memberId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  switchToGuest: () => void;
  refreshMe: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  purchaseCosmetic: (
    itemId: string,
  ) => Promise<{ snapshot: MemberSnapshot; itemId: string }>;
  equipCosmetic: (itemId: string) => Promise<void>;
  performProgressAction: (action: ProgressAction) => Promise<ProgressActionResult>;
  performArcadeEvent: (event: ArcadeMemberEvent) => Promise<ArcadeMemberResult>;
  submitJourneyAttempt: (input: JourneyAttemptInput) =>
    Promise<{ snapshot: MemberSnapshot; evaluation: JourneyEvaluation }>;
  selectCharacter: (characterId: string) => Promise<void>;
  selectAoiOutfit: (outfit: string) => Promise<void>;
  updateArcadeDifficulty: (
    gameId: string,
    difficulty: 'easy' | 'normal' | 'hard',
  ) => Promise<void>;
  updatePreferences: (
    changes: Partial<MemberSnapshot['preferences']>,
  ) => Promise<void>;
  updateProfile: (changes: Record<string, unknown>) => Promise<void>;
  importLocalSave: () => Promise<{ snapshot: MemberSnapshot }>;
  applySnapshot: (snapshot: MemberSnapshot) => void;
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
  const snapshotRef = useRef<MemberSnapshot | null>(null);
  const profileWriterRef = useRef<((patch: PlayerProfilePatch) => Promise<void>) | null>(null);
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const [error, setError] = useState<HouseholdApiError | Error | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const applySnapshot = useCallback((next: MemberSnapshot | null) => {
    if (
      next &&
      snapshotRef.current?.memberId === next.memberId &&
      snapshotRef.current.revision > next.revision
    ) return;
    const identityChanged = snapshotRef.current?.memberId !== next?.memberId;
    if (next) {
      const storage = createStorageFromSnapshot(next);
      setStorageDriver(storage);
      setMemberProfileWriter((patch) => {
        const writer = profileWriterRef.current;
        if (!writer) return Promise.reject(new Error('Member profile writer unavailable'));
        return writer(patch);
      });
      useGameStore.setState({ stats: next.arcade.stats, receipts: next.arcade.receipts });
    } else {
      setStorageDriver(null);
      setMemberProfileWriter(null);
      void useGameStore.persist.rehydrate();
    }
    if (identityChanged) useRiichiStore.getState().resetForIdentity();
    snapshotRef.current = next;
    setSnapshot(next);
    if (next) {
      const summary: MemberSummary = {
        id: next.memberId,
        nickname: next.profile.nickname,
        avatarPresetId: next.profile.avatarPresetId,
        avatarUploadDataUrl: next.profile.avatarUploadDataUrl,
      };
      setCurrentMember((previous) =>
        previous?.id === next.memberId ? summary : previous);
      setMembers((previous) => previous.map((member) =>
        member.id === next.memberId ? summary : member));
    }
    notifyStorageStateChanged();
    if (next && identityChanged) {
      queueMicrotask(() => void useRiichiStore.getState().refreshOnlineMatch());
    }
  }, []);

  const enqueueMutation = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.current.then(work, work);
    mutationQueue.current = result.then(() => {}, () => {});
    return result;
  }, []);

  const handleMutationFailure = useCallback((err: unknown, owner: string) => {
    if (snapshotRef.current?.memberId !== owner) return;
    if (err instanceof HouseholdApiError && err.status === 401) {
      applySnapshot(null);
      setMode('guest-local');
      setCurrentMember(null);
    }
    setError(err instanceof Error ? err : new Error(String(err)));
  }, [applySnapshot]);

  const reviseSnapshot = useCallback(<T extends { snapshot: MemberSnapshot }>(
    operation: (revision: number) => Promise<T>,
  ): Promise<T> => {
    const owner = snapshotRef.current?.memberId;
    if (!owner) return Promise.reject(new Error('Not logged in'));
    return enqueueMutation(async () => {
      try {
        const current = snapshotRef.current;
        if (!current || current.memberId !== owner)
          throw new Error('Member changed before the update');
        let result;
        try {
          result = await operation(current.revision);
        } catch (err) {
          if (!(err instanceof HouseholdApiError && err.status === 409)) throw err;
          const { snapshot: latest } = await fetchCurrentMe();
          if (latest.memberId !== owner)
            throw Object.assign(new Error('Member changed before the update'), { cause: err });
          applySnapshot(latest);
          result = await operation(latest.revision);
        }
        if (snapshotRef.current?.memberId === owner) applySnapshot(result.snapshot);
        setError(null);
        return result;
      } catch (err) {
        handleMutationFailure(err, owner);
        throw err;
      }
    });
  }, [applySnapshot, enqueueMutation, handleMutationFailure]);

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
        const hadMember = snapshotRef.current !== null;
        applySnapshot(null);
        setMode('guest-local');
        setCurrentMember(null);
        if (hadMember) setError(err);
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [applySnapshot]);

  const login = useCallback(
    async (memberId: string, pin: string) => {
      setError(null);
      await loginSession(memberId, pin, deviceId);
      // The cookie now belongs to the new login. Never keep the previous member's snapshot
      // visible if fetching the new snapshot fails.
      if (snapshotRef.current?.memberId !== memberId) {
        applySnapshot(null);
        setMode('guest-local');
        setCurrentMember(null);
      }
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
      const owner = snapshotRef.current?.memberId;
      if (!owner) throw new Error('Not logged in');
      return enqueueMutation(async () => {
        try {
          if (snapshotRef.current?.memberId !== owner)
            throw new Error('Member changed before the purchase');
          const result = await purchaseCosmeticItem(itemId);
          if (snapshotRef.current?.memberId === owner) applySnapshot(result.snapshot);
          setError(null);
          return result;
        } catch (err) {
          handleMutationFailure(err, owner);
          throw err;
        }
      });
    },
    [applySnapshot, enqueueMutation, handleMutationFailure],
  );

  const equipCosmetic = useCallback(async (itemId: string) => {
    await reviseSnapshot((revision) => equipMemberCosmetic(revision, itemId));
  }, [reviseSnapshot]);

  const performProgressAction = useCallback(async (action: ProgressAction) => {
    const response = await reviseSnapshot((revision) =>
      performMemberProgressAction(revision, action));
    return response.result;
  }, [reviseSnapshot]);

  const performArcadeEvent = useCallback(async (event: ArcadeMemberEvent) => {
    const response = await reviseSnapshot((revision) =>
      submitMemberArcadeEvent(revision, event));
    return response.result;
  }, [reviseSnapshot]);

  const submitJourneyAttempt = useCallback((input: JourneyAttemptInput) => {
    const owner = snapshotRef.current?.memberId;
    if (!owner) return Promise.reject(new Error('Not logged in'));
    return reviseSnapshot(async (revision) => {
      if (snapshotRef.current?.memberId !== owner)
        throw new Error('Member changed before the update');
      const response = await submitMemberJourneyAttempt(revision, input);
      if (response.snapshot.memberId !== owner || snapshotRef.current?.memberId !== owner)
        throw new Error('Member changed before the update');
      return response;
    });
  }, [reviseSnapshot]);

  const selectCharacter = useCallback(async (characterId: string) => {
    await reviseSnapshot((revision) =>
      updateMemberCharacter(revision, { activeCharacterId: characterId }));
  }, [reviseSnapshot]);

  const selectAoiOutfit = useCallback(async (outfit: string) => {
    await reviseSnapshot((revision) =>
      updateMemberCharacter(revision, { aoiOutfit: outfit }));
  }, [reviseSnapshot]);

  const updateArcadeDifficulty = useCallback(async (
    gameId: string,
    difficulty: 'easy' | 'normal' | 'hard',
  ) => {
    await reviseSnapshot((revision) => {
      const prefs = snapshotRef.current?.preferences.arcadePrefs ?? {};
      const stored = prefs.difficulties;
      const difficulties = stored && typeof stored === 'object' && !Array.isArray(stored)
        ? stored as Record<string, unknown> : {};
      return apiUpdatePreferences(revision, {
        arcadePrefs: {
          ...prefs,
          difficulties: { ...difficulties, [gameId]: difficulty },
        },
      });
    });
  }, [reviseSnapshot]);

  const updatePreferences = useCallback(
    async (changes: Partial<MemberSnapshot['preferences']>) => {
      await reviseSnapshot((revision) => apiUpdatePreferences(revision, changes));
    },
    [reviseSnapshot],
  );

  const updateProfile = useCallback(
    async (changes: Record<string, unknown>) => {
      await reviseSnapshot((revision) => apiUpdateProfile(revision, changes));
    },
    [reviseSnapshot],
  );

  profileWriterRef.current = (patch) => updateProfile({ ...patch });
  useEffect(() => () => setMemberProfileWriter(null), []);

  useEffect(() => {
    const mutate = <T extends { snapshot: MemberSnapshot }>(
      operation: () => Promise<T>,
    ): Promise<T> => {
      const owner = snapshotRef.current?.memberId;
      if (!owner) return Promise.reject(new Error('Not logged in'));
      return enqueueMutation(async () => {
        if (snapshotRef.current?.memberId !== owner)
          throw new Error('Member changed before the update');
        try {
          const response = await operation();
          if (snapshotRef.current?.memberId === owner)
            applySnapshot(response.snapshot);
          setError(null);
          return response;
        } catch (err) {
          handleMutationFailure(err, owner);
          throw err;
        }
      });
    };
    setRiichiOnlineBridge({
      start: (input) => mutate(() => startMemberRiichiMatch(input)),
      event: (input) => mutate(() => submitMemberRiichiEvent(input)),
      forfeit: (matchId) => mutate(() => forfeitMemberRiichiMatch(matchId)),
      current: async () => {
        const owner = snapshotRef.current?.memberId;
        if (!owner) throw new Error('Not logged in');
        try {
          const response = await fetchCurrentRiichiMatch();
          if (snapshotRef.current?.memberId !== owner)
            throw new Error('Member changed before the update');
          return response;
        } catch (err) {
          handleMutationFailure(err, owner);
          throw err;
        }
      },
    });
    return () => setRiichiOnlineBridge(null);
  }, [applySnapshot, enqueueMutation, handleMutationFailure]);

  const importLocalSave = useCallback(async () => {
    if (!snapshot) throw new Error('Not logged in');
    const save = parseSaveFile(JSON.stringify(createGuestSaveFile()));
    if (Object.keys(save.data).length === 0)
      throw new Error('No guest save is available to migrate');
    // Download exactly the guest data that will be imported. Abort on failure.
    downloadSaveFile(save);
    try {
      const result = await importLegacySave(save);
      applySnapshot(result.snapshot);
      setError(null);
      return result;
    } catch (err) {
      handleMutationFailure(err, snapshot.memberId);
      throw err;
    }
  }, [snapshot, applySnapshot, handleMutationFailure]);

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
      clearError,
      login,
      logout,
      switchToGuest,
      refreshMe,
      refreshMembers,
      purchaseCosmetic,
      equipCosmetic,
      performProgressAction,
      performArcadeEvent,
      submitJourneyAttempt,
      selectCharacter,
      selectAoiOutfit,
      updateArcadeDifficulty,
      updatePreferences,
      updateProfile,
      importLocalSave,
      applySnapshot,
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
      clearError,
      login,
      logout,
      switchToGuest,
      refreshMe,
      refreshMembers,
      purchaseCosmetic,
      equipCosmetic,
      performProgressAction,
      performArcadeEvent,
      submitJourneyAttempt,
      selectCharacter,
      selectAoiOutfit,
      updateArcadeDifficulty,
      updatePreferences,
      updateProfile,
      importLocalSave,
      applySnapshot,
    ],
  );

  return (
    <HouseholdContext.Provider value={value}>
      <Fragment key={`${mode}:${currentMember?.id ?? ''}`}>{children}</Fragment>
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

export function useOptionalHousehold(): HouseholdContextValue | null {
  return useContext(HouseholdContext);
}
