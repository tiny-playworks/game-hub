import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import type { YakuResult } from '@/lib/mahjongRiichi';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { RiichiGameState } from '../types';

type Updater<T> = T | ((prev: T) => T);

export type RiichiWinResult = {
  winner: number;
  isTsumo: boolean;
  yaku: YakuResult[];
  fu?: number;
  han?: number;
  yakuman?: number;
  ten?: number;
  tsumoPayments?: {
    dealerOrAll: number;
    nonDealer: number;
  } | null;
  uraHan?: number;
  uraDoraIndicators?: number[];
};

export type RiichiMatchEnd = {
  reason: MatchEndReason;
  finalScores: number[];
  ranking: number[];
};

type RiichiGameStore = {
  view: 'rules' | 'game';
  matchLength: 'east' | 'south';
  game: RiichiGameState | null;
  history: RiichiGameState[];
  gameLog: string[];
  logOpen: boolean;
  winResult: RiichiWinResult | null;
  showGuide: boolean;
  declinedRonToken: string | null;
  clockNowMs: number;
  matchEnd: RiichiMatchEnd | null;
  setView: (view: 'rules' | 'game') => void;
  setMatchLength: (matchLength: 'east' | 'south') => void;
  setGame: (updater: Updater<RiichiGameState | null>) => void;
  setHistory: (updater: Updater<RiichiGameState[]>) => void;
  setGameLog: (updater: Updater<string[]>) => void;
  setLogOpen: (updater: Updater<boolean>) => void;
  setWinResult: (updater: Updater<RiichiWinResult | null>) => void;
  setShowGuide: (updater: Updater<boolean>) => void;
  setDeclinedRonToken: (token: string | null) => void;
  setClockNowMs: (value: number) => void;
  setMatchEnd: (updater: Updater<RiichiMatchEnd | null>) => void;
};

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function'
    ? (updater as (value: T) => T)(prev)
    : updater;
}

export const useRiichiGameStore = createWithEqualityFn<RiichiGameStore>()(
  devtools(
    (set) => ({
      view: 'rules',
      matchLength: 'east',
      game: null,
      history: [],
      gameLog: [],
      logOpen: false,
      winResult: null,
      showGuide: false,
      declinedRonToken: null,
      clockNowMs: Date.now(),
      matchEnd: null,
      setView: (view) => set({ view }, false, 'riichi/setView'),
      setMatchLength: (matchLength) =>
        set({ matchLength }, false, 'riichi/setMatchLength'),
      setGame: (updater) =>
        set(
          (s) => ({ game: resolveUpdater(updater, s.game) }),
          false,
          'riichi/setGame',
        ),
      setHistory: (updater) =>
        set(
          (s) => ({ history: resolveUpdater(updater, s.history) }),
          false,
          'riichi/setHistory',
        ),
      setGameLog: (updater) =>
        set(
          (s) => ({ gameLog: resolveUpdater(updater, s.gameLog) }),
          false,
          'riichi/setGameLog',
        ),
      setLogOpen: (updater) =>
        set(
          (s) => ({ logOpen: resolveUpdater(updater, s.logOpen) }),
          false,
          'riichi/setLogOpen',
        ),
      setWinResult: (updater) =>
        set(
          (s) => ({ winResult: resolveUpdater(updater, s.winResult) }),
          false,
          'riichi/setWinResult',
        ),
      setShowGuide: (updater) =>
        set(
          (s) => ({ showGuide: resolveUpdater(updater, s.showGuide) }),
          false,
          'riichi/setShowGuide',
        ),
      setDeclinedRonToken: (declinedRonToken) =>
        set({ declinedRonToken }, false, 'riichi/setDeclinedRonToken'),
      setClockNowMs: (clockNowMs) =>
        set({ clockNowMs }, false, 'riichi/setClockNowMs'),
      setMatchEnd: (updater) =>
        set(
          (s) => ({ matchEnd: resolveUpdater(updater, s.matchEnd) }),
          false,
          'riichi/setMatchEnd',
        ),
    }),
    { name: 'riichi-game-store' },
  ),
  shallow,
);
