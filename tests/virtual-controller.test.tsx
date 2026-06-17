import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { VirtualController } from '../src/components/common/VirtualController';

test('虚拟手柄支持浅色页面上的深色控件', () => {
  render(<VirtualController tone="dark" />);

  expect(screen.getByRole('button', { name: 'Up' }).className).toContain(
    'bg-black/25',
  );
});
