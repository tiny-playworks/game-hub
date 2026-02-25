import { expect, test } from '@rstest/core';
import { renderHook } from '@testing-library/react';
import { useMahjongSounds } from '../src/hooks/useMahjongSounds';

test('useMahjongSounds 返回所有播放入口且为函数', () => {
  const { result } = renderHook(() => useMahjongSounds());
  const sounds = result.current;
  const keys = [
    'playChi',
    'playPon',
    'playKan',
    'playTsumo',
    'playRon',
    'playDiscard',
    'playDraw',
    'playRyuukyoku',
  ];
  for (const key of keys) {
    expect(sounds).toHaveProperty(key);
    expect(typeof sounds[key as keyof typeof sounds]).toBe('function');
  }
});
