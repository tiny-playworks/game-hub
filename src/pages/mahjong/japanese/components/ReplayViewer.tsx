import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { type RiichiReplayFile, replayMatch } from '../engine';
import { formatLogEntry, formatPoints, toTileKeyedItems } from '../helpers';
import { useRiichiDialogFocus } from '../useRiichiDialogFocus';
import { MeldTiles } from './MeldTiles';
import { RiichiTile } from './Tile';

type Props = { file: RiichiReplayFile; onClose: () => void };

export function ReplayViewer({ file, onClose }: Props) {
  const { locale, t } = useLocale();
  const restoreFocus = useRiichiDialogFocus();
  const frames = useMemo(() => replayMatch(file), [file]);
  const [index, setIndex] = useState(0);
  const roundStarts = useMemo(
    () =>
      frames.flatMap((frame, i) =>
        i === 0 || frame.round.roundId !== frames[i - 1].round.roundId
          ? [{ index: i, round: frame.round }]
          : [],
      ),
    [frames],
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const game = frame.round;
  const container =
    typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLElement>('[data-riichi-theme]');

  const exportReplay = () => {
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riichi-${file.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        onCloseAutoFocus={restoreFocus}
        showCloseButton={false}
        className="riichi-replay-dialog"
        aria-describedby={undefined}
      >
        <div className="riichi-replay-header">
          <DialogTitle>{t('riichi.replay.title')}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('game.mahjong.close')}
          >
            ×
          </button>
        </div>
        <div className="riichi-replay-toolbar">
          <label>
            {t('riichi.replay.jumpRound')}
            <select
              value={roundStarts.reduce(
                (last, item) => (item.index <= index ? item.index : last),
                0,
              )}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {roundStarts.map(({ index: start, round }) => (
                <option key={start} value={start}>
                  {t(`game.mahjong.winds.${round.roundWind}`)}
                  {round.roundNumber}
                  {t('riichi.replay.roundSuffix')} · {round.honba}
                  {t('riichi.replay.honbaSuffix')}
                </option>
              ))}
            </select>
          </label>
          <span>
            {formatMessage(locale, 'riichi.replay.step', {
              current: index,
              total: frames.length - 1,
            })}
          </span>
          <button type="button" onClick={exportReplay}>
            {t('riichi.replay.export')}
          </button>
        </div>
        <p className="riichi-replay-event">
          {index === 0
            ? t('riichi.replay.start')
            : frame.log.length > 0
              ? formatLogEntry(frame.log[frame.log.length - 1], locale)
              : file.events[index - 1]?.type}
        </p>
        <div className="riichi-replay-indicators">
          <span>{t('game.mahjong.dora')}</span>
          {toTileKeyedItems(game.doraIndicators, 'replay-dora').map(
            ({ tile, key }) => (
              <RiichiTile tile={tile} key={key} variant="indicator" />
            ),
          )}
          <span>
            {formatMessage(locale, 'game.mahjong.wallLength', {
              count: game.wall.length,
            })}
          </span>
        </div>
        <div className="riichi-replay-board">
          {[0, 1, 2, 3].map((seat) => (
            <section key={seat}>
              <header>
                <strong>{t(`game.mahjong.seats.${seat}`)}</strong>
                <span>{formatPoints(game.scores[seat], locale)}</span>
                {game.riichiDeclared[seat] && (
                  <small>{t('riichi.state.riichi')}</small>
                )}
                {game.currentPlayer === seat && frame.status === 'playing' && (
                  <small>{t('riichi.replay.currentTurn')}</small>
                )}
              </header>
              <div className="riichi-replay-tiles">
                {toTileKeyedItems(game.hands[seat], `replay-hand-${seat}`).map(
                  ({ tile, key }) => (
                    <RiichiTile key={key} tile={tile} variant="indicator" />
                  ),
                )}
              </div>
              <div className="riichi-replay-melds">
                {game.melds[seat].map((meld, meldIndex) => (
                  <span className="riichi-seat-meld" key={meldIndex}>
                    <MeldTiles meld={meld} seat={seat} />
                  </span>
                ))}
              </div>
              <div className="riichi-replay-tiles">
                {toTileKeyedItems(
                  game.discardPiles[seat],
                  `replay-river-${seat}`,
                ).map(({ tile, key }) => (
                  <RiichiTile key={key} tile={tile} variant="river" />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="riichi-replay-toolbar riichi-replay-footer">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            {t('riichi.replay.previous')}
          </button>
          <button
            type="button"
            disabled={index === frames.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            {t('riichi.replay.next')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
