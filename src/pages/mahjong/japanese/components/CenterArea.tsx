import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { toTileKeyedItems } from '../helpers';
import type { RiichiGameState } from '../types';
import { RiichiTile } from './Tile';

type Props = {
  game: RiichiGameState;
};

export function CenterArea({ game }: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="riichi-center-board">
      {([2, 1, 0, 3] as const).map((seat) => {
        const tiles = toTileKeyedItems(
          game.discardPiles[seat],
          `discard-${seat}`,
        );
        return (
          <div
            key={seat}
            className={`riichi-river riichi-river--seat-${seat}`}
            aria-label={`${t(`game.mahjong.seats.${seat}`)}舍牌`}
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
                    state={isLastDiscard ? 'last-discard' : 'normal'}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="riichi-center-console">
        <div className="riichi-center-round">
          <span>{t(`game.mahjong.winds.${game.roundWind}`)}</span>
          <strong>{game.roundNumber}</strong>
          <small>{game.honba} 本场</small>
        </div>
        <p className="riichi-center-wall">
          {formatMessage(locale, 'game.mahjong.wallLength', {
            count: game.wall.length,
          })}
        </p>
        <div className="riichi-center-indicators">
          {toTileKeyedItems(game.doraIndicators, 'center-dora').map(
            ({ tile, key }) => (
              <RiichiTile key={key} tile={tile} variant="indicator" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
