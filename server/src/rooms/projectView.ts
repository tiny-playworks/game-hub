import type {
  PlayerSeatPrivateState,
  PlayerViewSnapshot,
  RoomSummary,
} from '../../../shared/contracts/room';
import type { RiichiMatchState } from '@/pages/mahjong/japanese/engine/match';
import { getSeatClaimOptions } from '@/pages/mahjong/japanese/engine';

export function createPlayerView(
  roomId: string,
  matchId: string,
  viewerSeat: number,
  revision: number,
  match: RiichiMatchState,
  room: RoomSummary,
  serverDeadline: number | null = null,
  viewerDeviceId?: string,
): PlayerViewSnapshot {
  const round = match.round;

  const seats = [0, 1, 2, 3].map((seatIndex): PlayerSeatPrivateState => {
    const isSelf = seatIndex === viewerSeat;
    const roomSeat = room.seats[seatIndex];

    const identity: PlayerSeatPrivateState['identity'] =
      roomSeat.type === 'human'
        ? {
            type: 'human',
            name: roomSeat.nickname,
            avatarPresetId: roomSeat.avatarPresetId,
          }
        : roomSeat.type === 'ai'
          ? {
              type: 'ai',
              name: roomSeat.characterId,
              characterId: roomSeat.characterId,
            }
          : {
              type: 'ai',
              name: `AI-${seatIndex + 1}`,
            };

    const hand = round.hands[seatIndex] ?? [];
    const melds = round.melds[seatIndex] ?? [];
    const discards = round.discardPiles[seatIndex] ?? [];

    const isHuman = roomSeat.type === 'human';
    const connected = isHuman ? roomSeat.connected : true;
    const isAutoplay = isHuman ? roomSeat.isAutoplay : false;
    const hasControlLease = isHuman
      ? !viewerDeviceId || roomSeat.leaseDeviceId === viewerDeviceId
      : false;

    return {
      seatIndex,
      identity,
      // 核心隐私安全保护：只有自家能看见暗手牌，其余席位全部下发为空数组
      hand: isSelf ? [...hand] : [],
      tileCount: hand.length,
      melds: melds.map((m) => ({ ...m })),
      discards: [...discards],
      score: round.scores[seatIndex] ?? 25000,
      isRiichi: Boolean(round.riichiDeclared[seatIndex]),
      isDealer: round.dealer === seatIndex,
      connected,
      isAutoplay,
      hasControlLease,
      // 只有自家且持有控制权且轮到自家行牌时才下发 turnOptions
      turnOptions: isSelf && hasControlLease && !isAutoplay ? round.turnOptions : null,
      // 只有自家且持有控制权且鸣牌窗口未响应时才下发 claimOptions
      claimOptions: isSelf && hasControlLease && !isAutoplay ? getSeatClaimOptions(round, seatIndex) : null,
    };
  }) as [
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
  ];

  return {
    roomId,
    matchId,
    viewerSeat,
    revision,
    status: match.status,
    isPaused: room.isPaused ?? false,
    round: {
      roundWind: round.roundWind,
      roundNumber: round.roundNumber,
      honba: round.honba,
      riichiPot: round.riichiPot,
      doraIndicators: [...round.doraIndicators],
      wallRemaining: round.wall.length,
      currentPlayer: round.currentPlayer,
      phase: round.phase,
      claimTile:
        round.phase === 'claim' && round.claim
          ? { tile: round.claim.tile, from: round.claim.from }
          : null,
    },
    seats,
    serverDeadline,
    result: round.result,
    matchEnd: match.matchEnd,
  };
}
