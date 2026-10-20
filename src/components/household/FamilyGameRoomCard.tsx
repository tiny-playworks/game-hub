import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import type { GameRoomSummary } from '../../../shared/contracts/gameRoom';

export function FamilyGameRoomCard({ room }: { room: GameRoomSummary }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  return (
    <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">
            {t(`game.${room.gameId}.name`)}
          </p>
          <h3 className="mt-1 font-semibold">
            {formatMessage(locale, 'family.lobby.roomBy', {
              name: room.hostNickname,
            })}
          </h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-xs">
          {t(`gameRoom.${room.status}`)}
        </span>
      </div>
      <div className="flex gap-2">
        {room.seats.map((seat) => (
          <span
            key={seat.seatIndex}
            className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-2 text-center text-xs ${seat.type === 'human' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
          >
            {seat.type === 'human'
              ? seat.nickname
              : t(seat.type === 'ai' ? 'gameRoom.ai' : 'gameRoom.empty')}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {room.gameId === 'doudizhu'
            ? formatMessage(locale, 'gameRoom.seconds', {
                seconds: room.settings.turnSeconds,
              })
            : room.settings.clock
              ? formatMessage(locale, 'gameRoom.clockPreset', {
                  minutes: room.settings.clock.totalSeconds / 60,
                  seconds: room.settings.clock.incrementSeconds,
                })
              : t('gameRoom.unlimited')}
        </span>
        <span>
          {formatMessage(locale, 'family.lobby.people', {
            count: room.seats.filter((seat) => seat.type === 'human').length,
          })}
        </span>
      </div>
      <Button
        className="min-h-11 w-full"
        variant={room.status === 'playing' ? 'secondary' : 'default'}
        onClick={() => navigate(`/family/games/${room.id}`)}
      >
        {t('family.lobby.joinRoom')}
      </Button>
    </article>
  );
}
