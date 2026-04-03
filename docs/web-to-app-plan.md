# Web 完善后转 App 专项规划（v1）

## 目标
- 在不阻塞当前 Web 迭代的前提下，为后续 App 开发提前留好可复用“口子”
- 避免未来重写核心业务逻辑（成长、任务、玩家档案、游戏状态）

## 第一性原则
- 先抽“业务核心”，再换“展示壳”
- 数据结构稳定优先于页面样式稳定
- 只做必要抽象，避免过早平台化

## 需要提前留的口子（明日后即可逐步落实）

### 1) 存储适配口子（必须）
现状：直接使用 `localStorage`。  
建议：抽一个轻量 `storageAdapter`（Web 先实现 localStorage 版）。

建议接口：
```ts
interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

App 迁移时：
- React Native 可替换为 `AsyncStorage` 实现
- 业务层不改，仅注入实现

### 2) 领域模块边界（必须）
把玩家档案/成长/每日任务保持在 `src/lib/*` 的纯逻辑层，避免页面直写业务规则。  
规则：页面只调用 `lib` API，不直接拼规则。

### 3) 路由常量口子（建议）
统一路由常量（例如 `ROUTES.PROFILE = '/profile'`），避免页面字符串散落。  
App 侧可映射到导航栈名称。

### 4) 文案键稳定口子（建议）
i18n key 一旦定下尽量不随 UI 文案频繁改名。  
App 端可复用同一套 key 与词条来源。

### 5) 事件埋点命名口子（建议）
把关键行为事件名固定（如 `daily_task_claim`, `title_unlocked`, `profile_avatar_upload`）。  
先本地记录也可以，后续接入正式埋点平台时无需改业务代码。

### 6) 视觉 Token 口子（建议）
颜色、间距、圆角、阴影等抽到统一 token（CSS 变量或常量）。  
App 端可按同名 token 映射，降低视觉重做成本。

### 7) 奖励系统口子（新增，建议）
为“任务/活动/运营事件”统一奖励结构，避免后续重复造轮子。

建议接口：
```ts
type RewardType = 'growth_points' | 'title' | 'item';

interface RewardGrant {
  type: RewardType;
  amount?: number; // points
  itemId?: string; // item/title id
  reason: 'daily_task' | 'activity' | 'event';
  sourceId: string; // taskId/activityId/eventId
  grantedAt: number;
}
```

建议先落地：
- 奖励发放统一入口：`grantReward(...)`
- 背包/库存预留：`inventory`（先只存数量与最近发放记录）

## 推荐迁移路线（分阶段）

### 阶段 A：Web 继续迭代（当前）
- 完成 `/profile` 聚合
- 称号系统 B 与每日任务体验收口
- 补存储适配层（最小实现）

### 阶段 B：跨端准备
- 梳理“可复用纯逻辑”清单（`playerProfile / growth / dailyTasks / achievements`）
- 把 UI 无关逻辑移动到独立目录（必要时）

### 阶段 C：App 启动（建议 React Native + Expo）
- 先做容器壳 + 导航
- 首批只接“玩家档案/成长/任务”页面，不急着一次性上全部游戏
- 先打通 1 条端到端链路，再扩游戏模块

## 技术建议（简版）
- App 框架：React Native + Expo（迭代快）
- 状态层：沿用现有轻量模式，避免一开始上复杂状态框架
- 代码组织：优先复用 `lib` 逻辑，UI 分平台实现

## 风险与规避
- 风险：Web 业务逻辑夹杂 UI 导致 App 复用困难
  - 规避：业务规则统一下沉到 `lib`
- 风险：过早抽象导致开发变慢
  - 规避：只抽“存储适配 + 路由常量 + 埋点命名”三类刚需口子

## 近期执行建议（两周内）
1. 完成 `/profile` + 首页瘦身（已纳入 Day 0404）
2. 加 `storageAdapter` 并改造现有 `lib` 读取方式（最小改造）
3. 固化事件命名与路由常量
4. 统一奖励发放入口（为后续玩法扩展预留）
5. 再决定 App 首批承载页面与游戏范围
