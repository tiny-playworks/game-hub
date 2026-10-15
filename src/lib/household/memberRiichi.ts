import type { MemberSnapshot } from '../../../shared/contracts/member';
import { applyEvent, createMatch, restoreMatch, selectSeatCharacters, toReplayFile } from '@/pages/mahjong/japanese/engine';
import { randomSeed } from '@/lib/seededRandom';
import { getLocalResume, saveLocalResume, deleteLocalResume, listLocalResumes } from './offlineDb';
import { HouseholdApiError, putResumeSave } from './api';
import { queueOfflineRiichi } from './sync';
import type { MemberRiichiSession, RiichiOnlineBridge } from './riichiBridge';

export const CONFIRMED_MEMBER_CACHE_KEY = 'game-hub-confirmed-member-v1';

export function cacheConfirmedMember(snapshot: MemberSnapshot | null): void {
  try {
    if (snapshot) localStorage.setItem(CONFIRMED_MEMBER_CACHE_KEY, JSON.stringify({ at: Date.now(), snapshot }));
    else localStorage.removeItem(CONFIRMED_MEMBER_CACHE_KEY);
  } catch { /* A disabled cache must not prevent online play. */ }
}

export function readConfirmedMember(): MemberSnapshot | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIRMED_MEMBER_CACHE_KEY) ?? 'null');
    const snapshot = cached?.snapshot as MemberSnapshot | undefined;
    return cached?.at > Date.now() - 30 * 86400000 && snapshot?.schema === 1 &&
      typeof snapshot.memberId === 'string' && snapshot.profile && snapshot.characters && snapshot.wallet &&
      snapshot.arcade && snapshot.preferences ? snapshot : null;
  } catch { return null; }
}

/** The confirmed wallet stays unchanged until the NAS accepts an offline result. */
export function createMemberRiichiBridge(options: {
  online: RiichiOnlineBridge;
  snapshot: () => MemberSnapshot | null;
  deviceId: string;
  isOnline: () => boolean;
  onOffline: () => void;
}): RiichiOnlineBridge {
  let cached: { owner: string; session: MemberRiichiSession; detached: boolean } | null = null;
  const owner = () => {
    const snapshot = options.snapshot();
    if (!snapshot) throw new Error('Not logged in');
    if (cached && cached.owner !== snapshot.memberId) cached = null;
    return snapshot;
  };
  const remember = async (session: MemberRiichiSession, detached: boolean) => {
    const snapshot = owner();
    if (session.snapshot.memberId !== snapshot.memberId) throw new Error('Member changed before the update');
    cached = { owner: snapshot.memberId, session, detached };
    if (!session.match.ranked) {
      if (session.match.status === 'matchEnd') {
        await deleteLocalResume(session.matchId);
      } else {
        await saveLocalResume({ schema: 1, memberId: snapshot.memberId, deviceId: options.deviceId,
          saveId: session.matchId, source: 'free', updatedAt: new Date().toISOString(),
          replay: toReplayFile(session.match), processedProgress: [], playerCharacterId: session.playerCharacterId,
          themeChallengeEligible: true });
      }
    }
    return session;
  };
  const networkFailure = (error: unknown) => !(error instanceof HouseholdApiError) && error instanceof TypeError;
  return {
    async start(input) {
      const snapshot = owner();
      if (options.isOnline()) {
        try { return await remember(await options.online.start(input), false); }
        catch (error) { if (!networkFailure(error)) throw error; options.onOffline(); }
      }
      if (input.source !== 'free') throw new Error('Ranked matches require an online connection');
      const seed = randomSeed();
      const playerCharacterId = snapshot.characters.activeCharacterId;
      const created = createMatch({ seed, matchLength: input.matchLength,
        rules: { aiLevel: input.aiLevel ?? 'standard' },
        seatCharacters: selectSeatCharacters(seed, playerCharacterId, input.opponents) });
      return remember({ ...created, matchId: input.matchId, playerCharacterId, snapshot }, true);
    },
    async event(input) {
      const snapshot = owner();
      if (!cached || cached.session.matchId !== input.matchId) {
        const response = await options.online.current();
        if (!response.match || !response.matchId || !response.playerCharacterId) throw new Error('Match unavailable');
        await remember({ ...response, match: response.match, matchId: response.matchId,
          playerCharacterId: response.playerCharacterId, effects: [], snapshot }, false);
      }
      if (!cached!.detached && options.isOnline()) {
        try { return await remember(await options.online.event(input), false); }
        catch (error) { if (!networkFailure(error)) throw error; options.onOffline(); }
      }
      const previous = cached!.session;
      if (previous.match.ranked) throw new Error('Ranked matches require an online connection');
      if (input.expectedTurn !== previous.match.turn) throw new Error('Match turn changed');
      const step = applyEvent(previous.match, input.event);
      if (!step) throw new Error('Illegal match action');
      if (step.match.status === 'matchEnd') {
        await queueOfflineRiichi(snapshot.memberId, options.deviceId, input.matchId, {
          replay: toReplayFile(step.match), playerCharacterId: previous.playerCharacterId, themeChallengeEligible: true });
      }
      return remember({ ...previous, ...step, snapshot }, true);
    },
    async current() {
      const snapshot = owner();
      if (cached?.detached) return cached.session;
      if (options.isOnline()) {
        try {
          const result = await options.online.current();
          if (result.match && result.matchId && result.playerCharacterId)
            await remember({ ...result, match: result.match, matchId: result.matchId,
              playerCharacterId: result.playerCharacterId, effects: [], snapshot }, false);
          return result;
        } catch (error) { if (!networkFailure(error)) throw error; options.onOffline(); }
      }
      if (cached) return cached.session;
      const records = await listLocalResumes(snapshot.memberId);
      const record = records.filter((save) => save.deviceId === options.deviceId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const match = record && restoreMatch(record.replay);
      return match ? remember({ match, matchId: record.saveId,
        playerCharacterId: record.playerCharacterId ?? snapshot.characters.activeCharacterId, effects: [], snapshot }, true)
        : { match: null, matchId: null, playerCharacterId: null };
    },
    async resume(saveId) {
      const snapshot = owner();
      if (options.isOnline() && options.online.resume)
        return remember(await options.online.resume(saveId), false);
      const record = await getLocalResume(saveId);
      if (!record || record.memberId !== snapshot.memberId) throw new Error('Save unavailable');
      const match = restoreMatch(record.replay);
      if (!match) throw new Error('Save invalid');
      return remember({ match, matchId: saveId, effects: [], snapshot,
        playerCharacterId: record.playerCharacterId ?? snapshot.characters.activeCharacterId }, true);
    },
    forfeit: (matchId) => options.online.forfeit(matchId),
  };
}

export async function uploadLocalMemberResumes(memberId: string): Promise<void> {
  for (const record of await listLocalResumes(memberId)) {
    try { await putResumeSave(record.saveId, record); }
    catch (error) {
      // A game explicitly moved or finished elsewhere must never overwrite its newer state.
      if (error instanceof HouseholdApiError && error.status === 409) await deleteLocalResume(record.saveId);
      else throw error;
    }
  }
}
