import { beforeEach, expect, test } from 'rstack/test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HouseholdProvider } from '../src/contexts/HouseholdContext';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import { getCosmeticsState, syncCosmeticRewards } from '../src/lib/cosmetics';
import { updatePlayerCharacterState } from '../src/lib/playerCharacters';
import {
  getPlayerProfile,
  updatePlayerProfile,
} from '../src/lib/playerProfile';
import { getRankedState, saveRankedState } from '../src/lib/ranked';
import Shop from '../src/pages/Shop';
import { applyEvent } from '../src/pages/mahjong/japanese/engine';
import GameMahjongJapanese from '../src/pages/mahjong/japanese/index';
import { useRiichiStore } from '../src/pages/mahjong/japanese/store/riichiMatchStore';
import { nextAutoEvent } from './helpers/riichiSim';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

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
  useRiichiStore.setState({
    match: null,
    view: 'rules',
    showGuide: false,
    showMenu: false,
    replay: null,
    decisionClock: null,
    processedProgress: [],
    cutIns: [],
    moments: [],
    sessionId: '',
  });
});

test('完整牌桌 E2E 交互：开局后手牌选牌、出牌确认栏、快捷键与新手引导', async () => {
  renderRiichiApp();

  // 1. 验证牌桌舞台成功加载
  const stage = await screen.findByTestId('riichi-desktop-stage');
  expect(stage).toBeInTheDocument();

  // 2. 新手操作提示在首次开局时显示，可点击“我知道了”关闭
  const guideRegion = screen.getByRole('region', {
    name: /牌桌操作提示|Controls Guide/i,
  });
  expect(guideRegion).toBeInTheDocument();
  const dismissBtn = screen.getByRole('button', { name: /我知道了|Got it/i });
  fireEvent.click(dismissBtn);
  expect(
    screen.queryByRole('region', { name: /牌桌操作提示|Controls Guide/i }),
  ).toBeNull();
  expect(localStorage.getItem('game-hub-riichi-novice-guide-dismissed')).toBe(
    'true',
  );

  // 3. 顶部快速静音切换
  const muteToggle = screen.getByRole('button', {
    name: /静音|Mute|取消静音|Unmute|开启声音/i,
  });
  expect(muteToggle).toBeInTheDocument();
  expect(muteToggle.className).toMatch(/min-h-11|min-h-\[44px\]/);
  expect(muteToggle.className).toMatch(/min-w-11|min-w-\[44px\]/);

  act(() => {
    fireEvent.click(muteToggle);
  });
  expect(getPlayerProfile().audioVolumes.sfx).toBe(0);

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
  const confirmBar = screen.getByRole('region', {
    name: /可用动作|已选手牌操作|Selected tile action/i,
  });
  expect(confirmBar).toBeInTheDocument();
  const cancelBtn = screen.getByRole('button', { name: /取消|Cancel/i });
  const discardBtn = screen.getByRole('button', { name: /出牌|Discard/i });
  expect(cancelBtn).toBeInTheDocument();
  expect(discardBtn).toBeInTheDocument();

  expect(cancelBtn.className).toContain('riichi-cancel-select-btn');
  expect(discardBtn.className).toContain('riichi-confirm-discard-btn');

  // 点击取消按钮退出选择
  fireEvent.click(cancelBtn);
  expect(firstTile.getAttribute('aria-pressed')).toBe('false');
  expect(firstTile.className).not.toContain('riichi-tile--selected');

  // 5. 键盘快捷键交互：按右方向键选择手牌，按 Esc 取消选择
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  const selectedTileAfterKey = getHandTiles().find(
    (t) => t.getAttribute('aria-pressed') === 'true',
  );
  expect(selectedTileAfterKey).toBeDefined();

  fireEvent.keyDown(document, { key: 'Escape' });
  const stillSelected = getHandTiles().find(
    (t) => t.getAttribute('aria-pressed') === 'true',
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
  const firstTile = handTiles[0];

  fireEvent.touchStart(firstTile, { touches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.touchMove(firstTile, { touches: [{ clientX: 50, clientY: 80 }] });
  fireEvent.touchEnd(firstTile);

  expect(firstTile.getAttribute('aria-pressed')).toBe('false');
  expect(firstTile.className).not.toContain('riichi-tile--selected');

  fireEvent.touchStart(firstTile, { touches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.touchEnd(firstTile);

  expect(firstTile.getAttribute('aria-pressed')).toBe('true');
  expect(firstTile.className).toContain('riichi-tile--selected');
});

test('P8 锁定牌背解锁后在商店装备并在牌桌实战正常渲染（金箔/向日葵背/疾风牌背/和弦牌背）', async () => {
  const lockedTileBacks = [
    'back-gold',
    'back-koharu',
    'back-rin',
    'back-sora',
  ] as const;

  // 解锁前：四款牌背均不在 owned 中
  for (const id of lockedTileBacks) {
    expect(getCosmeticsState().owned).not.toContain(id);
  }

  // 真实解锁条件达成：雀圣段位 + 小春/凛/空 好感度达到阶段 3（>= 30）
  const ranked = getRankedState();
  saveRankedState({
    ...ranked,
    band: 'saint',
    peak: { band: 'saint', level: 1 },
  });
  updatePlayerCharacterState({
    affinityByCharacter: { koharu: 30, rin: 30, sora: 30 },
  });
  syncCosmeticRewards();

  for (const id of lockedTileBacks) {
    expect(getCosmeticsState().owned).toContain(id);
  }

  // 在商店逐个点击并装备，随后进入牌桌核对 data-tile-back 与 TileBack 实战渲染
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  try {
    for (const id of lockedTileBacks) {
      const shopRender = render(
        <MemoryRouter initialEntries={['/shop']}>
          <LocaleProvider>
            <HouseholdProvider>
              <Shop />
            </HouseholdProvider>
          </LocaleProvider>
        </MemoryRouter>,
      );

      const itemBtn = document.querySelector<HTMLButtonElement>(
        `button[data-cosmetic-id="${id}"]`,
      );
      expect(itemBtn).not.toBeNull();
      await act(async () => {
        fireEvent.click(itemBtn!);
      });

      const equipBtn = screen.getByRole('button', { name: /^装备$|^Equip$/i });
      await act(async () => {
        fireEvent.click(equipBtn);
      });
      expect(getCosmeticsState().equipped['tile-back']).toBe(id);
      shopRender.unmount();

      // 进入日麻实战牌桌核对
      useRiichiStore.setState({ match: null, view: 'rules' });
      const tableRender = renderRiichiApp();
      const stage = await screen.findByTestId('riichi-desktop-stage');
      expect(stage.getAttribute('data-tile-back')).toBe(id);
      const tileBackPatterns = stage.querySelectorAll(
        '.riichi-tile-back .cosmetic-tile-pattern',
      );
      expect(tileBackPatterns.length).toBeGreaterThan(0);
      tableRender.unmount();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('P9 整场连续动作链 E2E：出牌 -> 暗杠/副露鸣牌 -> 立直宣言 -> 自摸和牌 -> 结算弹窗 -> 下一局', async () => {
  localStorage.setItem('game-hub-riichi-novice-guide-dismissed', 'true');
  updatePlayerProfile({
    riichiSettings: {
      ...getPlayerProfile().riichiSettings,
      presentation: 'simple',
      callConfirm: false,
    },
  });

  renderRiichiApp('/game/mahjong-japanese');

  // 1. 暗杠与手牌出牌链路：构造东一局，自家持 4 张一万可暗杠
  const ankanRound = createTestRound(0, 0, 1);
  ankanRound.hands[0] = tiles('1111m234p567s1122z');
  ankanRound.drawnTile = tile('2z');
  ankanRound.currentPlayer = 0;
  ankanRound.phase = 'discard';
  await act(async () => {
    useRiichiStore.setState({
      match: matchWithRound(ankanRound),
      view: 'game',
      cutIns: [],
      moments: [],
    });
  });

  const stage = await screen.findByTestId('riichi-desktop-stage');
  expect(stage).toBeInTheDocument();

  // 点击暗杠按钮
  const ankanBtn = screen.getByRole('button', { name: /暗杠|Ankan/i });
  await act(async () => {
    fireEvent.click(ankanBtn);
  });

  // 验证自家副露区呈现日式暗杠：4 张牌含 2 张盖牌（.riichi-tile-back）+ 2 张亮牌（.riichi-tile--meld）
  const selfMelds = document.querySelector('.riichi-self-melds')!;
  expect(selfMelds.querySelectorAll('.riichi-tile-back')).toHaveLength(2);
  expect(selfMelds.querySelectorAll('.riichi-tile--meld')).toHaveLength(2);

  // 暗杠摸岭上牌后，通过选牌 + 出牌确认栏打出一张手牌
  const handBtnsAfterAnkan = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.riichi-self-hand button:not(:disabled)',
    ),
  );
  expect(handBtnsAfterAnkan.length).toBeGreaterThan(0);
  await act(async () => {
    fireEvent.click(handBtnsAfterAnkan[0]);
  });
  const confirmDiscardBtn = screen.getByRole('button', {
    name: /^出牌$|^Discard$/i,
  });
  await act(async () => {
    fireEvent.click(confirmDiscardBtn);
  });
  expect(useRiichiStore.getState().match?.round.discardPiles[0].length).toBe(1);

  // 2. 副露鸣牌（吃/碰）链路：上家（seat 3）打出 3p，自家可吃可碰
  const claimBase = createTestRound(3, 0, 1);
  claimBase.hands[3] = tiles('3p123m456p789s111z2z');
  claimBase.drawnTile = tile('3p');
  claimBase.currentPlayer = 3;
  claimBase.phase = 'discard';
  claimBase.hands[0] = tiles('1233p234m567s112z');
  const afterOpponentDiscard = applyEvent(matchWithRound(claimBase), {
    type: 'discard',
    seat: 3,
    tile: tile('3p'),
  })!.match;

  await act(async () => {
    useRiichiStore.setState({
      match: afterOpponentDiscard,
      view: 'game',
      cutIns: [],
      moments: [],
    });
  });

  // 动作栏同时展示吃、碰、跳过按钮，点击“碰”完成鸣牌
  expect(screen.getByRole('button', { name: /吃|Chi/i })).toBeInTheDocument();
  const pengBtn = screen.getByRole('button', { name: /碰|Pon/i });
  await act(async () => {
    fireEvent.click(pengBtn);
  });
  expect(useRiichiStore.getState().match?.round.melds[0]).toHaveLength(1);
  expect(useRiichiStore.getState().match?.round.melds[0][0].type).toBe('peng');
  expect(useRiichiStore.getState().match?.round.currentPlayer).toBe(0);
  expect(useRiichiStore.getState().match?.round.phase).toBe('discard');

  // 3. 立直宣言 -> 自摸和牌 -> 结算弹窗 -> 下一局连续链路
  const riichiRound = createTestRound(1, 0, 1); // 东一局，庄家为 seat 1，自家和牌后会进入东二局
  riichiRound.hands[0] = tiles('123m456p789s23s11z9p');
  riichiRound.drawnTile = tile('9p');
  riichiRound.currentPlayer = 0;
  riichiRound.phase = 'discard';
  riichiRound.hands[1] = tiles('1112223334445z');
  riichiRound.hands[2] = tiles('1112223336667z');
  riichiRound.hands[3] = tiles('19m19p19s1234567z');

  await act(async () => {
    useRiichiStore.setState({
      match: matchWithRound(riichiRound),
      view: 'game',
      cutIns: [],
      moments: [],
    });
  });

  // 点击“立直宣言”按钮进入立直选牌态
  const riichiBtn = screen.getByRole('button', {
    name: /立直宣言|Declare Riichi/i,
  });
  await act(async () => {
    fireEvent.click(riichiBtn);
  });
  expect(riichiBtn.getAttribute('aria-pressed')).toBe('true');

  // 选择可立直打出的摸切牌并点击“立直出牌”
  const riichiDiscardTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.riichi-self-hand button:not(:disabled)',
    ),
  );
  expect(riichiDiscardTiles.length).toBeGreaterThan(0);
  await act(async () => {
    fireEvent.click(riichiDiscardTiles[riichiDiscardTiles.length - 1]);
  });
  const confirmRiichiDiscardBtn = screen.getByRole('button', {
    name: /立直出牌|Declare Riichi/i,
  });
  await act(async () => {
    fireEvent.click(confirmRiichiDiscardBtn);
  });
  await act(async () => {
    useRiichiStore.getState().clearCutIns();
  });
  expect(useRiichiStore.getState().match?.round.riichiDeclared[0]).toBe(true);

  // 进入自家立直后摸入和了牌 1s 的自摸回合
  const tsumoRound = structuredClone(useRiichiStore.getState().match!.round);
  tsumoRound.hands[0] = tiles('123m456p789s123s11z');
  tsumoRound.drawnTile = tile('1s');
  tsumoRound.currentPlayer = 0;
  tsumoRound.phase = 'discard';
  tsumoRound.claim = null;
  await act(async () => {
    useRiichiStore.setState({
      match: matchWithRound(tsumoRound),
      view: 'game',
      cutIns: [],
      moments: [],
    });
  });

  expect(useRiichiStore.getState().match?.round.turnOptions?.tsumo).toBe(true);

  // 点击“自摸胡牌”按钮触发和牌结算
  const tsumoBtn = screen.getByRole('button', { name: /自摸胡牌|Tsumo/i });
  await act(async () => {
    fireEvent.click(tsumoBtn);
  });
  await act(async () => {
    useRiichiStore.getState().clearCutIns();
  });

  expect(useRiichiStore.getState().match?.status).toBe('roundEnd');
  expect(useRiichiStore.getState().match?.round.result?.type).toBe('win');

  // 验证和牌结算弹窗（WinPresentation）呈现，并点击“下一局”推进至东二局
  const nextRoundBtn = await screen.findByRole('button', {
    name: /下一局|Next Round/i,
  });
  expect(nextRoundBtn).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(nextRoundBtn);
  });

  expect(useRiichiStore.getState().match?.status).toBe('playing');
  expect(useRiichiStore.getState().match?.round.dealer).toBe(2);
  expect(useRiichiStore.getState().match?.round.roundNumber).toBe(3);
});

test('P9 模拟手机视口（390×844）触控完成整场对局直至终局结算', async () => {
  localStorage.setItem('game-hub-riichi-novice-guide-dismissed', 'true');
  updatePlayerProfile({
    riichiSettings: {
      ...getPlayerProfile().riichiSettings,
      presentation: 'off',
    },
  });

  const prevWidth = window.innerWidth;
  const prevHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 390,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: 844,
  });

  try {
    renderRiichiApp('/game/mahjong-japanese');
    await act(async () => {
      useRiichiStore.getState().setMatchLength('east');
      await useRiichiStore.getState().startMatch({
        seed: 2026,
      });
    });

    const stage = await screen.findByTestId('riichi-desktop-stage');
    expect(stage).toBeInTheDocument();

    // 先验证手机视口下首次手牌触控选牌 -> 点击 44px 确认栏出牌
    for (let guard = 0; guard < 20; guard++) {
      const m = useRiichiStore.getState().match!;
      if (m.round.currentPlayer === 0 && m.round.phase === 'discard') break;
      const ev = nextAutoEvent(m);
      if (!ev) break;
      await act(async () => {
        await useRiichiStore.getState().dispatch(ev);
      });
    }

    const touchTiles = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.riichi-self-hand button:not(:disabled)',
      ),
    );
    expect(touchTiles.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.touchStart(touchTiles[0], {
        touches: [{ clientX: 40, clientY: 700 }],
      });
      fireEvent.touchEnd(touchTiles[0]);
    });
    expect(touchTiles[0].getAttribute('aria-pressed')).toBe('true');

    const discardBtn = screen.getByRole('button', {
      name: /^出牌$|^Discard$/i,
    });
    expect(discardBtn.className).toContain('riichi-confirm-discard-btn');
    await act(async () => {
      fireEvent.click(discardBtn);
    });

    // 连续推进整场东风战直至 matchEnd，每个 roundEnd 通过 UI 的“下一局/查看全场结果”按钮推进
    for (let step = 0; step < 3000; step++) {
      const m = useRiichiStore.getState().match!;
      if (m.status === 'matchEnd') break;
      if (m.status === 'roundEnd') {
        const nextBtn = screen.getByRole('button', {
          name: /下一局|Next Round|查看全场结果|Match Results/i,
        });
        await act(async () => {
          fireEvent.click(nextBtn);
        });
        continue;
      }
      const ev = nextAutoEvent(m);
      if (!ev) break;
      await act(async () => {
        await useRiichiStore.getState().dispatch(ev);
      });
    }

    expect(useRiichiStore.getState().match?.status).toBe('matchEnd');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  } finally {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: prevWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: prevHeight,
    });
  }
}, 30000);
