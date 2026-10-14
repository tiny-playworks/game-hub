import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { createRoom, listRooms } from '@/lib/household/api';
import type { RoomSeat, RoomSettings, RoomSummary } from '../../shared/contracts/room';

export default function FamilyLobby() {
  const navigate = useNavigate();
  const household = useOptionalHousehold();
  const member = household?.currentMember;

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 创建房间表单状态
  const [matchLength, setMatchLength] = useState<'east' | 'south'>('east');
  const [defaultAiLevel, setDefaultAiLevel] = useState<RoomSettings['defaultAiLevel']>('standard');
  const [turnLimit, setTurnLimit] = useState(15);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRooms();
      setRooms(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    if (!member) return;
    setCreating(true);
    try {
      const created = await createRoom(
        {
          matchLength,
          defaultAiLevel,
          turnTimeLimitSeconds: turnLimit,
        },
        member.nickname,
        member.avatarPresetId,
      );
      setShowCreateModal(false);
      navigate(`/family/${created.id}`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12 pt-6 px-4 md:px-8 max-w-5xl mx-auto">
      {/* 头部标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">家庭真人牌桌</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> 局域网纯净同步
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            支持 2~4 名家庭成员同桌竞技，空位自动由家庭 AI 补齐。暗手牌隐私隔离，两真人完赛发放家庭雀币。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRooms}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新牌桌
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            disabled={!member}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold shadow"
          >
            <Plus className="h-4 w-4" />
            创建对局桌
          </Button>
        </div>
      </div>

      {/* 访客模式提示 */}
      {!member && (
        <div className="my-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-sm">
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-400">当前处于访客模式：</span>
            <span className="text-muted-foreground ml-1">
              真人对局与家庭结算需登录家庭成员账号，请先在右上角选择或创建成员。
            </span>
          </div>
        </div>
      )}

      {/* 房间列表 */}
      <div className="mt-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          活跃房间列表 ({rooms.length})
        </h2>

        {rooms.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/50">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-base font-medium text-foreground">当前暂无活跃牌桌</p>
            <p className="text-sm text-muted-foreground mt-1">
              点击上方“创建对局桌”即可成为房主，邀请家庭设备加入！
            </p>
            {member && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                创建第一个房间
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => {
              const isPlaying = room.status === 'playing';
              const isFinished = room.status === 'finished';

              return (
                <div
                  key={room.id}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          {room.hostNickname} 的牌桌
                        </span>
                        <Crown className="h-4 w-4 text-amber-500" />
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          isPlaying
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : isFinished
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isPlaying ? '对局中' : isFinished ? '已结算' : '等待就绪'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">赛制:</span>
                        <span>{room.settings.matchLength === 'east' ? '东风战' : '半庄战'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">限时:</span>
                        <span>{room.settings.turnTimeLimitSeconds} 秒/手</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">真人:</span>
                        <span className="text-foreground font-semibold">{room.humanCount} 人</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">AI 补位:</span>
                        <span>{room.settings.defaultAiLevel}</span>
                      </div>
                    </div>

                    {/* 座位预览条 */}
                    <div className="flex items-center gap-1.5 mb-4">
                      {room.seats.map((seat: RoomSeat, idx: number) => (
                        <div
                          key={idx}
                          className={`flex-1 py-1 px-1.5 rounded text-center text-xs truncate ${
                            seat.type === 'human'
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                              : seat.type === 'ai'
                                ? 'bg-muted text-muted-foreground'
                                : 'border border-dashed border-border text-muted-foreground/60'
                          }`}
                        >
                          {seat.type === 'human'
                            ? seat.nickname
                            : seat.type === 'ai'
                              ? `AI·${seat.characterId}`
                              : '空席'}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate(`/family/${room.id}`)}
                    className="w-full flex items-center justify-center gap-1.5 font-medium"
                    variant={isPlaying ? 'secondary' : 'default'}
                  >
                    <Play className="h-4 w-4" />
                    {isPlaying ? '观战 / 续玩' : '加入房间'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-bold">创建家庭对局房间</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  赛制局长
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchLength('east')}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                      matchLength === 'east'
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    东风战（快速局）
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchLength('south')}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                      matchLength === 'south'
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    半庄战（标准局）
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  空位 AI 难度
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['beginner', 'standard', 'expert', 'strong'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDefaultAiLevel(lvl)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                        defaultAiLevel === lvl
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {lvl === 'beginner'
                        ? '新手'
                        : lvl === 'standard'
                          ? '标准'
                          : lvl === 'expert'
                            ? '进阶'
                            : '强力'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  每手思考限时
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTurnLimit(sec)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        turnLimit === sec
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {sec} 秒
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                取消
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={creating}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {creating ? '创建中…' : '立即创建'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
