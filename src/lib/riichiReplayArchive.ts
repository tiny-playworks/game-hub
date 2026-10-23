import { gameStorage } from '@/lib/storage';
import type {
  ReplayArchiveDetail,
  ReplayArchiveSummary,
  ReplayListQuery,
  ReplayListResponse,
} from '../../shared/contracts/replay';
import {
  isReplayFile,
  restoreMatch,
  type RiichiReplayFile,
} from '@/pages/mahjong/japanese/engine/match';
import { loadLastReplay } from '@/pages/mahjong/japanese/store/persistence';

export const GUEST_REPLAY_ARCHIVE_STORAGE_KEY = 'game-hub-riichi-replays-v1';
export const REPLAY_ARCHIVE_CHANGED_EVENT = 'game-hub:replay-archive-changed';

function notifyReplayArchiveChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REPLAY_ARCHIVE_CHANGED_EVENT));
}

interface StoredGuestReplay {
  summary: ReplayArchiveSummary;
  file: RiichiReplayFile;
}

function storage(): Storage | null {
  try {
    return typeof gameStorage === 'undefined' ? null : gameStorage;
  } catch {
    return null;
  }
}

function loadGuestArchive(): StoredGuestReplay[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(GUEST_REPLAY_ARCHIVE_STORAGE_KEY);
    if (!raw) {
      // 迁移已有游客最近一份牌谱（P15 15.1 验收条件）
      const last = loadLastReplay();
      if (last && isReplayFile(last)) {
        const migrated = createGuestEntry(last, 'free', 0, false);
        s.setItem(GUEST_REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify([migrated]));
        return [migrated];
      }
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as StoredGuestReplay[]) : [];
  } catch {
    return [];
  }
}

function saveGuestArchive(items: StoredGuestReplay[]): void {
  try {
    storage()?.setItem(GUEST_REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify(items));
    notifyReplayArchiveChanged();
  } catch {
    // ignore quota error
  }
}

export function createGuestEntry(
  file: RiichiReplayFile,
  source: 'free' | 'ai-ranked' = 'free',
  viewerSeat = 0,
  isFavorite = false,
): StoredGuestReplay {
  const chars = file.seatCharacters ? file.seatCharacters.join('-') : 'default';
  const matchId =
    file.ranked?.id ??
    `local:${file.seed}:${file.events.length}:${chars}`;
  const roundsCount =
    file.events.filter((e) => e.type === 'nextRound').length + 1;

  let ranking = 1;
  let finalScore = 25000;
  try {
    const match = restoreMatch(file);
    if (match?.matchEnd) {
      ranking = match.matchEnd.ranking.indexOf(viewerSeat) + 1;
      finalScore = match.matchEnd.finalScores[viewerSeat] ?? 25000;
    } else if (match?.round?.scores?.[viewerSeat] !== undefined) {
      finalScore = match.round.scores[viewerSeat];
      const sorted = [...match.round.scores].sort((a, b) => b - a);
      ranking = sorted.indexOf(finalScore) + 1;
    }
  } catch {
    // ignore restore error
  }

  const summary: ReplayArchiveSummary = {
    matchId,
    source,
    viewerSeat,
    playerCharacterId:
      (file.seatCharacters && file.seatCharacters[viewerSeat]) || 'koharu',
    ranking,
    finalScore,
    matchLength: file.matchLength,
    isFavorite,
    createdAt: Date.now(),
    roundsCount,
  };

  return { summary, file };
}

export function archiveGuestReplay(
  file: RiichiReplayFile,
  source: 'free' | 'ai-ranked' = 'free',
  viewerSeat = 0,
): void {
  const entry = createGuestEntry(file, source, viewerSeat);
  const existing = loadGuestArchive();

  // 若已存在，不重复新增
  const index = existing.findIndex(
    (item) => item.summary.matchId === entry.summary.matchId,
  );
  if (index >= 0) {
    existing[index] = { ...existing[index], file: entry.file };
    saveGuestArchive(existing);
    return;
  }

  // 检查非收藏上限 200（总纲 4.5）
  const nonFavs = existing.filter((item) => !item.summary.isFavorite);
  if (nonFavs.length >= 200) {
    // 淘汰最旧的普通牌谱
    const oldest = nonFavs.sort(
      (a, b) => a.summary.createdAt - b.summary.createdAt,
    )[0];
    const dropIdx = existing.findIndex(
      (item) => item.summary.matchId === oldest.summary.matchId,
    );
    if (dropIdx >= 0) existing.splice(dropIdx, 1);
  }

  existing.unshift(entry);
  saveGuestArchive(existing);
}

// 统一对外查询接口（支持传入 memberId 使用网络，否则读本地）
export async function fetchReplayList(
  query: ReplayListQuery = {},
  isHouseholdMember = false,
  signal?: AbortSignal,
): Promise<ReplayListResponse> {
  if (isHouseholdMember) {
    const params = new URLSearchParams();
    if (query.source) params.set('source', query.source);
    if (query.ranking) params.set('ranking', String(query.ranking));
    if (query.favoriteOnly) params.set('favoriteOnly', 'true');
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));

    const res = await fetch(`/api/v1/replays?${params.toString()}`, {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch replays from server');
    return (await res.json()) as ReplayListResponse;
  }

  // 游客本地归档
  let items = loadGuestArchive().map((item) => item.summary);
  if (query.source && query.source !== 'all') {
    items = items.filter((item) => item.source === query.source);
  }
  if (query.ranking && query.ranking !== 'all') {
    items = items.filter((item) => item.ranking === query.ranking);
  }
  if (query.favoriteOnly) {
    items = items.filter((item) => item.isFavorite);
  }

  const favoritesCount = items.filter((item) => item.isFavorite).length;
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const paged = items.slice(offset, offset + limit);

  return {
    total: items.length,
    favoritesCount,
    items: paged,
  };
}

export async function fetchReplayDetail(
  matchId: string,
  isHouseholdMember = false,
  signal?: AbortSignal,
): Promise<ReplayArchiveDetail | null> {
  if (isHouseholdMember) {
    const res = await fetch(`/api/v1/replays/${encodeURIComponent(matchId)}`, {
      credentials: 'include',
      signal,
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to load replay: ${res.statusText}`);
    }
    return (await res.json()) as ReplayArchiveDetail;
  }

  const items = loadGuestArchive();
  const found = items.find((item) => item.summary.matchId === matchId);
  return found ?? null;
}

export async function setReplayFavorite(
  matchId: string,
  isFavorite: boolean,
  isHouseholdMember = false,
): Promise<{ success: boolean; error?: string }> {
  if (isHouseholdMember) {
    const res = await fetch(`/api/v1/replays/${encodeURIComponent(matchId)}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isFavorite }),
    });
    if (!res.ok) {
      if (res.status === 409)
        return { success: false, error: 'FAVORITE_LIMIT_REACHED' };
      return { success: false, error: 'ERROR' };
    }
    return { success: true };
  }

  const items = loadGuestArchive();
  const target = items.find((item) => item.summary.matchId === matchId);
  if (!target) return { success: false, error: 'NOT_FOUND' };

  if (isFavorite) {
    const favCount = items.filter((item) => item.summary.isFavorite).length;
    if (favCount >= 100)
      return { success: false, error: 'FAVORITE_LIMIT_REACHED' };
  }

  target.summary.isFavorite = isFavorite;
  saveGuestArchive(items);
  return { success: true };
}

export async function removeReplay(
  matchId: string,
  isHouseholdMember = false,
): Promise<boolean> {
  if (isHouseholdMember) {
    const res = await fetch(`/api/v1/replays/${encodeURIComponent(matchId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) notifyReplayArchiveChanged();
    return res.ok;
  }

  const items = loadGuestArchive();
  const next = items.filter((item) => item.summary.matchId !== matchId);
  if (next.length !== items.length) {
    saveGuestArchive(next);
    return true;
  }
  return false;
}
