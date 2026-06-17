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
  myFuritenReason,
  riichiDeclared,
}: Props) {
  const { locale, t } = useLocale();
  const myClaim = !!isMyClaim;
  const anyClaim = !!hasAnyClaimOption;

  const discardLine =
    lastDiscardFrom != null && lastDiscard != null
      ? formatMessage(locale, 'game.mahjong.discardLine', {
          seat: t(`game.mahjong.seats.${lastDiscardFrom}`),
          tile: getTileLabel(lastDiscard, locale),
        })
      : t('game.mahjong.waitingForAction');

  const mainLine = isClaimPhase
    ? myClaim
      ? anyClaim
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
    <div className="text-center mb-3">
      <div className="mb-2">
        <p className="text-sm text-[#f1faee] font-medium">{mainLine}</p>
      </div>

      {lastClaimMsg && (
        <div className="mb-2">
          <span className="inline-block text-xs text-amber-300/95 bg-amber-900/30 rounded-lg py-1 px-3">
            {lastClaimMsg}
          </span>
        </div>
      )}
      {myFuritenReason && (
        <div className="mb-2">
          <span className="inline-block text-xs text-rose-200 bg-rose-900/30 rounded-lg py-1 px-3">
            {myFuritenReason}
          </span>
        </div>
      )}

      {riichiDeclared.some((d) => d) && (
        <div className="mb-2">
          <div className="flex flex-wrap justify-center gap-2">
            {riichiDeclared.map(
              (declared, i) =>
                declared && (
                  <span
                    key={i}
                    className="text-xs text-red-300 bg-red-900/30 rounded-lg py-1 px-2"
                  >
                    {formatMessage(locale, 'game.mahjong.riichiDeclared', {
                      seat: t(`game.mahjong.seats.${i}`),
                    })}
                  </span>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
