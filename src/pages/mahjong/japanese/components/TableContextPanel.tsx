import { Activity, Layers3 } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import {
  formatPoints,
  getClaimPlayerFromState,
  getSeatWind,
} from '../helpers';
import type { RiichiGameState } from '../types';

type Props = {
  game: RiichiGameState;
};

export function TableContextPanel({ game }: Props) {
  const { t } = useLocale();
  const ranking = [...game.scores.keys()].sort(
    (left, right) => game.scores[right] - game.scores[left],
  );
  const rankBySeat = new Map(ranking.map((seat, index) => [seat, index + 1]));
  const activeSeat =
    game.phase === 'claim'
      ? (getClaimPlayerFromState(game) ?? game.currentPlayer)
      : game.currentPlayer;
  const roundWind = t(`game.mahjong.winds.${game.roundWind}`);

  return (
    <aside className="riichi-table-context" aria-label="牌局场况">
      <header className="riichi-table-context-header">
        <div>
          <p>TABLE STATUS</p>
          <h2>
            {roundWind}
            {game.roundNumber}局
          </h2>
        </div>
        <span className="riichi-table-context-live">
          <Activity aria-hidden="true" size={13} />
          进行中
        </span>
      </header>

      <div className="riichi-table-context-metrics">
        <div>
          <span>余牌</span>
          <strong>{game.wall.length}</strong>
        </div>
        <div>
          <span>本场</span>
          <strong>{game.honba}</strong>
        </div>
        <div>
          <span>立直棒</span>
          <strong>{game.riichiPot / 1000}</strong>
        </div>
      </div>

      <section className="riichi-table-context-section">
        <div className="riichi-table-context-title">
          <span>席位与点数</span>
          <small>
            庄家 {t(`game.mahjong.seats.${game.dealer}`)}
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
                <strong>{formatPoints(game.scores[seat])}</strong>
                {game.riichiDeclared[seat] && <em>立直</em>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="riichi-table-context-section">
        <div className="riichi-table-context-title">
          <span>牌河进度</span>
          <small>每家最多显示 6 × 6</small>
        </div>
        <div className="riichi-table-river-load">
          {[0, 1, 2, 3].map((seat) => {
            const count = game.discardPiles[seat].length;
            return (
              <div key={seat}>
                <span>{t(`game.mahjong.seats.${seat}`)}</span>
                <div aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (count / 36) * 100)}%` }} />
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
          副露 {game.melds.reduce((total, melds) => total + melds.length, 0)} 组
          · {game.phase === 'claim' ? '鸣牌响应中' : '摸打阶段'}
        </span>
      </footer>
    </aside>
  );
}
