/** Horizontal Delayed Auto Shift / Auto Repeat Rate for Tetris-like controls. */

export interface DasArrConfig {
  /** Delay before auto-repeat starts (ms). */
  dasMs: number;
  /** Interval between auto-repeat moves (ms). 0 = fire once per tick after DAS. */
  arrMs: number;
}

export const DEFAULT_DAS_ARR: DasArrConfig = {
  dasMs: 167,
  arrMs: 33,
};

export type HorizontalDir = -1 | 1;

export interface DasArrState {
  held: HorizontalDir | null;
  dasElapsed: number;
  arrElapsed: number;
  charged: boolean;
}

export function createDasArrState(): DasArrState {
  return {
    held: null,
    dasElapsed: 0,
    arrElapsed: 0,
    charged: false,
  };
}

export function dasArrOnKeyDown(
  state: DasArrState,
  dir: HorizontalDir,
): { state: DasArrState; fire: boolean } {
  if (state.held === dir) {
    return { state, fire: false };
  }
  return {
    state: {
      held: dir,
      dasElapsed: 0,
      arrElapsed: 0,
      charged: false,
    },
    fire: true,
  };
}

export function dasArrOnKeyUp(
  state: DasArrState,
  dir: HorizontalDir,
): DasArrState {
  if (state.held !== dir) return state;
  return createDasArrState();
}

export function dasArrTick(
  state: DasArrState,
  dtMs: number,
  config: DasArrConfig,
): { state: DasArrState; fires: number } {
  if (state.held === null || dtMs <= 0) {
    return { state, fires: 0 };
  }

  let dasElapsed = state.dasElapsed;
  let arrElapsed = state.arrElapsed;
  let charged = state.charged;
  let fires = 0;
  let remaining = dtMs;

  if (!charged) {
    const need = config.dasMs - dasElapsed;
    if (remaining < need) {
      return {
        state: { ...state, dasElapsed: dasElapsed + remaining },
        fires: 0,
      };
    }
    remaining -= need;
    dasElapsed = config.dasMs;
    charged = true;
    fires += 1;
    arrElapsed = 0;
  }

  if (config.arrMs <= 0) {
    // Instant ARR: one additional fire per tick while charged (after DAS fire above).
    if (remaining > 0 && fires === 0) fires = 1;
    return {
      state: {
        held: state.held,
        dasElapsed,
        arrElapsed: 0,
        charged: true,
      },
      fires,
    };
  }

  arrElapsed += remaining;
  while (arrElapsed >= config.arrMs) {
    arrElapsed -= config.arrMs;
    fires += 1;
  }

  return {
    state: {
      held: state.held,
      dasElapsed,
      arrElapsed,
      charged: true,
    },
    fires,
  };
}
