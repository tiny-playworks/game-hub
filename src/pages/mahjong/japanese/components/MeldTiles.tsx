import { getBaseTile } from '@/lib/mahjongRiichi';
import type { RiichiMeld } from '../types';
import { RiichiTile } from './Tile';

type Rotation = 0 | 90 | 180 | -90;

export function MeldTiles({
  meld,
  seat,
  rotation = 0,
  highlightedBase = null,
}: {
  meld: RiichiMeld;
  seat: number;
  rotation?: Rotation;
  highlightedBase?: number | null;
}) {
  const tiles =
    meld.type === 'kakan' ? meld.tiles.slice(0, 3) : [...meld.tiles];
  const source =
    meld.fromPlayer === undefined ? null : (meld.fromPlayer - seat + 4) % 4;
  const calledIndex =
    source === null
      ? meld.type === 'kakan'
        ? tiles.length - 1
        : -1
      : source === 3
        ? 0
        : source === 2
          ? 1
          : tiles.length - 1;
  if (calledIndex >= 0) {
    const original = Math.max(0, tiles.indexOf(meld.calledTile ?? tiles[0]));
    const [called] = tiles.splice(original, 1);
    tiles.splice(calledIndex, 0, called);
  }
  const sideways = (
    (rotation + 90 + 360) % 360 === 270 ? -90 : (rotation + 90 + 360) % 360
  ) as Rotation;
  const renderTile = (tile: number, direction: Rotation) => (
    <RiichiTile
      tile={tile}
      variant="meld"
      rotation={direction}
      highlighted={getBaseTile(tile) === highlightedBase}
    />
  );
  return tiles.map((tile, index) => (
    <span className="riichi-meld-call-slot" key={`${tile}-${index}`}>
      {renderTile(tile, index === calledIndex ? sideways : rotation)}
      {meld.type === 'kakan' && index === calledIndex && (
        <span className="riichi-meld-added">
          {renderTile(meld.tiles[3], sideways)}
        </span>
      )}
    </span>
  ));
}
