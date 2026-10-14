import type { MemberSnapshot } from '../../../shared/contracts/member';
import type {
  RiichiEffect,
  RiichiEvent,
  RiichiMatchState,
  RiichiAiLevel,
} from '@/pages/mahjong/japanese/engine';

export interface MemberRiichiSession {
  match: RiichiMatchState;
  matchId: string;
  playerCharacterId: string;
  effects: RiichiEffect[];
  snapshot: MemberSnapshot;
}

export interface MemberRiichiCurrent {
  match: RiichiMatchState | null;
  matchId: string | null;
  playerCharacterId: string | null;
}

export interface MemberRiichiStart {
  matchId: string;
  source: 'free' | 'ai-ranked';
  matchLength: 'east' | 'south';
  aiLevel?: RiichiAiLevel;
  opponents?: readonly (string | null)[];
}

export interface RiichiOnlineBridge {
  start: (input: MemberRiichiStart) => Promise<MemberRiichiSession>;
  event: (input: {
    matchId: string;
    expectedTurn: number;
    event: RiichiEvent;
  }) => Promise<MemberRiichiSession>;
  current: () => Promise<MemberRiichiCurrent>;
  forfeit: (matchId: string) => Promise<MemberRiichiSession>;
}

let currentBridge: RiichiOnlineBridge | null = null;

export function setRiichiOnlineBridge(bridge: RiichiOnlineBridge | null): void {
  currentBridge = bridge;
}

export function getRiichiOnlineBridge(): RiichiOnlineBridge | null {
  return currentBridge;
}
