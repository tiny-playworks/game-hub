import { Activity, Layers3 } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { getDecisionSeat } from '../engine';
import { formatPoints, getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';

type Props = {
  game: RiichiGameState;
};

export function TableContextPanel({ game }: Props) {
  const { t, locale } = useLocale();
  const ranking = [...game.scores.keys()].sort(
    (left, right) => game.scores[right] - game.scores[left],
  );
  const rankBySeat = new Map(ranking.map((seat, index) => [seat, index + 1]));
  const activeSeat = getDecisionSeat(game);
  const roundWind = t(`game.mahjong.winds.${game.roundWind}`);

  return (
    <aside
      className="riichi-table-context"
      aria-label={t('riichi.context.label')}
    >
      <header className="riichi-table-context-header">
        <div>
          <p>TABLE STATUS</p>
          <h2>
            {formatMessage(locale, 'riichi.context.round', {
              wind: roundWind,
              number: game.roundNumber,
            })}
          </h2>
        </div>
        <span className="riichi-table-context-live">
          <Activity aria-hidden="true" size={13} />
          {t(
            game.phase === 'end'
              ? 'riichi.state.roundFinished'
              : 'riichi.context.live',
          )}
        </span>
      </header>

      <div className="riichi-table-context-metrics">
        <div>
          <span>{t('riichi.context.wall')}</span>
          <strong>{game.wall.length}</strong>
        </div>
        <div>
          <span>{t('riichi.context.honba')}</span>
          <strong>{game.honba}</strong>
        </div>
        <div>
          <span>{t('riichi.context.riichiSticks')}</span>
          <strong>{game.riichiPot / 1000}</strong>
        </div>
      </div>

      <section className="riichi-table-context-section">
        <div className="riichi-table-context-title">
          <span>{t('riichi.context.scores')}</span>
          <small>
            {formatMessage(locale, 'riichi.context.dealer', {
              seat: t(`game.mahjong.seats.${game.dealer}`),
            })}
          </small>
        </div>
        <div className="riichi-table-scoreboard">
          {[0, 1, 2, 3].map((seat) => {
            const seatWind = getSeatWind(game.roundWind, seat, game.dealer);
            const isActive = activeSeat === seat;
            return (
              <div
                key={seat}
                className={cn(
                  'riichi-table-score-row',
                  isActive && 'is-active',
                )}
              >
                <span className="riichi-table-score-rank">
                  {rankBySeat.get(seat)}
                </span>
                <span className="riichi-table-score-wind">
                  {t(`game.mahjong.winds.${seatWind}`)}
                </span>
                <span className="riichi-table-score-name">
                  {t(`game.mahjong.seats.${seat}`)}
                </span>
                <strong>{formatPoints(game.scores[seat], locale)}</strong>
                {game.riichiDeclared[seat] && (
                  <em>{t('riichi.state.riichi')}</em>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="riichi-table-context-section">
        <div className="riichi-table-context-title">
          <span>{t('riichi.context.rivers')}</span>
          <small>{t('riichi.context.riverCapacity')}</small>
        </div>
        <div className="riichi-table-river-load">
          {[0, 1, 2, 3].map((seat) => {
            const count = game.discardPiles[seat].length;
            return (
              <div key={seat}>
                <span>{t(`game.mahjong.seats.${seat}`)}</span>
                <div aria-hidden="true">
                  <i
                    style={{ width: `${Math.min(100, (count / 36) * 100)}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="riichi-table-context-footer">
        <Layers3 aria-hidden="true" size={15} />
        <span>
          {formatMessage(locale, 'riichi.context.melds', {
            count: game.melds.reduce((total, melds) => total + melds.length, 0),
          })}
          {' · '}
          {t(
            game.phase === 'end'
              ? 'riichi.state.roundFinished'
              : game.phase === 'claim'
                ? 'riichi.context.claimPhase'
                : 'riichi.context.drawPhase',
          )}
        </span>
      </footer>
    </aside>
  );
}
