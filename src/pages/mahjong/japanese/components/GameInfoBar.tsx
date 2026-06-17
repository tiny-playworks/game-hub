import { useLocale } from '@/contexts/LocaleContext';
import { formatPoints } from '../helpers';
import type { RiichiGameState } from '../types';

type Props = {
  game: RiichiGameState;
};

export function GameInfoBar({ game }: Props) {
  const { locale, t } = useLocale();
  const listSeparator = locale === 'en' ? ', ' : '、';
  const semicolonSeparator = locale === 'en' ? '; ' : '；';

  return (
    <>
      <div
        className="riichi-score-strip mb-1.5 rounded-lg border px-2.5 py-1.5 text-xs opacity-90"
        style={{
          borderColor:
            'color-mix(in srgb, var(--riichi-border) 30%, transparent)',
          backgroundColor:
            'color-mix(in srgb, var(--riichi-table-inner) 70%, transparent)',
          color: 'var(--riichi-text)',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {t(`game.mahjong.seats.${i}`)}{' '}
            <span className="font-semibold text-[#ffd700]">
              {formatPoints(game.scores[i])}
            </span>
          </span>
        ))}
      </div>
      {game.lastSettlement && (
        <div className="mb-3 rounded-lg border border-[#457b9d]/40 bg-[#1d3557]/35 px-3 py-2">
          <p className="text-xs font-medium text-[#a8dadc]">
            {t('game.mahjong.lastRoundSettlement')}
          </p>
          {game.lastSettlement.tenpaiSeats && (
            <p className="mt-1 text-[11px] text-[#f1faee]/80">
              {t('riichi.modal.draw.tenpaiLabel')}
              {game.lastSettlement.tenpaiSeats.length === 0
                ? ` ${t('riichi.modal.none')}`
                : ` ${game.lastSettlement.tenpaiSeats.map((i) => t(`game.mahjong.seats.${i}`)).join(listSeparator)}`}
            </p>
          )}
          <p className="mt-1 text-[11px] text-[#f1faee]/80">
            {t('riichi.modal.summary.delta')}
            {game.lastSettlement.deltas
              .map(
                (d, i) =>
                  `${t(`game.mahjong.seats.${i}`)} ${d >= 0 ? '+' : ''}${d}`,
              )
              .join(' · ')}
          </p>
          {game.lastSettlement.timeoutEvents &&
            game.lastSettlement.timeoutEvents.length > 0 && (
              <p className="mt-1 text-[11px] text-[#f1faee]/80">
                {t('riichi.modal.summary.timeout')}
                {game.lastSettlement.timeoutEvents.join(semicolonSeparator)}
              </p>
            )}
        </div>
      )}
    </>
  );
}
