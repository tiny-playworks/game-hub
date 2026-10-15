import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { getTurnTotalSeconds } from '@/lib/riichiClock';
import { markCharactersEncountered, recordCharacterMatchFinish, CHARACTER_DEFS } from '@/lib/playerCharacters';
import { selectRankedOpponents, saveRankedState } from '@/lib/ranked';
import { settleRankedMatch } from '@/lib/rankedSettlement';
import { recordRiichiMatchFinish, recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { recordMemberThemeChallengeMatch } from '../services/progression';
import { type RiichiEvent, type RiichiMatchState, type RiichiEffect,
  getSeatTurnOptions, isReplayFile, selectSeatCharacters, toReplayFile } from '@/pages/mahjong/japanese/engine';
import { apiError, requireSession } from '../auth';
import { archiveReplay, getMember, readSnapshot, saveSnapshot, transaction } from '../db';
import { runSnapshotMutation } from '../snapshotRuntime';
import { applyEvent, createMatch, nextServerAiEvent } from '../riichi/runtime';

type MatchRow = {
  match_id: string;
  device_id: string;
  source: 'free' | 'ai-ranked';
  state_json: string;
  player_character_id: string;
  challenge_eligible: number;
  updated_at: number;
  finished_at: number | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const aiLevels = ['beginner', 'standard', 'strong', 'expert'];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw apiError(400, 'BAD_REQUEST');
  return value as Record<string, unknown>;
}

function startInput(body: unknown) {
  const input = object(body);
  const { matchId, source, matchLength, aiLevel, opponents } = input;
  if (typeof matchId !== 'string' || !uuid.test(matchId) ||
    (source !== 'free' && source !== 'ai-ranked') ||
    (matchLength !== 'east' && matchLength !== 'south') ||
    (aiLevel !== undefined && !aiLevels.includes(String(aiLevel))) ||
    (opponents !== undefined &&
      (!Array.isArray(opponents) || opponents.length !== 3 ||
        opponents.some((id) => id !== null &&
          (typeof id !== 'string' || !CHARACTER_DEFS.some((character) => character.id === id))))))
    throw apiError(400, 'BAD_REQUEST');
  return { matchId, source: source as 'free' | 'ai-ranked',
    matchLength: matchLength as 'east' | 'south',
    aiLevel: aiLevel as 'beginner' | 'standard' | 'strong' | 'expert' | undefined,
    opponents: opponents as (string | null)[] | undefined };
}

function rowFor(db: DatabaseSync, memberId: string, matchId: string): MatchRow | null {
  return (db.prepare('SELECT * FROM riichi_matches WHERE member_id = ? AND match_id = ?')
    .get(memberId, matchId) as MatchRow | undefined) ?? null;
}

function actionKey(event: RiichiEvent): string {
  switch (event.type) {
    case 'nextRound': return 'nextRound';
    case 'discard':
    case 'riichi': return `${event.type}:${event.seat}:${event.tile}`;
    case 'tsumo':
    case 'kyuushu': return `${event.type}:${event.seat}`;
    case 'ankan': return `${event.type}:${event.seat}:${event.tiles.join(',')}`;
    case 'kakan': return `${event.type}:${event.seat}:${event.meldIndex}:${event.tile}`;
    case 'claim': return `${event.type}:${event.seat}:${JSON.stringify(event.response)}`;
  }
}

function readEvent(body: unknown, match: RiichiMatchState): { matchId: string; expectedTurn: number; event: RiichiEvent } {
  const input = object(body);
  const { matchId, expectedTurn, event } = input;
  if (typeof matchId !== 'string' || !uuid.test(matchId) ||
    !Number.isSafeInteger(expectedTurn) || Number(expectedTurn) < 0 ||
    !event || JSON.stringify(event).length > 1000 ||
    !isReplayFile({ version: match.version, seed: match.seed,
      matchLength: match.matchLength, rules: match.rules,
      seatCharacters: match.seatCharacters, seatAiLevels: match.seatAiLevels,
      ranked: match.ranked, events: [event] }))
    throw apiError(400, 'BAD_REQUEST');
  return { matchId, expectedTurn: Number(expectedTurn), event: event as RiichiEvent };
}

function applyProgress(effects: RiichiEffect[]): void {
  for (const effect of effects) {
    if (effect.type === 'progress') recordRiichiProgressEvent(effect.event);
  }
}

function timeoutAction(match: RiichiMatchState): RiichiEvent | null {
  if (match.round.phase === 'claim')
    return { type: 'claim', seat: 0, response: { type: 'pass' } };
  const options = getSeatTurnOptions(match.round, 0);
  if (!options?.discardable.length) return null;
  const drawn = match.round.drawnTile;
  const tile = drawn !== null && options.discardable.includes(drawn)
    ? drawn : options.discardable[options.discardable.length - 1];
  return { type: 'discard', seat: 0, tile };
}

export function registerRiichiRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get('/api/v1/me/riichi/current', async (request) => {
    const { member, session } = requireSession(db, request);
    const activeRanked = readSnapshot(member).ranked.activeMatchId;
    const row = activeRanked ? rowFor(db, member.id, activeRanked) :
      db.prepare(`SELECT * FROM riichi_matches WHERE member_id = ? AND device_id = ?
        AND finished_at IS NULL ORDER BY updated_at DESC LIMIT 1`)
        .get(member.id, session.device_id) as MatchRow | undefined;
    return { match: row && row.finished_at === null ? JSON.parse(row.state_json) as RiichiMatchState : null,
      matchId: row?.finished_at === null ? row.match_id : null,
      playerCharacterId: row?.finished_at === null ? row.player_character_id : null };
  });

  app.post('/api/v1/me/riichi/matches', async (request) => {
    const { member, session } = requireSession(db, request);
    const input = startInput(request.body);
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      const snapshot = readSnapshot(current);
      const existing = rowFor(db, member.id, input.matchId);
      if (existing) {
        if (existing.device_id !== session.device_id || existing.source !== input.source)
          throw apiError(409, 'MATCH_CONFLICT');
        return { snapshot, match: JSON.parse(existing.state_json) as RiichiMatchState,
          matchId: existing.match_id, playerCharacterId: existing.player_character_id, effects: [] };
      }
      if (snapshot.ranked.activeMatchId) throw apiError(409, 'RANKED_MATCH_ACTIVE');
      const seed = randomInt(0, 0x1_0000_0000);
      const playerCharacterId = snapshot.characters.activeCharacterId;
      const ticket = input.source === 'ai-ranked' ? {
        id: input.matchId, at: Date.now(), seed,
        band: snapshot.ranked.band, level: snapshot.ranked.level,
        matchLength: input.matchLength, characterId: playerCharacterId,
        affinityStart: snapshot.characters.affinityByCharacter[playerCharacterId] ?? 0,
        ...selectRankedOpponents(snapshot.ranked, playerCharacterId, seed),
      } : undefined;
      const started = createMatch({
        seed, matchLength: input.matchLength, ranked: ticket,
        rules: ticket || !input.aiLevel ? undefined : { aiLevel: input.aiLevel },
        seatCharacters: ticket ? undefined : selectSeatCharacters(seed, playerCharacterId, input.opponents),
      });
      const updated = runSnapshotMutation(snapshot, () => {
        if (ticket) saveRankedState({ ...snapshot.ranked, activeMatchId: ticket.id, activeTicket: ticket });
        markCharactersEncountered([playerCharacterId, ...started.match.seatCharacters.slice(1) as string[]]);
        applyProgress(started.effects);
      });
      const next = saveSnapshot(db, current, updated.snapshot);
      const now = Date.now();
      db.prepare(`INSERT INTO riichi_matches(member_id, match_id, device_id, source,
        state_json, player_character_id, challenge_eligible, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(member.id, input.matchId, session.device_id, input.source,
          JSON.stringify(started.match), playerCharacterId, now, now);
      return { snapshot: next, match: started.match, matchId: input.matchId,
        playerCharacterId, effects: started.effects };
    });
  });

  app.post('/api/v1/me/riichi/events', async (request) => {
    const { member, session } = requireSession(db, request);
    const body = object(request.body);
    if (typeof body.matchId !== 'string' || !uuid.test(body.matchId))
      throw apiError(400, 'BAD_REQUEST');
    return transaction(db, () => {
      const current = getMember(db, member.id);
      const row = rowFor(db, member.id, body.matchId as string);
      if (!current || !row) throw apiError(404, 'MATCH_NOT_FOUND');
      if (row.device_id !== session.device_id) throw apiError(403, 'DEVICE_NOT_OWNER');
      const match = JSON.parse(row.state_json) as RiichiMatchState;
      const { expectedTurn, event } = readEvent(body, match);
      const snapshot = readSnapshot(current);
      if (expectedTurn < match.turn && match.events[expectedTurn] &&
        actionKey(match.events[expectedTurn]) === actionKey(event))
        return { snapshot, match, matchId: row.match_id,
          playerCharacterId: row.player_character_id, effects: [] };
      if (expectedTurn !== match.turn) throw apiError(409, 'MATCH_TURN_CONFLICT', true);
      if (row.finished_at !== null) throw apiError(409, 'MATCH_FINISHED');
      if (event.type !== 'nextRound' && event.seat !== 0) {
        const expected = nextServerAiEvent(match);
        if (!expected || actionKey(event) !== actionKey(expected))
          throw apiError(400, 'INVALID_MATCH_EVENT');
      }
      const now = Date.now();
      const timedOut = event.type !== 'nextRound' && event.seat === 0 &&
        (now - row.updated_at) / 1000 >= getTurnTotalSeconds(match.round.timeBanks[0]);
      if (timedOut) {
        const forced = timeoutAction(match);
        if (!forced || actionKey(event) !== actionKey(forced))
          throw apiError(409, 'MATCH_TIMEOUT', true);
      }
      const canonical: RiichiEvent = event.type === 'nextRound' ? event : {
        ...event,
        elapsed: event.seat === 0
          ? Math.min(300, Math.max(0, (now - row.updated_at) / 1000))
          : event.type === 'claim' ? 0.42 : 0.55,
        timeout: timedOut,
      };
      const step = applyEvent(match, canonical);
      if (!step) throw apiError(400, 'INVALID_MATCH_EVENT');
      const updated = runSnapshotMutation(snapshot, () => {
        applyProgress(step.effects);
        if (step.match.status === 'matchEnd' && step.match.matchEnd) {
          if (step.match.ranked) {
            if (!settleRankedMatch(step.match.ranked, step.match.matchEnd.finalScores))
              throw apiError(409, 'RANKED_MATCH_CONFLICT');
          } else {
            recordRiichiMatchFinish(step.match.matchEnd.ranking.indexOf(0) + 1,
              step.match.matchLength, row.match_id);
            recordCharacterMatchFinish({ matchId: row.match_id,
              characterId: row.player_character_id,
              opponents: step.match.seatCharacters.slice(1) as string[],
              ranking: step.match.matchEnd.ranking });
          }
          if (row.challenge_eligible === 1) {
            recordMemberThemeChallengeMatch(
              db,
              member.id,
              row.match_id,
              row.source,
              step.match,
            );
          }
        }
      });
      const next = saveSnapshot(db, current, updated.snapshot);
      db.prepare(`UPDATE riichi_matches SET state_json = ?, updated_at = ?, finished_at = ?
        WHERE member_id = ? AND match_id = ?`)
        .run(JSON.stringify(step.match), now, step.match.status === 'matchEnd' ? now : null,
          member.id, row.match_id);

      if (step.match.status === 'matchEnd' && step.match.matchEnd) {
        try {
          const replayFile = toReplayFile(step.match);
          archiveReplay(db, member.id, {
            matchId: row.match_id,
            source: row.source,
            viewerSeat: 0,
            playerCharacterId: row.player_character_id,
            ranking: step.match.matchEnd.ranking.indexOf(0) + 1,
            finalScore: step.match.matchEnd.finalScores[0] ?? 25000,
            matchLength: step.match.matchLength,
            replayJson: JSON.stringify(replayFile),
          });
        } catch {
          // ignore replay archive error
        }
      }

      return { snapshot: next, match: step.match, matchId: row.match_id,
        playerCharacterId: row.player_character_id, effects: step.effects };
    });
  });

  app.post('/api/v1/me/riichi/forfeit', async (request) => {
    const { member, session } = requireSession(db, request);
    const body = object(request.body);
    if (typeof body.matchId !== 'string' || !uuid.test(body.matchId))
      throw apiError(400, 'BAD_REQUEST');
    return transaction(db, () => {
      const current = getMember(db, member.id);
      const row = rowFor(db, member.id, body.matchId as string);
      if (!current || !row) throw apiError(404, 'MATCH_NOT_FOUND');
      if (row.device_id !== session.device_id) throw apiError(403, 'DEVICE_NOT_OWNER');
      if (row.source !== 'ai-ranked') throw apiError(400, 'BAD_REQUEST');
      const snapshot = readSnapshot(current);
      const match = JSON.parse(row.state_json) as RiichiMatchState;
      if (row.finished_at !== null) return { snapshot, match,
        matchId: row.match_id, playerCharacterId: row.player_character_id, effects: [] };
      if (!match.ranked) throw apiError(409, 'RANKED_MATCH_CONFLICT');
      const updated = runSnapshotMutation(snapshot, () => {
        if (!settleRankedMatch(match.ranked!, match.round.scores, true))
          throw apiError(409, 'RANKED_MATCH_CONFLICT');
      });
      const next = saveSnapshot(db, current, updated.snapshot);
      db.prepare('UPDATE riichi_matches SET finished_at = ?, updated_at = ? WHERE member_id = ? AND match_id = ?')
        .run(Date.now(), Date.now(), member.id, row.match_id);
      return { snapshot: next, match, matchId: row.match_id,
        playerCharacterId: row.player_character_id, effects: [] };
    });
  });
}
