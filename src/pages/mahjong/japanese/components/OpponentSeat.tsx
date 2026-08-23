import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  formatPoints,
  getSeatWind,
  toMeldKeyedItems,
  toTileKeyedItems,
} from '../helpers';
import type { RiichiGameState } from '../types';
import { RiichiTile, TileBack } from './Tile';

function tileRotation(seat: 1 | 2 | 3): 0 | 90 | -90 {
  if (seat === 2) return 0;
  return seat === 1 ? -90 : 90;
}

type Props = {
  seat: 1 | 2 | 3;
  game: RiichiGameState;
  timerLabel: string;
  timerClassName: string;
  isCurrentTurn: boolean;
};

export function OpponentSeat({
  seat,
  game,
  timerLabel,
  timerClassName,
  isCurrentTurn,
}: Props) {
  const { locale, t } = useLocale();
  const rotation = tileRotation(seat);
  const isSide = seat !== 2;
  const seatWind = getSeatWind(game.roundWind, seat, game.dealer);
  const isRiichi = game.riichiDeclared[seat];
  const ariaLabelText = formatMessage(locale, 'game.mahjong.opponentAria', {
    seat: t(`game.mahjong.seats.${seat}`),
    wind: t(`game.mahjong.winds.${seatWind}`),
    count: game.hands[seat].length,
    points: formatPoints(game.scores[seat]),
    timer: timerLabel,
  });

  return (
    <section
      className={cn(
        'riichi-seat riichi-seat--opponent',
        isSide ? 'riichi-seat--side' : 'riichi-seat--top',
        isCurrentTurn && 'riichi-seat--active',
      )}
      aria-label={ariaLabelText}
    >
      <div className="riichi-seat-card">
        <div className="riichi-seat-card-main">
          <span className="riichi-seat-wind">
            {t(`game.mahjong.winds.${seatWind}`)}
          </span>
          <span className="riichi-seat-name">
            {t(`game.mahjong.seats.${seat}`)}
          </span>
          <strong>{formatPoints(game.scores[seat])}</strong>
        </div>
        <div className="riichi-seat-card-meta">
          <span className={timerClassName}>{timerLabel}</span>
          {isCurrentTurn && <span className="riichi-seat-action">行动中</span>}
          {isRiichi && <span className="riichi-seat-riichi">立直</span>}
        </div>
      </div>

      <div className="riichi-opponent-hand" aria-hidden="true">
        {Array.from({ length: game.hands[seat].length }, (_, index) => (
          <span className="riichi-opponent-hand-slot" key={index}>
            <TileBack rotation={rotation} />
          </span>
        ))}
      </div>

      {game.melds[seat].length > 0 && (
        <div className="riichi-seat-melds">
          {toMeldKeyedItems(game.melds[seat], `opponent-${seat}-meld`).map(
            ({ meld, key }) => (
              <span className="riichi-seat-meld" key={key}>
                {toTileKeyedItems(meld.tiles, `${key}-tile`).map(
                  ({ tile, key: tileKey }) => (
                    <RiichiTile
                      key={tileKey}
                      tile={tile}
                      variant="meld"
                      rotation={rotation}
                    />
                  ),
                )}
              </span>
            ),
          )}
        </div>
      )}
    </section>
  );
}
