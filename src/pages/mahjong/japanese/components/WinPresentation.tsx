import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { RiichiEventArtwork } from '@/components/riichi/RiichiEventArtwork';
import { characterRoomAppearance } from '../../../../../shared/contracts/roomAppearance';
import { useRiichiStore } from '../store/riichiMatchStore';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import { useRiichiSounds } from '@/hooks/useRiichiSounds';
import { formatMessage } from '@/lib/i18n';
import type { RiichiPlayerSettings } from '@/lib/playerProfile';
import {
  BONUS_YAKU_IDS,
  getScoreTier,
  winningHand,
  winTimeline,
} from '@/lib/riichiPresentation';
import type { RiichiRoundProgressSummary } from '@/lib/riichiProgress';
import type { CharacterMoment } from '../characterMoments';
import {
  formatPoints,
  summarizeWinnerPayments,
  toTileKeyedItems,
} from '../helpers';
import type { RoundResult } from '../types';
import { MeldTiles } from './MeldTiles';
import { ResultDialog, RoundGrowthSummary } from './Modals';
import { CharacterQuotes } from './SpeechBubble';
import { RiichiTile } from './Tile';
import '../presentation.css';

type Props = {
  result: Extract<RoundResult, { type: 'win' }>;
  doraIndicators: number[];
  moments?: CharacterMoment[];
  mode: RiichiPlayerSettings['presentation'];
  roundProgressSummary: RiichiRoundProgressSummary;
  timeoutEvents: string[];
  onNext: () => void;
};

export function WinPresentation({
  result,
  doraIndicators,
  moments = [],
  mode,
  roundProgressSummary,
  timeoutEvents,
  onNext,
}: Props) {
  const { t, locale } = useLocale();
  const { equipped } = useCosmetics();
  const seatCharacters = useRiichiStore((state) => state.match?.seatCharacters);
  const sounds = useRiichiSounds();
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [illustrationEnded, setIllustrationEnded] = useState(false);
  const played = useRef(false);
  const { wins, settlement } = result;
  const { bonusAt, scoreAt, finalAt } = winTimeline(wins);
  const full = mode === 'full' && !reduced;
  const final = !full || skipped || elapsed >= finalAt;
  const time = final ? finalAt : elapsed;
  const tiers = [
    null,
    'mangan',
    'haneman',
    'baiman',
    'sanbaiman',
    'yakuman',
    'doubleYakuman',
  ];
  const primary = wins.reduce((best, win) =>
    tiers.indexOf(getScoreTier(win)) > tiers.indexOf(getScoreTier(best))
      ? win
      : best,
  );
  const tier = getScoreTier(primary);
  const yakuman = tier === 'yakuman' || tier === 'doubleYakuman';
  const advance = () => (final ? onNext() : setSkipped(true));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!full || skipped) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const value = Math.min(finalAt, now - start);
      setElapsed(value);
      if (value < finalAt) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [full, skipped, finalAt]);

  useEffect(() => {
    if (!final || played.current) return;
    played.current = true;
    if (full && !skipped && yakuman && navigator.userActivation?.hasBeenActive !== false)
      return sounds.playYakuman();
  }, [final, full, skipped, yakuman, sounds]);

  return (
    <ResultDialog
      onClose={advance}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a, summary'))
          advance();
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          advance();
        }
      }}
      className={
        full
          ? final && yakuman
            ? 'riichi-yakuman-dialog'
            : ''
          : 'riichi-win-static'
      }
    >
      <div
        className="riichi-win-presentation"
        data-mode={mode}
        data-final={final}
        data-tier={tier ?? 'small'}
        data-effects={full && final}
      >
        <header className="riichi-result-heading">
          <div>
            <p>{t('riichi.presentation.roundResult')}</p>
            <DialogTitle asChild>
              <h3>
                {t(
                  wins.length > 1
                    ? 'riichi.modal.win.multiple'
                    : wins[0].isTsumo
                      ? 'riichi.modal.win.tsumo'
                      : 'riichi.modal.win.ron',
                )}
              </h3>
            </DialogTitle>
          </div>
          {final && tier && mode !== 'off' && (
            <strong className="riichi-win-tier">
              {t(`riichi.presentation.tier.${tier}`)}
            </strong>
          )}
        </header>
        {full && final && tier && (
          <div className="riichi-win-effects" aria-hidden="true">
            {yakuman && (
              <b className="riichi-yakuman-title">
                {t(`riichi.presentation.tier.${tier}`)}
              </b>
            )}
          </div>
        )}
        {full && final && !skipped && !illustrationEnded && (
          <div className="riichi-win-illustrated" aria-hidden="true">
            <RiichiEventArtwork
              effectId={primary.winner === 0 ? equipped['win-effect'] : characterRoomAppearance(seatCharacters?.[primary.winner] ?? undefined).winEffect}
              kind="win"
              mode={mode}
              layout="result"
              onComplete={() => setIllustrationEnded(true)}
            />
          </div>
        )}
        {mode !== 'off' && (
          <CharacterQuotes
            moments={moments}
            kinds={['ron', 'tsumo', 'deal-in', 'chatter']}
          />
        )}
        <div className="riichi-win-hands">
          {wins.map((win) => {
            const payment = summarizeWinnerPayments(
              settlement.payments,
              win.winner,
            );
            const yaku = win.yaku.filter(
              (item) => !BONUS_YAKU_IDS.has(item.id),
            );
            const bonus = win.yaku.filter((item) =>
              BONUS_YAKU_IDS.has(item.id),
            );
            const rolling = Math.max(0, Math.min(1, (time - scoreAt) / 400));
            return (
              <article key={win.winner} className="riichi-win-hand">
                <h4>{t(`game.mahjong.seats.${win.winner}`)}</h4>
                {mode !== 'off' && (
                  <div className="riichi-win-tiles" data-ready={time >= 400}>
                    <div className="riichi-win-concealed">
                      {toTileKeyedItems(
                        winningHand(win),
                        `winner-${win.winner}`,
                      ).map(({ key, tile }, index) => (
                        <span
                          key={key}
                          style={{ '--tile-index': index } as CSSProperties}
                        >
                          <RiichiTile tile={tile} variant="hand" />
                        </span>
                      ))}
                      <span
                        className="riichi-winning-tile"
                        title={t('riichi.presentation.winningTile')}
                      >
                        <RiichiTile
                          tile={win.winningTile}
                          variant="hand"
                          highlighted
                        />
                      </span>
                    </div>
                    <div className="riichi-win-melds">
                      {win.melds.map((meld, index) => (
                        <div key={`${meld.type}-${index}`}>
                          <MeldTiles meld={meld} seat={win.winner} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <ul className="riichi-win-yaku">
                  {yaku.map((item, index) => (
                    <li
                      key={`${item.id}-${index}`}
                      data-visible={time >= 400 + index * 180}
                      data-yakuman={win.yakuman > 0}
                    >
                      <span>{t(`riichi.yaku.${item.id}`)}</span>
                      <strong>
                        {win.yakuman > 0
                          ? t('riichi.presentation.tier.yakuman')
                          : `${item.han} ${t('riichi.modal.unit.han')}`}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div
                  className="riichi-win-bonus"
                  data-visible={time >= bonusAt}
                >
                  {mode !== 'off' && (
                    <div className="riichi-win-indicators">
                      <span>{t('game.mahjong.dora')}</span>
                      {toTileKeyedItems(doraIndicators, 'win-dora').map(
                        ({ tile, key }) => (
                          <RiichiTile
                            key={key}
                            tile={tile}
                            variant="indicator"
                          />
                        ),
                      )}
                      {win.uraDoraIndicators.length > 0 && (
                        <>
                          <span>{t('riichi.modal.win.uraIndicator')}</span>
                          {toTileKeyedItems(
                            win.uraDoraIndicators,
                            'win-ura',
                          ).map(({ tile, key }) => (
                            <RiichiTile
                              key={key}
                              tile={tile}
                              variant="indicator"
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  <p>
                    {bonus.length
                      ? bonus
                          .map(
                            (item) =>
                              `${t(`riichi.yaku.${item.id}`)} ${item.han} ${t('riichi.modal.unit.han')}`,
                          )
                          .join(' · ')
                      : t('riichi.presentation.noBonus')}
                  </p>
                </div>
                <div
                  className="riichi-win-total"
                  data-visible={time >= scoreAt}
                >
                  <span>
                    {win.yakuman > 0
                      ? formatMessage(locale, 'game.mahjong.multipleYakuman', {
                          count: win.yakuman,
                        })
                      : `${win.han} ${t('riichi.modal.unit.han')} · ${win.fu} ${t('riichi.modal.unit.fu')}`}
                  </span>
                  <strong>
                    {formatPoints(
                      Math.round((win.ten * rolling) / 100) * 100,
                      locale,
                    )}
                  </strong>
                  {final && (
                    <small>
                      {t('riichi.modal.summary.base')} +{payment.base} ·{' '}
                      {t('riichi.modal.summary.honba')} +{payment.honba} ·{' '}
                      {t('riichi.modal.summary.riichi')} +{payment.riichi}
                    </small>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {final && (
          <section className="riichi-win-settlement">
            <div className="riichi-result-score-table">
              {settlement.newScores.map((score, seat) => (
                <div key={seat} data-positive={settlement.deltas[seat] >= 0}>
                  <span>{t(`game.mahjong.seats.${seat}`)}</span>
                  <strong>{score.toLocaleString()}</strong>
                  <em>
                    {settlement.deltas[seat] >= 0 ? '+' : ''}
                    {settlement.deltas[seat].toLocaleString()}
                  </em>
                </div>
              ))}
            </div>
            {timeoutEvents.length > 0 && (
              <p className="riichi-result-timeout">
                {t('riichi.modal.summary.timeout')}
                {timeoutEvents.join(' · ')}
              </p>
            )}
            <details className="riichi-win-growth">
              <summary>{t('riichi.presentation.rewards')}</summary>
              <RoundGrowthSummary roundProgressSummary={roundProgressSummary} />
            </details>
          </section>
        )}
        <Button className="riichi-result-primary" onClick={advance}>
          {t(final ? 'riichi.modal.nextRound' : 'riichi.presentation.skip')}
        </Button>
        {!final && (
          <p className="riichi-presentation-hint">
            {t('riichi.presentation.clickSkip')}
          </p>
        )}
      </div>
    </ResultDialog>
  );
}
