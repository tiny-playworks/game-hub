import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  expect(screen.getByText('游戏合集')).toBeInTheDocument();
  expect(screen.getByText('选择分类，进入对应游戏列表')).toBeInTheDocument();
});
