# 游戏大厅整体优化架构与实施计划

在对各个独立小游戏（如贪吃蛇、俄罗斯方块、2048等）进行深度“Juice & Polish”重制之前，我们需要一套全局的基础设施。这不仅能减少重复代码，还能保证所有游戏在视觉、听觉和交互上拥有统一的“高品质”体验。

## 1. 全局基础设施建设 (Shared Infrastructure)

### 1.1 全局音效管理器 (Audio Manager)
- **现状**：各游戏音效零散，且加载可能存在延迟。
- **优化**：利用项目中已有的 `use-sound` 库，建立全局的 `SoundContext`。
- **功能**：
  - 预加载所有核心音效（点击、爆炸、得分、失败等）。
  - 全局音量控制（BGM 与 SFX 分离，提供全局静音按钮）。
  - 防止音频并发重叠导致的爆音问题。

### 1.2 全局状态与高分持久化 (State & Highscore)
- **现状**：刷新页面后分数丢失，缺乏长期目标感。
- **优化**：借助 `zustand` 结合 `persist` 中间件（持久化到 `localStorage`）。
- **功能**：
  - 为每个子游戏记录：最高分（High Score）、最高连击（Max Combo）、历史游玩次数等。
  - 在大厅（Home）界面增加“成就/排行榜”展示板块。

### 1.3 移动端适配与虚拟按键 (Mobile & Touch Controls)
- **现状**：很多游戏依赖键盘（如 WASD/方向键），在手机端无法正常游玩。
- **优化**：提供统一的 `<VirtualController />` 组件。
- **功能**：
  - 自动检测移动端环境（或屏幕宽度），按需渲染**虚拟十字键（D-Pad）**和**动作按钮（Action Buttons）**。
  - 引入手势滑动支持（Swipe），适用于 2048、贪吃蛇等游戏。

### 1.4 全局粒子与震动系统 (Juice Engine)
- **屏幕震动 (Screen Shake)**：封装一个自定义 Hook `useScreenShake()`，基于 CSS 动画或 DOM 操作，在任何游戏触发暴击、碰撞或死亡时调用。
- **统一动画方案**：利用项目中已有的 `@tweenjs/tween.js` 和 `tw-animate-css`，规范弹窗的弹出（Spring/Bounce）、数字上涨的缓动效果。

## 2. 实施路径 (Execution Phases)

为了保证开发节奏，建议分阶段推进：

### Phase 1: 基建与脚手架 (Infrastructure)
1. 搭建 `store/` 目录，完成 Zustand 的状态持久化。
2. 搭建 `hooks/` 目录，封装 `useAudio`、`useScreenShake`。
3. 完善统一的 `<GameContainer />` 布局，支持响应式和屏幕安全区适配。

### Phase 2: 轻量级游戏重制 (Quick Wins)
- 优先重构 **2048** 和 **猜数字 (GuessNumber)**。
  - 理由：不涉及复杂的物理帧同步或复杂的 Canvas 渲染，主要依靠 DOM 动画和 CSS 过渡，能快速验证基建（震动、音效、高分）。

### Phase 3: 动作/街机类重制 (Action & Arcade)
- 重构 **贪吃蛇 (Snake)**、**俄罗斯方块 (Tetris)**、**飞机大战 (Shooter)**。
  - 理由：涉及到 Canvas 渲染循环重构（`requestAnimationFrame`）、对象池（Object Pool）的引入，以及复杂的碰撞检测和粒子发射。

## 3. 技术栈规范提醒
- Node 版本：统一要求使用 **Node v24**（如 `nvm use 24`）。
- 样式：继续沿用 Tailwind CSS (`@tailwindcss/postcss`)，多用现成的 utility class。
- 3D需求：项目中存在 `three` 依赖，未来如有进阶需求可将某些平面背景替换为 3D 视差背景。
