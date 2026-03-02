import {
  calcFu,
  calcScore,
  getTotalHan,
  type YakuResult,
} from '@/lib/mahjongRiichi';
import { appendUraDoraYaku, countUraDoraHan } from '../helpers';
import type { RiichiGameState } from '../types';

export type EnrichWinParams = {
  state: RiichiGameState;
  winner: number;
  isTsumo: boolean;
  handWithWin: number[];
  yaku: YakuResult[];
  fu?: number;
  han?: number;
  ten?: number;
};

export function enrichWinResultWithUra(params: EnrichWinParams): {
  winner: number;
  isTsumo: boolean;
  handWithWin: number[];
  yaku: YakuResult[];
  fu?: number;
  han?: number;
  ten?: number;
  uraHan?: number;
  uraDoraIndicators?: number[];
} {
  if (!params.state.riichiDeclared[params.winner]) {
    return {
      winner: params.winner,
      isTsumo: params.isTsumo,
      handWithWin: params.handWithWin,
      yaku: params.yaku,
      fu: params.fu,
      han: params.han,
      ten: params.ten,
      uraHan: 0,
      uraDoraIndicators: [],
    };
  }
  const allTiles = [
    ...params.handWithWin,
    ...params.state.melds[params.winner].flatMap((m) => m.tiles),
  ];
  const uraHan = countUraDoraHan(allTiles, params.state.uraDoraIndicators);
  const yakuWithUra = appendUraDoraYaku(params.yaku, uraHan);
  const uraAdded = yakuWithUra.length !== params.yaku.length;
  if (!uraAdded) {
    return {
      winner: params.winner,
      isTsumo: params.isTsumo,
      handWithWin: params.handWithWin,
      yaku: yakuWithUra,
      fu: params.fu,
      han: params.han,
      ten: params.ten,
      uraHan,
      uraDoraIndicators: params.state.uraDoraIndicators,
    };
  }
  const baseHan = params.han ?? getTotalHan(params.yaku);
  const nextHan = baseHan + uraHan;
  const nextTen =
    params.fu != null
      ? calcScore(
          params.fu,
          nextHan,
          params.state.dealer === params.winner,
          params.isTsumo,
        )
      : params.ten;
  return {
    winner: params.winner,
    isTsumo: params.isTsumo,
    handWithWin: params.handWithWin,
    yaku: yakuWithUra,
    fu: params.fu,
    han: nextHan,
    ten: nextTen,
    uraHan,
    uraDoraIndicators: params.state.uraDoraIndicators,
  };
}

export type WinResultForBaseTen = {
  winner: number;
  isTsumo: boolean;
  yaku: YakuResult[];
  fu?: number;
  han?: number;
  ten?: number;
};

export function resolveWinBaseTen(
  result: WinResultForBaseTen,
  state: RiichiGameState,
): number {
  if (result.ten != null && result.ten > 0) return result.ten;
  const han = result.han ?? getTotalHan(result.yaku);
  if (han <= 0) return 1000;
  const hasPinfu = result.yaku.some((y) => y.id === 'pinfu');
  const isChiitoitsu = result.yaku.some((y) => y.id === 'chiitoitsu');
  const isMenzhen = state.melds[result.winner].every(
    (m) => m.type === 'angang',
  );
  const fu =
    result.fu ??
    calcFu({
      isTsumo: result.isTsumo,
      isMenzhen,
      hasPinfu,
      isChiitoitsu,
    });
  return calcScore(fu, han, state.dealer === result.winner, result.isTsumo);
}
