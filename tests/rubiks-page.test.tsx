import { expect, rs, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import GameRubiks from '../src/pages/rubiks';

test('3D 魔方页面提供打乱与重置控制并调用引擎', () => {
  const engine = {
    dispose: rs.fn(),
    reset: rs.fn(),
    scramble: rs.fn(),
  };

  render(
    <MemoryRouter>
      <LocaleProvider>
        <GameRubiks createEngine={() => engine} />
      </LocaleProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: '3D 魔方' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打乱魔方' }));
  fireEvent.click(screen.getByRole('button', { name: '重置魔方' }));

  expect(engine.scramble).toHaveBeenCalledOnce();
  expect(engine.reset).toHaveBeenCalledOnce();
});
