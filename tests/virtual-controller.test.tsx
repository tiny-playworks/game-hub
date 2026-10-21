import { expect, test } from 'rstack/test';
import { render, screen } from '@testing-library/react';
import { VirtualController } from '../src/components/common/VirtualController';
import { LocaleProvider } from '../src/contexts/LocaleContext';

test('虚拟手柄支持浅色页面上的深色控件', () => {
  render(<LocaleProvider><VirtualController tone="dark" /></LocaleProvider>);

  expect(screen.getByRole('button', { name: /向上|Up/ }).closest('.virtual-controller'))
    .toHaveAttribute('data-tone', 'dark');
});
