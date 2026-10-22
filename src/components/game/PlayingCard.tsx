import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import './playing-cards.css';

/** 0–51 为四花色，52=小王，53=大王。花色顺序：黑桃、红桃、梅花、方片 */
const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'] as const;
const SUIT_NAMES = ['黑桃', '红桃', '梅花', '方片'] as const;
const RANK_LABELS = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
] as const;

export const CARD_SMALL_JOKER = 52;
export const CARD_BIG_JOKER = 53;

export interface CardFace {
  rank: string;
  suit: string;
  red: boolean;
  isJoker: boolean;
  /** 无障碍名称，例如「红桃 A」 */
  name: string;
}

/** 把牌值解码为可渲染的牌面 */
export const getCardFace = (
  card: number,
  locale: 'zh' | 'en' = 'zh',
): CardFace => {
  if (card === CARD_SMALL_JOKER) {
    return {
      rank: locale === 'en' ? 'B' : '小',
      suit: locale === 'en' ? 'J' : '王',
      red: false,
      isJoker: true,
      name: locale === 'en' ? 'Black Joker' : '小王',
    };
  }
  if (card === CARD_BIG_JOKER) {
    return {
      rank: locale === 'en' ? 'R' : '大',
      suit: locale === 'en' ? 'J' : '王',
      red: true,
      isJoker: true,
      name: locale === 'en' ? 'Red Joker' : '大王',
    };
  }
  const suitIndex = Math.floor(card / 13);
  const rank = RANK_LABELS[card % 13] ?? '?';
  const suit = SUIT_SYMBOLS[suitIndex] ?? '♠';
  return {
    rank,
    suit,
    red: suitIndex === 1 || suitIndex === 3,
    isJoker: false,
    name:
      locale === 'en'
        ? `${rank} of ${['Spades', 'Hearts', 'Clubs', 'Diamonds'][suitIndex] ?? ''}`
        : `${SUIT_NAMES[suitIndex] ?? ''}${rank}`,
  };
};

export type CardSize = 'sm' | 'md';

const SIZE_CLASS: Record<CardSize, string> = {
  sm: 'h-[3.1rem] w-[2.2rem]',
  md: 'h-[4.4rem] w-[3.1rem] sm:h-[4.9rem] sm:w-[3.45rem]',
};

const INDEX_CLASS: Record<CardSize, string> = {
  sm: 'text-[0.65rem] leading-[0.8]',
  md: 'text-[0.8rem] leading-[0.85] sm:text-[0.9rem]',
};

const PIP_CLASS: Record<CardSize, string> = {
  sm: 'text-base',
  md: 'text-2xl sm:text-3xl',
};

interface PlayingCardProps {
  card: number;
  locale?: 'zh' | 'en';
  size?: CardSize;
  /** 选中态：向上抬起 */
  selected?: boolean;
  /** 不可出：变灰 */
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

/**
 * 一张扑克牌。花色点数放在左上角，这样手牌重叠排列时每张牌依然能被认出来，
 * 这也是实体扑克的做法。可点击时是 button，纯展示时是 img 语义的 div。
 */
export const PlayingCard = ({
  card,
  locale = 'zh',
  size = 'md',
  selected,
  dimmed,
  disabled,
  onClick,
  style,
  className,
}: PlayingCardProps) => {
  const face = getCardFace(card, locale);

  const content = (
    <>
      <span
        className={cn(
          'playing-card-index absolute left-[0.18rem] top-[0.2rem] flex flex-col items-center font-bold',
          INDEX_CLASS[size],
        )}
      >
        <span>{face.rank}</span>
        <span className={face.isJoker ? '' : 'text-[0.9em]'}>{face.suit}</span>
      </span>
      <span className={cn('playing-card-mark', PIP_CLASS[size])} aria-hidden>
        {face.isJoker ? '★' : face.suit}
      </span>
      <span className="playing-card-mirror" aria-hidden="true">
        <span>{face.rank}</span>
        <span>{face.suit}</span>
      </span>
    </>
  );

  const shared = cn(
    'playing-card relative flex shrink-0 items-center justify-center rounded-md border border-slate-300/80 transition-all duration-150',
    SIZE_CLASS[size],
    face.red ? 'text-rose-600' : 'text-slate-800',
    selected && 'z-10 -translate-y-3 ring-2 ring-amber-400',
    dimmed && 'opacity-45 saturate-50',
    className,
  );

  if (!onClick) {
    return (
      <div
        role="img"
        aria-label={face.name}
        data-red={face.red}
        data-joker={face.isJoker}
        style={style}
        className={shared}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={face.name}
      aria-pressed={selected}
      data-red={face.red}
      data-joker={face.isJoker}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cn(
        shared,
        'cursor-pointer outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-sky-500',
        !disabled && !selected && 'hover:z-10 hover:-translate-y-1.5',
        disabled && 'cursor-default',
      )}
    >
      {content}
    </button>
  );
};

/** 牌背，用于对手手牌 */
export const CardBack = ({
  size = 'sm',
  className,
  style,
}: {
  size?: CardSize;
  className?: string;
  style?: CSSProperties;
}) => (
  <div
    aria-hidden
    style={style}
    className={cn(
      'playing-card-back shrink-0 rounded-md',
      SIZE_CLASS[size],
      className,
    )}
  />
);

interface CardFanProps {
  cards: number[];
  locale?: 'zh' | 'en';
  size?: CardSize;
  /** 每张牌露出的宽度（rem）。牌多时收窄，保证一行装得下 */
  reveal?: number;
  selected?: number[];
  disabledCards?: boolean;
  dimmedCards?: number[];
  onCardClick?: (card: number) => void;
  className?: string;
  animate?: boolean;
}

/**
 * 叠放的一手牌。靠负 margin 收窄，只露出左上角的花色点数，
 * 这样 17 张手牌或一条长顺子都能排成一行而不换行。
 */
export const CardFan = ({
  cards,
  locale = 'zh',
  size = 'md',
  reveal,
  selected,
  disabledCards,
  dimmedCards,
  onCardClick,
  className,
  animate,
}: CardFanProps) => {
  const step = reveal ?? (size === 'sm' ? 1.05 : 1.15);
  const selectedSet = new Set(selected);
  const dimmedSet = new Set(dimmedCards);
  const rowLength = Math.ceil(cards.length / 2);
  const rows =
    cards.length > 10 && onCardClick
      ? [cards.slice(0, rowLength), cards.slice(rowLength)]
      : [cards];

  return (
    <div
      className={cn('card-fan-viewport', className)}
      data-card-size={size}
      style={
        {
          width: `calc(${Math.max(0, cards.length - 1)} * ${step}rem + var(--fan-card-width))`,
          '--fan-step': `min(${step}rem, calc((100cqw - var(--fan-card-width)) / ${Math.max(1, cards.length - 1)}))`,
          '--fan-row-step': `min(2rem, calc((100cqw - var(--fan-card-width)) / ${Math.max(1, rowLength - 1)}))`,
        } as CSSProperties
      }
    >
      <div className="card-fan-rows" data-two-rows={rows.length === 2}>
        {rows.map((row, rowIndex) => (
          <div className="card-fan-row" key={rowIndex}>
            {row.map((card, index) => (
              <PlayingCard
                key={card}
                card={card}
                locale={locale}
                size={size}
                selected={selectedSet.has(card)}
                dimmed={dimmedSet.has(card)}
                disabled={disabledCards}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
                className={animate ? 'animate-card-deal' : undefined}
                style={{
                  animationDelay: animate
                    ? `${Math.min(index, 16) * 16}ms`
                    : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
