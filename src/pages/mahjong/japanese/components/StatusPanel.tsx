import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';

type Props = {
  isClaimPhase: boolean;
  isMyClaim: boolean | null;
  hasAnyClaimOption: boolean | null;
  lastDiscardFrom: number | null;
  lastDiscard: number | null;
  claimPlayer: number | null;
  isMyTurn: boolean;
  currentPlayer: number;
  lastClaimMsg: string | null;
  myFuritenReason: string | null;
  riichiDeclared: boolean[];
};

export function StatusPanel({
  isClaimPhase,
  isMyClaim,
  hasAnyClaimOption,
  lastDiscardFrom,
  lastDiscard,
  claimPlayer,
  isMyTurn,
  currentPlayer,
  lastClaimMsg,
}: Props) {
  const { locale, t } = useLocale();
  const discardLine =
    lastDiscardFrom != null && lastDiscard != null
      ? formatMessage(locale, 'game.mahjong.discardLine', {
          seat: t(`game.mahjong.seats.${lastDiscardFrom}`),
          tile: getTileLabel(lastDiscard, locale),
        })
      : t('game.mahjong.waitingForAction');

  const mainLine = isClaimPhase
    ? isMyClaim
      ? hasAnyClaimOption
        ? formatMessage(locale, 'game.mahjong.status.myClaimOptions', {
            discardLine,
          })
        : formatMessage(locale, 'game.mahjong.status.myClaimWait', {
            discardLine,
          })
      : formatMessage(locale, 'game.mahjong.status.otherClaim', {
          discardLine,
          seat: t(`game.mahjong.seats.${claimPlayer ?? 0}`),
        })
    : isMyTurn
      ? t('game.mahjong.status.yourTurn')
      : formatMessage(locale, 'game.mahjong.status.waitingForSeat', {
          seat: t(`game.mahjong.seats.${currentPlayer}`),
        });

  return (
    <div className="riichi-status-ribbon" aria-live="polite">
      <span className="riichi-status-pulse" aria-hidden="true" />
      <strong>{mainLine}</strong>
      {lastClaimMsg && (
        <span className="riichi-status-event">{lastClaimMsg}</span>
      )}
    </div>
  );
}
