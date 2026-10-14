import { games } from '@/data/games';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { recordCharacterMatchFinish } from '@/lib/playerCharacters';
import {
  isReplayFile,
  restoreMatch,
  type RiichiMatchState,
} from '@/pages/mahjong/japanese/engine/match';
import { recordRiichiMatchFinish } from '@/lib/riichiProgress';
import {
  THEME_CHALLENGE_SET_ID,
  type ThemeChallengeId,
} from '../../../shared/contracts/challenge';
import {
  recordThemeChallengeMatch,
  THEME_CHALLENGE_REWARD_POINTS,
} from '@/lib/themeChallenges';
import type { DatabaseSync } from 'node:sqlite';
import { gameStore } from '@/store/gameStoreCore';
import type { MemberSnapshot } from '../../../shared/contracts/member';
import type {
  OfflineReceipt,
  OfflineReceiptResult,
} from '../../../shared/contracts/sync';
import { runSnapshotMutation } from '../snapshotRuntime';

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validatePlausibleArcadeFinish(
  gameId: string,
  outcome: 'win' | 'lose' | 'draw',
  score: number,
  meta?: Record<string, unknown>,
): boolean {
  if (!games.some((g) => g.id === gameId)) return false;
  if (!isIntInRange(score, 0, 10_000_000)) return false;
  if (meta?.maxCombo !== undefined && !isIntInRange(meta.maxCombo, 0, 100_000)) return false;

  switch (gameId) {
    case '2048': {
      if (outcome === 'win' && score < 256) return false;
      if (meta?.maxTile !== undefined) {
        const tile = meta.maxTile;
        if (
          !isIntInRange(tile, 2, 131_072) ||
          (tile & (tile - 1)) !== 0 ||
          score < tile ||
          (outcome === 'win' && tile < 256)
        )
          return false;
      }
      break;
    }
    case 'guess-number': {
      if (outcome === 'win' && !isIntInRange(score, 1, 1000)) return false;
      if (outcome === 'lose' && score !== 0) return false;
      break;
    }
    case 'snake':
    case 'tetris':
    case 'breakout': {
      if (score < 0) return false;
      break;
    }
    case 'gomoku':
    case 'xiangqi':
    case 'chess':
    case 'tictactoe': {
      if (score !== 0 && score !== 1) return false;
      break;
    }
  }
  return true;
}

export function processOfflineRiichiReceipt(
  snapshot: MemberSnapshot,
  receipt: OfflineReceipt,
  recordChallenges?: (match: RiichiMatchState) => number,
): { snapshot: MemberSnapshot; result: OfflineReceiptResult } {
  if (receipt.payload.source !== 'free' || !('riichi' in receipt.payload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  const { replay, playerCharacterId } = receipt.payload.riichi;
  if (!isReplayFile(replay)) {
    throw new Error('INVALID_REPLAY');
  }

  // 严禁离线上报排位赛
  if (replay.ranked) {
    throw new Error('RANKED_NOT_ALLOWED');
  }

  // 验证可完整重放
  const match: RiichiMatchState | null = restoreMatch(replay);
  if (!match) {
    throw new Error('REPLAY_FAILED');
  }

  if (match.status !== 'matchEnd' || !match.matchEnd) {
    throw new Error('MATCH_NOT_FINISHED');
  }

  const ranking = match.matchEnd.ranking;
  const placement = ranking.indexOf(0) + 1;
  const matchLength = match.matchLength;
  const prevCoins = snapshot.wallet.coins;

  const updated = runSnapshotMutation(snapshot, () => {
    // 发放对局金币与记录胜负统计
    recordRiichiMatchFinish(placement, matchLength, receipt.matchId);
    // 发放角色好感与相遇统计
    recordCharacterMatchFinish({
      matchId: receipt.matchId,
      characterId: playerCharacterId,
      opponents: match.seatCharacters.slice(1) as string[],
      ranking,
    });
    return recordChallenges?.(match) ?? 0;
  });

  const coinsEarned = Math.max(0, updated.snapshot.wallet.coins - prevCoins);
  const affinityAmount = matchLength === 'east' ? 2 : 4;

  return {
    snapshot: updated.snapshot,
    result: {
      eventId: receipt.eventId,
      matchId: receipt.matchId,
      source: 'free',
      coinsEarned,
      pointsEarned: updated.result,
      affinityEarned: {
        characterId: playerCharacterId,
        amount: affinityAmount,
      },
    },
  };
}

/** Persist unique accepted match and completion credentials in the caller's DB transaction. */
export function recordMemberThemeChallengeMatch(
  db: DatabaseSync,
  memberId: string,
  matchId: string,
  source: 'free' | 'ai-ranked',
  match: RiichiMatchState,
): number {
  const receipt = db.prepare(`
    INSERT OR IGNORE INTO theme_challenge_matches
      (member_id, challenge_set_id, match_id, source, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(memberId, THEME_CHALLENGE_SET_ID, matchId, source, Date.now());
  if (receipt.changes !== 1) return 0;

  const rows = db.prepare(`
    SELECT challenge_id FROM theme_challenge_completions
    WHERE member_id = ? AND challenge_set_id = ?
  `).all(memberId, THEME_CHALLENGE_SET_ID) as Array<{ challenge_id: string }>;
  const completed = rows
    .map((row) => row.challenge_id)
    .filter((id): id is ThemeChallengeId =>
      id === 'menzen-win' || id === 'safe-south' || id === 'three-matches',
    );
  const result = recordThemeChallengeMatch(match, matchId, source, completed);
  for (const challengeId of result.newlyCompleted) {
    const completion = db.prepare(`
      INSERT OR IGNORE INTO theme_challenge_completions
        (member_id, challenge_set_id, challenge_id, match_id, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      memberId,
      THEME_CHALLENGE_SET_ID,
      challengeId,
      matchId,
      Date.now(),
    );
    if (completion.changes !== 1)
      throw new Error('THEME_CHALLENGE_CREDENTIAL_CONFLICT');
  }
  return result.newlyCompleted.length * THEME_CHALLENGE_REWARD_POINTS;
}

export function processOfflineArcadeReceipt(
  snapshot: MemberSnapshot,
  receipt: OfflineReceipt,
): { snapshot: MemberSnapshot; result: OfflineReceiptResult } {
  if (receipt.payload.source !== 'arcade' || !('arcade' in receipt.payload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  const { gameId, difficulty, score, outcome, meta } = receipt.payload.arcade;
  const normalizedDiff = normalizeArcadeDifficulty(gameId, difficulty);

  if (!validatePlausibleArcadeFinish(gameId, outcome, score, meta)) {
    throw new Error('PLAUSIBILITY_CHECK_FAILED');
  }

  const prevCoins = snapshot.wallet.coins;

  const updated = runSnapshotMutation(snapshot, () => {
    gameStore.setState({
      stats: snapshot.arcade.stats,
      receipts: snapshot.arcade.receipts,
    });

    const common = {
      gameId,
      difficulty: normalizedDiff,
      score,
      meta: { ...meta, outcome, roundId: receipt.matchId },
    };

    const first = emitGameEvent({ ...common, type: 'finish' });
    const won = outcome === 'win' ? emitGameEvent({ ...common, type: 'win' }) : null;
    const best = first.record?.isNewBest ? emitGameEvent({ ...common, type: 'best' }) : null;

    return {
      record: first.record,
      wonRecord: won?.record,
      bestRecord: best?.record,
    };
  });

  const coinsEarned = Math.max(0, updated.snapshot.wallet.coins - prevCoins);

  return {
    snapshot: updated.snapshot,
    result: {
      eventId: receipt.eventId,
      matchId: receipt.matchId,
      source: 'arcade',
      coinsEarned,
      pointsEarned: 0,
      record: updated.result.record,
    },
  };
}
