import { expect, rs, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import { getCurrentRiichiRoundProgressSummary } from '../src/lib/riichiProgress';
import { WinModal } from '../src/pages/mahjong/japanese/components/Modals';
import {
  applyEvent,
  getPendingSeats,
} from '../src/pages/mahjong/japanese/engine';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

test('双响结果弹窗分别显示两名和牌者，并可进入下一局', () => {
  const state = createTestRound();
  state.hands[0] = tiles('147m147p147s12345z');
  state.hands[1] = tiles('123456m123p789s5z');
  state.hands[2] = tiles('123456m123p789s5z');
  state.riichiDeclared[1] = state.riichiDeclared[2] = true;
  let match = applyEvent(matchWithRound(state), {
    type: 'discard',
    seat: 0,
    tile: tile('5z'),
  })!.match;
  while (match.round.phase === 'claim') {
    const seat = getPendingSeats(match.round)[0];
    match = applyEvent(match, {
      type: 'claim',
      seat,
      response: { type: seat === 1 || seat === 2 ? 'ron' : 'pass' },
    })!.match;
  }
  const result = match.round.result;
  expect(result?.type).toBe('win');
  if (result?.type !== 'win') throw new Error('没有双响结果');
  const next = rs.fn();
  render(
    <MemoryRouter>
      <LocaleProvider>
        <WinModal
          result={result}
          roundProgressSummary={getCurrentRiichiRoundProgressSummary()}
          timeoutEvents={[]}
          onNext={next}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: '双响' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /下家/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /对家/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一局' }));
  expect(next).toHaveBeenCalledTimes(1);
});
