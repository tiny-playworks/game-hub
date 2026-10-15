import type { Locale } from './i18n';

const lines: Record<Locale, Record<string, string[]>> = {
  zh: {
    'match-start': [
      '换一种心情，再认真打两圈。',
      '今天的手牌，会是什么颜色呢？',
      '坐好了？那就开始吧。',
    ],
    riichi: [
      '立直，这次听自己的直觉。',
      '准备好了，立直。',
      '这一手，就这样决定了。',
    ],
    ron: ['荣，刚好等到你。', '这张牌，我收下了。', '机会来了呢。'],
    tsumo: ['自摸，今天手气不错。', '终于轮到这张了。', '这份期待没有落空。'],
    'deal-in': ['啊，还是太急了。', '记住这一巡，下次再来。'],
    call: ['借这张走一步。', '换条路试试。'],
    'ryuukyoku-tenpai': ['听牌，再等一巡就好了。', '准备得不算白费。'],
    'match-top': ['今天的节奏刚刚好。', '谢谢陪我打完这一场。'],
    'match-last': ['下次换个心情重新来。', '输赢先放下，复盘可不能省。'],
  },
  en: {
    'match-start': [
      'A fresh mood, another thoughtful round.',
      'What color will this hand take?',
      'Ready? Let us begin.',
    ],
    riichi: [
      'Riichi. I trust this choice.',
      'Ready now. Riichi.',
      'This is the hand I am committing to.',
    ],
    ron: [
      'Ron. Just what I was waiting for.',
      'I will take that tile.',
      'There is my chance.',
    ],
    tsumo: [
      'Tsumo. A fortunate draw.',
      'There you are at last.',
      'Worth the wait.',
    ],
    'deal-in': ['A little too eager.', 'I will remember that decision.'],
    call: ['One step closer.', 'Let us try another route.'],
    'ryuukyoku-tenpai': [
      'Tenpai. Just one more turn...',
      'The preparation still counts.',
    ],
    'match-top': [
      'The rhythm felt right today.',
      'Thank you for playing this match.',
    ],
    'match-last': [
      'A fresh start next time.',
      'Time to learn from this match.',
    ],
  },
};
const chatter: Record<Locale, Record<string, string[]>> = {
  zh: {
    'other-riichi': ['先看清楚，再决定。', '这巡要小心一点。'],
    stalled: ['换个角度想想。', '好牌也需要耐心。'],
    'other-win': ['漂亮的一手。', '下一局再来。'],
    'last-place': ['还有机会，别急。', '一步一步追上去。'],
    'big-win': ['这手值得记下来。', '等到了，真好。'],
    'double-draw': ['大家都很谨慎呢。', '再换一副新牌吧。'],
    'danger-survived': ['还好，稳住了。', '这一巡先守住。'],
  },
  en: {
    'other-riichi': ['Read the table first.', 'Careful with this turn.'],
    stalled: ['Try another perspective.', 'A good hand takes patience.'],
    'other-win': ['Nicely played.', 'On to the next round.'],
    'last-place': ['There is still a chance.', 'One step at a time.'],
    'big-win': ['A hand to remember.', 'It was worth waiting.'],
    'double-draw': [
      'Everyone is playing carefully.',
      'Time for a fresh set of tiles.',
    ],
    'danger-survived': ['Steady now.', 'Safe for this turn.'],
  },
};
const stories: Record<Locale, string[][]> = {
  zh: [
    [
      '初次同桌',
      '这里的位置，可以留给我吗？',
      '当然，刚好还有一席。',
      '我喜欢先听一会儿洗牌的声音。',
      '好了，今天也请多指教。',
    ],
    [
      '换个心情',
      '你发现我今天换了发饰吗？',
      '发现了，很适合你。',
      '不过打牌可不能只凭今天的心情。',
      '下一手，我会认真看牌河的。',
    ],
    [
      '再坐一会儿',
      '刚才那张牌，我还是有点在意。',
      '一起看看记录吧。',
      '原来这里还有另一种选择。',
      '和你同桌，总能学到一点新东西。',
    ],
    [
      '晨光里的下一巡',
      '晨光都照进牌馆了，我还在想刚才那张牌。',
      '你不是已经有答案了吗？',
      '有了。今天不急着抢先，先把牌河看清。',
      '下一局也坐我旁边吧，我们一起慢慢打。',
    ],
  ],
  en: [
    [
      'A Seat at the Table',
      'May I take this seat?',
      'Of course. We have room.',
      'I like listening to the tiles being shuffled.',
      'Ready now. Thank you for playing with me.',
    ],
    [
      'A Change of Mood',
      'Did you notice my new hair ornament?',
      'Yes. It suits you.',
      'But I cannot play by mood alone.',
      'I will watch the discards carefully this time.',
    ],
    [
      'Stay a Little Longer',
      'I am still thinking about that discard.',
      'Let us review it together.',
      'There was another choice here after all.',
      'I always learn something at your table.',
    ],
    [
      'The Next Turn at Dawn',
      'Morning light is filling the parlor, and I am still thinking about that tile.',
      'Have you not found your answer already?',
      'I have. Today I will read the table before rushing ahead.',
      'Sit beside me next round too. We can take our time together.',
    ],
  ],
};

const labels: Record<Locale, Record<string, string>> = {
  zh: {
    'character.name.aoi': '葵',
    'character.tagline.aoi': '换一种心情，再认真打两圈。',
    'character.bio.aoi':
      '喜欢用不同的装扮迎接新的一天。牌桌上不急着抢跑，愿意为更好的选择多想一巡。',
    'outfit.title': '角色外观',
    'outfit.casual': '日常 · 001',
    'outfit.moonlight': '月白 · 002',
    'outfit.vermilion': '朱樱 · 003',
    'outfit.ink': '墨紫 · 004',
    'outfit.blossom': '春桃 · 005',
    'cosmetic.back-aoi.name': '朱樱牌背',
    'cosmetic.back-aoi.desc': '细密的朱红麻叶纹，记录与葵同桌的时光。',
    'cosmetic.frame-aoi.name': '葵的银缘',
    'cosmetic.frame-aoi.desc': '沉静的银色细框，陪伴已成习惯。',
  },
  en: {
    'character.name.aoi': 'Aoi',
    'character.tagline.aoi': 'A fresh mood, another thoughtful round.',
    'character.bio.aoi':
      'Aoi greets each day with a different look. At the table she takes her time, always willing to consider a better choice.',
    'outfit.title': 'Character outfit',
    'outfit.casual': 'Casual · 001',
    'outfit.moonlight': 'Moonlight · 002',
    'outfit.vermilion': 'Vermilion · 003',
    'outfit.ink': 'Ink · 004',
    'outfit.blossom': 'Blossom · 005',
    'cosmetic.back-aoi.name': 'Vermilion Leaf',
    'cosmetic.back-aoi.desc':
      'Fine vermilion hemp-leaf patterns, a keepsake of matches with Aoi.',
    'cosmetic.frame-aoi.name': 'Aoi Silver',
    'cosmetic.frame-aoi.desc': 'A quiet silver frame for a familiar companion.',
  },
};

export const aoiMessages = Object.fromEntries(
  (['zh', 'en'] as const).map((locale) => [
    locale,
    {
      ...labels[locale],
      ...Object.fromEntries(
        Object.entries(lines[locale]).flatMap(([kind, values]) =>
          values.map((text, i) => [`character.line.aoi.${kind}.${i}`, text]),
        ),
      ),
      ...Object.fromEntries(
        Object.entries(chatter[locale]).flatMap(([kind, values]) =>
          values.map((text, i) => [`character.chatter.aoi.${kind}.${i}`, text]),
        ),
      ),
      ...Object.fromEntries(
        stories[locale].flatMap(([title, ...values], index) => [
          [`story.aoi.${index + 1}.title`, title],
          ...values.map((text, i) => [`story.aoi.${index + 1}.${i}`, text]),
        ]),
      ),
    },
  ]),
) as Record<Locale, Record<string, string>>;
