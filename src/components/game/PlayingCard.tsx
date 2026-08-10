import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

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
export const getCardFace = (card: number): CardFace => {
  if (card === CARD_SMALL_JOKER) {
    return { rank: '小', suit: '王', red: false, isJoker: true, name: '小王' };
  }
  if (card === CARD_BIG_JOKER) {
    return { rank: '大', suit: '王', red: true, isJoker: true, name: '大王' };
  }
  const suitIndex = Math.floor(card / 13);
  const rank = RANK_LABELS[card % 13] ?? '?';
  const suit = SUIT_SYMBOLS[suitIndex] ?? '♠';
  return {
    rank,
    suit,
    red: suitIndex === 1 || suitIndex === 3,
    isJoker: false,
    name: `${SUIT_NAMES[suitIndex] ?? ''}${rank}`,
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
  size = 'md',
  selected,
  dimmed,
  disabled,
  onClick,
  style,
  className,
}: PlayingCardProps) => {
  const face = getCardFace(card);

  const content = (
    <>
      <span
        className={cn(
          'absolute left-[0.15rem] top-[0.15rem] flex flex-col items-center font-bold',
          INDEX_CLASS[size],
        )}
      >
        <span>{face.rank}</span>
        <span className={face.isJoker ? '' : 'text-[0.9em]'}>{face.suit}</span>
      </span>
      <span className={cn('opacity-25', PIP_CLASS[size])} aria-hidden>
        {face.isJoker ? '★' : face.suit}
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
      <div role="img" aria-label={face.name} style={style} className={shared}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={face.name}
      aria-pressed={selected}
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
  const width = size === 'sm' ? 2.2 : 3.1;
  const offset = -(width - step);
  const selectedSet = new Set(selected);
  const dimmedSet = new Set(dimmedCards);

  return (
    <div className={cn('flex items-end', className)}>
      {cards.map((card, index) => (
        <PlayingCard
          key={card}
          card={card}
          size={size}
          selected={selectedSet.has(card)}
          dimmed={dimmedSet.has(card)}
          disabled={disabledCards}
          onClick={onCardClick ? () => onCardClick(card) : undefined}
          className={animate ? 'animate-card-deal' : undefined}
          style={{
            marginLeft: index === 0 ? 0 : `${offset}rem`,
            animationDelay: animate
              ? `${Math.min(index, 16) * 16}ms`
              : undefined,
          }}
        />
      ))}
    </div>
  );
};
