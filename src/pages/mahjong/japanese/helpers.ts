import { formatMessage, getMessage, type Locale } from '@/lib/i18n';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { PaymentDetail } from '@/lib/riichiSettlement';
import type {
  RiichiGameState,
  RiichiLogEntry,
  RiichiMeld,
  RyuukyokuReason,
} from './types';

export { getNextRound } from './engine/match';
export { getSeatWind } from './engine/selectors';

function getOccurrenceKey(baseKey: string, seen: Map<string, number>): string {
  const occurrence = (seen.get(baseKey) ?? 0) + 1;
  seen.set(baseKey, occurrence);
  return `${baseKey}-${occurrence}`;
}

export function toTileKeyedItems(
  tiles: readonly number[],
  scope: string,
): { tile: number; key: string }[] {
  const seen = new Map<string, number>();
  return tiles.map((tile) => {
    const baseKey = `${scope}-${tile}`;
    return { tile, key: getOccurrenceKey(baseKey, seen) };
  });
}

export function toMeldKeyedItems(
  melds: readonly RiichiMeld[],
  scope: string,
): { meld: RiichiMeld; key: string }[] {
  const seen = new Map<string, number>();
  return melds.map((meld) => {
    const baseKey = `${scope}-${meld.type}-${meld.fromPlayer ?? 'self'}-${meld.tiles.join('.')}`;
    return { meld, key: getOccurrenceKey(baseKey, seen) };
  });
}

export function getMatchEndReasonText(
  reason: MatchEndReason | undefined,
  translate: (key: string) => string,
): string {
  return translate(
    reason
      ? `riichi.matchEndReason.${reason}`
      : 'riichi.matchEndReason.default',
  );
}

export function getRyuukyokuReasonText(
  reason: RyuukyokuReason,
  translate: (key: string) => string,
): string {
  return translate(`riichi.drawReason.${reason}`);
}

export function getRyuukyokuDescription(
  reason: RyuukyokuReason,
  translate: (key: string) => string,
): string {
  return translate(`riichi.drawDesc.${reason}`);
}

/** 统计各基础牌型（0-33）对自家可见的枚数：自家手牌、所有副露、牌河与宝牌表示牌 */
export function countVisibleTilesByBase(
  state: RiichiGameState,
  seat = 0,
): number[] {
  const count = new Array<number>(34).fill(0);
  const add = (tile: number) => {
    const b = getBaseTile(tile);
    if (b >= 0 && b < 34) count[b]++;
  };
  state.hands[seat].forEach(add);
  for (const seatMelds of state.melds) {
    for (const meld of seatMelds) meld.tiles.forEach(add);
  }
  for (let i = 0; i < 4; i++) state.discardPiles[i].forEach(add);
  for (const ind of state.doraIndicators) add(ind);
  return count;
}

export function formatPoints(points: number, locale: Locale = 'zh'): string {
  return formatMessage(locale, 'riichi.unit.points', {
    points: points.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN'),
  });
}

export function summarizeWinnerPayments(
  payments: PaymentDetail[],
  winner: number,
): { base: number; honba: number; riichi: number } {
  let base = 0;
  let honba = 0;
  let riichi = 0;
  for (const p of payments) {
    if (p.to !== winner) continue;
    if (p.reason === 'riichi') riichi += p.amount;
    else if (p.reason === 'honba') honba += p.amount;
    else base += p.amount;
  }
  return { base, honba, riichi };
}

/** 把引擎日志条目渲染为当前语言的文本 */
export function formatLogEntry(entry: RiichiLogEntry, locale: Locale): string {
  const vars: Record<string, string | number> = {};
  const separator = locale === 'en' ? ' ' : '';
  for (const [k, v] of Object.entries(entry.params ?? {})) {
    if (k === 'seat' || k === 'from') {
      vars[k] = getMessage(locale, `game.mahjong.seats.${v}`);
    } else if (k === 'tile' && typeof v === 'number') {
      vars[k] = getTileLabel(v, locale);
    } else if (k === 'tiles' && Array.isArray(v)) {
      vars[k] = v.map((t) => getTileLabel(t, locale)).join(separator);
    } else if (k.endsWith('Key') && typeof v === 'string') {
      vars[k] = getMessage(locale, v);
    } else if (typeof v === 'number') {
      vars[k] = v;
    } else if (typeof v === 'string') {
      vars[k] = v;
    }
  }
  return formatMessage(locale, entry.key, vars);
}
