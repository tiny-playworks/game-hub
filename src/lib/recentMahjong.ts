import { gameStorage } from '@/lib/storage';
export const RECENT_MAHJONG_STORAGE_KEY = 'game-hub-recent-mahjong';

export type RecentMahjongEntry = {
  gameId: 'mahjong-japanese';
  playedAt: number;
};

export function getRecentMahjongEntry(): RecentMahjongEntry | null {
  if (typeof gameStorage === 'undefined') return null;
  try {
    const raw = gameStorage.getItem(RECENT_MAHJONG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentMahjongEntry;
    if (parsed.gameId !== 'mahjong-japanese') return null;
    if (typeof parsed.playedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function markRecentMahjongPlayed(): void {
  if (typeof gameStorage === 'undefined') return;
  gameStorage.setItem(
    RECENT_MAHJONG_STORAGE_KEY,
    JSON.stringify({
      gameId: 'mahjong-japanese',
      playedAt: Date.now(),
    } satisfies RecentMahjongEntry),
  );
}
