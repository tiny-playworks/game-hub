import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { MeldTiles } from '../src/pages/mahjong/japanese/components/MeldTiles';
import { tile, tiles } from './helpers/riichiTiles';

test.each([
  { from: 3, index: 0 },
  { from: 2, index: 1 },
  { from: 1, index: 2 },
])('吃碰按来源方向横置实际被鸣的赤牌：$from', ({ from, index }) => {
  render(
    <MeldTiles
      seat={0}
      meld={{
        type: 'peng',
        tiles: tiles('550m'),
        fromPlayer: from,
        calledTile: tile('0m'),
      }}
    />,
  );
  const faces = screen.getAllByRole('img');
  expect(faces).toHaveLength(3);
  expect(faces[index]).toHaveAttribute('data-rotation', '90');
  expect(faces[index]).toHaveAttribute('aria-label', '赤五万');
});

test('加杠显示四张牌，第四张叠在原被鸣牌上', () => {
  const { container } = render(
    <MeldTiles
      seat={0}
      meld={{
        type: 'kakan',
        tiles: tiles('5550p'),
        fromPlayer: 2,
        calledTile: tile('5p'),
      }}
    />,
  );
  expect(screen.getAllByRole('img')).toHaveLength(4);
  expect(
    container.querySelector('.riichi-meld-added [role="img"]'),
  ).toHaveAttribute('aria-label', '赤五筒');
  expect(
    container.querySelector('.riichi-meld-added [role="img"]'),
  ).toHaveAttribute('data-rotation', '90');
});
