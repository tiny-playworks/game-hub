import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  expect(screen.getAllByText('日麻游戏大厅').length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getByText('进来就能开打，规则和新手引导也都在手边'),
  ).toBeInTheDocument();
});

test('home page shows category links', () => {
  render(<App />);
  expect(screen.getAllByText('日本麻将').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('小游戏').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('棋类').length).toBeGreaterThanOrEqual(1);
});
