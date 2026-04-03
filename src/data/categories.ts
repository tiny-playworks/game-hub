export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  path: string;
}

export const categories: CategoryItem[] = [
  {
    id: 'mini',
    name: '小游戏',
    description: '猜数字、井字棋、打砖块、俄罗斯方块等轻量玩法',
    path: '/category/mini',
  },
  {
    id: 'board',
    name: '棋类',
    description: '围棋、象棋、国际象棋等传统棋类',
    path: '/category/board',
  },
  {
    id: 'poker',
    name: '扑克',
    description: '斗地主、升级等扑克牌类玩法',
    path: '/category/poker',
  },
];
