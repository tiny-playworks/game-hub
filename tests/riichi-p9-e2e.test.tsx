import { beforeEach, expect, test } from 'rstack/test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import GameMahjongJapanese from '../src/pages/mahjong/japanese/index';
import { getPlayerProfile, updatePlayerProfile } from '../src/lib/playerProfile';

function renderRiichiApp(initialEntry = '/game/mahjong-japanese?start=1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocaleProvider>
        <GameMahjongJapanese />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('完整牌桌 E2E 交互：开局后手牌选牌、出牌确认栏、快捷键与新手引导', async () => {
  renderRiichiApp();

  // 1. 验证牌桌舞台成功加载
  const stage = await screen.findByTestId('riichi-desktop-stage');
  expect(stage).toBeInTheDocument();

  // 2. 新手操作提示在首次开局时显示，可点击“我知道了”关闭
  const guideRegion = screen.getByRole('region', { name: /牌桌操作提示|Controls Guide/i });
  expect(guideRegion).toBeInTheDocument();
  const dismissBtn = screen.getByRole('button', { name: /我知道了|Got it/i });
  fireEvent.click(dismissBtn);
  expect(screen.queryByRole('region', { name: /牌桌操作提示|Controls Guide/i })).toBeNull();
  expect(localStorage.getItem('game-hub-riichi-novice-guide-dismissed')).toBe('true');

  // 3. 顶部快速静音切换
  const muteToggle = screen.getByRole('button', { name: /静音|Mute|取消静音|Unmute/i });
  expect(muteToggle).toBeInTheDocument();
  // 检查按钮最小触控尺寸具备 44px (Tailwind 11 = 44px)
  expect(muteToggle.className).toMatch(/min-h-11|min-h-\[44px\]/);
  expect(muteToggle.className).toMatch(/min-w-11|min-w-\[44px\]/);

  // 点击静音
  act(() => {
    fireEvent.click(muteToggle);
  });
  expect(getPlayerProfile().audioVolumes.sfx).toBe(0);

  // 再次点击取消静音
  act(() => {
    fireEvent.click(muteToggle);
  });
  expect(getPlayerProfile().audioVolumes.sfx).toBe(1);

  // 4. 手牌交互：查找自身手牌区中的手牌按钮
  const getHandTiles = () =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.riichi-self-hand button:not(:disabled)',
      ),
    );
  const handTiles = getHandTiles();
  expect(handTiles.length).toBeGreaterThan(0);

  const firstTile = handTiles[0];

  // 首次点击：选中手牌，升起并加上 riichi-tile--selected 类
  fireEvent.click(firstTile);
  expect(firstTile.getAttribute('aria-pressed')).toBe('true');
  expect(firstTile.className).toContain('riichi-tile--selected');

  // 弹出选牌确认栏，且按钮点击区域 >= 44px
  const confirmBar = screen.getByRole('region', { name: /可用动作|已选手牌操作|Selected tile action/i });
  expect(confirmBar).toBeInTheDocument();
  const cancelBtn = screen.getByRole('button', { name: /取消|Cancel/i });
  const discardBtn = screen.getByRole('button', { name: /出牌|Discard/i });
  expect(cancelBtn).toBeInTheDocument();
  expect(discardBtn).toBeInTheDocument();

  // 验证确认与取消按钮在样式上有 44px 触控区保底 (min-height: 44px)
  expect(cancelBtn.className).toContain('riichi-cancel-select-btn');
  expect(discardBtn.className).toContain('riichi-confirm-discard-btn');

  // 点击取消按钮退出选择
  fireEvent.click(cancelBtn);
  expect(firstTile.getAttribute('aria-pressed')).toBe('false');
  expect(firstTile.className).not.toContain('riichi-tile--selected');

  // 5. 键盘快捷键交互：按右方向键选择手牌，按 Esc 取消选择
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  const selectedTileAfterKey = getHandTiles().find(
    (tile) => tile.getAttribute('aria-pressed') === 'true',
  );
  expect(selectedTileAfterKey).toBeDefined();

  // 按 Esc 键取消选择
  fireEvent.keyDown(document, { key: 'Escape' });
  const stillSelected = getHandTiles().find(
    (tile) => tile.getAttribute('aria-pressed') === 'true',
  );
  expect(stillSelected).toBeUndefined();
});

test('手机触控滚动保护：拖动滑动不触发选牌', async () => {
  renderRiichiApp();
  await screen.findByTestId('riichi-desktop-stage');

  const handTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.riichi-self-hand button:not(:disabled)',
    ),
  );
  expect(handTiles.length).toBeGreaterThan(0);
  const tile = handTiles[0];

  // 模拟触控滑动 > 10px
  fireEvent.touchStart(tile, { touches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.touchMove(tile, { touches: [{ clientX: 50, clientY: 80 }] });
  fireEvent.touchEnd(tile);

  // 不应被选中
  expect(tile.getAttribute('aria-pressed')).toBe('false');
  expect(tile.className).not.toContain('riichi-tile--selected');

  // 原地轻触（位移 <= 10px）
  fireEvent.touchStart(tile, { touches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.touchEnd(tile);

  // 成功选中
  expect(tile.getAttribute('aria-pressed')).toBe('true');
  expect(tile.className).toContain('riichi-tile--selected');
});
