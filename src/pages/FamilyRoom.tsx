import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Crown,
  Play,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { ConnectionNotice } from '@/components/household/ConnectionNotice';
import { useLocale } from '@/contexts/LocaleContext';
import { useRoomClient } from '@/lib/household/roomClient';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import { MeldTiles } from '@/pages/mahjong/japanese/components/MeldTiles';
import { RiichiTile, TileBack } from '@/pages/mahjong/japanese/components/Tile';
import {
  usePlayerSeatView,
} from '@/pages/mahjong/japanese/usePlayerSeatView';
import type { PlayerSeatPrivateState, RoomSeat } from '../../shared/contracts/room';

const AI_CANDIDATES = [
  { id: 'aoi', name: '葵' },
  { id: 'mio', name: '澪' },
  { id: 'rin', name: '凛' },
  { id: 'sora', name: '空' },
  { id: 'koharu', name: '小春' },
  { id: 'chitose', name: '千岁' },
  { id: 'kuro', name: '黑' },
  { id: 'shiro', name: '白' },
];

export default function FamilyRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const currentMember = household?.currentMember;
  const seatName = (identity: PlayerSeatPrivateState['identity']) =>
    identity.type === 'ai' && identity.characterId
      ? t(getCharacterById(identity.characterId).nameKey)
      : identity.name;
  const windName = (seat: number) =>
    t(`family.room.wind.${['east', 'south', 'west', 'north'][seat]}`);

  const {
    room,
    view,
    connected,
    leaseLost,
    error,
    mySeatIndex,
    isHost,
    joinSeat,
    leaveSeat,
    fillAi,
    removeAi,
    setReady,
    startGame,
    discardTile,
    declareRiichi,
    declareTsumo,
    declareRon,
    passClaim,
    declareClaim,
    nextRound,
    takeoverControl,
    toggleAutoplay,
    resumeGame,
  } = useRoomClient(roomId, currentMember?.id);

  const { selfSeat, rightSeat, topSeat, leftSeat } = usePlayerSeatView(view);
  const isSpectator = view?.isSpectator === true;

  // 倒计时剩余秒数状态
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!view?.serverDeadline) {
      setSecondsRemaining(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((view.serverDeadline! - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [view?.serverDeadline]);

  // 如果房间不存在或加载中
  if (!room) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground text-sm">{t('family.room.connecting')}</p>
        {error && <p className="text-destructive text-xs mt-2">{error}</p>}
      </div>
    );
  }

  const isFinished = room.status === 'finished';

  // 1. 等待就绪界面
  if (room.status === 'waiting') {
    const mySeat = mySeatIndex !== -1 ? room.seats[mySeatIndex] : null;
    const isMySeatReady = mySeat?.type === 'human' && mySeat.isReady;
    const allHumansReady = room.seats.every(
      (s) => s.type !== 'human' || s.isReady,
    );

    return (
      <div className="min-h-screen bg-background text-foreground pb-12 pt-6 px-4 md:px-8 max-w-4xl mx-auto space-y-6">
        {/* 顶部房间信息栏 */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/family')}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('family.room.back')}
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">
                  {formatMessage(locale, 'family.room.roomBy', { name: room.hostNickname })}
                </h1>
                {connected ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                    <Wifi className="h-3.5 w-3.5" /> {t('family.room.online')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                    <WifiOff className="h-3.5 w-3.5" /> {t('family.room.connectingShort')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('family.room.roomNumber')} <span className="font-mono">{room.id.slice(0, 8)}</span>{' '}
                · {t(room.settings.matchLength === 'east' ? 'family.match.east' : 'family.match.south')} ·{' '}
                {formatMessage(locale, 'family.room.limit', { seconds: room.settings.turnTimeLimitSeconds })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mySeatIndex !== -1 && (
              <Button
                variant={isMySeatReady ? 'outline' : 'default'}
                onClick={() => setReady(!isMySeatReady)}
                className="font-semibold"
              >
                {t(isMySeatReady ? 'family.room.unready' : 'family.room.ready')}
              </Button>
            )}

            {isHost && (
              <Button
                onClick={startGame}
                disabled={!allHumansReady || room.humanCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
              >
                <Play className="h-4 w-4" />
                {t('family.room.start')}
              </Button>
            )}
          </div>
        </div>

        <ConnectionNotice
          connected={connected}
          isAutoplay={false}
          leaseLost={leaseLost}
          isPaused={room.isPaused}
          onTakeover={takeoverControl}
          onResumeGame={resumeGame}
        />

        {/* 4 个席位布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {room.seats.map((seat: RoomSeat, index: number) => {
            const wind = windName(index);
            const isMe = mySeatIndex === index;

            return (
              <div
                key={index}
                className={`p-5 rounded-2xl border transition-all ${
                  isMe
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {formatMessage(locale, 'family.room.seatNumber', { wind, number: index + 1 })}
                  </span>
                  {seat.type === 'human' && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        seat.isReady
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {t(seat.isReady ? 'family.room.readyStatus' : 'family.room.waitingStatus')}
                    </span>
                  )}
                </div>

                {seat.type === 'human' ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                        {seat.nickname.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">
                            {seat.nickname}
                          </span>
                          {room.hostMemberId === seat.memberId && (
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                              {t('family.room.you')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t('family.room.human')}
                        </span>
                      </div>
                    </div>

                    {isMe && (
                      <Button variant="ghost" size="sm" onClick={leaveSeat}>
                        {t('family.room.leave')}
                      </Button>
                    )}
                  </div>
                ) : seat.type === 'ai' ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm block">
                          AI·{t(getCharacterById(seat.characterId).nameKey)}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {formatMessage(locale, 'family.room.difficulty', { level: t(`family.ai.${seat.aiLevel}`) })}
                        </span>
                      </div>
                    </div>

                    {isHost && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAi(index)}
                      >
                        {t('family.room.remove')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground/70">
                      {t('family.room.empty')}
                    </span>
                    <div className="flex items-center gap-2">
                      {mySeatIndex === -1 && currentMember && (
                        <Button
                          size="sm"
                          onClick={() =>
                            joinSeat(
                              index,
                              currentMember.nickname,
                              currentMember.avatarPresetId,
                            )
                          }
                        >
                          {t('family.room.sit')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const candidate =
                            AI_CANDIDATES[index % AI_CANDIDATES.length].id;
                          fillAi(
                            index,
                            candidate,
                            room.settings.defaultAiLevel,
                          );
                        }}
                      >
                        {t('family.room.addAi')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 提示栏 */}
        <div className="p-4 rounded-xl border border-border bg-card/40 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>
              {formatMessage(locale, 'family.room.seatHint', { humans: room.humanCount, empty: 4 - room.playerCount })}
            </span>
          </div>
          {room.humanCount >= 2 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {t('family.room.coinRule')}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. 对局中 / 终局结算界面
  const round = view?.round;
  const isMyTurn = !isSpectator && (selfSeat?.isCurrentTurn ?? false);
  const turnOptions = selfSeat?.seat.turnOptions;
  const claimOptions = selfSeat?.seat.claimOptions;
  const canDiscard =
    isMyTurn && turnOptions !== null && round?.phase === 'discard';

  return (
    <div className="min-h-[calc(100dvh-6.25rem)] md:min-h-[calc(100dvh-4rem)] bg-[#0d1811] text-[#e8f2ea] flex flex-col justify-between p-2 md:p-6 select-none overflow-x-hidden">
      {/* 顶部状态与倒计时 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 md:px-3 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/family')}
            className="text-white/80 hover:text-white h-7 px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            {t('family.room.back')}
          </Button>
          <span className="font-semibold text-emerald-400">
            {formatMessage(locale, 'family.room.round', {
              wind: windName(round?.roundWind ?? 0),
              number: round?.roundNumber ?? 1,
            })}
          </span>
          {isSpectator && (
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/75">
              {t('family.room.spectating')}
            </span>
          )}
          <span className="hidden sm:inline text-white/60">{formatMessage(locale, 'family.room.honba', { count: round?.honba ?? 0 })}</span>
          <span className="hidden sm:inline text-amber-300">
            {formatMessage(locale, 'family.room.riichiPot', { points: (round?.riichiPot ?? 0) * 1000 })}
          </span>
          <span className="text-white/60">
            {formatMessage(locale, 'family.room.wall', { count: round?.wallRemaining ?? 0 })}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* 宝牌指示牌 */}
          <div className="flex items-center gap-1">
            <span className="text-white/60 mr-1">{t('family.room.dora')}</span>
            {round?.doraIndicators.map((dora, i) => (
              <div key={i} className="scale-75 origin-left inline-block">
                <RiichiTile tile={dora} variant="indicator" />
              </div>
            ))}
          </div>

          {/* 思考限时倒计时 */}
          {secondsRemaining !== null && (
            <div
              className={`flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded ${
                secondsRemaining <= 5
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'bg-white/10 text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {secondsRemaining}s
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto mt-2">
        <ConnectionNotice
          connected={connected}
          isAutoplay={selfSeat?.seat.isAutoplay}
          leaseLost={leaseLost}
          isPaused={room.isPaused}
          onTakeover={takeoverControl}
          onCancelAutoplay={() => toggleAutoplay(false)}
          onResumeGame={resumeGame}
        />
      </div>

      {/* 牌桌核心对战场区 */}
      <div className="relative flex-1 my-2 md:my-4 flex flex-col justify-between max-w-4xl w-full mx-auto">
        {/* 对家 (上方) */}
        {topSeat && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-xs">
              <span className="text-amber-400 font-bold">
                {windName(topSeat.absSeat)}
              </span>
              <span className="font-medium">{seatName(topSeat.seat.identity)}</span>
              <span className="text-white/60 font-mono">
                {formatMessage(locale, 'family.room.points', { points: topSeat.seat.score })}
              </span>
              {topSeat.seat.isRiichi && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                  {t('family.room.riichi')}
                </span>
              )}
            </div>

            {/* 对家手牌 (暗牌背，隐私隔离) */}
            <div className="family-room-opponent-hand flex items-center gap-0.5 justify-center">
              {Array.from({ length: topSeat.seat.tileCount }).map((_, i) => (
                <TileBack
                  key={i}
                  className="scale-75 origin-center"
                  rotation={180}
                />
              ))}
            </div>

            {/* 对家牌河与副露 */}
            <div className="flex items-center gap-1 mt-1">
              <div className="flex flex-wrap gap-0.5 max-w-70 justify-center">
                {topSeat.seat.discards.map((tile, i) => (
                  <div key={i} className="scale-75 origin-center inline-block">
                    <RiichiTile tile={tile} variant="river" />
                  </div>
                ))}
              </div>
              {topSeat.seat.melds.map((meld, i) => (
                <div key={i} className="scale-75 inline-block">
                  <MeldTiles meld={meld} seat={topSeat.absSeat} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 左右两侧对手 */}
        <div className="flex items-center justify-between w-full px-2 my-auto">
          {/* 上家 (左侧) */}
          {leftSeat && (
            <div className="flex flex-col items-start gap-1 max-w-50">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-xs">
                <span className="text-amber-400 font-bold">
                  {windName(leftSeat.absSeat)}
                </span>
                <span className="font-medium truncate max-w-17.5">
                  {seatName(leftSeat.seat.identity)}
                </span>
                <span className="text-white/60 font-mono">
                  {leftSeat.seat.score}
                </span>
              </div>
              <div className="flex flex-wrap gap-0.5 max-w-35">
                {leftSeat.seat.discards.slice(-8).map((tile, i) => (
                  <div key={i} className="scale-65 origin-left inline-block">
                    <RiichiTile tile={tile} variant="river" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 牌桌中央：轮次指示 */}
          <div className="text-center p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur space-y-1">
            <span className="text-xs text-white/50 block">{t('family.room.currentTurn')}</span>
            <span className="text-sm font-bold text-emerald-400">
              {isMyTurn
                ? t('family.room.yourTurn')
                : formatMessage(locale, 'family.room.waitForSeat', { number: (view?.round.currentPlayer ?? 0) + 1 })}
            </span>
          </div>

          {/* 下家 (右侧) */}
          {rightSeat && (
            <div className="flex flex-col items-end gap-1 max-w-50">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-xs">
                <span className="text-amber-400 font-bold">
                  {windName(rightSeat.absSeat)}
                </span>
                <span className="font-medium truncate max-w-17.5">
                  {seatName(rightSeat.seat.identity)}
                </span>
                <span className="text-white/60 font-mono">
                  {rightSeat.seat.score}
                </span>
              </div>
              <div className="flex flex-wrap gap-0.5 max-w-35 justify-end">
                {rightSeat.seat.discards.slice(-8).map((tile, i) => (
                  <div key={i} className="scale-65 origin-right inline-block">
                    <RiichiTile tile={tile} variant="river" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 自家 (下方本人视角) */}
        {selfSeat && (
          <div className="flex flex-col items-center gap-2 mt-auto">
            {/* 牌河与副露 */}
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-0.5 max-w-[320px] justify-center bg-black/20 p-1.5 rounded-xl border border-white/5">
                {selfSeat.seat.discards.map((tile, i) => (
                  <div key={i} className="scale-85 origin-center inline-block">
                    <RiichiTile tile={tile} variant="river" />
                  </div>
                ))}
              </div>

              {selfSeat.seat.melds.map((meld, i) => (
                <div key={i} className="scale-85 inline-block">
                  <MeldTiles meld={meld} seat={selfSeat.absSeat} />
                </div>
              ))}
            </div>

            {/* 本人信息栏与动作按纽栏 */}
            <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-2xl px-3 py-1.5 rounded-xl bg-black/60 border border-white/10">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 font-bold text-sm">
                  {windName(selfSeat.absSeat)} {t(isSpectator ? 'family.room.spectatorView' : 'family.room.selfView')}
                </span>
                <span className="font-semibold">
                  {seatName(selfSeat.seat.identity)}
                </span>
                <span className="font-mono text-emerald-400 text-sm">
                  {formatMessage(locale, 'family.room.points', { points: selfSeat.seat.score })}
                </span>
                {selfSeat.seat.isRiichi && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                    {t('family.room.riichi')}
                  </span>
                )}
              </div>

              {/* 动作按钮：自摸 / 立直 / 荣 / 吃 / 碰 / 杠 / 过 */}
              <div className="flex items-center gap-1.5">
                {turnOptions?.tsumo && (
                  <Button
                    size="sm"
                    onClick={declareTsumo}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 px-3 text-xs"
                  >
                    {t('family.room.tsumo')}
                  </Button>
                )}
                {turnOptions &&
                  turnOptions.riichiDiscards.length > 0 &&
                  !selfSeat.seat.isRiichi && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const firstDiscard = turnOptions.riichiDiscards[0];
                        if (firstDiscard !== undefined)
                          declareRiichi(firstDiscard);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-7 px-3 text-xs"
                    >
                      {t('family.room.riichi')}
                    </Button>
                  )}
                {claimOptions?.ron && (
                  <Button
                    size="sm"
                    onClick={declareRon}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-7 px-3 text-xs animate-bounce"
                  >
                    {t('family.room.ron')}
                  </Button>
                )}
                {claimOptions?.pon && (
                  <Button
                    size="sm"
                    onClick={() => declareClaim('pon')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-7 px-2.5 text-xs"
                  >
                    {t('family.room.pon')}
                  </Button>
                )}
                {claimOptions?.minkan && (
                  <Button
                    size="sm"
                    onClick={() => declareClaim('minkan')}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-7 px-2.5 text-xs"
                  >
                    {t('family.room.kan')}
                  </Button>
                )}
                {claimOptions?.chi && claimOptions.chi.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => declareClaim('chi', claimOptions.chi[0])}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2.5 text-xs"
                  >
                    {t('family.room.chi')}
                  </Button>
                )}
                {claimOptions && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={passClaim}
                    className="h-7 px-2.5 text-xs border-white/20 text-white/80 hover:text-white"
                  >
                    {t('family.room.pass')}
                  </Button>
                )}
              </div>
            </div>

            {/* 观战时仅显示牌背，不发送任何暗手牌 */}
            <div className="family-room-hand flex items-center gap-0.5 md:gap-1 justify-center py-2 px-2 md:px-3 rounded-2xl bg-black/40 border border-white/10 shadow-lg">
              {isSpectator ? Array.from({ length: selfSeat.seat.tileCount }).map((_, i) => (
                <TileBack key={i} className="scale-75 origin-center" />
              )) : selfSeat.seat.hand.map((tile, i) => {
                const isDiscardable = Boolean(
                  canDiscard && turnOptions?.discardable.includes(tile),
                );
                return (
                  <div
                    key={`${tile}-${i}`}
                    className={`transition-transform duration-100 ${
                      isDiscardable
                        ? 'hover:-translate-y-2 cursor-pointer'
                        : 'opacity-90'
                    }`}
                  >
                    <RiichiTile
                      tile={tile}
                      variant="hand"
                      onClick={
                        isDiscardable ? () => discardTile(tile) : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 局结算或终局结算弹窗 */}
      {view?.result && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#142319] border border-white/20 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-center text-emerald-400">
              {t(isFinished ? 'family.room.finalResult' : 'family.room.roundResult')}
            </h3>

            {view.result.type === 'win' ? (
              <div className="space-y-3">
                {view.result.wins.map((win, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="text-center">
                      <span className="text-sm text-white/70">{t('family.room.winningSeat')}</span>
                      <span className="text-lg font-bold text-amber-400 ml-2">
                        {formatMessage(locale, 'family.room.windSeat', { wind: windName(win.winner) })} (
                        {view.seats[win.winner] ? seatName(view.seats[win.winner].identity) : ''})
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                      {win.yaku.map((y, yIdx) => (
                        <div
                          key={yIdx}
                          className="flex justify-between text-xs"
                        >
                          <span>{y.name}</span>
                          <span className="font-mono text-emerald-400">
                            {formatMessage(locale, 'family.room.han', { count: y.han })}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-sm">
                        <span>{t('family.room.score')}</span>
                        <span className="font-mono text-amber-300">
                          {formatMessage(locale, 'family.room.points', { points: win.ten })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="text-base text-white/80 font-semibold">
                  {t('family.room.draw')} (
                  {t(view.result.reason === 'exhaustive'
                    ? 'family.room.exhaustive'
                    : 'family.room.abortive')}
                  )
                </span>
              </div>
            )}

            {/* 终局家庭雀币提示 */}
            {isFinished && room.humanCount >= 2 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
                {t('family.room.coinAward')}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              {isFinished ? (
                <Button
                  onClick={() => navigate('/family')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {t('family.room.return')}
                </Button>
              ) : isSpectator ? (
                <p className="w-full text-center text-sm text-white/70">{t('family.room.waitNext')}</p>
              ) : (
                <Button
                  onClick={nextRound}
                  className="w-full bg-primary text-primary-foreground font-semibold"
                >
                  {t('family.room.next')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
