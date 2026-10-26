import type { ArcadeDifficulty } from './arcade';
import type { Game2048State } from './game2048';
import type { Board as ChessBoard, Piece as ChessPiece } from './chess';
import type { Board as XiangqiBoard, Piece as XiangqiPiece } from './xiangqi';
import type { ShengjiState } from './shengji';
import type { GoState } from './go';
import type { GomokuStone } from './gomoku';
import { parseHand, type DoudizhuState } from './doudizhu';
import type { ArcadeMemberEvent } from '../../shared/contracts/member';
import type { ArcadeResult } from '@/contexts/ArcadeContext';

type Move = [number, number, number, number] | null;
export interface ChessPosition {
  board: ChessBoard;
  whiteTurn: boolean;
  lastMove: Move;
  captured: ChessPiece[];
}
export interface XiangqiPosition {
  board: XiangqiBoard;
  redTurn: boolean;
  lastMove: Move;
  captured: XiangqiPiece[];
  notation: string[];
}
export interface ArcadePositions {
  go: {
    state: GoState;
    past: GoState[];
    lastMove: [number, number] | null;
    opponent: 'ai' | 'human';
  };
  gomoku: { board: GomokuStone[]; history: number[]; opponent: 'ai' | 'human' };
  doudizhu: { state: DoudizhuState; biddingEnabled: boolean };
  '2048': {
    state: Game2048State;
    history: Game2048State[];
    maxCombo: number;
    moves: number;
    continuing: boolean;
  };
  chess: ChessPosition & { past: ChessPosition[]; opponent: 'ai' | 'human' };
  xiangqi: XiangqiPosition & {
    past: XiangqiPosition[];
    opponent: 'ai' | 'human';
  };
  shengji: { state: ShengjiState; teamLevels: [number, number] };
}
export type ResumableArcadeId = keyof ArcadePositions;
export const RESUMABLE_ARCADE_IDS: readonly string[] = [
  '2048',
  'chess',
  'xiangqi',
  'shengji',
  'go',
  'gomoku',
  'doudizhu',
];
export const MEMBER_ARCADE_MAX_AGE = 24 * 60 * 60 * 1000;
export interface ArcadeResume {
  kind: 'arcade';
  gameId: ResumableArcadeId;
  difficulty: ArcadeDifficulty;
  mode: 'classic' | 'challenge';
  position: ArcadePositions[ResumableArcadeId];
  receipt: {
    id: string;
    started: boolean;
    finished: boolean;
    startedAt: number;
    elapsedMs: number;
  };
  pendingFinish: ArcadeMemberEvent | null;
  result: ArcadeResult | null;
  practiceOnly: boolean;
}

export const arcadeResumeSlot = (gameId: string, mode: string) =>
  `arcade:${gameId}:${mode}`;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const numbers = (value: unknown, length: number, max: number) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((item) => integer(item, 0, max));

function valid2048(value: unknown, size: number): boolean {
  if (
    !object(value) ||
    value.size !== size ||
    !object(value.tiles) ||
    !integer(value.score) ||
    !integer(value.combo) ||
    typeof value.gameOver !== 'boolean'
  )
    return false;
  const tileMap = value.tiles;
  const tiles = Object.values(tileMap);
  const occupied = new Set<string>();
  return (
    tiles.length >= 2 &&
    tiles.length <= size * size * 2 &&
    tiles.every((tile) => {
      if (
        !object(tile) ||
        typeof tile.id !== 'string' ||
        tileMap[tile.id] !== tile ||
        !integer(tile.value, 2, 2 ** 40) ||
        !Number.isInteger(Math.log2(tile.value)) ||
        !integer(tile.r, 0, size - 1) ||
        !integer(tile.c, 0, size - 1) ||
        (tile.mergedInto !== undefined && typeof tile.mergedInto !== 'string')
      )
        return false;
      if (tile.mergedInto) return true;
      const cell = `${tile.r}:${tile.c}`;
      if (occupied.has(cell)) return false;
      occupied.add(cell);
      return true;
    })
  );
}

function validBoardPosition(value: unknown, chinese: boolean): boolean {
  if (!object(value)) return false;
  const rows = chinese ? 10 : 8;
  const cols = chinese ? 9 : 8;
  const types = chinese ? 'kaehrcp' : 'KQRBNP';
  const sides = chinese ? ['red', 'black'] : ['white', 'black'];
  const piece = (p: unknown) =>
    object(p) &&
    typeof p.type === 'string' &&
    p.type.length === 1 &&
    types.includes(p.type) &&
    sides.includes(String(p.side));
  return (
    Array.isArray(value.board) &&
    value.board.length === rows &&
    value.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === cols &&
        row.every((p) => p === null || piece(p)),
    ) &&
    typeof value[chinese ? 'redTurn' : 'whiteTurn'] === 'boolean' &&
    (value.lastMove === null ||
      (Array.isArray(value.lastMove) &&
        value.lastMove.length === 4 &&
        value.lastMove.every((n, i) =>
          integer(n, 0, (i % 2 === 0 ? rows : cols) - 1),
        ))) &&
    Array.isArray(value.captured) &&
    value.captured.length <= 32 &&
    value.captured.every(piece) &&
    (!chinese ||
      (Array.isArray(value.notation) &&
        value.notation.every((n) => typeof n === 'string')))
  );
}

function validShengji(value: unknown): boolean {
  if (
    !object(value) ||
    !object(value.state) ||
    !numbers(value.teamLevels, 2, 12)
  )
    return false;
  const s = value.state;
  const cards = (v: unknown, max: number) =>
    Array.isArray(v) && v.length <= max && v.every((c) => integer(c, 0, 53));
  if (
    !Array.isArray(s.hands) ||
    s.hands.length !== 4 ||
    !s.hands.every((hand) => cards(hand, 13)) ||
    !cards(s.currentTrick, 3) ||
    !cards(s.bottomCards, 2) ||
    !cards(s.playedCards ?? [], 52) ||
    !integer(s.dealer, 0, 3) ||
    !integer(s.currentPlayer, 0, 3) ||
    !integer(s.trickLeader, 0, 3) ||
    !integer(s.trumpSuit, -1, 3) ||
    !integer(s.levelRank, 0, 12) ||
    !integer(s.tricksPlayed, 0, 13) ||
    !numbers(s.teamScores, 2, 200) ||
    !integer(s.bottomBonus, 0, 40) ||
    typeof s.roundOver !== 'boolean' ||
    typeof s.defenderUpgrade !== 'boolean'
  )
    return false;
  const remaining = [
    ...s.hands.flat(),
    ...(s.currentTrick as number[]),
    ...(s.bottomCards as number[]),
  ];
  if (
    new Set(remaining).size !== remaining.length ||
    remaining.length !== 54 - s.tricksPlayed * 4
  )
    return false;
  return (
    s.lastTrick === null ||
    (object(s.lastTrick) &&
      cards(s.lastTrick.cards, 4) &&
      (s.lastTrick.cards as number[]).length === 4 &&
      integer(s.lastTrick.leader, 0, 3) &&
      integer(s.lastTrick.winner, 0, 3) &&
      integer(s.lastTrick.points, 0, 40))
  );
}

function point(value: unknown, size: number): boolean {
  return value === null || numbers(value, 2, size - 1);
}
function validGo(value: unknown): boolean {
  return (
    object(value) &&
    Array.isArray(value.board) &&
    value.board.length === 9 &&
    value.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 9 &&
        row.every((c) => c === null || c === 'B' || c === 'W'),
    ) &&
    typeof value.blackTurn === 'boolean' &&
    typeof value.lastPass === 'boolean' &&
    typeof value.gameOver === 'boolean' &&
    integer(value.blackCaptured) &&
    integer(value.whiteCaptured) &&
    point(value.koPoint, 9)
  );
}
function validDoudizhu(value: unknown): boolean {
  if (
    !object(value) ||
    !object(value.state) ||
    typeof value.biddingEnabled !== 'boolean'
  )
    return false;
  const s = value.state;
  const cards = (v: unknown): v is number[] =>
    Array.isArray(v) && v.length <= 54 && v.every((c) => integer(c, 0, 53));
  if (
    !Array.isArray(s.hands) ||
    s.hands.length !== 3 ||
    !s.hands.every((h) => cards(h) && h.length <= 20) ||
    !integer(s.landlord, -1, 2) ||
    !integer(s.currentPlayer, 0, 2) ||
    !integer(s.passCount, 0, 2) ||
    typeof s.gameOver !== 'boolean' ||
    ![null, 0, 1].includes(s.winner as null | number) ||
    !cards(s.playedCards ?? []) ||
    !cards(s.bottomCards ?? []) ||
    (s.phase !== undefined && s.phase !== 'bidding' && s.phase !== 'playing') ||
    (s.playCounts !== undefined && !numbers(s.playCounts, 3, 54)) ||
    (s.bids !== undefined &&
      (!Array.isArray(s.bids) ||
        s.bids.length > 3 ||
        !s.bids.every(
          (b) => object(b) && integer(b.seat, 0, 2) && integer(b.score, 0, 3),
        ))) ||
    (s.highestBid !== undefined && !integer(s.highestBid, 0, 3)) ||
    (s.firstBidder !== undefined && !integer(s.firstBidder, 0, 2)) ||
    (s.dealNumber !== undefined && !integer(s.dealNumber, 1))
  )
    return false;
  const all = [
    ...s.hands.flat(),
    ...((s.playedCards as number[]) ?? []),
    ...(s.phase === 'bidding' ? ((s.bottomCards as number[]) ?? []) : []),
  ];
  if (all.length !== 54 || new Set(all).size !== 54) return false;
  if (s.lastPlay === null) return true;
  if (
    !object(s.lastPlay) ||
    !integer(s.lastPlay.player, 0, 2) ||
    !object(s.lastPlay.hand) ||
    !cards(s.lastPlay.hand.cards)
  )
    return false;
  const hand = parseHand(s.lastPlay.hand.cards);
  return (
    !!hand &&
    hand.type === s.lastPlay.hand.type &&
    hand.rank === s.lastPlay.hand.rank
  );
}

export function isArcadeResume(value: unknown): value is ArcadeResume {
  if (
    !object(value) ||
    value.kind !== 'arcade' ||
    !RESUMABLE_ARCADE_IDS.includes(String(value.gameId)) ||
    !['easy', 'normal', 'hard'].includes(String(value.difficulty)) ||
    !['classic', 'challenge'].includes(String(value.mode)) ||
    !object(value.position) ||
    !object(value.receipt) ||
    typeof value.receipt.id !== 'string' ||
    !/^arcade:[\da-f-]{36}$/i.test(value.receipt.id) ||
    typeof value.receipt.started !== 'boolean' ||
    typeof value.receipt.finished !== 'boolean' ||
    !integer(value.receipt.startedAt) ||
    !integer(value.receipt.elapsedMs) ||
    typeof value.practiceOnly !== 'boolean'
  )
    return false;
  if (
    value.result !== null &&
    (!object(value.result) ||
      !['win', 'lose', 'draw'].includes(String(value.result.outcome)) ||
      !integer(value.result.score) ||
      !integer(value.result.coinsEarned) ||
      typeof value.result.capReached !== 'boolean')
  )
    return false;
  if (
    value.pendingFinish !== null &&
    (!object(value.pendingFinish) ||
      value.pendingFinish.type !== 'finish' ||
      value.pendingFinish.roundId !== value.receipt.id ||
      value.pendingFinish.gameId !== value.gameId ||
      value.pendingFinish.difficulty !== value.difficulty ||
      !['win', 'lose', 'draw'].includes(String(value.pendingFinish.outcome)) ||
      !integer(value.pendingFinish.score) ||
      (value.mode === 'challenge'
        ? value.pendingFinish.challengeId !== 'focus-v1'
        : value.pendingFinish.challengeId !== undefined))
  )
    return false;
  const p = value.position;
  if (value.gameId === 'go')
    return (
      validGo(p.state) &&
      Array.isArray(p.past) &&
      p.past.length <= 2000 &&
      p.past.every(validGo) &&
      point(p.lastMove, 9) &&
      ['ai', 'human'].includes(String(p.opponent))
    );
  if (value.gameId === 'gomoku') {
    if (
      !Array.isArray(p.board) ||
      p.board.length !== 225 ||
      !Array.isArray(p.history) ||
      p.history.length > 225 ||
      !p.history.every((n) => integer(n, 0, 224)) ||
      new Set(p.history).size !== p.history.length ||
      !['ai', 'human'].includes(String(p.opponent))
    )
      return false;
    const board = Array<unknown>(225).fill(null);
    p.history.forEach((n, i) => {
      board[n] = i % 2 ? 'W' : 'B';
    });
    return p.board.every((stone, i) => stone === board[i]);
  }
  if (value.gameId === 'doudizhu') return validDoudizhu(p);
  if (value.gameId === '2048') {
    const size =
      value.difficulty === 'normal' ? 5 : value.difficulty === 'hard' ? 3 : 4;
    return (
      valid2048(p.state, size) &&
      Array.isArray(p.history) &&
      p.history.length <= 5 &&
      p.history.every((state) => valid2048(state, size)) &&
      integer(p.maxCombo) &&
      integer(p.moves) &&
      typeof p.continuing === 'boolean'
    );
  }
  if (value.gameId === 'shengji')
    return value.difficulty !== 'easy' && validShengji(p);
  const chinese = value.gameId === 'xiangqi';
  return (
    validBoardPosition(p, chinese) &&
    ['ai', 'human'].includes(String(p.opponent)) &&
    Array.isArray(p.past) &&
    p.past.length <= 2000 &&
    p.past.every((state) => validBoardPosition(state, chinese))
  );
}
