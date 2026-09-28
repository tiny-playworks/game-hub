import { AKA_5_MAN, AKA_5_PIN, AKA_5_SOU } from '../../src/lib/mahjongRiichi';

/**
 * 天凤风格牌面记法 → 本项目牌 id。
 * m=万 p=筒 s=条 z=字（1-4 东南西北，5 白 6 发 7 中）；0m/0p/0s 为赤五。
 * 例：tiles('123m406p789s11z')
 */
export function tiles(notation: string): number[] {
  const out: number[] = [];
  let digits: string[] = [];
  for (const ch of notation.replace(/\s+/g, '')) {
    if (/\d/.test(ch)) {
      digits.push(ch);
      continue;
    }
    for (const d of digits) out.push(toTileId(Number(d), ch));
    digits = [];
  }
  if (digits.length > 0) throw new Error(`Missing suit in "${notation}"`);
  return out;
}

export function tile(notation: string): number {
  const result = tiles(notation);
  if (result.length !== 1) throw new Error(`Expected one tile: ${notation}`);
  return result[0];
}

function toTileId(n: number, suit: string): number {
  if (suit === 'm') return n === 0 ? AKA_5_MAN : n - 1;
  if (suit === 's') return n === 0 ? AKA_5_SOU : 9 + n - 1;
  if (suit === 'p') return n === 0 ? AKA_5_PIN : 18 + n - 1;
  if (suit === 'z') {
    if (n >= 1 && n <= 4) return 27 + n - 1;
    if (n === 5) return 33;
    if (n === 6) return 32;
    if (n === 7) return 31;
  }
  throw new Error(`Unknown tile ${n}${suit}`);
}
