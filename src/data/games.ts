export interface GameItem {
  id: string;
  name: string;
  description: string;
  path: string;
  difficulty: 1 | 2 | 3 | 4;
  tags: string[];
}

export const games: GameItem[] = [
  {
    id: 'breakout',
    name: '打砖块',
    description: '用挡板接住小球，击碎所有砖块。经典弹球打砖块。',
    path: '/game/breakout',
    difficulty: 4,
    tags: ['弹球', '经典', '动作'],
  },
];
