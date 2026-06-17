# 记忆翻牌优化评估

## 源码入口

- 页面：`src/pages/GameMemory.tsx`
- 样式：`src/pages/memory.css`

## 当前状态

当前版本有 4x4 卡牌、倒计时、关卡递增、步数、分数、配对奖励时间和失败震动。隐藏卡牌已不再把 emoji 直接暴露在 DOM 文本里，卡牌也改成了 button。

## 已落地优化

- 有时间压力和关卡推进，不只是单局静态配对。
- 已显示步数，方便衡量玩家表现。
- 隐藏状态不渲染牌面，避免测试和可访问性层面泄底。
- 卡牌有 `aria-label`，基础可访问性比旧版更好。
- 高分接入 `useGameStore`。

## 待优化问题

- 翻牌、匹配、失败回翻、升级都写在组件状态里，异步 timeout 逻辑分散。
- 重开时历史 timeout 理论上可能影响新局，后续复杂化后风险会变大。
- Header 仍有 `Score`、`Best` 英文。
- 键盘操作还不完整，只有鼠标/触屏点击体验。
- 关卡变化只是换 emoji，没有难度曲线、主题或布局变化。

## 建议重构

- 用 reducer 表达状态机：`playing`、`checking`、`levelClear`、`lost`。
- timeout id 用 ref 集中管理，重开和卸载时统一清理。
- 抽出 `generateCards(level, rng)` 和 `revealCard(state, index)` 纯函数。
- 键盘焦点按网格移动，Enter/Space 翻牌。

## 优先级

- P0：中文化剩余英文 UI；集中清理 timeout。
- P1：抽 reducer 和纯规则，补配对/失败/升级测试。
- P2：加入难度选择、连击奖励、卡牌翻转音效和完成动效。

## 验证建议

- 单测覆盖翻第一张、翻第二张匹配、翻第二张失败、锁定期间不能继续翻。
- 浏览器验证移动端卡牌尺寸和 Header 是否换行正常。
