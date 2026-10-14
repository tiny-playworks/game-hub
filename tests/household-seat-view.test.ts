import { describe, expect, it } from 'rstack/test';
import {
  toAbsoluteSeat,
  toRelativeSeat,
  WIND_NAMES,
} from '../src/pages/mahjong/japanese/usePlayerSeatView';

describe('P12 座次视角投影算法测试', () => {
  it('正确将绝对座次转换为本人视角下的相对方位 (下、右、上、左)', () => {
    // 假设本人坐在 0 号席位 (东)
    expect(toRelativeSeat(0, 0)).toBe(0); // 自家 (下)
    expect(toRelativeSeat(1, 0)).toBe(1); // 下家 (右)
    expect(toRelativeSeat(2, 0)).toBe(2); // 对家 (上)
    expect(toRelativeSeat(3, 0)).toBe(3); // 上家 (左)

    // 假设本人坐在 2 号席位 (西)
    expect(toRelativeSeat(2, 2)).toBe(0); // 自家 (下)
    expect(toRelativeSeat(3, 2)).toBe(1); // 下家 (右)
    expect(toRelativeSeat(0, 2)).toBe(2); // 对家 (上)
    expect(toRelativeSeat(1, 2)).toBe(3); // 上家 (左)
  });

  it('正确将相对方位映射回服务器绝对座次', () => {
    // 假设本人坐在 1 号席位 (南)
    expect(toAbsoluteSeat(0, 1)).toBe(1); // 下方对应 1 号席位
    expect(toAbsoluteSeat(1, 1)).toBe(2); // 右侧对应 2 号席位
    expect(toAbsoluteSeat(2, 1)).toBe(3); // 上方对应 3 号席位
    expect(toAbsoluteSeat(3, 1)).toBe(0); // 左侧对应 0 号席位
  });

  it('风位名称常量完整性验证', () => {
    expect(WIND_NAMES).toEqual(['东', '南', '西', '北']);
  });
});
