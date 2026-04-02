export const RECENT_MAHJONG_STORAGE_KEY = 'game-hub-recent-mahjong';

export type RecentMahjongEntry = {
  gameId: 'mahjong-japanese';
  playedAt: number;
};

export function getRecentMahjongEntry(): RecentMahjongEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RECENT_MAHJONG_STORAGE_KEY);
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
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    RECENT_MAHJONG_STORAGE_KEY,
    JSON.stringify({
      gameId: 'mahjong-japanese',
      playedAt: Date.now(),
    } satisfies RecentMahjongEntry),
  );
}
