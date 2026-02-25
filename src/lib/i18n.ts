export type Locale = 'zh' | 'en';

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    'home.title': '游戏合集',
    'home.subtitle': '选择分类，进入对应游戏列表',
    'common.enter': '进入',
    'common.backHome': '返回首页',
    'common.categoryNotFound': '分类不存在',
    'common.noGames': '暂无游戏，敬请期待',
    'common.comingSoon': '开发中',
    'common.startGame': '开始游戏',
    'difficulty.0': '',
    'difficulty.1': '简单',
    'difficulty.2': '中等',
    'difficulty.3': '困难',
    'difficulty.4': '挑战',
    'category.mini.name': '小游戏',
    'category.mini.description': '猜数字、井字棋、打砖块、俄罗斯方块等轻量玩法',
    'category.board.name': '棋类',
    'category.board.description': '围棋、象棋、国际象棋等传统棋类',
    'category.poker.name': '扑克',
    'category.poker.description': '斗地主、升级等扑克牌类玩法',
    'category.mahjong.name': '麻将',
    'category.mahjong.description': '四川麻将、中国通用、日本麻将等多种玩法',
  },
  en: {
    'home.title': 'Game Hub',
    'home.subtitle': 'Pick a category to see games',
    'common.enter': 'Enter',
    'common.backHome': 'Back to Home',
    'common.categoryNotFound': 'Category not found',
    'common.noGames': 'No games yet',
    'common.comingSoon': 'Coming soon',
    'common.startGame': 'Start Game',
    'difficulty.0': '',
    'difficulty.1': 'Easy',
    'difficulty.2': 'Medium',
    'difficulty.3': 'Hard',
    'difficulty.4': 'Challenge',
    'category.mini.name': 'Mini Games',
    'category.mini.description': '2048, Snake, Tetris, Breakout & more',
    'category.board.name': 'Board',
    'category.board.description': 'Go, Xiangqi, Chess & more',
    'category.poker.name': 'Poker',
    'category.poker.description': 'Doudizhu, Shengji & more',
    'category.mahjong.name': 'Mahjong',
    'category.mahjong.description': 'Sichuan, Chinese, Japanese Riichi',
  },
};

export function getMessage(locale: Locale, key: string): string {
  return messages[locale]?.[key] ?? messages.zh[key] ?? key;
}

export const LOCALE_STORAGE_KEY = 'game-hub-locale';

export function getStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'zh';
  const v = localStorage.getItem(LOCALE_STORAGE_KEY);
  return v === 'en' ? 'en' : 'zh';
}

export function setStoredLocale(locale: Locale): void {
  localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
}
