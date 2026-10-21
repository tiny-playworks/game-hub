import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Crown,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { GPT_BANNER_ASSETS } from '@/assets/gptAssets';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { createRoom, listFamilyCups, listRooms } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import type { FamilyCupSummary, RoomSeat, RoomSettings, RoomSummary } from '../../shared/contracts/room';
import { FAMILY_GAME_IDS, type FamilyGameId, type GameRoomSummary } from '../../shared/contracts/gameRoom';
import { FamilyGameRoomCard } from '@/components/household/FamilyGameRoomCard';
import { FamilyHeadToHead } from '@/components/household/FamilyHeadToHead';
import { GameRoomSettingsFields, defaultGameRoomSettings } from '@/components/household/GameRoomSettingsFields';
import { createGameRoom, listGameRooms } from '@/lib/household/gameRoomClient';
import { HouseholdApiError } from '@/lib/household/api';

export default function FamilyLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedGame = FAMILY_GAME_IDS.find((id) => id === searchParams.get('game'));
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const member = household?.currentMember;
  const isMember = household?.mode === 'member-online';

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [gameRooms, setGameRooms] = useState<GameRoomSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'riichi' | FamilyGameId>(selectedGame ?? 'all');
  const [createGame, setCreateGame] = useState<'riichi' | FamilyGameId>(selectedGame ?? 'riichi');
  const [gameSettings, setGameSettings] = useState(defaultGameRoomSettings);
  const [recentCups, setRecentCups] = useState<FamilyCupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('create') === '1');
  const visibleRooms = filter === 'all' || filter === 'riichi' ? rooms : [];
  const visibleGames = filter === 'all' ? gameRooms : gameRooms.filter((room) => room.gameId === filter);
  const roomCount = visibleRooms.length + visibleGames.length;

  // 创建房间表单状态
  const [cupTotalMatches, setCupTotalMatches] = useState<null | 2 | 3>(null);
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
      setGameRooms([]);
      setRecentCups([]);
      setListError(null);
      return;
    }
    setLoading(true);
    try {
      const [roomData, cupsData, gameData] = await Promise.all([
        listRooms(),
        listFamilyCups(5).catch(() => []),
        listGameRooms(),
      ]);
      setRooms(roomData);
      setGameRooms(gameData);
      setRecentCups(cupsData);
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
      if (createGame !== 'riichi') {
        const created = await createGameRoom(createGame, gameSettings);
        setShowCreateModal(false);
        navigate(`/family/games/${created.room.id}`);
        return;
      }
      const created = await createRoom(
        {
          matchLength,
          defaultAiLevel,
          turnTimeLimitSeconds: turnLimit,
          cupTotalMatches,
        },
        member.nickname,
        member.avatarPresetId,
      );
      setShowCreateModal(false);
      navigate(`/family/${created.id}`);
    } catch (error) {
      setCreateError(error instanceof HouseholdApiError ? error.messageKey : 'family.lobby.createError');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="venue-family lobby-page min-h-screen bg-background text-foreground pb-12 pt-6 px-4 md:px-8 max-w-6xl mx-auto">
      {/* 头部标题与操作（新和风沙龙家庭俱乐部横幅） */}
      <section className="salon-page-banner salon-page-banner--family">
        {GPT_BANNER_ASSETS.family && (
          <img
            src={GPT_BANNER_ASSETS.family}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="salon-banner-media"
          />
        )}
        <div className="salon-banner-inner flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <p className="play-eyebrow">FAMILY SALON · 家庭茶席与雀庄杯</p>
            <div className="flex flex-wrap items-center gap-2.5 mt-1">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f5f2e9]">
                {t('gameRoom.title')}
              </h1>
              {household?.isServerAvailable && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />{' '}
                  {t('family.lobby.connected')}
                </span>
              )}
            </div>
            <p className="text-sm text-[#e8e3d5] mt-2 max-w-2xl leading-6">
              {t('gameRoom.intro')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRooms}
              disabled={loading || !isMember}
              className="salon-banner-outline-btn flex items-center gap-1.5 min-h-10"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              {t('family.lobby.refresh')}
            </Button>

            <Button
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              disabled={!isMember}
              className="salon-banner-primary-btn flex items-center gap-1.5 min-h-10 font-semibold shadow"
            >
              <Plus className="h-4 w-4" />
              {t('family.lobby.createRoom')}
            </Button>
          </div>
        </div>
      </section>

      {/* 访客模式提示 */}
      {!member && (
        <div className="salon-guest-notice my-6 p-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 flex items-center justify-between text-sm">
          <div>
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t('family.lobby.guestTitle')}
            </span>
            <span className="text-muted-foreground ml-1.5">
              {t('family.lobby.guestHint')}
            </span>
          </div>
        </div>
      )}

      {/* 房间列表 */}
      <div className="mt-6">
        <div
          className="salon-filter-bar mb-5 flex flex-wrap gap-2"
          aria-label={t('gameRoom.game')}
        >
          {(['all', 'riichi', ...FAMILY_GAME_IDS] as const).map((game) => (
            <Button
              key={game}
              variant={filter === game ? 'default' : 'outline'}
              className="min-h-11 rounded-xl"
              onClick={() => {
                setFilter(game);
                if (game !== 'all') setCreateGame(game);
              }}
            >
              {t(
                game === 'all'
                  ? 'gameRoom.all'
                  : game === 'riichi'
                    ? 'gameRoom.riichi'
                    : `game.${game}.name`,
              )}
            </Button>
          ))}
        </div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-serif">
          <Users className="h-4 w-4 text-primary" />
          {formatMessage(locale, 'family.lobby.rooms', { count: roomCount })}
        </h2>

        {listError && isMember && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p>{t(listError)}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchRooms()}>
              {t('family.lobby.retry')}
            </Button>
          </div>
        )}

        {!listError && roomCount === 0 ? (
          <div className="salon-empty-card paper-texture text-center py-16 border border-dashed border-gold/40 rounded-2xl bg-card/70">
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
        ) : roomCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleGames.map((room) => <FamilyGameRoomCard key={room.id} room={room} />)}
            {visibleRooms.map((room) => {
              const isPlaying = room.status === 'playing';
              const isFinished = room.status === 'finished';

              return (
                <div
                  key={room.id}
                  className="salon-room-card paper-texture rounded-2xl border border-gold/30 bg-card p-5 hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          {formatMessage(locale, 'family.lobby.roomBy', { name: room.hostNickname })}
                        </span>
                        <Crown className="h-4 w-4 text-amber-500" />
                        {room.cup && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Trophy className="h-3 w-3" />
                            {formatMessage(locale, 'family.cup.cupBadge', {
                              current: room.cup.completedMatches + (isFinished ? 0 : 1),
                              total: room.cup.totalMatches,
                            })}
                          </span>
                        )}
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

      <FamilyHeadToHead />

      {/* 近期杯赛记录 */}
      {isMember && recentCups.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            {formatMessage(locale, 'family.cup.recentCups', { count: recentCups.length })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentCups.map((cup) => {
              const champion = cup.standings[0];
              return (
                <div
                  key={cup.cupId}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {t(cup.totalMatches === 2 ? 'family.cup.modeCup2' : 'family.cup.modeCup3')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t(cup.matchLength === 'east' ? 'family.match.east' : 'family.match.south')}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(cup.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                    </span>
                  </div>

                  {champion && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                      <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>{formatMessage(locale, 'family.cup.champion', { name: champion.nickname })}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    {cup.standings.map((st) => (
                      <div key={st.memberId} className="flex items-center justify-between py-0.5 border-b border-border/40 last:border-none">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-muted-foreground">#{st.rank}</span>
                          <span className="font-medium">{st.nickname}</span>
                        </span>
                        <span className="font-mono">
                          <strong className="text-primary">{st.totalCupPoints}</strong> {t('family.cup.points')}
                          <span className="text-muted-foreground ml-2">({st.totalMatchScore} pts)</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {cup.matches.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/replays?source=family')}
                        className="text-xs h-7 px-2"
                      >
                        {t('family.cup.matchesHistory')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label={t('family.lobby.dialogTitle')} className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-bold">{t('family.lobby.dialogTitle')}</h3>

            <div className="space-y-4">
              <label className="block text-sm">{t('gameRoom.game')}
                <select value={createGame} onChange={(event) => setCreateGame(event.target.value as typeof createGame)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">
                  {(['riichi', ...FAMILY_GAME_IDS] as const).map((game) => <option key={game} value={game}>{t(game === 'riichi' ? 'gameRoom.riichi' : `game.${game}.name`)}</option>)}
                </select>
              </label>
              {createGame !== 'riichi' ? <GameRoomSettingsFields gameId={createGame} value={gameSettings} onChange={setGameSettings} /> : <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {t('family.cup.modeLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCupTotalMatches(null)}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                      cupTotalMatches === null
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {t('family.cup.modeSingle')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCupTotalMatches(2)}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                      cupTotalMatches === 2
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {t('family.cup.modeCup2')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCupTotalMatches(3)}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                      cupTotalMatches === 3
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {t('family.cup.modeCup3')}
                  </button>
                </div>
                {cupTotalMatches !== null && (
                  <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 leading-normal">
                    {t('family.cup.modeHint')}
                  </p>
                )}
              </div>

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
              </>}
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
