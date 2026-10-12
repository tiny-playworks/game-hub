import {
  Brain,
  BrickWall,
  CircleDot,
  Crosshair,
  Cuboid,
  type Gamepad2,
  Spade,
  Swords,
  Target,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** Code-native glyphs mirror the approved arcade motifs at any screen density. */
export function VenueGameGlyph({ gameId }: { gameId: string }) {
  let art: ReactNode;
  switch (gameId) {
    case 'guess-number':
      art = [0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 17 + 3},${i * 16 + 2})`}>
          <rect
            width="30"
            height="32"
            rx="4"
            fill={i === 2 ? 'var(--venue-red)' : 'var(--venue-ink)'}
          />
          <text x="15" y="23" textAnchor="middle" fill="#f5f2e9" fontSize="24">
            {i + 1}
          </text>
        </g>
      ));
      break;
    case 'tictactoe':
      art = (
        <g
          fill="none"
          stroke="var(--venue-ink)"
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          <path d="M25 5v58M47 5v58M5 25h58M5 47h58M7 7l13 13m0-13L7 20M50 50l13 13m0-13L50 63" />
          <circle cx="36" cy="15" r="8" stroke="var(--venue-red)" />
          <circle cx="14" cy="37" r="8" stroke="var(--venue-red)" />
          <path d="M29 30l13 13m0-13L29 43" />
        </g>
      );
      break;
    case 'memory':
      art = (
        <g>
          <rect
            x="24"
            y="12"
            width="38"
            height="52"
            rx="5"
            fill="var(--venue-red)"
          />
          <rect
            x="4"
            y="3"
            width="38"
            height="52"
            rx="5"
            fill="var(--card)"
            stroke="var(--venue-ink)"
            strokeWidth="3"
          />
          <path
            d="m23 12 4 8 9 2-7 6 1 9-7-4-8 4 2-9-7-6 9-2z"
            fill="var(--venue-ink)"
          />
        </g>
      );
      break;
    case '2048':
      art = ['2', '0', '4', '8'].map((n, i) => (
        <g
          key={n}
          transform={`translate(${(i % 2) * 33},${Math.floor(i / 2) * 33})`}
        >
          <rect width="30" height="30" rx="4" fill="var(--venue-ink)" />
          <text
            x="15"
            y="23"
            textAnchor="middle"
            fill="#f5f2e9"
            fontFamily="Georgia,serif"
            fontSize="25"
          >
            {n}
          </text>
        </g>
      ));
      break;
    case 'snake':
      art = (
        <g fill="var(--venue-ink)">
          <path d="M5 5h52v12H17v13h34v13H17v13h44v12H5V31h34v-2H5z" />
          <circle cx="62" cy="34" r="6" fill="var(--venue-red)" />
          <circle cx="51" cy="11" r="2" fill="#f5f2e9" />
        </g>
      );
      break;
    default: {
      const Icon =
        (
          {
            breakout: BrickWall,
            shooter: Crosshair,
            tank: Target,
            tetris: BrickWall,
            rubiks: Cuboid,
            gomoku: CircleDot,
            go: CircleDot,
            chess: Swords,
            xiangqi: Swords,
            doudizhu: Spade,
            shengji: Spade,
          } as Record<string, typeof Gamepad2>
        )[gameId] ?? Brain;
      return (
        <Icon
          className="venue-game-glyph"
          aria-hidden="true"
          strokeWidth={1.6}
        />
      );
    }
  }
  return (
    <svg className="venue-game-glyph" viewBox="0 0 72 72" aria-hidden="true">
      {art}
    </svg>
  );
}
