import { useId } from 'react';
import type { Piece, PieceType } from '@/lib/chess';
import { cn } from '@/lib/utils';
import './board-surfaces.css';

const SHAPES: Record<PieceType, string> = {
  K: 'M20 4h8v6h6v7H14v-7h6ZM16 21h16l-3 10 5 12H14l5-12Z',
  Q: 'M10 12l8 7 6-11 6 11 8-7-5 17H15ZM17 31h14l-1 5 5 7H13l5-7Z',
  B: 'M24 5c-3 5-11 10-11 16 0 5 5 8 11 8s11-3 11-8c0-6-8-11-11-16ZM19 31h10l-1 5 6 7H14l6-7Z',
  N: 'M12 43l2-10 9-10-7 3-6-5 9-10 1-7 7 5c11 1 15 12 11 24l-3 10Z',
  R: 'M11 8h7v7h3V8h6v7h3V8h7v17H11ZM16 27h16l-3 9 5 7H14l5-7Z',
  P: 'M24 10a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM20 28h8l-1 7 7 8H14l7-8Z',
};

/** Small vector carvings keep each piece legible on both light and dark squares. */
export function ChessPiece({
  piece,
  className,
}: {
  piece: Piece;
  className?: string;
}) {
  const id = useId();
  const gradientId = `chess-carving-${id}`;
  const light = piece.side === 'white';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 56"
      className={cn('chess-piece', className)}
      data-side={piece.side}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light ? '#b88b50' : '#070e14'} />
          <stop offset="0.35" stopColor={light ? '#fff4d8' : '#586471'} />
          <stop offset="0.63" stopColor={light ? '#e7c68f' : '#25333f'} />
          <stop offset="1" stopColor={light ? '#a5773b' : '#0d1922'} />
        </linearGradient>
      </defs>
      <g
        fill={`url(#${gradientId})`}
        stroke={light ? '#79512d' : '#c2a471'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      >
        <path d={SHAPES[piece.type]} />
        <path d="M13 43h22l3 5H10ZM9 48h30l3 5H6Z" />
      </g>
      <g
        fill="none"
        stroke={light ? '#986c36' : '#d3af66'}
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M15 46h18M11 51h26" />
        {piece.type === 'B' && <path d="m20 18 7 7" />}
        {piece.type === 'N' && (
          <>
            <path d="m22 17 2-1M29 17c4 7 0 14-5 18" />
            <path d="m16 20 2 1" />
          </>
        )}
        {piece.type === 'K' && <path d="M24 8v5m-3-2h6" />}
        {piece.type === 'Q' && <path d="M18 25h12" />}
        {piece.type === 'R' && <path d="M16 22h16" />}
      </g>
    </svg>
  );
}
