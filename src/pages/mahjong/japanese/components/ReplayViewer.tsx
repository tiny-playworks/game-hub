import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  type RiichiMatchState,
  type RiichiReplayFile,
  replayMatch,
} from '../engine';
import { formatLogEntry, formatPoints, toTileKeyedItems } from '../helpers';
import {
  useRiichiDialogContainer,
  useRiichiDialogFocus,
} from '../useRiichiDialogFocus';
import { useRiichiTheme } from '../useRiichiTheme';
import { MeldTiles } from './MeldTiles';
import { RiichiTile } from './Tile';

type Props = {
  file: RiichiReplayFile;
  onClose: () => void;
  initialIndex?: number;
  frames?: RiichiMatchState[];
};

export function ReplayViewer({
  file,
  onClose,
  initialIndex = 0,
  frames: suppliedFrames,
}: Props) {
  const { locale, t } = useLocale();
  const { theme } = useRiichiTheme();
  const restoreFocus = useRiichiDialogFocus();
  const frames = useMemo(
    () => suppliedFrames ?? replayMatch(file),
    [file, suppliedFrames],
  );
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(frames.length - 1, initialIndex)),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastIndex = frames.length - 1;
  const atEnd = index >= lastIndex;
  const seek = (next: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(lastIndex, next)));
  };

  useEffect(() => {
    if (!playing || atEnd) return;
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, lastIndex));
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, atEnd, speed, lastIndex]);
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
  const container = useRiichiDialogContainer();

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

  if (!container) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        container={container}
        data-riichi-theme={theme}
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
              onChange={(event) => seek(Number(event.target.value))}
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
        <div className="riichi-replay-transport">
          <label className="riichi-replay-progress">
            <span>
              {t('riichi.replay.progress')}
              <output>
                {index} / {lastIndex}
              </output>
            </span>
            <input
              type="range"
              min={0}
              max={lastIndex}
              value={index}
              disabled={lastIndex === 0}
              onChange={(event) => seek(Number(event.target.value))}
              aria-valuetext={formatMessage(locale, 'riichi.replay.step', {
                current: index,
                total: lastIndex,
              })}
            />
          </label>
          <div className="riichi-replay-toolbar riichi-replay-footer">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => seek(0)}
              aria-label={t('riichi.replay.first')}
              title={t('riichi.replay.first')}
            >
              <SkipBack size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => seek(index - 1)}
              aria-label={t('riichi.replay.previous')}
              title={t('riichi.replay.previous')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="riichi-replay-play"
              disabled={lastIndex === 0}
              onClick={() => {
                if (atEnd) setIndex(0);
                setPlaying(atEnd || !playing);
              }}
              aria-label={t(
                playing && !atEnd
                  ? 'riichi.replay.pause'
                  : 'riichi.replay.play',
              )}
            >
              {playing && !atEnd ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
              {t(
                playing && !atEnd
                  ? 'riichi.replay.pause'
                  : atEnd
                    ? 'riichi.replay.replay'
                    : 'riichi.replay.play',
              )}
            </button>
            <button
              type="button"
              disabled={index === frames.length - 1}
              onClick={() => seek(index + 1)}
              aria-label={t('riichi.replay.next')}
              title={t('riichi.replay.next')}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={atEnd}
              onClick={() => seek(lastIndex)}
              aria-label={t('riichi.replay.last')}
              title={t('riichi.replay.last')}
            >
              <SkipForward size={18} aria-hidden="true" />
            </button>
            <label className="riichi-replay-speed">
              {t('riichi.replay.speed')}
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                {[0.5, 1, 2, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
