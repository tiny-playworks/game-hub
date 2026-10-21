/**
 * Auto-maintained by `pnpm assets:gpt` (scripts/process-gpt-assets.mjs).
 * When GPT-generated WebP assets are placed into `output/gpt-raw/` and processed,
 * this registry automatically binds their static bundle URLs.
 */

import asset_0 from './stories/tsubaki.webp';
import asset_1 from './venue/banners/banner-home.webp';
import asset_2 from './venue/banners/banner-journey.webp';
import asset_3 from './venue/banners/banner-family.webp';
import asset_4 from './venue/banners/banner-leaderboard.webp';
import asset_5 from './venue/textures/washi-paper.webp';
import asset_6 from './venue/textures/kaya-wood.webp';
import asset_7 from './venue/textures/urushi-lacquer.webp';
import asset_8 from './venue/textures/card-baize.webp';
import asset_9 from './arcade/covers/guess-number.webp';
import asset_10 from './arcade/covers/tictactoe.webp';
import asset_11 from './arcade/covers/memory.webp';
import asset_12 from './arcade/covers/2048.webp';
import asset_13 from './arcade/covers/snake.webp';
import asset_14 from './arcade/covers/breakout.webp';
import asset_15 from './arcade/covers/shooter.webp';
import asset_16 from './arcade/covers/tank.webp';
import asset_17 from './arcade/covers/tetris.webp';
import asset_18 from './arcade/covers/rubiks.webp';
import asset_19 from './arcade/covers/gomoku.webp';
import asset_20 from './arcade/covers/go.webp';
import asset_21 from './arcade/covers/chess.webp';
import asset_22 from './arcade/covers/xiangqi.webp';
import asset_23 from './arcade/covers/doudizhu.webp';
import asset_24 from './arcade/covers/shengji.webp';

export const GPT_STORY_ASSETS: Partial<Record<string, string>> = {
  'tsubaki': asset_0,
};

export const GPT_BANNER_ASSETS: Partial<
  Record<'home' | 'journey' | 'family' | 'leaderboard', string>
> = {
  'home': asset_1,
  'journey': asset_2,
  'family': asset_3,
  'leaderboard': asset_4,
};

export const GPT_TEXTURE_ASSETS: Partial<
  Record<'washi-paper' | 'kaya-wood' | 'urushi-lacquer' | 'card-baize', string>
> = {
  'washi-paper': asset_5,
  'kaya-wood': asset_6,
  'urushi-lacquer': asset_7,
  'card-baize': asset_8,
};

export const GPT_ARCADE_COVERS: Partial<Record<string, string>> = {
  'guess-number': asset_9,
  'tictactoe': asset_10,
  'memory': asset_11,
  '2048': asset_12,
  'snake': asset_13,
  'breakout': asset_14,
  'shooter': asset_15,
  'tank': asset_16,
  'tetris': asset_17,
  'rubiks': asset_18,
  'gomoku': asset_19,
  'go': asset_20,
  'chess': asset_21,
  'xiangqi': asset_22,
  'doudizhu': asset_23,
  'shengji': asset_24,
};
