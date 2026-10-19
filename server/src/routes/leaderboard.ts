import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { normalizeArcadeDifficulty } from '@/lib/arcade';
import type { LeaderboardScope } from '../../../shared/contracts/leaderboard';
import { apiError, requireSession } from '../auth';
import {
  getFamilyFeed,
  getLeaderboard,
  getMemberChampions,
  isRankedGame,
} from '../services/leaderboard';

export function registerLeaderboardRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get('/api/v1/leaderboard', async (request) => {
    requireSession(db, request);
    const query = request.query as Record<string, unknown>;
    const { gameId, difficulty, scope } = query;
    if (
      typeof gameId !== 'string' || !isRankedGame(gameId) ||
      typeof difficulty !== 'string' ||
      normalizeArcadeDifficulty(gameId, difficulty) !== difficulty ||
      (scope !== 'all-time' && scope !== 'week')
    )
      throw apiError(400, 'BAD_REQUEST');
    return getLeaderboard(db, gameId, difficulty, scope as LeaderboardScope);
  });

  app.get('/api/v1/feed', async (request) => {
    requireSession(db, request);
    const raw = Number((request.query as Record<string, unknown>).limit ?? 20);
    return { items: getFamilyFeed(db, Number.isFinite(raw) ? raw : 20) };
  });

  app.get('/api/v1/me/champions', async (request) => {
    const { member } = requireSession(db, request);
    return { badges: getMemberChampions(db, member.id) };
  });
}
