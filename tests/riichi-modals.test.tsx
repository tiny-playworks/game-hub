import { expect, rs, test } from 'rstack/test';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import { getCurrentRiichiRoundProgressSummary } from '../src/lib/riichiProgress';
import { WinPresentation } from '../src/pages/mahjong/japanese/components/WinPresentation';
import {
  applyEvent,
  getPendingSeats,
} from '../src/pages/mahjong/japanese/engine';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

function doubleRonResult() {
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
  return { result, doraIndicators: match.round.doraIndicators };
}

test('双响结果弹窗分别显示两名和牌者，并可进入下一局', () => {
  const { result, doraIndicators } = doubleRonResult();
  const next = rs.fn();
  render(
    <MemoryRouter>
      <LocaleProvider>
        <WinPresentation
          result={result}
          doraIndicators={doraIndicators}
          mode="simple"
          moments={[
            {
              id: 'observer',
              seat: 3,
              kind: 'chatter',
              characterId: 'yoru',
              lineKey: 'character.chatter.yoru.big-win.0',
            },
          ]}
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
  expect(screen.getByText('够重。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一局' }));
  expect(next).toHaveBeenCalledTimes(1);
});

test('演出第一次点击显示最终结算，第二次可用键盘继续', () => {
  const { result, doraIndicators } = doubleRonResult();
  const next = rs.fn();
  render(
    <MemoryRouter>
      <LocaleProvider>
        <WinPresentation
          result={result}
          doraIndicators={doraIndicators}
          mode="full"
          roundProgressSummary={getCurrentRiichiRoundProgressSummary()}
          timeoutEvents={[]}
          onNext={next}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: '跳过演出' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('heading', { name: '双响' }));
  expect(screen.getByRole('button', { name: '下一局' })).toBeInTheDocument();
  expect(next).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
  expect(next).toHaveBeenCalledTimes(1);
});

test('关闭演出仅显示简洁卡片，不显示手牌或特效', () => {
  const { result, doraIndicators } = doubleRonResult();
  const next = rs.fn();
  render(
    <MemoryRouter>
      <LocaleProvider>
        <WinPresentation
          result={result}
          doraIndicators={doraIndicators}
          mode="off"
          roundProgressSummary={getCurrentRiichiRoundProgressSummary()}
          timeoutEvents={[]}
          onNext={next}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );
  expect(document.querySelector('.riichi-win-tiles')).toBeNull();
  expect(document.querySelector('.riichi-win-effects')).toBeNull();
  expect(document.querySelector('.riichi-win-tier')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下一局' }));
  expect(next).toHaveBeenCalledTimes(1);
});
