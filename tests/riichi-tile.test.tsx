import { describe, expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { getTileLabel } from '../src/lib/mahjongRiichi';
import {
  getTileColorClass,
  RiichiTileFace,
} from '../src/pages/mahjong/japanese/components/Tile';

const HONORS = [
  { tile: 27, label: '东', face: '東' },
  { tile: 28, label: '南', face: '南' },
  { tile: 29, label: '西', face: '西' },
  { tile: 30, label: '北', face: '北' },
  { tile: 31, label: '中', face: '中' },
  { tile: 32, label: '发', face: '發' },
  { tile: 33, label: '白', face: '白' },
] as const;

describe('日麻字牌牌面', () => {
  test.each(HONORS)('$tile 与规则层标签 $label 保持同一字牌顺序', ({
    tile,
    label,
    face,
  }) => {
    expect(getTileLabel(tile)).toBe(label);

    render(<RiichiTileFace tile={tile} />);

    expect(screen.getByText(face)).toBeInTheDocument();
  });

  test('中、发、白分别使用红、绿、白色牌样式', () => {
    expect(getTileColorClass(31)).toContain('text-red-700');
    expect(getTileColorClass(31)).toContain('bg-rose-50');

    expect(getTileColorClass(32)).toContain('text-emerald-700');
    expect(getTileColorClass(32)).toContain('bg-emerald-50');

    expect(getTileColorClass(33)).toContain('text-slate-400');
    expect(getTileColorClass(33)).toContain('bg-slate-50');
  });
});
