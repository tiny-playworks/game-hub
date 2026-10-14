import type { HumanSeat } from '../../../shared/contracts/room';

export const DISCONNECT_GRACE_PERIOD_MS = 60_000;

export function markSeatDisconnected(seat: HumanSeat): void {
  seat.connected = false;
  seat.disconnectedAt = Date.now();
}

export function markSeatConnected(seat: HumanSeat, deviceId: string): void {
  seat.connected = true;
  seat.disconnectedAt = null;
  // 如果断线前就是该设备持有控制权，保持控制权
  if (!seat.leaseDeviceId) {
    seat.leaseDeviceId = deviceId;
  }
}

export function shouldTriggerAutoplay(seat: HumanSeat, now: number = Date.now()): boolean {
  if (seat.isAutoplay) return true;
  if (!seat.connected && seat.disconnectedAt) {
    return now - seat.disconnectedAt >= DISCONNECT_GRACE_PERIOD_MS;
  }
  return false;
}

export function takeoverSeatControl(
  seat: HumanSeat,
  newDeviceId: string,
): { changed: boolean; previousDeviceId?: string } {
  const previous = seat.leaseDeviceId;
  const changed = previous !== newDeviceId;

  seat.leaseDeviceId = newDeviceId;
  seat.connected = true;
  seat.disconnectedAt = null;
  seat.isAutoplay = false; // 接管时立即解除托管

  return {
    changed,
    previousDeviceId: changed ? previous : undefined,
  };
}

export function hasControlLease(seat: HumanSeat, deviceId: string): boolean {
  return seat.leaseDeviceId === deviceId;
}
