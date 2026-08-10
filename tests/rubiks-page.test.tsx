import { expect, rs, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import GameRubiks from '../src/pages/rubiks';

test('3D 魔方页面提供打乱、撤销与重置控制并调用引擎', async () => {
  const engine = {
    dispose: rs.fn(),
    reset: rs.fn(),
    scramble: rs.fn(),
    undo: rs.fn(),
    getMoveCount: rs.fn(() => 0),
  };

  let onMoveCountChange: ((count: number) => void) | undefined;

  render(
    <MemoryRouter>
      <LocaleProvider>
        <GameRubiks
          createEngine={(_host, options) => {
            onMoveCountChange = options.onMoveCountChange;
            return engine;
          }}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: '3D 魔方' })).toBeInTheDocument();
  expect(screen.getByText(/步数 0/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '打乱魔方' }));
  fireEvent.click(screen.getByRole('button', { name: '重置魔方' }));

  expect(engine.scramble).toHaveBeenCalledOnce();
  expect(engine.reset).toHaveBeenCalledOnce();

  onMoveCountChange?.(2);
  await waitFor(() => {
    expect(screen.getByText(/步数 2/)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: '撤销上一步' }));
  expect(engine.undo).toHaveBeenCalledOnce();
});
