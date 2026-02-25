import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  expect(screen.getByText('游戏合集')).toBeInTheDocument();
  expect(screen.getByText('选择分类，进入对应游戏列表')).toBeInTheDocument();
});

test('home page shows category links', () => {
  render(<App />);
  expect(screen.getAllByText('小游戏').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('麻将').length).toBeGreaterThanOrEqual(1);
});
