import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type {
  ReplayArchiveDetail,
  ReplayArchiveSummary,
  ReplayListResponse,
} from '../../../shared/contracts/replay';
import { apiError, requireSession } from '../auth';
import {
  deleteReplay,
  getReplay,
  listReplays,
  toggleFavoriteReplay,
  type ReplaySummaryRow,
} from '../db';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine';

function toSummary(row: ReplaySummaryRow): ReplayArchiveSummary {
  return {
    matchId: row.match_id,
    source: row.source,
    roomId: row.room_id ?? undefined,
    viewerSeat: row.viewer_seat,
    playerCharacterId: row.player_character_id,
    ranking: row.ranking,
    finalScore: row.final_score,
    matchLength: row.match_length as 'east' | 'south',
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.created_at,
    roundsCount: row.rounds_count ?? undefined,
  };
}

export function registerReplayRoutes(app: FastifyInstance, db: DatabaseSync): void {
  // 牌谱列表
  app.get('/api/v1/replays', async (request) => {
    const { member } = requireSession(db, request);
    const query = (request.query ?? {}) as Record<string, string | undefined>;

    const source = query.source as 'all' | 'free' | 'ai-ranked' | 'family' | undefined;
    const rankingStr = query.ranking;
    const ranking = rankingStr && rankingStr !== 'all' ? (Number.parseInt(rankingStr, 10) as 1 | 2 | 3 | 4) : 'all';
    const favoriteOnly = query.favoriteOnly === 'true' || query.favoriteOnly === '1';
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;

    const result = listReplays(db, member.id, {
      source,
      ranking,
      favoriteOnly,
      limit,
      offset,
    });

    const response: ReplayListResponse = {
      total: result.total,
      favoritesCount: result.favoritesCount,
      items: result.items.map(toSummary),
    };
    return response;
  });

  // 获取特定牌谱详情
  app.get<{ Params: { matchId: string } }>('/api/v1/replays/:matchId', async (request) => {
    const { member } = requireSession(db, request);
    const { matchId } = request.params;

    const row = getReplay(db, member.id, matchId);
    if (!row) {
      throw apiError(404, 'REPLAY_NOT_FOUND');
    }

    // 进行中家庭局禁止查询全知牌谱（总纲 4.5 & P15），但已完成入账的杯赛场次允许查看
    if (row.room_id) {
      const activeRoom = db
        .prepare('SELECT room_id FROM active_rooms WHERE room_id = ?')
        .get(row.room_id) as { room_id: string } | undefined;
      const completedCupMatch = db
        .prepare('SELECT 1 FROM family_cup_matches WHERE match_id = ?')
        .get(matchId);
      if (activeRoom && !completedCupMatch) {
        throw apiError(403, 'FORBIDDEN_ONGOING_ROOM');
      }
    }

    const file = JSON.parse(row.replay_json) as RiichiReplayFile;
    const detail: ReplayArchiveDetail = {
      summary: toSummary(row),
      file,
    };
    return detail;
  });

  // 收藏 / 取消收藏
  app.patch<{ Params: { matchId: string }; Body: { isFavorite: boolean } }>(
    '/api/v1/replays/:matchId/favorite',
    async (request) => {
      const { member } = requireSession(db, request);
      const { matchId } = request.params;
      const body = request.body as { isFavorite?: boolean } | undefined;

      if (typeof body?.isFavorite !== 'boolean') {
        throw apiError(400, 'BAD_REQUEST');
      }

      const res = toggleFavoriteReplay(db, member.id, matchId, body.isFavorite);
      if (!res.success) {
        if (res.code === 'FAVORITE_LIMIT_REACHED') {
          throw apiError(409, 'FAVORITE_LIMIT_REACHED');
        }
        throw apiError(404, 'REPLAY_NOT_FOUND');
      }

      return { success: true, isFavorite: body.isFavorite };
    },
  );

  // 删除牌谱（不影响已发奖励和凭据，总纲 4.5）
  app.delete<{ Params: { matchId: string } }>('/api/v1/replays/:matchId', async (request) => {
    const { member } = requireSession(db, request);
    const { matchId } = request.params;

    const deleted = deleteReplay(db, member.id, matchId);
    if (!deleted) {
      throw apiError(404, 'REPLAY_NOT_FOUND');
    }
    return { success: true };
  });
}
