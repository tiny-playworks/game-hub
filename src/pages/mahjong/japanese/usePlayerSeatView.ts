import { useMemo } from 'react';
import type { PlayerSeatPrivateState, PlayerViewSnapshot } from '../../../../shared/contracts/room';

export const WIND_NAMES = ['东', '南', '西', '北'] as const;

export function toRelativeSeat(absSeat: number, viewerSeat: number): number {
  return (absSeat - viewerSeat + 4) % 4;
}

export function toAbsoluteSeat(relSeat: number, viewerSeat: number): number {
  return (viewerSeat + relSeat) % 4;
}

export interface RelativeSeatPerspective {
  seat: PlayerSeatPrivateState;
  absSeat: number;
  relSeat: number; // 0: 自家(下), 1: 下家(右), 2: 对家(上), 3: 上家(左)
  windName: (typeof WIND_NAMES)[number];
  isCurrentTurn: boolean;
  isSelf: boolean;
}

export function usePlayerSeatView(view: PlayerViewSnapshot | null): {
  selfSeat: RelativeSeatPerspective | null;
  rightSeat: RelativeSeatPerspective | null;
  topSeat: RelativeSeatPerspective | null;
  leftSeat: RelativeSeatPerspective | null;
  orderedPerspectives: RelativeSeatPerspective[];
} {
  return useMemo(() => {
    if (!view) {
      return {
        selfSeat: null,
        rightSeat: null,
        topSeat: null,
        leftSeat: null,
        orderedPerspectives: [],
      };
    }

    const viewerSeat = view.viewerSeat;
    const dealer = view.seats.findIndex((s) => s.isDealer);
    const effectiveDealer = dealer !== -1 ? dealer : 0;

    const ordered: RelativeSeatPerspective[] = [0, 1, 2, 3].map((relSeat) => {
      const absSeat = toAbsoluteSeat(relSeat, viewerSeat);
      const seat = view.seats[absSeat];
      const windIndex = (absSeat - effectiveDealer + 4) % 4;
      return {
        seat,
        absSeat,
        relSeat,
        windName: WIND_NAMES[windIndex],
        isCurrentTurn: view.round.currentPlayer === absSeat && view.round.phase === 'discard',
        isSelf: relSeat === 0,
      };
    });

    return {
      selfSeat: ordered[0],
      rightSeat: ordered[1],
      topSeat: ordered[2],
      leftSeat: ordered[3],
      orderedPerspectives: ordered,
    };
  }, [view]);
}
