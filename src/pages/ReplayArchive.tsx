import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { getCharacterById } from '@/lib/playerCharacters';
import type { ReplayArchiveSummary, ReplaySource } from '../../shared/contracts/replay';
import {
  fetchReplayDetail,
  fetchReplayList,
  removeReplay,
  setReplayFavorite,
} from '@/lib/riichiReplayArchive';
import { TrainingSummary } from '@/components/profile/TrainingSummary';
import { MatchReviewDialog } from '@/pages/mahjong/japanese/components/MatchReview';
import { ReplayViewer } from '@/pages/mahjong/japanese/components/ReplayViewer';
import type { RiichiReplayFile } from '@/pages/mahjong/japanese/engine/match';
import { formatPoints } from '@/pages/mahjong/japanese/helpers';
import { buildMatchReview, type MatchReview } from '@/lib/riichiMatchReview';

export default function ReplayArchive() {
  const { t, locale } = useLocale();
  const { mode } = useHousehold();
  const isMember = mode === 'member-online';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [replays, setReplays] = useState<ReplayArchiveSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  // 筛选状态
  const [sourceFilter, setSourceFilter] = useState<'all' | ReplaySource>('all');
  const [rankingFilter, setRankingFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  // 交互弹窗状态
  const [reviewTarget, setReviewTarget] = useState<{ file: RiichiReplayFile; viewerSeat: number } | null>(null);
  const [replayTarget, setReplayTarget] = useState<{ file: RiichiReplayFile; review: MatchReview } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchReplayList(
        {
          source: sourceFilter,
          ranking: rankingFilter,
          favoriteOnly,
          limit: 100,
        },
        isMember,
      );
      setReplays(res.items);
      setTotal(res.total);
      setFavoritesCount(res.favoritesCount);
    } catch {
      // ignore load error
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, rankingFilter, favoriteOnly, isMember]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleFavorite = async (matchId: string, current: boolean) => {
    setFavoriteError(null);
    const res = await setReplayFavorite(matchId, !current, isMember);
    if (!res.success) {
      if (res.error === 'FAVORITE_LIMIT_REACHED') {
        setFavoriteError(t('riichi.archive.favoriteLimit'));
      }
      return;
    }
    void loadData();
  };

  const handleDelete = async (matchId: string) => {
    await removeReplay(matchId, isMember);
    setDeleteConfirmId(null);
    void loadData();
  };

  const handleOpenReview = async (matchId: string, viewerSeat: number) => {
    const detail = await fetchReplayDetail(matchId, isMember);
    if (detail) {
      setReviewTarget({ file: detail.file, viewerSeat });
    }
  };

  const handleOpenReplay = async (matchId: string, viewerSeat: number) => {
    const detail = await fetchReplayDetail(matchId, isMember);
    if (detail) {
      const review = await buildMatchReview(detail.file, { viewerSeat });
      setReplayTarget({ file: detail.file, review });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const placementBadgeColor = (ranking: number) => {
    switch (ranking) {
      case 1:
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 2:
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 3:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
      default:
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="container max-w-5xl py-8 px-4 space-y-6">
      {/* 顶部标题与返回 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('riichi.archive.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('riichi.archive.eyebrow')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {replays.length} / {total} 场
          </span>
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            已收藏 {favoritesCount}/100
          </span>
        </div>
      </div>

      {favoriteError && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400">
          {favoriteError}
        </div>
      )}

      {/* 薄弱点分析组件 */}
      <TrainingSummary />

      {/* 筛选工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-card/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* 来源筛选 */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
            {(['all', 'free', 'ai-ranked', 'family'] as const).map((source) => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sourceFilter === source
                    ? 'bg-background shadow-xs font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`riichi.archive.source.${source}`)}
              </button>
            ))}
          </div>

          {/* 顺位筛选 */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
            {(['all', 1, 2, 3, 4] as const).map((rk) => (
              <button
                key={String(rk)}
                onClick={() => setRankingFilter(rk)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  rankingFilter === rk
                    ? 'bg-background shadow-xs font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`riichi.archive.ranking.${rk}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 仅看收藏 */}
        <Button
          variant={favoriteOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className="text-xs gap-1.5"
        >
          <Star className={`h-3.5 w-3.5 ${favoriteOnly ? 'fill-current' : ''}`} />
          {t('riichi.archive.filter.favoriteOnly')}
        </Button>
      </div>

      {/* 牌谱列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
          {t('riichi.review.computing')}
        </div>
      ) : replays.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
            <h3 className="text-base font-semibold">{t('riichi.archive.empty')}</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {t('riichi.archive.emptyDesc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {replays.map((item) => {
            const char = getCharacterById(item.playerCharacterId);
            return (
              <Card key={item.matchId} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* 左侧信息 */}
                  <div className="flex items-center gap-3.5">
                    {/* 角色头像 */}
                    <img
                      src={char.avatar}
                      alt={char.name}
                      className="h-12 w-12 rounded-xl object-cover border bg-muted shrink-0"
                    />

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${placementBadgeColor(item.ranking)}`}
                        >
                          {t(`riichi.archive.ranking.${item.ranking}`)}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatPoints(item.finalScore)} 点
                        </span>
                        <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {t(`riichi.archive.source.${item.source}`)}
                        </span>
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {item.matchLength === 'south' ? '半庄' : '东风'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.createdAt)}
                        </span>
                        <span>·</span>
                        <span>座位: {t(`game.mahjong.seats.${item.viewerSeat}`)}</span>
                        {item.roundsCount && (
                          <>
                            <span>·</span>
                            <span>{item.roundsCount} 局</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧动作按键 */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    {/* 收藏 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-500"
                      onClick={() => handleToggleFavorite(item.matchId, item.isFavorite)}
                    >
                      <Star
                        className={`h-4 w-4 ${item.isFavorite ? 'fill-amber-500' : ''}`}
                      />
                    </Button>

                    {/* 复盘 */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenReview(item.matchId, item.viewerSeat)}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5 text-primary" />
                      {t('riichi.archive.review')}
                    </Button>

                    {/* 回放 */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenReplay(item.matchId, item.viewerSeat)}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" />
                      {t('riichi.archive.replay')}
                    </Button>

                    {/* 错题训练 */}
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs"
                      asChild
                    >
                      <Link to={`/replays/training?matchId=${item.matchId}`}>
                        <BookOpen className="mr-1 h-3.5 w-3.5" />
                        {t('riichi.archive.train')}
                      </Link>
                    </Button>

                    {/* 删除 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                      onClick={() => setDeleteConfirmId(item.matchId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 复盘弹窗 */}
      {reviewTarget && (
        <MatchReviewDialog
          file={reviewTarget.file}
          viewerSeat={reviewTarget.viewerSeat}
          onClose={() => setReviewTarget(null)}
        />
      )}

      {/* 回放弹窗 */}
      {replayTarget && (
        <ReplayViewer
          file={replayTarget.file}
          frames={replayTarget.review.frames}
          initialIndex={0}
          onClose={() => setReplayTarget(null)}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <Dialog open onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('riichi.archive.delete')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              {t('riichi.archive.deleteConfirm')}
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(deleteConfirmId)}
              >
                {t('riichi.archive.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
