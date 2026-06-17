# 俄罗斯方块优化评估

## 源码入口

- 页面入口：`src/pages/GameTetris.tsx`
- 主页面：`src/pages/tetris/index.tsx`
- 规则：`src/lib/tetris.ts`
- 3D 渲染：`src/pages/tetris/Tetris3DEngine.ts`
- 样式：`src/pages/tetris/tetris.css`

## 当前状态

当前版本已经是 3D 俄罗斯方块，不是旧文档描述的简单纯色块。规则层已抽到 `src/lib/tetris.ts`，支持 hold、ghost、hard drop、soft drop、旋转、连击、技能能量、升级和成就。

## 已落地优化

- 规则和渲染已经明显分离。
- 3D 渲染有 ghost 方块、灯光、主题切换和消行动效。
- 支持 Hold、技能、升级选择、暂停、重开。
- 有 `rstest` 覆盖规则和页面。
- 有 WebGL 支持检测，不支持时会使用 noop engine 避免直接崩溃。

## 待优化问题

- 键盘手感还缺现代俄罗斯方块常见的 DAS/ARR 配置。
- 最佳消行数直接写 `localStorage`，没有统一接入 `useGameStore`。
- 移动端只有滑动手势，没有清晰的虚拟按钮层，Hold、技能、暂停等操作不够直观。
- WebGL fallback 只是 noop，玩家看到的降级说明还不够明确。
- 3D 渲染较重，低端设备需要更明确的质量档位。

## 建议重构

- 在输入层实现 DAS/ARR，不要改规则层核心。
- 把最佳消行、高分、最大连击接入统一游戏统计。
- 移动端增加紧凑控制条：左/右、旋转、软降、硬降、Hold、技能。
- 增加渲染质量选项：高质量阴影、低质量阴影、无 3D 降级提示。

## 优先级

- P0：统一统计存储；补移动端关键操作按钮。
- P1：实现 DAS/ARR 和输入测试。
- P2：做质量档位、音效、T-Spin/Back-to-back 等硬核规则。

## 验证建议

- 单测覆盖 Hold 限制、连击、技能、升级、硬降计分。
- 浏览器验证 WebGL 正常、移动端按钮、低宽度 HUD 不重叠。
