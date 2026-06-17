# 打砖块优化评估

## 源码入口

- 页面：`src/pages/GameBreakout.tsx`

## 当前状态

当前版本是单文件 Canvas 实现，支持分数、生命、开始/暂停、胜利、失败和 pointer 输入。移动端已经可以用手指移动挡板，不再只依赖鼠标。

## 已落地优化

- 支持 `pointermove` 和 `pointerdown`，桌面/触屏共用一套输入。
- Canvas 通过 CSS 限制宽度，移动端不会横向裁切。
- 有基础生命和胜负状态。
- 胜利后会解锁 `breakout-first-win` 成就。

## 待优化问题

- 规则、输入、绘制全部在同一个 `useEffect` 内，后续加道具、关卡、粒子会很难维护。
- 碰撞只做简单 AABB，然后统一反转 `ballVy`，侧面撞砖、擦边撞挡板的反馈不够可靠。
- 挡板只有在 `playing` 状态里跟随 pointer，开球前移动反馈不够自然。
- 没有接入 `useGameStore` 高分和局数统计。
- 砖块只有 alive 状态，没有生命值、硬砖、掉落物和关卡配置。

## 建议重构

- 抽出 `src/lib/breakout.ts`，包含 `createLevel`、`stepBreakout`、`resolveBallCollision`。
- 页面保留 Canvas draw 和输入映射，规则由纯函数返回下一状态和事件。
- 把砖块配置从常量数组升级成 level 配置，先支持普通砖和硬砖两类即可。
- 引入简单事件：`brick_hit`、`life_lost`、`level_clear`，后续音效和粒子都监听事件。

## 优先级

- P0：让开球前挡板也跟随 pointer；接入高分统计。
- P1：修正砖块/挡板碰撞方向，抽规则函数并补测试。
- P2：加入球拖尾、砖块碎片、掉落物和连击计分。

## 验证建议

- 单测覆盖挡板不同命中位置、生命扣减、清空砖块胜利。
- 浏览器验证触屏拖动、空格暂停/继续和移动端画布尺寸。
