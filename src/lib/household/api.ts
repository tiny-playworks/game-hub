import type { ApiErrorBody } from '../../../shared/contracts/api';
import type { JourneyAttemptInput, JourneyEvaluation } from '../../../shared/contracts/journey';
import type {
  ArcadeMemberEvent,
  ArcadeMemberResult,
  MemberSnapshot,
  MemberSummary,
  ProgressAction,
  ProgressActionResult,
} from '../../../shared/contracts/member';
import type { RiichiEvent } from '@/pages/mahjong/japanese/engine';
import type {
  MemberRiichiCurrent,
  MemberRiichiSession,
  MemberRiichiStart,
} from './riichiBridge';
import type {
  OfflineReceipt,
  ResumeSaveRecord,
  ResumeSaveSummary,
  SyncBatchResponse,
} from '../../../shared/contracts/sync';

export class HouseholdApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly revision?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.code);
    this.name = 'HouseholdApiError';
    this.status = status;
    this.code = body.code;
    this.messageKey = body.messageKey;
    this.retryable = body.retryable;
    this.revision = body.revision;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {
        code: `HTTP_${response.status}`,
        messageKey: `household.error.HTTP_${response.status}`,
        retryable: response.status >= 500,
      };
    }
    throw new HouseholdApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export async function checkServerHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 3000);
  try {
    const data = await request<{ status: string }>('/healthz', { signal: controller.signal });
    return data.status === 'ok';
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function listMembers(): Promise<MemberSummary[]> {
  return request<MemberSummary[]>('/api/v1/members');
}

export async function loginSession(
  memberId: string,
  pin: string,
  deviceId?: string,
): Promise<{ memberId: string; deviceId: string; expiresAt: string }> {
  return request<{ memberId: string; deviceId: string; expiresAt: string }>(
    '/api/v1/session',
    {
      method: 'POST',
      body: JSON.stringify({ memberId, pin, deviceId }),
    },
  );
}

export async function logoutSession(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/v1/session', {
    method: 'DELETE',
  });
}

export async function fetchCurrentMe(): Promise<{
  snapshot: MemberSnapshot;
  deviceId: string;
}> {
  return request<{ snapshot: MemberSnapshot; deviceId: string }>(
    '/api/v1/me',
  );
}

export async function updatePreferences(
  baseRevision: number,
  changes: Partial<MemberSnapshot['preferences']>,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, changes }),
  });
}

export async function updateProfile(
  baseRevision: number,
  changes: Record<string, unknown>,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, changes }),
  });
}

export async function importLegacySave(
  save: unknown,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/import', {
    method: 'POST',
    body: JSON.stringify({ save }),
  });
}

export async function purchaseCosmeticItem(
  itemId: string,
): Promise<{ snapshot: MemberSnapshot; itemId: string }> {
  return request<{ snapshot: MemberSnapshot; itemId: string }>(
    '/api/v1/shop/purchases',
    {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    },
  );
}

export async function equipMemberCosmetic(
  baseRevision: number,
  itemId: string,
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/cosmetics', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, itemId }),
  });
}

export async function performMemberProgressAction(
  baseRevision: number,
  action: ProgressAction,
): Promise<{ snapshot: MemberSnapshot; result: ProgressActionResult }> {
  return request<{ snapshot: MemberSnapshot; result: ProgressActionResult }>(
    '/api/v1/me/progress/actions',
    { method: 'POST', body: JSON.stringify({ baseRevision, action }) },
  );
}

export async function updateMemberCharacter(
  baseRevision: number,
  change: { activeCharacterId: string } | { aoiOutfit: string },
): Promise<{ snapshot: MemberSnapshot }> {
  return request<{ snapshot: MemberSnapshot }>('/api/v1/me/characters', {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision, ...change }),
  });
}

export async function submitMemberArcadeEvent(
  baseRevision: number,
  event: ArcadeMemberEvent,
): Promise<{ snapshot: MemberSnapshot; result: ArcadeMemberResult }> {
  return request<{ snapshot: MemberSnapshot; result: ArcadeMemberResult }>(
    '/api/v1/me/arcade/events',
    { method: 'POST', body: JSON.stringify({ baseRevision, event }) },
  );
}

export async function submitMemberJourneyAttempt(
  baseRevision: number,
  input: JourneyAttemptInput,
): Promise<{ snapshot: MemberSnapshot; evaluation: JourneyEvaluation }> {
  return request<{ snapshot: MemberSnapshot; evaluation: JourneyEvaluation }>(
    '/api/v1/me/journey/attempts',
    { method: 'POST', body: JSON.stringify({ baseRevision, ...input }) },
  );
}

export async function startMemberRiichiMatch(
  input: MemberRiichiStart,
): Promise<MemberRiichiSession> {
  return request<MemberRiichiSession>('/api/v1/me/riichi/matches', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function submitMemberRiichiEvent(input: {
  matchId: string;
  expectedTurn: number;
  event: RiichiEvent;
}): Promise<MemberRiichiSession> {
  return request<MemberRiichiSession>('/api/v1/me/riichi/events', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function fetchCurrentRiichiMatch(): Promise<MemberRiichiCurrent> {
  return request<MemberRiichiCurrent>('/api/v1/me/riichi/current');
}

export async function resumeMemberRiichiMatch(saveId: string): Promise<MemberRiichiSession> {
  return request<MemberRiichiSession>('/api/v1/me/riichi/resume', {
    method: 'POST', body: JSON.stringify({ saveId }),
  });
}

export async function forfeitMemberRiichiMatch(
  matchId: string,
): Promise<MemberRiichiSession> {
  return request<MemberRiichiSession>('/api/v1/me/riichi/forfeit', {
    method: 'POST', body: JSON.stringify({ matchId }),
  });
}

export async function syncBatchReceipts(
  baseRevision: number,
  receipts: OfflineReceipt[],
): Promise<SyncBatchResponse> {
  return request<SyncBatchResponse>('/api/v1/sync', {
    method: 'POST',
    body: JSON.stringify({ baseRevision, receipts }),
  });
}

export async function listResumeSaves(): Promise<ResumeSaveSummary[]> {
  return request<ResumeSaveSummary[]>('/api/v1/saves');
}

export async function getResumeSave(saveId: string): Promise<ResumeSaveRecord> {
  return request<ResumeSaveRecord>(`/api/v1/saves/${encodeURIComponent(saveId)}`);
}

export async function putResumeSave(
  saveId: string,
  data: Partial<ResumeSaveRecord>,
): Promise<{ ok: boolean; saveId: string; updatedAt: string }> {
  return request<{ ok: boolean; saveId: string; updatedAt: string }>(
    `/api/v1/saves/${encodeURIComponent(saveId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  );
}

export async function deleteResumeSave(saveId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/v1/saves/${encodeURIComponent(saveId)}`, {
    method: 'DELETE',
  });
}

export async function listRooms(): Promise<import('../../../shared/contracts/room').RoomSummary[]> {
  return request<import('../../../shared/contracts/room').RoomSummary[]>('/api/v1/rooms');
}

export async function getRoom(roomId: string): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(`/api/v1/rooms/${encodeURIComponent(roomId)}`);
}

export async function createRoom(
  settings?: Partial<import('../../../shared/contracts/room').RoomSettings>,
  nickname?: string,
  avatarPresetId?: string,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>('/api/v1/rooms', {
    method: 'POST',
    body: JSON.stringify({ settings, nickname, avatarPresetId }),
  });
}

export async function joinRoomSeat(
  roomId: string,
  seatIndex: number,
  nickname?: string,
  avatarPresetId?: string,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({ seatIndex, nickname, avatarPresetId }),
    },
  );
}

export async function leaveRoomSeat(roomId: string): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/leave`,
    {
      method: 'POST',
    },
  );
}

export async function fillRoomAi(
  roomId: string,
  seatIndex: number,
  characterId: string,
  aiLevel: string,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/ai`,
    {
      method: 'POST',
      body: JSON.stringify({ seatIndex, characterId, aiLevel }),
    },
  );
}

export async function removeRoomAi(
  roomId: string,
  seatIndex: number,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/ai/${seatIndex}`,
    {
      method: 'DELETE',
    },
  );
}

export async function setRoomReady(
  roomId: string,
  isReady: boolean,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/ready`,
    {
      method: 'POST',
      body: JSON.stringify({ isReady }),
    },
  );
}

export async function startRoomGame(
  roomId: string,
): Promise<import('../../../shared/contracts/room').RoomSummary> {
  return request<import('../../../shared/contracts/room').RoomSummary>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/start`,
    {
      method: 'POST',
    },
  );
}

export async function getRoomPlayerView(
  roomId: string,
): Promise<import('../../../shared/contracts/room').PlayerViewSnapshot> {
  return request<import('../../../shared/contracts/room').PlayerViewSnapshot>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/view`,
  );
}

export async function sendRoomCommand(
  roomId: string,
  command: import('../../../shared/contracts/room').RoomCommand,
): Promise<{ accepted: boolean; code?: string; revision: number }> {
  return request<{ accepted: boolean; code?: string; revision: number }>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/command`,
    {
      method: 'POST',
      body: JSON.stringify(command),
    },
  );
}

export async function listFamilyCups(
  limit = 10,
): Promise<import('../../../shared/contracts/room').FamilyCupSummary[]> {
  return request<import('../../../shared/contracts/room').FamilyCupSummary[]>(
    `/api/v1/rooms/cups?limit=${encodeURIComponent(limit)}`,
  );
}

export async function getFamilyCup(
  cupId: string,
): Promise<import('../../../shared/contracts/room').FamilyCupSummary> {
  return request<import('../../../shared/contracts/room').FamilyCupSummary>(
    `/api/v1/rooms/cups/${encodeURIComponent(cupId)}`,
  );
}

export async function fetchLeaderboard(
  gameId: string,
  difficulty: string,
  scope: import('../../../shared/contracts/leaderboard').LeaderboardScope,
): Promise<import('../../../shared/contracts/leaderboard').LeaderboardResponse> {
  const params = new URLSearchParams({ gameId, difficulty, scope });
  return request<import('../../../shared/contracts/leaderboard').LeaderboardResponse>(
    `/api/v1/leaderboard?${params.toString()}`,
  );
}

export async function fetchFamilyFeed(
  limit = 20,
): Promise<{ items: import('../../../shared/contracts/leaderboard').FamilyFeedItem[] }> {
  return request<{ items: import('../../../shared/contracts/leaderboard').FamilyFeedItem[] }>(
    `/api/v1/feed?limit=${encodeURIComponent(limit)}`,
  );
}

export async function fetchMyChampions(): Promise<{
  badges: import('../../../shared/contracts/leaderboard').WeeklyChampionBadge[];
}> {
  return request<{
    badges: import('../../../shared/contracts/leaderboard').WeeklyChampionBadge[];
  }>('/api/v1/me/champions');
}




