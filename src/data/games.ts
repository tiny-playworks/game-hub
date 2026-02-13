export type CategoryId = 'mini' | 'board' | 'mahjong' | 'poker';

export interface GameItem {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  path: string;
  difficulty: 1 | 2 | 3 | 4;
  tags: string[];
  /** 开发中时不渲染「开始游戏」链接，仅展示占位 */
  comingSoon?: boolean;
}

export const games: GameItem[] = [
  {
    id: 'guess-number',
    categoryId: 'mini',
    name: '猜数字',
    description: '电脑想一个 1～100 的数，用最少次数猜中。',
    path: '/game/guess-number',
    difficulty: 1,
    tags: ['逻辑', '休闲'],
  },
  {
    id: 'tictactoe',
    categoryId: 'mini',
    name: '井字棋',
    description: '经典 3×3 井字棋，双人轮流下 X 和 O，先连成一线者胜。',
    path: '/game/tictactoe',
    difficulty: 1,
    tags: ['双人', '经典'],
  },
  {
    id: 'memory',
    categoryId: 'mini',
    name: '记忆翻牌',
    description: '翻开两张牌，配对相同图案。用最少步数完成全部配对。',
    path: '/game/memory',
    difficulty: 2,
    tags: ['记忆', '益智'],
  },
  {
    id: '2048',
    categoryId: 'mini',
    name: '2048',
    description: '方向键移动方块，相同数字合并，努力拼出 2048。',
    path: '/game/2048',
    difficulty: 3,
    tags: ['益智', '经典'],
  },
  {
    id: 'snake',
    categoryId: 'mini',
    name: '贪吃蛇',
    description: '控制蛇头方向，吃到食物变长，撞墙或撞到自己即结束。',
    path: '/game/snake',
    difficulty: 3,
    tags: ['经典', '动作'],
  },
  {
    id: 'breakout',
    categoryId: 'mini',
    name: '打砖块',
    description: '用挡板接住小球，击碎所有砖块。经典弹球打砖块。',
    path: '/game/breakout',
    difficulty: 4,
    tags: ['弹球', '经典', '动作'],
  },
  {
    id: 'shooter',
    categoryId: 'mini',
    name: '飞机大战',
    description: '控制战机左右移动，空格射击，击落敌机得分，避免被撞。',
    path: '/game/shooter',
    difficulty: 4,
    tags: ['射击', '经典', '动作'],
  },
  {
    id: 'tank',
    categoryId: 'mini',
    name: '坦克大战',
    description: '俯视角坦克，保护黄色基地，消灭所有敌方坦克。',
    path: '/game/tank',
    difficulty: 4,
    tags: ['策略', '经典', '动作'],
  },
  {
    id: 'tetris',
    categoryId: 'mini',
    name: '俄罗斯方块',
    description: '经典下落方块，消行得分，等级越高下落越快。',
    path: '/game/tetris',
    difficulty: 4,
    tags: ['经典', '益智', '动作'],
  },
  // 棋类 - 占位
  {
    id: 'go',
    categoryId: 'board',
    name: '围棋（开发中）',
    description: '黑白对弈，围地吃子，千古名局。',
    path: '/game/go',
    difficulty: 4,
    tags: ['围棋', '双人'],
    comingSoon: true,
  },
  {
    id: 'xiangqi',
    categoryId: 'board',
    name: '中国象棋（开发中）',
    description: '楚河汉界，将帅对弈。',
    path: '/game/xiangqi',
    difficulty: 3,
    tags: ['象棋', '双人'],
    comingSoon: true,
  },
  {
    id: 'chess',
    categoryId: 'board',
    name: '国际象棋（开发中）',
    description: '王后车马象兵，经典西洋棋。',
    path: '/game/chess',
    difficulty: 3,
    tags: ['国际象棋', '双人'],
    comingSoon: true,
  },
  {
    id: 'gomoku',
    categoryId: 'board',
    name: '五子棋（开发中）',
    description: '五子连珠即胜，简单易上手。',
    path: '/game/gomoku',
    difficulty: 2,
    tags: ['五子棋', '双人'],
    comingSoon: true,
  },
  // 麻将 - 三种
  {
    id: 'mahjong-sichuan',
    categoryId: 'mahjong',
    name: '四川麻将（开发中）',
    description: '血战到底、缺一门等川麻规则。',
    path: '/game/mahjong-sichuan',
    difficulty: 4,
    tags: ['四川麻将', '四人'],
    comingSoon: true,
  },
  {
    id: 'mahjong-chinese',
    categoryId: 'mahjong',
    name: '中国通用麻将',
    description: '国标规则，吃碰杠胡，番种计分。',
    path: '/game/mahjong-chinese',
    difficulty: 4,
    tags: ['中国麻将', '四人'],
  },
  {
    id: 'mahjong-japanese',
    categoryId: 'mahjong',
    name: '日本麻将',
    description: '立直、役种、符与点数计算。（规则页已开放，对局开发中）',
    path: '/game/mahjong-japanese',
    difficulty: 4,
    tags: ['日本麻将', '四人'],
  },
  // 扑克 - 占位
  {
    id: 'doudizhu',
    categoryId: 'poker',
    name: '斗地主（开发中）',
    description: '三人斗地主，抢地主、出牌、春天。',
    path: '/game/doudizhu',
    difficulty: 3,
    tags: ['扑克', '三人'],
    comingSoon: true,
  },
  {
    id: 'shengji',
    categoryId: 'poker',
    name: '升级（开发中）',
    description: '四人升级，组队打级。',
    path: '/game/shengji',
    difficulty: 3,
    tags: ['扑克', '四人'],
    comingSoon: true,
  },
];

export function getGamesByCategory(categoryId: string): GameItem[] {
  return games.filter((g) => g.categoryId === categoryId);
}

export function getGameByPath(path: string): GameItem | undefined {
  return games.find((g) => g.path === path);
}
