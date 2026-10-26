const entries: Record<string, [string, string]> = {
  'library.title': ['常玩与速选', 'Your games'],
  'library.recent': ['最近玩', 'Recent'],
  'library.favorite': ['收藏', 'Favorites'],
  'library.all': ['全部游戏', 'All games'],
  'library.time': ['预计用时', 'Play time'],
  'library.minutes': ['分钟', 'min'],
  'library.any': ['不限', 'Any'],
  'library.about': ['约', 'About'],
  'library.empty': [
    '还没有符合条件的游戏。',
    'No games match this selection yet.',
  ],
  'library.save': ['收藏', 'Favorite'],
  'library.unfavorite': ['取消收藏', 'Unfavorite'],
  'library.scope': [
    '时间为单次游玩参考。最近玩和收藏仅保存在本机，按游客／成员隔离。',
    'Times are approximate per visit. Recent games and favorites stay on this device, separately for each guest/member.',
  ],
  'short.title': ['短挑战与残局', 'Short challenges'],
  'short.scope': [
    '用几分钟解一道小局面。同一挑战码对应相同起手与出牌变化；只作本机练习，不发奖励、不进入榜单。自动保留最近一场，换题会替换进度。',
    'Solve a short puzzle. The same code reproduces its starting position and random sequence. Device-local practice only, with no rewards or leaderboard entries. Your latest puzzle is saved; choosing another replaces it.',
  ],
  'short.code': ['挑战码', 'Challenge code'],
  'short.open': ['打开', 'Open'],
  'short.invalid': [
    '挑战码格式为 GH1-2048-1、GH1-XIANGQI-1 或 GH1-TETRIS-1，末尾编号为 1～9999。',
    'Use GH1-2048-1, GH1-XIANGQI-1 or GH1-TETRIS-1, with a number from 1 to 9999.',
  ],
  'short.2048.goal': ['8 步内合成 128', 'Reach 128 in 8 moves'],
  'short.2048.help': [
    '只有改变棋盘的移动才计步。观察四个 32 如何合并；每次重来，随机落点也相同。',
    'Only moves that change the board count. Plan how to combine the four 32 tiles. Restarting reproduces the same random spawns.',
  ],
  'short.xiangqi.goal': ['双车配合：红方一步将杀', 'Two rooks: mate in one'],
  'short.xiangqi.help': [
    '先选红棋，再选绿色目标点。只走一步，以现有象棋规则判断是否将杀。',
    'Select a red piece, then a green destination. You have one move; the existing Xiangqi rules determine checkmate.',
  ],
  'short.xiangqi.hint': [
    '提示：一辆车封住下一行，另一辆车到将所在的一行。',
    'Hint: one rook blocks the next rank while the other moves to the king’s rank.',
  ],
  'short.tetris.goal': ['4 块以内消除 4 行', 'Clear 4 lines within 4 pieces'],
  'short.tetris.help': [
    '这是一道落点题，不自动下落。旋转长条、对准缺口，再点落下；轮廓标示落点。',
    'This placement puzzle does not auto-fall. Rotate the I piece, align with the gap and drop it. The outline shows the landing position.',
  ],
  'short.blocks': [
    '已用 {pieces} / 4 块 · 已消 {lines} / 4 行',
    '{pieces} / 4 pieces used · {lines} / 4 lines cleared',
  ],
  'short.moves': ['步', 'moves'],
  'short.up': ['↑ 上', '↑ Up'],
  'short.down': ['↓ 下', '↓ Down'],
  'short.left': ['← 左', '← Left'],
  'short.right': ['右 →', 'Right →'],
  'short.rotate': ['旋转', 'Rotate'],
  'short.drop': ['落下', 'Drop'],
  'short.won': [
    '挑战达成！可以重打同一局面，或换一个变化。',
    'Challenge complete! Replay this position or try a variation.',
  ],
  'short.retry': ['还差一步，再试试。', 'Not quite. Try again.'],
  'short.restart': ['同局重来', 'Restart position'],
  'short.variation': ['换个变化', 'Next variation'],
  'offline.title': ['网页离线游玩', 'Play offline in your browser'],
  'offline.description': [
    '提前下载这个版本的网页资源，断网后仍可打开单机游戏和入门训练。家庭牌桌、同步与在线奖励需要服务连接。字体使用设备自带字体，无需访问外部字体站。',
    'Download this version’s web assets to open solo games and starter lessons offline. Family tables, sync and online rewards still need the server. Text uses fonts already on your device.',
  ],
  'offline.build': [
    '当前版本 {version} · 资源约 {size} MiB',
    'Version {version} · about {size} MiB of assets',
  ],
  'offline.development': [
    '资源下载在正式构建预览中可用。',
    'Asset downloads are available in a production build.',
  ],
  'offline.saved': [
    '已保存版本 {version} · {date}',
    'Saved version {version} · {date}',
  ],
  'offline.empty': [
    '尚未保存离线资源。浏览器清理网站数据后需要重新下载。',
    'No offline assets saved. Download again if your browser clears site data.',
  ],
  'offline.download': [
    '下载／更新离线资源',
    'Download / update offline assets',
  ],
  'offline.clear': ['移除离线资源', 'Remove offline assets'],
  'offline.backup': ['存档导出与导入', 'Export / import saves'],
  'offline.working': ['正在处理', 'Working'],
  'offline.secure': [
    '此浏览器环境不支持离线缓存；需要 HTTPS 或本机 localhost，普通局域网 HTTP 地址暂不支持。',
    'Offline caching requires HTTPS or localhost and a supported browser. Plain HTTP LAN addresses do not support it.',
  ],
  'offline.failed': [
    '资源操作未完成，请保持页面打开并重试；已有存档不受影响。',
    'The resource operation did not finish. Keep the page open and retry; your saves are unaffected.',
  ],
  'demo.banner': [
    '本机演示环境 · 四名演示成员 PIN 均为 1234 · 使用独立演示数据',
    'Local demo · All four demo members use PIN 1234 · Isolated demo data',
  ],
  'notebook.title': ['练习笔记', 'Practice notebook'],
  'notebook.start': ['六道入门题', 'Six starter lessons'],
  'notebook.scope': [
    '答案、收藏与复习安排保存在这台设备，按游客／成员分别记录，不影响战绩和奖励。没有牌谱也能做入门题。',
    'Answers, favorites and review dates stay on this device, separately for each guest/member. They do not affect records or rewards. Starter lessons need no replays.',
  ],
  'notebook.compare': [
    '重复练过的 {count} 道题：首次与参考一致 {first}% → 最近 {last}%。',
    'Across {count} repeated questions: reference agreement was {first}% initially → {last}% most recently.',
  ],
  'notebook.due': ['到期复习', 'Due for review'],
  'notebook.favorite': ['收藏难题', 'Saved questions'],
  'notebook.history': ['练习历史', 'Practice history'],
  'notebook.empty': [
    '这里暂时没有题目，可以先练入门题或从下方牌谱分析开始。',
    'No questions here yet. Try the starter lessons or a replay below.',
  ],
  'notebook.replay': ['牌谱题', 'Replay question'],
  'notebook.matched': ['与参考一致', 'Matches the reference'],
  'notebook.different': ['再看一下解析', 'Review the explanation'],
  'notebook.unanswered': ['尚未作答', 'Not answered yet'],
  'notebook.next': ['下次复习', 'Next review'],
  'notebook.method': [
    '复习间隔为 1、3、7、14、30 天，与参考不同则回到 1 天。仅比较同一道题的首次与最近回答，不代表实战胜率。最多保留 200 道题，收藏不自动淘汰；原牌谱删除后对应题目无法再打开。清空游客数据也会清理游客笔记。',
    'Reviews are spaced at 1, 3, 7, 14 and 30 days; a different answer returns to 1 day. Only first/latest answers to the same question are compared, not win rates. Up to 200 questions; favorites are retained. Deleted replays cannot be reopened. Resetting guest data also clears guest notes.',
  ],
  'notebook.save': ['收藏这道题', 'Save question'],
  'notebook.unfavorite': ['取消收藏', 'Remove favorite'],
  'notebook.failed': [
    '本机保存失败，请重试。',
    'Could not save on this device. Please retry.',
  ],
  'lesson.shape.title': ['向听：离听牌还有多远', 'Shanten: distance to tenpai'],
  'lesson.shape.prompt': [
    '两种舍牌方案分别留下 1 向听和 2 向听。在暂不考虑防守与打点时，哪种更接近听牌？',
    'Two discards leave you at 1-shanten or 2-shanten. Ignoring defense and hand value, which is closer to tenpai?',
  ],
  'lesson.shape.0': ['2 向听', '2-shanten'],
  'lesson.shape.1': ['1 向听', '1-shanten'],
  'lesson.shape.2': ['数字越大越好', 'A larger number is better'],
  'lesson.shape.why': [
    '向听数越小，通常越接近听牌；0 向听就是听牌。实战还需要结合进张、打点和风险。',
    'A lower shanten number is closer to tenpai; 0-shanten is tenpai. In play, also consider effective tiles, value and risk.',
  ],
  'lesson.sequence.title': ['两面搭子', 'An open-ended shape'],
  'lesson.sequence.prompt': [
    '单看手里的 4 筒、5 筒，哪些牌可以让这组搭子组成顺子？',
    'Looking only at 4-pin and 5-pin, which tiles complete a sequence?',
  ],
  'lesson.sequence.0': ['3 筒或 6 筒', '3-pin or 6-pin'],
  'lesson.sequence.1': ['只有 3 筒', 'Only 3-pin'],
  'lesson.sequence.2': ['只有 5 筒', 'Only 5-pin'],
  'lesson.sequence.why': [
    '3-4-5 与 4-5-6 都是顺子，所以 4-5 是两面搭子。整手是否听牌还取决于其他部分。',
    'Both 3-4-5 and 4-5-6 are sequences, so 4-5 is open-ended. Whether the whole hand is in tenpai depends on the remaining tiles.',
  ],
  'lesson.visible.title': ['进张：扣除看得见的牌', 'Count visible copies'],
  'lesson.visible.prompt': [
    '某种普通牌共有 4 张，你手里有 1 张，牌河里可见 2 张，没有其他可见副露。还有多少张位置未知？',
    'A tile type has 4 copies. You hold 1 and can see 2 in discard ponds, with no other exposed copies. How many have unknown locations?',
  ],
  'lesson.visible.0': ['4 张', '4'],
  'lesson.visible.1': ['2 张', '2'],
  'lesson.visible.2': ['1 张', '1'],
  'lesson.visible.why': [
    '4 − 1 − 2 = 1。未知牌可能在他家手里或牌山中，不能直接当成一定能摸到的牌。',
    '4 − 1 − 2 = 1. The unknown copy may be in another hand or the wall; it is not guaranteed to be drawable.',
  ],
  'lesson.safe.title': ['防守：现物的范围', 'Defense: what genbutsu means'],
  'lesson.safe.prompt': [
    '对手已经立直，他自己的牌河里有一张 9 万。你打出 9 万时，哪种说法正确？',
    'An opponent has declared riichi and has 9-man in their own discard pond. What is true if you discard 9-man?',
  ],
  'lesson.safe.0': ['所有对手都不能荣和', 'Nobody can ron it'],
  'lesson.safe.1': [
    '这名立直者不能荣和，但其他人仍可能荣和',
    'That riichi opponent cannot ron it, but others may',
  ],
  'lesson.safe.2': ['一定能让自己和牌', 'It guarantees your win'],
  'lesson.safe.why': [
    '因振听，这张现物对该立直者不会放铳；安全性不自动适用于其他两家。',
    'Furiten prevents that riichi opponent from winning by ron on this tile. That protection does not automatically apply to the other opponents.',
  ],
  'lesson.riichi.title': ['立直需要什么', 'Requirements for riichi'],
  'lesson.riichi.prompt': [
    '本项目中，你门前清、已听牌、至少有 1000 点，且牌山剩余张数足够。哪种动作需要支付 1000 点并锁定此后的舍牌选择？',
    'Here you have a closed tenpai hand, at least 1,000 points and enough tiles left in the wall. Which action deposits 1,000 points and restricts later discards?',
  ],
  'lesson.riichi.0': ['宣告立直', 'Declare riichi'],
  'lesson.riichi.1': ['普通舍牌', 'Discard normally'],
  'lesson.riichi.2': ['按暂停', 'Pause'],
  'lesson.riichi.why': [
    '立直是对听牌的宣告，需支付立直棒；之后通常只能摸切。是否值得立直还要看待牌、打点和场况。',
    'Riichi declares tenpai and requires a deposit; afterward you normally discard the drawn tile. Whether it is worthwhile depends on waits, value and table conditions.',
  ],
  'lesson.dama.title': ['默听保留的选择', 'What dama preserves'],
  'lesson.dama.prompt': [
    '你已门清听牌，手中已有可和牌的役。如果选择暂不立直（默听），通常保留了什么？',
    'Your closed hand is in tenpai and already has a winning yaku. What does staying in dama usually preserve?',
  ],
  'lesson.dama.0': ['无条件增加一番', 'An unconditional extra han'],
  'lesson.dama.1': ['查看别人的手牌', 'Seeing opponents’ hands'],
  'lesson.dama.2': [
    '改变待牌或转向防守的灵活性',
    'Flexibility to change waits or defend',
  ],
  'lesson.dama.why': [
    '默听没有立直带来的限制，可以改良手牌或弃和防守；也放弃了立直役等潜在收益，不能一概认为更优。',
    'Dama keeps the freedom to improve the hand or fold, while forgoing potential riichi benefits. It is not always the better choice.',
  ],
};

export const localPlayMessages: Record<'zh' | 'en', Record<string, string>> = {
  zh: Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, value[0]]),
  ),
  en: Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, value[1]]),
  ),
};
