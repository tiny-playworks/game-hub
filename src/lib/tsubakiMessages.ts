import type { Locale } from './i18n';

const lines: Record<Locale, Record<string, string[]>> = {
  zh: {
    'match-start': [
      '点差会说话，我只负责听。',
      '欢迎光临，今天想怎么打这一圈？',
      '茶已经备好了，请入座吧。',
    ],
    riichi: [
      '立直。是时候把点棒推回中央了。',
      '立直，这一手正好用来翻盘。',
      '既然局势到了这里，那就立直吧。',
    ],
    ron: [
      '荣。多谢你的这张牌。',
      '点差开始动了呢，荣。',
      '刚好赶上，这一手我收下了。',
    ],
    tsumo: [
      '自摸。牌山还是挺温柔的。',
      '自摸，落后的时候更要沉得住气。',
      '这张来了，刚刚好。',
    ],
    'deal-in': [
      '哎呀，这笔账先记在店里吧。',
      '看来今天你的气势更盛呢。',
    ],
    call: [
      '借这一张调个节奏。',
      '稍微加快一点步子吧。',
    ],
    'ryuukyoku-tenpai': [
      '听牌。守住点差也是一种赢法。',
      '一步一步来，还不算晚。',
    ],
    'match-top': [
      '承让了，逆风的牌打起来最有意思。',
      '今天也是场好局，常来坐坐吧。',
    ],
    'match-last': [
      '老板偶尔也要给客人让个头名嘛。',
      '精彩的牌局，下一圈我可不会客气了。',
    ],
  },
  en: {
    'match-start': [
      'The score gap talks. I only listen.',
      'Welcome in. How will you play this round?',
      'The tea is ready. Please take your seat.',
    ],
    riichi: [
      'Riichi. Time to push the sticks back to the center.',
      'Riichi. This hand is built for a comeback.',
      'Now that the table stands here—riichi.',
    ],
    ron: [
      'Ron. Thank you for that tile.',
      'The score gap is shifting now. Ron.',
      'Right on cue. I will take this hand.',
    ],
    tsumo: [
      'Tsumo. The wall can be kind after all.',
      'Tsumo. Patience pays most when trailing.',
      'There it is—just in time.',
    ],
    'deal-in': [
      'Oh my. Put that one on the parlor tab.',
      'Your momentum is stronger today.',
    ],
    call: [
      'Borrowing this to shift the tempo.',
      'Let us quicken the pace a little.',
    ],
    'ryuukyoku-tenpai': [
      'Tenpai. Holding the margin is its own victory.',
      'One step at a time. It is never too late.',
    ],
    'match-top': [
      'Thank you for the match. Comebacks make the best hands.',
      'A wonderful game today. Come visit again anytime.',
    ],
    'match-last': [
      'A parlor owner has to let her guests shine sometimes.',
      'Well played. I will not hold back next round.',
    ],
  },
};

const chatter: Record<Locale, Record<string, string[]>> = {
  zh: {
    'other-riichi': ['哦？开始施压了呢。', '先算算点差，再决定跟不跟。'],
    stalled: ['逆风的时候，牌更要慢慢理。', '别急，等那张真正有用的牌。'],
    'other-win': ['漂亮，点差又变有趣了。', '好牌，下一局该我追分了。'],
    'last-place': ['落后才刚开始呢，看好了。', '这点差距，一发满贯就回来了。'],
    'big-win': ['这就是等待的价值。', '点差一口气翻过来了呢。'],
    'double-draw': ['大家都在看点差行事呢。', '真是场沉得住气的对局。'],
    'danger-survived': ['领先的时候，收手才是本事。', '这一巡不必硬闯。'],
  },
  en: {
    'other-riichi': ['Putting on pressure already?', 'Check the score gap before answering.'],
    stalled: ['Take your time when the wind is against you.', 'Wait for the tile that truly matters.'],
    'other-win': ['Nicely done. The margin gets interesting.', 'Good hand. My turn to chase next round.'],
    'last-place': ['Trailing is where the real game begins.', 'One mangan will erase this gap.'],
    'big-win': ['That is the value of patience.', 'The score turns around in a single hand.'],
    'double-draw': ['Everyone is playing by the scoreboard.', 'A wonderfully patient table.'],
    'danger-survived': ['Knowing when to fold protects a lead.', 'No need to force this turn.'],
  },
};

const stories: Record<Locale, string[][]> = {
  zh: [
    [
      '柜台后的目光',
      '把前面的桌子都打完一遍了？坐吧，这杯热茶算我请你的。',
      '原来你一直都在看着各桌的对局吗？',
      '毕竟我是这里的老板嘛。谁急了、谁忍住了，点棒的声音听得一清二楚。',
      '来，让我亲手试试你现在的分量。',
    ],
    [
      '逆风的价码',
      '刚才落后一万点的时候，你的眼神反而更静了呢。',
      '因为慌张只会把能赢的牌也切掉。',
      '说得好。很多人只会在顺风时挥霍运气，却不懂逆风时每一巡的价码。',
      '能算清这笔账的人，在我的雀庄里可不多见。',
    ],
    [
      '收手的分寸',
      '那手满贯明明只差一张，你为什么在尾巡忽然拆掉了？',
      '因为我已经领先了，没必要再去赌对手的现物之外。',
      '哎呀，连我都差点以为你会硬推到底呢，害我白等了一巡。',
      '不过，懂得在领先时把门关好，才算真正听懂了点差的话。',
    ],
    [
      '打烊后的最后一圈',
      '招牌已经翻到「准备中」了，山茶花香还在屋里，要陪老板再打半庄吗？',
      '荣幸之至，今晚的目标也是把店主的点棒赢过来。',
      '口气不小嘛。那我就拿出看家的逆转手筋，看看谁能笑到南四局。',
      '请多指教——今夜不论胜负，这间雀庄永远为你留着主位。',
    ],
  ],
  en: [
    [
      'Eyes Behind the Counter',
      'Finished every table in the parlor? Sit down—this cup of tea is on the house.',
      'Were you watching our matches the whole time?',
      'I am the owner, after all. The click of point sticks tells me who rushed and who held steady.',
      'Come, let me test your measure myself.',
    ],
    [
      'The Price of a Headwind',
      'When you fell ten thousand points behind just now, your eyes only grew calmer.',
      'Panicking only makes you discard the tiles that could bring you back.',
      'Well said. Many players spend their luck in a tailwind, never learning the price of each turn when trailing.',
      'Few guests in my parlor can keep that ledger straight.',
    ],
    [
      'Knowing When to Close the Door',
      'You were one tile from mangan—why did you break the hand on the final turns?',
      'I already held the lead. There was no reason to gamble past safe discards.',
      'And here I thought you would push to the end. You left me waiting in vain.',
      'Still, knowing when to lock the door with a lead means you truly hear what the score gap says.',
    ],
    [
      'One Last Hanchan After Closing',
      'The sign is flipped to Closed and camellia tea fills the room. Care for one more hanchan with the owner?',
      'Gladly. Tonight I am aiming for the house’s point sticks too.',
      'Bold words. Then I will bring my best comeback lines and see who smiles at South 4.',
      'Let us begin—win or lose tonight, the seat of honor in this parlor is always yours.',
    ],
  ],
};

const labels: Record<Locale, Record<string, string>> = {
  zh: {
    'character.name.tsubaki': '椿',
    'character.tagline.tsubaki': '点差会说话，我只负责听。',
    'character.bio.tsubaki':
      '山茶雀庄的店主。总是在牌桌旁微笑着品茶，落后时立直与打点毫不留情，领先时却滴水不漏地收手保位。',
    'character.tag.comeback': '逆风翻盘',
    'profile.companion.unlock.journeyFinale': '通关巡礼收束关「点差会说话」解锁',
    'cosmetic.win-tsubaki.name': '金椿花落',
    'cosmetic.win-tsubaki.desc': '酒红与古金交织的山茶花瓣，见证逆风翻盘的一刻。',
    'cosmetic.frame-tsubaki.name': '椿的店主金缘',
    'cosmetic.frame-tsubaki.desc': '山茶雀庄店主的深墨绿镶金纪念头像框。',
  },
  en: {
    'character.name.tsubaki': 'Tsubaki',
    'character.tagline.tsubaki': 'The score gap talks. I only listen.',
    'character.bio.tsubaki':
      'Owner of the Camellia mahjong parlor. She sips her tea with a knowing smile—relentless with riichi and value when trailing, yet airtight in defense once ahead.',
    'character.tag.comeback': 'Comeback specialist',
    'profile.companion.unlock.journeyFinale': 'Clear the Journey finale "The score gap talks" to unlock',
    'cosmetic.win-tsubaki.name': 'Golden Camellia',
    'cosmetic.win-tsubaki.desc': 'Wine-red and antique-gold camellia petals for a decisive comeback.',
    'cosmetic.frame-tsubaki.name': 'Tsubaki Parlor Crest',
    'cosmetic.frame-tsubaki.desc': 'An ink-green and antique-gold frame from the owner of Camellia Parlor.',
  },
};

export const tsubakiMessages = Object.fromEntries(
  (['zh', 'en'] as const).map((locale) => [
    locale,
    {
      ...labels[locale],
      ...Object.fromEntries(
        Object.entries(lines[locale]).flatMap(([kind, values]) =>
          values.map((text, i) => [`character.line.tsubaki.${kind}.${i}`, text]),
        ),
      ),
      ...Object.fromEntries(
        Object.entries(chatter[locale]).flatMap(([kind, values]) =>
          values.map((text, i) => [`character.chatter.tsubaki.${kind}.${i}`, text]),
        ),
      ),
      ...Object.fromEntries(
        stories[locale].flatMap(([title, ...values], index) => [
          [`story.tsubaki.${index + 1}.title`, title],
          ...values.map((text, i) => [`story.tsubaki.${index + 1}.${i}`, text]),
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(lines[locale]).map(([kind, values]) => [
          `character.affinityLine.tsubaki.${kind}`,
          values[0],
        ]),
      ),
    },
  ]),
) as Record<Locale, Record<string, string>>;
