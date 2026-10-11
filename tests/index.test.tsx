import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  expect(screen.getAllByText('坐下来，打两圈。').length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getByText('一方牌桌，片刻闲暇。'),
  ).toBeInTheDocument();
});

test('home page shows category links', () => {
  render(<App />);
  expect(screen.getAllByText('小游戏').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('棋类').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('扑克').length).toBeGreaterThanOrEqual(1);
});
