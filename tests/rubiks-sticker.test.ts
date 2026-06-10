import { expect, test } from '@rstest/core';
import { drawStickerCanvas } from '../src/pages/rubiks/stickerTexture';

test('贴纸纹理由 Canvas 绘制黑色底、圆角贴纸和高光渐变', () => {
  const calls: string[] = [];
  const gradient = {
    addColorStop: (offset: number, color: string) => {
      calls.push(`stop:${offset}:${color}`);
    },
  };
  const context = {
    beginPath: () => calls.push('beginPath'),
    createLinearGradient: () => {
      calls.push('linearGradient');
      return gradient;
    },
    createRadialGradient: () => {
      calls.push('radialGradient');
      return gradient;
    },
    fill: () => calls.push('fill'),
    fillRect: () => calls.push('fillRect'),
    fillStyle: '',
    globalAlpha: 1,
    lineWidth: 0,
    roundRect: () => calls.push('roundRect'),
    shadowBlur: 0,
    shadowColor: '',
    shadowOffsetY: 0,
    stroke: () => calls.push('stroke'),
    strokeStyle: '',
  };
  const canvas = {
    getContext: () => context,
    height: 0,
    width: 0,
  } as unknown as HTMLCanvasElement;

  drawStickerCanvas(canvas, '#dc2626');

  expect(canvas.width).toBe(512);
  expect(canvas.height).toBe(512);
  expect(calls).toContain('fillRect');
  expect(calls.filter((call) => call === 'roundRect').length).toBeGreaterThan(
    1,
  );
  expect(calls).toContain('radialGradient');
  expect(calls).not.toContain('linearGradient');
  expect(calls).toContain('stop:0:rgba(255,255,255,0.12)');
  expect(calls).toContain('stop:1:rgba(255,255,255,0)');
});
