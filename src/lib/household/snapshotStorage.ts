import type { MemberSnapshot } from '../../../shared/contracts/member';
import { normalizeArcadeChallenges, ARCADE_CHALLENGE_STORAGE_KEY } from '../../../shared/contracts/arcadeChallenge';
import { normalizeThemeChallengeState } from '../../../shared/contracts/challenge';
import { normalizeJourneyProgress } from '../../../shared/contracts/journey';
import { JOURNEY_PROGRESS_CHANGED_EVENT, JOURNEY_PROGRESS_STORAGE_KEY } from '@/lib/journeyProgress';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '@/lib/achievements';
import { COSMETICS_CHANGED_EVENT } from '@/lib/cosmetics';
import { CHARACTERS_CHANGED_EVENT } from '@/lib/playerCharacters';
import { PLAYER_PROFILE_STORAGE_KEY } from '@/lib/playerProfile';
import { RANKED_CHANGED_EVENT } from '@/lib/ranked';
import { WALLET_CHANGED_EVENT } from '@/lib/wallet';
import { THEME_CHALLENGES_CHANGED_EVENT } from '@/lib/themeChallenges';

export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.map.keys());
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  toMap(): Map<string, string> {
    return new Map(this.map);
  }
}

export function createStorageFromSnapshot(snapshot: MemberSnapshot): MemoryStorage {
  const storage = new MemoryStorage();

  storage.setItem('game-hub-player-profile', JSON.stringify(snapshot.profile));
  storage.setItem('game-hub-growth-state', JSON.stringify(snapshot.growth));
  storage.setItem('game-hub-player-characters', JSON.stringify(snapshot.characters));
  storage.setItem('game-hub-wallet-v1', JSON.stringify(snapshot.wallet));
  storage.setItem('game-hub-cosmetics-v1', JSON.stringify(snapshot.cosmetics));
  storage.setItem('game-hub-unlocked-achievements', JSON.stringify(snapshot.achievements));
  storage.setItem('game-hub-storage', JSON.stringify({ state: snapshot.arcade }));
  storage.setItem('game-hub-player-stats', JSON.stringify(snapshot.stats));
  storage.setItem('game-hub-daily-tasks', JSON.stringify(snapshot.dailyTasks));
  storage.setItem('game-hub-weekly-tasks', JSON.stringify(snapshot.weeklyTasks));
  storage.setItem(
    'game-hub-theme-challenges-v1',
    JSON.stringify(normalizeThemeChallengeState(snapshot.themeChallenges)),
  );
  storage.setItem(ARCADE_CHALLENGE_STORAGE_KEY, JSON.stringify(normalizeArcadeChallenges(snapshot.arcadeChallenges)));
  storage.setItem('game-hub-checkin-state', JSON.stringify(snapshot.checkin));
  storage.setItem(JOURNEY_PROGRESS_STORAGE_KEY, JSON.stringify(normalizeJourneyProgress(snapshot.journey)));
  storage.setItem('game-hub-ranked-v1', JSON.stringify(snapshot.ranked));
  storage.setItem('game-hub-locale', snapshot.preferences.locale);
  if (snapshot.preferences.riichiTheme) {
    storage.setItem('game-hub-riichi-theme', snapshot.preferences.riichiTheme);
  }
  if (snapshot.preferences.venueTheme) {
    storage.setItem('game-hub-theme-v1', snapshot.preferences.venueTheme);
  }
  storage.setItem('game-hub-arcade-prefs-v1', JSON.stringify(snapshot.preferences.arcadePrefs));

  if (snapshot.legacyData) {
    for (const [key, value] of Object.entries(snapshot.legacyData)) {
      if (
        typeof value === 'string' &&
        key !== 'game-hub-theme-challenges-v1' &&
        key !== JOURNEY_PROGRESS_STORAGE_KEY && key !== ARCADE_CHALLENGE_STORAGE_KEY
      ) {
        storage.setItem(key, value);
      }
    }
  }

  return storage;
}

export function notifyStorageStateChanged(): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
  window.dispatchEvent(new Event(COSMETICS_CHANGED_EVENT));
  window.dispatchEvent(new Event(CHARACTERS_CHANGED_EVENT));
  window.dispatchEvent(new Event(RANKED_CHANGED_EVENT));
  window.dispatchEvent(new Event(THEME_CHALLENGES_CHANGED_EVENT));
  window.dispatchEvent(new Event(JOURNEY_PROGRESS_CHANGED_EVENT));
  window.dispatchEvent(new Event(ACHIEVEMENT_UNLOCKED_EVENT));
  window.dispatchEvent(new StorageEvent('storage', { key: PLAYER_PROFILE_STORAGE_KEY }));
}
