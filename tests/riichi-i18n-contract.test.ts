import { expect, test } from '@rstest/core';
import { getMessage } from '../src/lib/i18n';
import { formatLogEntry } from '../src/pages/mahjong/japanese/helpers';

test('新引擎的日志、流局与终局原因都有中英文文案', () => {
  const logs = [
    'roundStart',
    'discard',
    'riichi',
    'chi',
    'pon',
    'minkan',
    'ankan',
    'kakan',
    'tsumo',
    'tsumoYakuman',
    'ron',
    'ronYakuman',
    'ryuukyoku',
    'nagashi',
    'timeoutDiscard',
    'timeoutPass',
    'scoreLine',
    'matchEnd',
    'undo',
  ];
  const draws = [
    'exhaustive',
    'kyuushu',
    'suufon',
    'suucha',
    'suukaikan',
    'sanchahou',
  ];
  const endings = [
    'tobi',
    'east4_end',
    'south4_end',
    'agari_yame',
    'extension_end',
    'default',
  ];
  const keys = [
    ...logs.map((key) => `riichi.log.${key}`),
    ...draws.flatMap((key) => [
      `riichi.drawReason.${key}`,
      `riichi.drawDesc.${key}`,
    ]),
    ...endings.map((key) => `riichi.matchEndReason.${key}`),
    'riichi.unit.points',
  ];
  for (const key of keys) {
    expect(getMessage('zh', key), key).not.toBe(key);
    expect(getMessage('en', key), key).not.toBe(key);
    expect(getMessage('en', key), key).not.toBe(getMessage('zh', key));
  }
});

test('引擎日志的座位、牌和原因键都按当前语言渲染', () => {
  const entry = {
    key: 'riichi.log.ryuukyoku',
    params: { reasonKey: 'riichi.drawReason.sanchahou' },
  };
  expect(formatLogEntry(entry, 'zh')).toContain('三家和');
  expect(formatLogEntry(entry, 'en')).toContain('Triple ron');
  const discard = { key: 'riichi.log.discard', params: { seat: 0, tile: 34 } };
  expect(formatLogEntry(discard, 'zh')).toContain('五万');
  expect(formatLogEntry(discard, 'en')).toContain('5m');
});

test('算分库全部役种编号都有中英文名称', () => {
  for (let id = 0; id <= 55; id += 1) {
    const key = `riichi.yaku.${id}`;
    expect(getMessage('zh', key), key).not.toBe(key);
    expect(getMessage('en', key), key).not.toBe(key);
    expect(getMessage('en', key), key).not.toBe(getMessage('zh', key));
  }
});
