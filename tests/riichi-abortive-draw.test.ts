import { describe, expect, test } from '@rstest/core';
import {
  canDeclareKyuushuKyuuhai,
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
  shouldAbortOnSuukaikan,
} from '../src/lib/riichiAbortiveDraw';

describe('日麻途中流局判定', () => {
  test('九种九牌：14 张里幺九字牌种类 >=9 时可宣言', () => {
    const ok = canDeclareKyuushuKyuuhai([
      0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 4, 13, 22,
    ]);
    expect(ok).toBe(true);
  });

  test('四风连打：四家第一打同风牌且无人副露时触发', () => {
    const ok = shouldAbortOnSuufonRenda(
      [[27], [27], [27], [27]],
      [[], [], [], []],
    );
    expect(ok).toBe(true);
  });

  test('四家立直：四家都立直时触发', () => {
    expect(shouldAbortOnSuuchaRiichi([true, true, true, true])).toBe(true);
    expect(shouldAbortOnSuuchaRiichi([true, true, false, true])).toBe(false);
  });

  test('四开杠：两家以上合计四杠触发；一人四杠不触发', () => {
    const byTwoSeats = shouldAbortOnSuukaikan([
      [{ type: 'mingang' }, { type: 'angang' }] as Array<{
        type: 'chi' | 'peng' | 'mingang' | 'angang';
      }>,
      [] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
      [{ type: 'mingang' }, { type: 'angang' }] as Array<{
        type: 'chi' | 'peng' | 'mingang' | 'angang';
      }>,
      [] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
    ]);
    expect(byTwoSeats).toBe(true);

    const byOneSeat = shouldAbortOnSuukaikan([
      [
        { type: 'mingang' },
        { type: 'angang' },
        { type: 'mingang' },
        { type: 'angang' },
      ] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
      [] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
      [] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
      [] as Array<{ type: 'chi' | 'peng' | 'mingang' | 'angang' }>,
    ]);
    expect(byOneSeat).toBe(false);
  });
});
