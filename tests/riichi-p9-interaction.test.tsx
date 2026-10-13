import { beforeEach, expect, test } from 'rstack/test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import {
  SelectedTileBar,
  NoviceControlsGuide,
} from '../src/pages/mahjong/japanese/components/TableFeedback';
import { useTileInteraction } from '../src/pages/mahjong/japanese/useTileInteraction';
import { RiichiSettingsPanel } from '../src/pages/mahjong/japanese/components/RiichiSettingsPanel';
import { getPlayerProfile, updatePlayerProfile } from '../src/lib/playerProfile';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

function TestTileInteractionHarness({
  canDiscard = true,
  riichiSelecting = false,
  isMyClaim = false,
  onDiscard = () => {},
  onCancelRiichi = () => {},
  onPassClaim = () => {},
}: {
  canDiscard?: boolean;
  riichiSelecting?: boolean;
  isMyClaim?: boolean;
  onDiscard?: (tile: number) => void;
  onCancelRiichi?: () => void;
  onPassClaim?: () => void;
}) {
  const handItems = [
    { tile: 0, key: 'tile-0' }, // 1m
    { tile: 1, key: 'tile-1' }, // 2m
    { tile: 2, key: 'tile-2' }, // 3m
  ];
  const discardable = [0, 1, 2];

  const interaction = useTileInteraction({
    handItems,
    discardable,
    canDiscard,
    riichiSelecting,
    isMyClaim,
    enabled: true,
    onDiscard,
    onCancelRiichi,
    onPassClaim,
  });

  return (
    <div>
      <div data-testid="selected-key">{interaction.selectedKey ?? 'none'}</div>
      <div data-testid="selected-tile">{interaction.selectedTile ?? 'none'}</div>
      {handItems.map((item) => (
        <button
          key={item.key}
          type="button"
          data-testid={`tile-btn-${item.key}`}
          data-tile-key={item.key}
          onClick={() => interaction.selectTile(item.key, item.tile)}
          onTouchStart={interaction.touchHandlers.onTouchStart}
          onTouchMove={interaction.touchHandlers.onTouchMove}
          onTouchEnd={(e) => interaction.touchHandlers.onTouchEnd(e, item.key, item.tile)}
        >
          Tile {item.tile}
        </button>
      ))}
      <SelectedTileBar
        selectedTile={interaction.selectedTile}
        canDiscard={canDiscard}
        riichiSelecting={riichiSelecting}
        onConfirmDiscard={interaction.confirmDiscard}
        onCancelSelection={interaction.cancelSelection}
      />
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('手牌选择与确认出牌：首次点击选中，再次点击确认出牌', () => {
  let discardedTile: number | null = null;
  renderWithLocale(
    <TestTileInteractionHarness
      onDiscard={(tile) => {
        discardedTile = tile;
      }}
    />,
  );

  const tile0 = screen.getByTestId('tile-btn-tile-0');

  // First click: selects the tile
  fireEvent.click(tile0);
  expect(screen.getByTestId('selected-key')).toHaveTextContent('tile-0');
  expect(screen.getByTestId('selected-tile')).toHaveTextContent('0');
  expect(discardedTile).toBeNull();

  // Second click on same tile: confirms discard
  fireEvent.click(tile0);
  expect(discardedTile).toBe(0);
  expect(screen.getByTestId('selected-key')).toHaveTextContent('none');
});

test('出牌确认栏：选中手牌后显示出牌按钮与取消按钮，点击出牌打出，点击取消退出选择', () => {
  let discardedTile: number | null = null;
  renderWithLocale(
    <TestTileInteractionHarness
      onDiscard={(tile) => {
        discardedTile = tile;
      }}
    />,
  );

  const tile1 = screen.getByTestId('tile-btn-tile-1');
  fireEvent.click(tile1);

  // Confirmation bar appears
  const discardBtn = screen.getByRole('button', { name: /出牌|Discard/i });
  const cancelBtn = screen.getByRole('button', { name: /取消|Cancel/i });
  expect(discardBtn).toBeInTheDocument();
  expect(cancelBtn).toBeInTheDocument();

  // Click cancel
  fireEvent.click(cancelBtn);
  expect(screen.getByTestId('selected-key')).toHaveTextContent('none');
  expect(discardedTile).toBeNull();

  // Re-select and click discard button
  fireEvent.click(tile1);
  const confirmBtn = screen.getByRole('button', { name: /出牌|Discard/i });
  fireEvent.click(confirmBtn);
  expect(discardedTile).toBe(1);
});

test('键盘快捷键：方向键选牌，Enter 确认出牌，Esc 取消选择', () => {
  let discardedTile: number | null = null;
  renderWithLocale(
    <TestTileInteractionHarness
      onDiscard={(tile) => {
        discardedTile = tile;
      }}
    />,
  );

  // ArrowRight selects first tile
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(screen.getByTestId('selected-key')).toHaveTextContent('tile-0');

  // ArrowRight moves to next tile
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(screen.getByTestId('selected-key')).toHaveTextContent('tile-1');

  // Enter confirms discard
  fireEvent.keyDown(document, { key: 'Enter' });
  expect(discardedTile).toBe(1);
  expect(screen.getByTestId('selected-key')).toHaveTextContent('none');

  // Re-select then press Escape
  fireEvent.keyDown(document, { key: 'ArrowLeft' });
  expect(screen.getByTestId('selected-key')).not.toHaveTextContent('none');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByTestId('selected-key')).toHaveTextContent('none');
});

test('触控滚动防误触：滑动距离大于 10px 时取消选牌/出牌动作', () => {
  let discardedTile: number | null = null;
  renderWithLocale(
    <TestTileInteractionHarness
      onDiscard={(tile) => {
        discardedTile = tile;
      }}
    />,
  );

  const tile0 = screen.getByTestId('tile-btn-tile-0');

  // Simulate scroll gesture
  fireEvent.touchStart(tile0, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchMove(tile0, { touches: [{ clientX: 100, clientY: 130 }] }); // 30px scroll
  fireEvent.touchEnd(tile0);

  // Should NOT be selected because user was scrolling
  expect(screen.getByTestId('selected-key')).toHaveTextContent('none');
  expect(discardedTile).toBeNull();

  // Tap without scroll
  fireEvent.touchStart(tile0, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchEnd(tile0);
  expect(screen.getByTestId('selected-key')).toHaveTextContent('tile-0');
});

test('新手操作提示：首次进入显示，点击“我知道了”后关闭并持久化存储', () => {
  const { rerender } = renderWithLocale(<NoviceControlsGuide />);
  expect(screen.getByRole('region', { name: /牌桌操作提示|Controls Guide/i })).toBeInTheDocument();

  const dismissBtn = screen.getByRole('button', { name: /我知道了|Got it/i });
  fireEvent.click(dismissBtn);

  // Card disappears
  expect(screen.queryByRole('region', { name: /牌桌操作提示|Controls Guide/i })).toBeNull();
  expect(localStorage.getItem('game-hub-riichi-novice-guide-dismissed')).toBe('true');

  // Re-render: should not display again
  rerender(
    <LocaleProvider>
      <NoviceControlsGuide />
    </LocaleProvider>,
  );
  expect(screen.queryByRole('region', { name: /牌桌操作提示|Controls Guide/i })).toBeNull();
});

test('对局偏好与静音设置：修改静音、音量与演出强度，刷新后保留', () => {
  renderWithLocale(<RiichiSettingsPanel />);

  // Toggle mute
  const muteCheckbox = screen.getByLabelText(/静音|Mute audio/i);
  act(() => {
    fireEvent.click(muteCheckbox);
  });

  const profile = getPlayerProfile();
  expect(profile.audioVolumes.sfx).toBe(0);
  expect(profile.audioVolumes.voice).toBe(0);

  // Unmute and change presentation
  act(() => {
    fireEvent.click(muteCheckbox);
  });
  expect(getPlayerProfile().audioVolumes.sfx).toBe(1);

  // Change presentation mode to simple
  const presentationSelect = screen.getByLabelText(/演出强度|Presentation intensity/i);
  act(() => {
    fireEvent.change(presentationSelect, { target: { value: 'simple' } });
  });

  expect(getPlayerProfile().riichiSettings.presentation).toBe('simple');
});
