import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FamilyChessBoard } from '@/components/household/FamilyChessBoard';
import { FamilyDoudizhuTable } from '@/components/household/FamilyDoudizhuTable';
import { FamilyHeadToHead } from '@/components/household/FamilyHeadToHead';
import { GameRoomSettingsFields } from '@/components/household/GameRoomSettingsFields';
import { Button } from '@/components/ui/button';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useGameRoom } from '@/hooks/useGameRoom';
import { watchGameRoom } from '@/lib/household/gameRoomClient';
import { formatMessage } from '@/lib/i18n';
import { getAvatarPresetById } from '@/lib/playerProfile';

const timeLabel = (milliseconds: number) =>
  `${Math.floor(Math.max(0, milliseconds) / 60_000)}:${String(Math.floor(Math.max(0, milliseconds) / 1000) % 60).padStart(2, '0')}`;

export default function FamilyGameRoom() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const household = useOptionalHousehold();
  const { t, locale } = useLocale();
  const memberId =
    household?.mode === 'member-online'
      ? household.currentMember?.id
      : undefined;
  const { view, connected, pending, error, send, update } = useGameRoom(
    roomId,
    memberId,
  );
  const [now, setNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [confirm, setConfirm] = useState<'resign' | 'leave' | null>(null);
  const [watchError, setWatchError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (view) setServerOffset(view.serverNow - Date.now());
  }, [view?.serverNow]);
  const matchId = view?.room.result?.matchId;
  useEffect(() => {
    if (matchId) void household?.refreshMe().catch(() => {});
  }, [matchId, household?.refreshMe]);
  const back = (
    <Link
      to="/family"
      className="inline-flex min-h-11 items-center text-sm text-primary"
    >
      ← {t('gameRoom.back')}
    </Link>
  );
  if (!memberId)
    return (
      <main className="mx-auto max-w-4xl p-5">
        {back}
        <p className="mt-5">{t('family.lobby.guestHint')}</p>
      </main>
    );
  if (!view)
    return (
      <main className="mx-auto max-w-4xl p-5">
        {back}
        <p role="status" className="mt-5">
          {t(error ? 'gameRoom.notFound' : 'gameRoom.connecting')}
        </p>
      </main>
    );
  const { room, board, viewerSeat } = view;
  const mine = viewerSeat === null ? null : room.seats[viewerSeat];
  const isHost = room.hostMemberId === memberId;
  const disabled = pending || !connected || !view.hasControl;
  const chess = room.gameId !== 'doudizhu';
  const serverNow = now + serverOffset;
  const currentSeat = board?.currentSeat;
  const name = (seatIndex: number) => {
    const seat = room.seats[seatIndex];
    return seat?.type === 'human' ? seat.nickname : t('gameRoom.ai');
  };
  const watch = async () => {
    try {
      update(await watchGameRoom(roomId, !view.isSpectator));
      setWatchError(false);
    } catch {
      setWatchError(true);
    }
  };
  return (
    <main className="mx-auto max-w-5xl px-3 pb-10 pt-3 text-foreground sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          {back}
          <h1 className="font-serif text-2xl font-bold">
            {t(`game.${room.gameId}.name`)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              {t('gameRoom.title')}
            </span>
          </h1>
        </div>
        <div className="text-right text-xs">
          <p
            className={
              connected
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600'
            }
          >
            {t(connected ? 'gameRoom.connected' : 'gameRoom.connecting')}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t(`gameRoom.${room.status}`)}
          </p>
        </div>
      </header>
      {error || watchError ? (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t(`gameRoom.error.${watchError ? 'NETWORK' : error}`)}
        </p>
      ) : null}
      {!connected ? (
        <p
          role="status"
          className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm"
        >
          {t('gameRoom.connectionHint')}
        </p>
      ) : null}
      {mine && !view.hasControl ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <p>{t('gameRoom.readOnly')}</p>
          <Button
            className="min-h-11"
            disabled={pending || !connected}
            onClick={() => void send('takeover')}
          >
            {t('gameRoom.takeover')}
          </Button>
        </div>
      ) : null}
      {view.isSpectator ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {t('gameRoom.spectatorHint')}
        </p>
      ) : null}
      <section
        aria-label={t('family.lobby.players')}
        className={`mb-4 grid gap-2 ${room.seats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {room.seats.map((seat) => {
          const avatar =
            seat.type === 'human'
              ? getAvatarPresetById(seat.avatarPresetId)
              : null;
          let remaining = view.clockRemaining?.[seat.seatIndex];
          if (
            remaining !== undefined &&
            seat.seatIndex === currentSeat &&
            view.deadline !== null &&
            room.status === 'playing'
          )
            remaining = Math.max(0, view.deadline - serverNow);
          const role =
            room.gameId === 'gomoku'
              ? seat.seatIndex === room.firstSeat
                ? 'black'
                : 'white'
              : room.gameId === 'xiangqi'
                ? seat.seatIndex === room.firstSeat
                  ? 'red'
                  : 'blackSide'
                : board?.gameId === 'doudizhu' && board.landlord !== null
                  ? seat.seatIndex === board.landlord
                    ? 'landlord'
                    : 'farmer'
                  : 'bidding';
          return (
            <div
              key={seat.seatIndex}
              className={`min-w-0 rounded-xl border bg-card p-2.5 sm:p-4 ${currentSeat === seat.seatIndex && room.status === 'playing' ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={`hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex ${avatar?.bgClass ?? 'bg-muted'} ${avatar?.fgClass ?? ''}`}
                >
                  {avatar?.glyph ?? '♟'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {seat.type === 'human'
                      ? seat.nickname
                      : t(
                          seat.type === 'ai' ? 'gameRoom.ai' : 'gameRoom.empty',
                        )}
                    {viewerSeat === seat.seatIndex
                      ? ` · ${t('gameRoom.you')}`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {room.roundNumber ? t(`gameRoom.${role}`) : ''}
                    {seat.type === 'human'
                      ? ` · ${t(seat.autoplay ? 'gameRoom.autoplay' : seat.connected ? 'gameRoom.online' : 'gameRoom.offline')}`
                      : ''}
                  </p>
                </div>
              </div>
              {remaining !== undefined ? (
                <p className="mt-2 font-mono text-lg tabular-nums">
                  {timeLabel(remaining)}
                </p>
              ) : null}
              {board?.gameId === 'doudizhu' ? (
                <p className="mt-2 text-xs">
                  {formatMessage(locale, 'gameRoom.cards', {
                    count: board.handCounts[seat.seatIndex],
                  })}
                </p>
              ) : null}
              {room.status === 'waiting' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {seat.type !== 'human' &&
                  viewerSeat === null &&
                  !view.isSpectator ? (
                    <Button
                      className="min-h-11"
                      disabled={pending || !connected}
                      onClick={() =>
                        void send('join', { seatIndex: seat.seatIndex })
                      }
                    >
                      {t('gameRoom.join')}
                    </Button>
                  ) : null}
                  {seat.type !== 'human' && isHost ? (
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={disabled}
                      onClick={() =>
                        void send('ai', {
                          seatIndex: seat.seatIndex,
                          remove: seat.type === 'ai',
                        })
                      }
                    >
                      {t(
                        seat.type === 'ai'
                          ? 'gameRoom.removeAi'
                          : 'gameRoom.fillAi',
                      )}
                    </Button>
                  ) : null}
                  {seat.type === 'human' && seat.ready ? (
                    <span className="text-xs text-emerald-600">
                      {t('gameRoom.readyStatus')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
      {room.status === 'paused' ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
        >
          <p>{t(chess ? 'gameRoom.pauseHint' : 'gameRoom.cardsPauseHint')}</p>
          {chess && mine ? (
            <Button
              className="mt-3 min-h-11"
              variant="outline"
              disabled={
                disabled ||
                room.pausedAt === null ||
                serverNow - room.pausedAt < 600_000
              }
              onClick={() => void send('end')}
            >
              {t('gameRoom.end')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {room.status === 'waiting' ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <GameRoomSettingsFields
            gameId={room.gameId}
            value={room.settings}
            disabled={disabled || !isHost}
            onChange={(settings) => void send('settings', { settings })}
          />
          <p className="text-xs text-muted-foreground">
            {t('gameRoom.startHint')}
          </p>
          {mine?.type === 'human' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={disabled}
                variant="outline"
                onClick={() => void send('ready', { ready: !mine.ready })}
              >
                {t(mine.ready ? 'gameRoom.unready' : 'gameRoom.ready')}
              </Button>
              {isHost ? (
                <Button
                  className="min-h-11"
                  disabled={disabled}
                  onClick={() => void send('start')}
                >
                  {t('gameRoom.start')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {board ? (
        <section className="rounded-2xl border border-border bg-card p-2 sm:p-5">
          <div
            className="mb-3 flex flex-wrap items-center justify-center gap-2 text-sm font-medium"
            aria-live="polite"
          >
            {room.status === 'playing'
              ? formatMessage(locale, 'gameRoom.turn', {
                  name: name(board.currentSeat),
                })
              : t(`gameRoom.${room.status}`)}
            {board.gameId === 'xiangqi' && board.inCheck ? (
              <span className="text-red-600">{t('gameRoom.check')}</span>
            ) : null}
            {room.gameId === 'doudizhu' &&
            view.deadline &&
            room.status === 'playing' ? (
              <span className="font-mono">
                {timeLabel(view.deadline - serverNow)}
              </span>
            ) : null}
          </div>
          {board.gameId === 'doudizhu' ? (
            <FamilyDoudizhuTable
              view={view}
              disabled={disabled}
              onAction={(action) => send('action', { action })}
            />
          ) : (
            <FamilyChessBoard
              view={view}
              disabled={disabled}
              onAction={(action) => send('action', { action })}
            />
          )}
        </section>
      ) : null}
      {view.offer ? (
        <section className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p>
            {formatMessage(
              locale,
              view.offer.kind === 'draw'
                ? 'gameRoom.drawOffer'
                : 'gameRoom.undoOffer',
              { name: name(view.offer.seat) },
            )}
          </p>
          {mine && view.offer.seat !== viewerSeat ? (
            <div className="mt-3 flex gap-2">
              <Button
                className="min-h-11"
                disabled={disabled || room.status !== 'playing'}
                onClick={() => void send('respond', { accept: true })}
              >
                {t('gameRoom.accept')}
              </Button>
              <Button
                className="min-h-11"
                variant="outline"
                disabled={disabled || room.status !== 'playing'}
                onClick={() => void send('respond', { accept: false })}
              >
                {t('gameRoom.reject')}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">
              {t('gameRoom.offerWaiting')}
            </p>
          )}
        </section>
      ) : null}
      {room.result ? (
        <section className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-card p-5">
          <h2 className="font-serif text-xl font-bold">
            {t('gameRoom.result')}
          </h2>
          {room.result.outcomes ? (
            room.seats.map((seat) => (
              <div
                key={seat.seatIndex}
                className="flex flex-wrap justify-between gap-2 text-sm"
              >
                <span>
                  {name(seat.seatIndex)} ·{' '}
                  {t(`gameRoom.${room.result!.outcomes![seat.seatIndex]}`)}
                </span>
                {seat.type === 'human' ? (
                  <span className="font-semibold text-primary">
                    {formatMessage(locale, 'gameRoom.coins', {
                      coins: room.result!.coinsByMember[seat.memberId] ?? 0,
                    })}
                  </span>
                ) : null}
              </div>
            ))
          ) : (
            <p>{t('gameRoom.void')}</p>
          )}
          {!room.result.counted ? (
            <p className="text-xs text-muted-foreground">
              {t('gameRoom.noReward')}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t('gameRoom.rematchHint')}
          </p>
          {isHost ? (
            <Button
              className="min-h-11"
              disabled={disabled}
              onClick={() => void send('rematch')}
            >
              {t('gameRoom.rematch')}
            </Button>
          ) : null}
        </section>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {mine &&
        chess &&
        (room.status === 'playing' || room.status === 'paused') ? (
          <>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={
                disabled || room.status !== 'playing' || Boolean(view.offer)
              }
              onClick={() => void send('offer', { kind: 'draw' })}
            >
              {t('gameRoom.offerDraw')}
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={
                disabled ||
                room.status !== 'playing' ||
                Boolean(view.offer) ||
                view.undoUsed[viewerSeat!] >= room.settings.undoLimit
              }
              onClick={() => void send('offer', { kind: 'undo' })}
            >
              {t('gameRoom.offerUndo')}
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={disabled}
              onClick={() => setConfirm('resign')}
            >
              {t('gameRoom.resign')}
            </Button>
          </>
        ) : null}
        {mine ? (
          <Button
            className="min-h-11"
            variant="ghost"
            disabled={disabled}
            onClick={() => setConfirm('leave')}
          >
            {t('gameRoom.leave')}
          </Button>
        ) : chess ? (
          <Button
            className="min-h-11"
            variant="outline"
            disabled={pending || !connected}
            onClick={() => void watch()}
          >
            {t(view.isSpectator ? 'gameRoom.stopWatch' : 'gameRoom.watch')}
          </Button>
        ) : null}
        {chess ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {formatMessage(locale, 'gameRoom.spectators', {
              count: room.spectators.length,
            })}
            {room.spectators.length
              ? ` · ${room.spectators.map((person) => person.nickname).join('、')}`
              : ''}
          </span>
        ) : null}
      </div>
      {chess ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('gameRoom.offerRule')}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {t('gameRoom.rewardHint')}
      </p>
      <FamilyHeadToHead revision={room.result ? room.roundNumber : 0} />
      {confirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(
            confirm === 'resign' ? 'gameRoom.resign' : 'gameRoom.leave',
          )}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-5">
            <p>
              {t(
                confirm === 'resign'
                  ? 'gameRoom.confirmResign'
                  : 'gameRoom.confirmLeave',
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setConfirm(null)}
              >
                {t('gameRoom.cancel')}
              </Button>
              <Button
                className="min-h-11"
                disabled={pending}
                onClick={() => {
                  void send(confirm).then((ok) => {
                    if (ok && confirm === 'leave') navigate('/family');
                    setConfirm(null);
                  });
                }}
              >
                {t('gameRoom.confirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
