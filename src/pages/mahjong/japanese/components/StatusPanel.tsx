import { getTileLabel } from '@/lib/mahjongRiichi';
import { SEAT_NAMES } from '../constants';

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
  const myClaim = !!isMyClaim;
  const anyClaim = !!hasAnyClaimOption;
  const discardLine =
    lastDiscardFrom != null && lastDiscard != null
      ? `${SEAT_NAMES[lastDiscardFrom]} 打出 ${getTileLabel(lastDiscard)}`
      : '等待操作';

  const mainLine = isClaimPhase
    ? myClaim
      ? anyClaim
        ? `${discardLine}，请选择操作`
        : `${discardLine}，等待其他玩家响应`
      : `${discardLine}，当前轮到 ${SEAT_NAMES[claimPlayer ?? 0]}`
    : isMyTurn
      ? '轮到你出牌'
      : `等待 ${SEAT_NAMES[currentPlayer]} 行动`;

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
                    {SEAT_NAMES[i]} 已立直
                  </span>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
