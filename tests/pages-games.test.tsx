import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import Achievements from '../src/pages/Achievements';
import Game2048 from '../src/pages/Game2048';
import GameBreakout from '../src/pages/GameBreakout';
import GameChess from '../src/pages/GameChess';
import GameDoudizhu from '../src/pages/GameDoudizhu';
import GameGo from '../src/pages/GameGo';
import GameGomoku from '../src/pages/GameGomoku';
import GameGuessNumber from '../src/pages/GameGuessNumber';
import GameMemory from '../src/pages/GameMemory';
import GameShengji from '../src/pages/GameShengji';
import GameShooter from '../src/pages/GameShooter';
import GameSnake from '../src/pages/GameSnake';
import GameTank from '../src/pages/GameTank';
import GameTetris from '../src/pages/GameTetris';
import GameTictactoe from '../src/pages/GameTictactoe';
import GameXiangqi from '../src/pages/GameXiangqi';
import GameMahjongJapanese from '../src/pages/mahjong/japanese/index';

const withRouter = (children: React.ReactElement) => (
  <MemoryRouter>
    <LocaleProvider>{children}</LocaleProvider>
  </MemoryRouter>
);

const withRouterAt = (children: React.ReactElement, initialEntry: string) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    <LocaleProvider>{children}</LocaleProvider>
  </MemoryRouter>
);

test('成就页：渲染标题与成就列表', () => {
  render(
    <MemoryRouter>
      <LocaleProvider>
        <Achievements />
      </LocaleProvider>
    </MemoryRouter>,
  );
  expect(
    screen.getByRole('heading', { name: /成就|Achievements/ }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('link', { name: /返回首页|Back to Home/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('猜数字：渲染标题与猜按钮', () => {
  render(withRouter(<GameGuessNumber />));
  expect(
    screen.getAllByText(/猜数字|Guess Number/).length,
  ).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('button', { name: /猜|Guess/ })).toBeInTheDocument();
});

test('井字棋：渲染棋盘与重开按钮', () => {
  render(withRouter(<GameTictactoe />));
  expect(
    screen.getByRole('button', { name: /重开|Restart/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/下一位|赢家|平局|Next|Winner|Draw/),
  ).toBeInTheDocument();
});

test('五子棋：渲染五子连珠说明与重开按钮', () => {
  render(withRouter(<GameGomoku />));
  expect(screen.getByText(/五子连珠即胜|Gomoku/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('中国象棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameXiangqi />));
  expect(screen.getByText(/中国象棋|Xiangqi/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('国际象棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameChess />));
  expect(screen.getByText(/国际象棋|Chess/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('围棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameGo />));
  expect(screen.getByText(/围棋|Go 9/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('记忆翻牌：渲染步数统计', () => {
  render(withRouter(<GameMemory />));
  expect(screen.getByText(/步数:|Moves:/)).toBeInTheDocument();
});

test('2048：渲染分数与操作说明', () => {
  render(withRouter(<Game2048 />));
  expect(screen.getByText(/分数:|Score:/)).toBeInTheDocument();
  expect(
    screen.getByText(/方向键移动方块|Slide and merge/),
  ).toBeInTheDocument();
});

test('贪吃蛇：渲染开始提示或分数', () => {
  render(withRouter(<GameSnake />));
  const scoreOrStart = screen.getAllByText(
    /分数:|按方向键开始|Score:|Press arrow/,
  );
  expect(scoreOrStart.length).toBeGreaterThanOrEqual(1);
});

test('打砖块：渲染生命或开始按钮', () => {
  render(withRouter(<GameBreakout />));
  expect(screen.getByText(/生命:|Lives:/)).toBeInTheDocument();
});

test('飞机大战：渲染得分与操作说明', () => {
  render(withRouter(<GameShooter />));
  expect(screen.getByText(/分数:|Score:/)).toBeInTheDocument();
  expect(screen.getByText(/击落敌机得分|Shoot down/)).toBeInTheDocument();
});

test('坦克大战：渲染操作说明', () => {
  render(withRouter(<GameTank />));
  expect(
    screen.getByText(/保护黄色基地|Protect the yellow base/),
  ).toBeInTheDocument();
});

test('俄罗斯方块：渲染得分/等级/消行', () => {
  render(withRouter(<GameTetris />));
  expect(screen.getByText(/消行:|Lines:/)).toBeInTheDocument();
});

test('日本立直麻将：渲染标题与开始游戏', () => {
  render(withRouter(<GameMahjongJapanese />));
  expect(
    screen.getByText(/日本立直麻将|Japanese Riichi Mahjong/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /开始游戏|Start Game/ }),
  ).toBeInTheDocument();
});

test('日本立直麻将：自动开局后进入手机游戏舞台', async () => {
  render(
    withRouterAt(<GameMahjongJapanese />, '/game/mahjong-japanese?start=1'),
  );
  const stage = await screen.findByTestId('riichi-mobile-stage');
  expect(stage.getAttribute('aria-label')).toMatch(
    /日本立直麻将游戏舞台|Japanese Riichi Mahjong Game Stage/,
  );
});

test('斗地主：渲染说明与重开按钮', () => {
  render(withRouter(<GameDoudizhu />));
  expect(screen.getByText(/三人斗地主|Doudizhu/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('升级：渲染说明与重开按钮', () => {
  render(withRouter(<GameShengji />));
  expect(screen.getByText(/升级入门|Shengji/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /重开|Restart/ }).length,
  ).toBeGreaterThanOrEqual(1);
});
