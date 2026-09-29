import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getBaseTile } from '@/lib/mahjongRiichi';
import { toTileKeyedItems } from '../helpers';
import type { RiichiGameState } from '../types';
import { RiichiTile } from './Tile';

type Props = {
  game: RiichiGameState;
  highlightedBase?: number | null;
};

export function CenterArea({ game, highlightedBase = null }: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="riichi-center-board">
      {([2, 1, 0, 3] as const).map((seat) => {
        const tiles = toTileKeyedItems(
          game.discardPiles[seat],
          `discard-${seat}`,
        );
        return (
          <section
            key={seat}
            className={`riichi-river riichi-river--seat-${seat}`}
            aria-label={formatMessage(locale, 'riichi.table.river', {
              seat: t(`game.mahjong.seats.${seat}`),
            })}
          >
            <div
              className={`riichi-river-grid riichi-river-grid--seat-${seat}${tiles.length > 24 ? ' is-dense' : ''}`}
            >
              {tiles.map(({ tile, key }, index) => {
                const isLastDiscard =
                  game.lastDiscardFrom === seat && index === tiles.length - 1;
                return (
                  <RiichiTile
                    key={key}
                    tile={tile}
                    variant="river"
                    state={
                      game.riichiDiscardIndex[seat] === index
                        ? 'riichi-discard'
                        : isLastDiscard
                          ? 'last-discard'
                          : 'normal'
                    }
                    highlighted={getBaseTile(tile) === highlightedBase}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="riichi-center-console">
        <div className="riichi-center-round">
          <span>{t(`game.mahjong.winds.${game.roundWind}`)}</span>
          <strong>{game.roundNumber}</strong>
          <small>
            {formatMessage(locale, 'riichi.table.honba', { count: game.honba })}
          </small>
        </div>
        <p className="riichi-center-wall">
          {formatMessage(locale, 'game.mahjong.wallLength', {
            count: game.wall.length,
          })}
        </p>
        <div className="riichi-center-indicators">
          {toTileKeyedItems(game.doraIndicators, 'center-dora').map(
            ({ tile, key }) => (
              <RiichiTile
                key={key}
                tile={tile}
                variant="indicator"
                highlighted={getBaseTile(tile) === highlightedBase}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
