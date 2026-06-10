import { expect, rs, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameTetris3D from '../src/pages/tetris/index';

test('3D 俄罗斯方块页面显示 DOM HUD 并同步渲染引擎', () => {
  const engine = {
    dispose: rs.fn(),
    sync: rs.fn(),
  };

  const { unmount } = render(
    <MemoryRouter>
      <GameTetris3D createEngine={() => engine} />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('heading', { name: '3D 俄罗斯方块' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/得分:/)).toBeInTheDocument();
  expect(screen.getByText(/等级:/)).toBeInTheDocument();
  expect(screen.getByText(/消行:/)).toBeInTheDocument();
  expect(screen.getByText(/最高纪录:/)).toBeInTheDocument();
  expect(screen.getByText('下一个方块')).toBeInTheDocument();
  expect(engine.sync).toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '按空格或点击舞台开始' }));
  fireEvent.click(screen.getByRole('button', { name: '暂停游戏' }));
  expect(screen.getByRole('button', { name: '继续游戏' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '重新开始' }));
  expect(screen.getByRole('button', { name: '暂停游戏' })).toBeInTheDocument();

  unmount();
  expect(engine.dispose).toHaveBeenCalledOnce();
});

test('3D 俄罗斯方块保留空格开始与 P 暂停键盘操作', () => {
  const engine = {
    dispose: rs.fn(),
    sync: rs.fn(),
  };

  render(
    <MemoryRouter>
      <GameTetris3D createEngine={() => engine} />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('button', { name: '按空格或点击舞台开始' }),
  ).toBeInTheDocument();
  fireEvent.keyDown(window, { code: 'Space' });
  expect(screen.getByText('游戏进行中')).toBeInTheDocument();
  fireEvent.keyDown(window, { code: 'KeyP' });
  expect(screen.getByText('已暂停')).toBeInTheDocument();
});
