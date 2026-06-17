import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { TILE_DISCARD } from '../constants';
import {
  formatPoints,
  getSeatWind,
  toMeldKeyedItems,
  toTileKeyedItems,
} from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace, TileBack } from './Tile';

const TOP_HAND_SLOT = { width: 22, height: 31 };
const SIDE_HAND_SLOT = { width: 26, height: 18 };
const TOP_TILE_BACK_CLASS = 'w-[22px] h-[31px]';
const SIDE_TILE_BACK_CLASS = 'w-[18px] h-[26px]';
const SIDE_VISIBLE_BACKS = 7;

function tileRotation(seat: 1 | 2 | 3): number {
  if (seat === 2) return 0;
  return seat === 1 ? -90 : 90; // 下家 -90°，上家 90°
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
  const rot = tileRotation(seat);
  const tileStyle = { transform: `rotate(${rot}deg)` };
  const isVertical = seat !== 2;
  const handSlot = isVertical ? SIDE_HAND_SLOT : TOP_HAND_SLOT;
  const tileBackClassName = isVertical
    ? SIDE_TILE_BACK_CLASS
    : TOP_TILE_BACK_CLASS;
  const visibleBacks = isVertical
    ? Math.min(game.hands[seat].length, SIDE_VISIBLE_BACKS)
    : game.hands[seat].length;

  const ariaLabelText = formatMessage(locale, 'game.mahjong.opponentAria', {
    seat: t(`game.mahjong.seats.${seat}`),
    wind: t(
      `game.mahjong.winds.${getSeatWind(game.roundWind, seat, game.dealer)}`,
    ),
    count: game.hands[seat].length,
    points: formatPoints(game.scores[seat]),
    timer: timerLabel,
  });

  return (
    <button
      type="button"
      className={cn(
        'riichi-opponent-seat rounded-lg px-2 py-1.5 flex flex-col items-center justify-center min-h-0 overflow-visible',
        isVertical && 'px-1.5 md:px-2',
        isCurrentTurn && 'riichi-opponent-seat-active border',
      )}
      aria-label={ariaLabelText}
    >
      <div className="riichi-opponent-chip">
        <span className="font-semibold">{t(`game.mahjong.seats.${seat}`)}</span>
        <span className="opacity-70">
          {t(
            `game.mahjong.winds.${getSeatWind(game.roundWind, seat, game.dealer)}`,
          )}
        </span>
      </div>
      <div className="riichi-opponent-float" role="tooltip">
        <p className="font-semibold">
          {t(`game.mahjong.seats.${seat}`)} ·{' '}
          {t(
            `game.mahjong.winds.${getSeatWind(game.roundWind, seat, game.dealer)}`,
          )}
        </p>
        <p>
          {formatMessage(locale, 'game.mahjong.tileCount', {
            count: game.hands[seat].length,
          })}
        </p>
        <p>{formatPoints(game.scores[seat])}</p>
        <p>
          <span className={timerClassName}>{timerLabel}</span>
        </p>
      </div>
      {game.hands[seat].length > 0 && (
        <div
          className={cn(
            'flex justify-center gap-0.5 mt-0.5 overflow-visible',
            isVertical ? 'flex-col items-center' : 'flex-wrap',
          )}
        >
          {Array.from({ length: visibleBacks }, (_, i) => (
            <span
              key={i}
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{ width: handSlot.width, height: handSlot.height }}
            >
              <span style={tileStyle} className="inline-flex">
                <TileBack className={tileBackClassName} />
              </span>
            </span>
          ))}
        </div>
      )}
      {game.melds[seat].length > 0 && (
        <div
          className={cn(
            'flex justify-center gap-0.5 mt-0.5',
            isVertical ? 'flex-col items-center' : 'flex-wrap',
          )}
        >
          {toMeldKeyedItems(game.melds[seat], `opponent-${seat}-meld`).map(
            ({ meld: m, key }) => (
              <span
                key={key}
                className={cn(
                  'flex gap-0.5',
                  isVertical && 'flex-col items-center',
                )}
              >
                {toTileKeyedItems(m.tiles, `${key}-tile`).map(
                  ({ tile, key }) => (
                    <span
                      key={key}
                      className="inline-flex items-center justify-center rounded font-bold text-[10px] flex-shrink-0"
                      style={{ width: handSlot.width, height: handSlot.height }}
                    >
                      <span
                        style={tileStyle}
                        className={cn(TILE_DISCARD, getTileColorClass(tile))}
                      >
                        <RiichiTileFace tile={tile} />
                      </span>
                    </span>
                  ),
                )}
              </span>
            ),
          )}
        </div>
      )}
    </button>
  );
}
