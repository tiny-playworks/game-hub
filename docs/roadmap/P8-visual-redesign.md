# P8 全站现代日式竞技馆视觉

> 依赖：P7 本机可靠性验收通过。先读 [README](./README.md)。
> 目标：统一全站的新视觉与信息层级；电脑版清晰完整，手机保留实际操作空间。
> 状态：待实施。任务内容尚未代表实现或验收。

## 涉及文件（先读）

- [src/App.css](../../src/App.css) — 全局主题与旧雀庄样式。
- [src/pages/Home.tsx](../../src/pages/Home.tsx) — 大厅入口。
- [src/pages/Profile.tsx](../../src/pages/Profile.tsx) — 个人档案。
- [src/pages/Shop.tsx](../../src/pages/Shop.tsx) — 商店。
- [src/pages/CharacterProfile.tsx](../../src/pages/CharacterProfile.tsx) — 角色档案。
- [src/components/game/GameShell.tsx](../../src/components/game/GameShell.tsx) — 16 个副玩法公共外壳。
- [src/pages/mahjong/japanese/components/RiichiDesktopStage.tsx](../../src/pages/mahjong/japanese/components/RiichiDesktopStage.tsx) — 牌桌舞台。
- [src/pages/mahjong/japanese/components/Tile.tsx](../../src/pages/mahjong/japanese/components/Tile.tsx) — 牌面。
- [src/pages/mahjong/japanese/useRiichiTheme.ts](../../src/pages/mahjong/japanese/useRiichiTheme.ts) — 现有牌桌主题。
- [src/cosmetics.css](../../src/cosmetics.css) — 已有可购买外观。

## 拟新增文件（计划新增，当前不要求存在）

- `src/styles/venue.css` — 新主题 token 与通用页面排版。
- `src/components/layout/VenueNavigation.tsx` — 全站导航与主操作。
- `src/pages/mahjong/japanese/components/RiichiMobileStage.tsx` — 紧凑手机牌桌。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 8.1 设计先行

先制作大厅、桌面牌桌、手机牌桌、档案/商店的协调概念并让用户确认；样式用墨蓝/象牙白/朱红，八角色复用。概念资产放工作输出目录，不擅自新建说明文档。未确认设计不批量改 CSS。

## 8.2 统一全站

统一 token、字号、间距、按钮、导航、列表、空态和错误态；保留语言和浅/深模式。首页突出自由/段位/续局，预留家庭入口但未实现时不放可点击假按钮。

## 8.3 桌面与手机牌桌

1440×900 和 1920×1080 核对完整手牌、牌河、操作与点数；手机 390×844 竖屏紧凑和 844×390 横屏核对，不通过遮挡或横向溢出容纳桌面侧栏。

## 8.4 外观兼容

已拥有的牌背、桌布、特效和头像框保持装备和预览一致；默认主题替换不清空购买记录，不把全部饰品强制改成同一视觉。

## 验收：本机

1. 主要页面设计确认后再编码；对照概念和浏览器截图验收。
2. 所有既有导航、购买、角色切换、语言切换可操作。
3. 电脑/手机主要牌桌没有裁切手牌、遮住鸣牌按钮或全页面水平滚动。
4. 旧存档和已购外观保留；16 个副玩法公共顶栏仍可暂停与设置。

## 验收：真实 NAS（当前待现场验证）

1. 家庭实际电脑/手机首屏、字体加载和触控尺寸核对。

## 不做

- 不改规则/奖励/段位公式，不引入新的 UI 框架，不做 3D 日麻。

## 交接与停止条件

- 只实施 P8；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
