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
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { createRoom, listRooms } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import type { RoomSeat, RoomSettings, RoomSummary } from '../../shared/contracts/room';

export default function FamilyLobby() {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const member = household?.currentMember;
  const isMember = household?.mode === 'member-online';

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 创建房间表单状态
  const [matchLength, setMatchLength] = useState<'east' | 'south'>('east');
  const [defaultAiLevel, setDefaultAiLevel] = useState<RoomSettings['defaultAiLevel']>('standard');
  const [turnLimit, setTurnLimit] = useState(15);
  const aiLevelLabel: Record<RoomSettings['defaultAiLevel'], string> = {
    beginner: 'family.ai.beginner',
    standard: 'family.ai.standard',
    expert: 'family.ai.expert',
    strong: 'family.ai.strong',
  };

  const fetchRooms = useCallback(async () => {
    if (!isMember) {
      setRooms([]);
      setListError(null);
      return;
    }
    setLoading(true);
    try {
      const data = await listRooms();
      setRooms(data);
      setListError(null);
    } catch {
      setListError('family.lobby.listError');
    } finally {
      setLoading(false);
    }
  }, [isMember]);

  useEffect(() => {
    void fetchRooms();
    if (!isMember) return;
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [fetchRooms, isMember]);

  const handleCreateRoom = async () => {
    if (!member) return;
    setCreating(true);
    setCreateError(null);
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
      setCreateError('family.lobby.createError');
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
            <h1 className="text-2xl font-bold tracking-tight">{t('family.lobby.title')}</h1>
            {household?.isServerAvailable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('family.lobby.connected')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('family.lobby.intro')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRooms}
            disabled={loading || !isMember}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('family.lobby.refresh')}
          </Button>

          <Button
            onClick={() => { setCreateError(null); setShowCreateModal(true); }}
            disabled={!member}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold shadow"
          >
            <Plus className="h-4 w-4" />
            {t('family.lobby.createRoom')}
          </Button>
        </div>
      </div>

      {/* 访客模式提示 */}
      {!member && (
        <div className="my-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-sm">
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t('family.lobby.guestTitle')}</span>
            <span className="text-muted-foreground ml-1">
              {t('family.lobby.guestHint')}
            </span>
          </div>
        </div>
      )}

      {/* 房间列表 */}
      <div className="mt-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {formatMessage(locale, 'family.lobby.rooms', { count: rooms.length })}
        </h2>

        {listError && isMember && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p>{t(listError)}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchRooms()}>
              {t('family.lobby.retry')}
            </Button>
          </div>
        )}

        {!listError && rooms.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/50">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-base font-medium text-foreground">{t(isMember ? 'family.lobby.noRooms' : 'family.lobby.signInToSee')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t(isMember ? 'family.lobby.createHint' : 'family.lobby.chooseMember')}
            </p>
            {member && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                {t('family.lobby.firstRoom')}
              </Button>
            )}
          </div>
        ) : rooms.length > 0 ? (
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
                          {formatMessage(locale, 'family.lobby.roomBy', { name: room.hostNickname })}
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
                        {t(isPlaying ? 'family.lobby.playing' : isFinished ? 'family.lobby.finished' : 'family.lobby.waiting')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{t('family.lobby.format')}</span>
                        <span>{t(room.settings.matchLength === 'east' ? 'family.match.east' : 'family.match.south')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{t('family.lobby.timeLimit')}</span>
                        <span>{formatMessage(locale, 'family.lobby.secondsPerTurn', { seconds: room.settings.turnTimeLimitSeconds })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{t('family.lobby.players')}</span>
                        <span className="text-foreground font-semibold">{formatMessage(locale, 'family.lobby.people', { count: room.humanCount })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{t('family.lobby.aiFill')}</span>
                        <span>{t(aiLevelLabel[room.settings.defaultAiLevel])}</span>
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
                              ? `AI·${t(getCharacterById(seat.characterId).nameKey)}`
                              : t('family.lobby.emptySeat')}
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
                    {t(isPlaying ? 'family.lobby.spectateContinue' : 'family.lobby.joinRoom')}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-bold">{t('family.lobby.dialogTitle')}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {t('family.lobby.length')}
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
                    {t('family.lobby.eastQuick')}
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
                    {t('family.lobby.southStandard')}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {t('family.lobby.aiLevel')}
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
                      {t(aiLevelLabel[lvl])}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {t('family.lobby.turnLimit')}
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
                      {formatMessage(locale, 'family.lobby.seconds', { seconds: sec })}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {t(createError)}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {t('family.lobby.cancel')}
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={creating}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {t(creating ? 'family.lobby.creating' : 'family.lobby.createNow')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
