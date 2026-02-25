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
import GameMahjongChinese from '../src/pages/GameMahjongChinese';
import GameMahjongJapanese from '../src/pages/GameMahjongJapanese';
import GameMahjongSichuan from '../src/pages/GameMahjongSichuan';
import GameMemory from '../src/pages/GameMemory';
import GameShengji from '../src/pages/GameShengji';
import GameShooter from '../src/pages/GameShooter';
import GameSnake from '../src/pages/GameSnake';
import GameTank from '../src/pages/GameTank';
import GameTetris from '../src/pages/GameTetris';
import GameTictactoe from '../src/pages/GameTictactoe';
import GameXiangqi from '../src/pages/GameXiangqi';

const withRouter = (children: React.ReactElement) => (
  <MemoryRouter>
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
  expect(screen.getByText(/成就|Achievements/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('link', { name: /返回首页|Back to Home/ }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('猜数字：渲染标题与猜按钮', () => {
  render(withRouter(<GameGuessNumber />));
  expect(screen.getAllByText('猜数字').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('button', { name: '猜' })).toBeInTheDocument();
});

test('井字棋：渲染棋盘与重开按钮', () => {
  render(withRouter(<GameTictactoe />));
  expect(screen.getByRole('button', { name: '重开' })).toBeInTheDocument();
  expect(screen.getByText(/下一位|赢家|平局/)).toBeInTheDocument();
});

test('五子棋：渲染五子连珠说明与重开按钮', () => {
  render(withRouter(<GameGomoku />));
  expect(screen.getByText(/五子连珠即胜/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('中国象棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameXiangqi />));
  expect(screen.getByText(/中国象棋：红先黑后/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('国际象棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameChess />));
  expect(screen.getByText(/国际象棋：白先黑后/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('围棋：渲染说明与重开按钮', () => {
  render(withRouter(<GameGo />));
  expect(screen.getByText(/围棋 9×9/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('记忆翻牌：渲染步数统计', () => {
  render(withRouter(<GameMemory />));
  expect(screen.getByText(/步数:/)).toBeInTheDocument();
});

test('2048：渲染分数与操作说明', () => {
  render(withRouter(<Game2048 />));
  expect(screen.getByText(/分数:/)).toBeInTheDocument();
  expect(screen.getByText(/方向键移动，相同数字合并/)).toBeInTheDocument();
});

test('贪吃蛇：渲染开始提示或分数', () => {
  render(withRouter(<GameSnake />));
  const scoreOrStart = screen.getAllByText(/分数:|按方向键开始/);
  expect(scoreOrStart.length).toBeGreaterThanOrEqual(1);
});

test('打砖块：渲染生命或开始按钮', () => {
  render(withRouter(<GameBreakout />));
  expect(screen.getByText(/生命:/)).toBeInTheDocument();
});

test('飞机大战：渲染得分与操作说明', () => {
  render(withRouter(<GameShooter />));
  expect(screen.getByText(/得分:/)).toBeInTheDocument();
  expect(screen.getByText(/击落敌机得分/)).toBeInTheDocument();
});

test('坦克大战：渲染操作说明', () => {
  render(withRouter(<GameTank />));
  expect(screen.getByText(/保护黄色基地/)).toBeInTheDocument();
});

test('俄罗斯方块：渲染得分/等级/消行', () => {
  render(withRouter(<GameTetris />));
  expect(screen.getByText(/消行:/)).toBeInTheDocument();
});

test('中国通用麻将：渲染标题与开始', () => {
  render(withRouter(<GameMahjongChinese />));
  expect(screen.getAllByText('中国通用麻将').length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getAllByRole('button', { name: '开始' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('四川麻将：渲染标题与开始', () => {
  render(withRouter(<GameMahjongSichuan />));
  expect(screen.getAllByText('四川麻将').length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getAllByRole('button', { name: '开始' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('日本立直麻将：渲染标题与开始游戏', () => {
  render(withRouter(<GameMahjongJapanese />));
  expect(screen.getByText('日本立直麻将')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument();
});

test('斗地主：渲染说明与重开按钮', () => {
  render(withRouter(<GameDoudizhu />));
  expect(screen.getByText(/三人斗地主简化版/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});

test('升级：渲染说明与重开按钮', () => {
  render(withRouter(<GameShengji />));
  expect(screen.getByText(/升级入门/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: '重开' }).length,
  ).toBeGreaterThanOrEqual(1);
});
