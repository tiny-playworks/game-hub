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
  canRon: boolean | null;
  hasNonRonClaimOption: boolean | null;
  chiOptionsLength: number;
  canPeng: boolean | null;
  canMingang: boolean | null;
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
  canRon,
  hasNonRonClaimOption,
  chiOptionsLength,
  canPeng,
  canMingang,
  lastClaimMsg,
  myFuritenReason,
  riichiDeclared,
}: Props) {
  const myClaim = !!isMyClaim;
  const anyClaim = !!hasAnyClaimOption;
  const ron = !!canRon;
  const nonRon = !!hasNonRonClaimOption;
  const peng = !!canPeng;
  const mingang = !!canMingang;

  const mainLine = isClaimPhase
    ? myClaim
      ? anyClaim
        ? `⚠️ ${lastDiscardFrom != null ? SEAT_NAMES[lastDiscardFrom] : ''} 打出了 ${lastDiscard != null ? getTileLabel(lastDiscard) : ''}`
        : '⏳ 等待其他玩家行动...'
      : `⏳ ${lastDiscardFrom != null ? SEAT_NAMES[lastDiscardFrom] : ''} 打出了 ${lastDiscard != null ? getTileLabel(lastDiscard) : ''}，当前轮到 ${SEAT_NAMES[claimPlayer ?? 0]}`
    : isMyTurn
      ? '🎮 轮到你出牌了'
      : `⏳ 等待 ${SEAT_NAMES[currentPlayer]} 行动`;

  const showClaimHint = ron || (myClaim && nonRon);
  const claimHintParts: string[] = [];
  if (ron) claimHintParts.push('胡牌');
  if (chiOptionsLength > 0) claimHintParts.push(`吃(${chiOptionsLength}种)`);
  if (peng) claimHintParts.push('碰');
  if (mingang) claimHintParts.push('杠');
  if (myClaim) claimHintParts.push('过');
  else if (ron) claimHintParts.push('放弃荣和');
  const claimHintText = `💡 可选操作：${claimHintParts.join(' ')}`;

  return (
    <div className="text-center mb-3">
      <div className="mb-2">
        <p className="text-sm text-[#f1faee] font-medium">{mainLine}</p>
      </div>

      {showClaimHint && (
        <div className="mb-2">
          <p className="text-xs text-[#a8dadc] bg-[#1d3557]/50 rounded-lg py-1 px-3 inline-block">
            {claimHintText}
          </p>
        </div>
      )}

      {lastClaimMsg && (
        <div className="mb-2">
          <span className="inline-block text-xs text-amber-300/95 bg-amber-900/30 rounded-lg py-1 px-3">
            📢 {lastClaimMsg}
          </span>
        </div>
      )}
      {myFuritenReason && (
        <div className="mb-2">
          <span className="inline-block text-xs text-rose-200 bg-rose-900/30 rounded-lg py-1 px-3">
            ⚠️ {myFuritenReason}
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
                    🎯 {SEAT_NAMES[i]} 已立直
                  </span>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
