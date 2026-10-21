import type { ReactNode } from 'react';
import { GPT_ARCADE_COVERS } from '@/assets/gptAssets';

/**
 * Renders each arcade game's visual emblem:
 * 1. Automatically uses the GPT-generated ukiyo-e/maki-e cover (`src/assets/arcade/covers/<gameId>.webp`) when available.
 * 2. Provides a complete 16-game bespoke Neo-Traditional Japanese Salon (Ink Navy / Ivory / Vermilion / Maki-e Gold) woodblock vector medallion baseline, eliminating generic wireframe icon fallbacks.
 */
export function VenueGameGlyph({ gameId }: { gameId: string }) {
  const gptCover = GPT_ARCADE_COVERS[gameId];
  if (gptCover) {
    return (
      <img
        src={gptCover}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="venue-game-glyph venue-game-glyph--cover"
      />
    );
  }

  let art: ReactNode;
  switch (gameId) {
    case 'guess-number':
      art = (
        <g>
          <rect
            x="10"
            y="14"
            width="52"
            height="44"
            rx="6"
            fill="#1f3649"
            stroke="#d3af66"
            strokeWidth="1.6"
          />
          <line
            x1="27"
            y1="14"
            x2="27"
            y2="58"
            stroke="#d3af66"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />
          <line
            x1="45"
            y1="14"
            x2="45"
            y2="58"
            stroke="#d3af66"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />
          <rect x="30" y="18" width="12" height="36" rx="3" fill="#c54838" />
          <text
            x="18.5"
            y="42"
            textAnchor="middle"
            fill="#f5f2e9"
            fontFamily="Georgia, serif"
            fontSize="18"
            fontWeight="700"
          >
            壱
          </text>
          <text
            x="36"
            y="42"
            textAnchor="middle"
            fill="#fffaf2"
            fontFamily="Georgia, serif"
            fontSize="18"
            fontWeight="700"
          >
            柒
          </text>
          <text
            x="53.5"
            y="42"
            textAnchor="middle"
            fill="#d3af66"
            fontFamily="Georgia, serif"
            fontSize="18"
            fontWeight="700"
          >
            玖
          </text>
        </g>
      );
      break;
    case 'tictactoe':
      art = (
        <g>
          <path
            d="M27 12v48M45 12v48M12 27h48M12 45h48"
            stroke="#d3af66"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle
            cx="20"
            cy="20"
            r="5.5"
            fill="none"
            stroke="#c54838"
            strokeWidth="2.8"
          />
          <circle
            cx="36"
            cy="36"
            r="5.5"
            fill="none"
            stroke="#c54838"
            strokeWidth="2.8"
          />
          <circle
            cx="52"
            cy="52"
            r="5.5"
            fill="none"
            stroke="#c54838"
            strokeWidth="2.8"
          />
          <path
            d="M48 16l8 8m0-8l-8 8M16 48l8 8m0-8l-8 8"
            stroke="#f5f2e9"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      );
      break;
    case 'memory':
      art = (
        <g>
          <rect
            x="26"
            y="14"
            width="30"
            height="42"
            rx="4"
            transform="rotate(10 41 35)"
            fill="#c54838"
            stroke="#d3af66"
            strokeWidth="1.5"
          />
          <rect
            x="15"
            y="14"
            width="30"
            height="42"
            rx="4"
            transform="rotate(-8 30 35)"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.6"
          />
          <circle cx="29" cy="31" r="7" fill="#c54838" />
          <path
            d="M20 47c4-5 10-5 18 0"
            fill="none"
            stroke="#172a3a"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      );
      break;
    case '2048':
      art = (
        <g>
          {[
            { x: 12, y: 12, bg: '#20384b', fg: '#f5f2e9', txt: '2' },
            { x: 37, y: 12, bg: '#29465c', fg: '#d3af66', txt: '0' },
            { x: 12, y: 37, bg: '#8b6b4a', fg: '#fffaf2', txt: '4' },
            { x: 37, y: 37, bg: '#c54838', fg: '#fffaf2', txt: '8' },
          ].map((tile) => (
            <g key={tile.txt} transform={`translate(${tile.x},${tile.y})`}>
              <rect
                width="23"
                height="23"
                rx="4"
                fill={tile.bg}
                stroke="#d3af66"
                strokeWidth="1.3"
              />
              <text
                x="11.5"
                y="17"
                textAnchor="middle"
                fill={tile.fg}
                fontFamily="Georgia, serif"
                fontSize="16"
                fontWeight="700"
              >
                {tile.txt}
              </text>
            </g>
          ))}
        </g>
      );
      break;
    case 'snake':
      art = (
        <g>
          <path
            d="M15 50c0-10 10-10 16-10h12c7 0 11-4 11-9s-4-9-11-9H26c-6 0-9-3-9-7"
            fill="none"
            stroke="#d3af66"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            d="M15 50c0-10 10-10 16-10h12c7 0 11-4 11-9s-4-9-11-9H26c-6 0-9-3-9-7"
            fill="none"
            stroke="#f5f2e9"
            strokeWidth="2"
            strokeDasharray="3 4"
            strokeLinecap="round"
          />
          <circle
            cx="52"
            cy="50"
            r="6"
            fill="#c54838"
            stroke="#f5f2e9"
            strokeWidth="1.4"
          />
        </g>
      );
      break;
    case 'breakout':
      art = (
        <g>
          {[0, 1, 2].map((col) => (
            <rect
              key={`r1-${col}`}
              x={13 + col * 16}
              y="14"
              width="14"
              height="7"
              rx="2"
              fill={col === 1 ? '#c54838' : '#d3af66'}
            />
          ))}
          {[0, 1, 2].map((col) => (
            <rect
              key={`r2-${col}`}
              x={13 + col * 16}
              y="24"
              width="14"
              height="7"
              rx="2"
              fill={col === 1 ? '#f5f2e9' : '#2b4a61'}
              stroke="#d3af66"
              strokeWidth="1"
            />
          ))}
          <circle cx="40" cy="41" r="4.5" fill="#c54838" />
          <path
            d="M28 51l10-8"
            stroke="#d3af66"
            strokeWidth="1.8"
            strokeDasharray="2 2"
            strokeLinecap="round"
          />
          <rect
            x="18"
            y="53"
            width="36"
            height="6"
            rx="3"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
        </g>
      );
      break;
    case 'shooter':
      art = (
        <g>
          <circle
            cx="36"
            cy="36"
            r="18"
            fill="none"
            stroke="#d3af66"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <path
            d="M36 13l15 36-15-8-15 8z"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M36 19v22" stroke="#c54838" strokeWidth="2.8" />
          <circle cx="36" cy="49" r="4" fill="#c54838" />
        </g>
      );
      break;
    case 'tank':
      art = (
        <g>
          <rect
            x="16"
            y="26"
            width="10"
            height="30"
            rx="3"
            fill="#274257"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
          <rect
            x="46"
            y="26"
            width="10"
            height="30"
            rx="3"
            fill="#274257"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
          <rect
            x="22"
            y="29"
            width="28"
            height="24"
            rx="4"
            fill="#172a3a"
            stroke="#d3af66"
            strokeWidth="1.6"
          />
          <circle
            cx="36"
            cy="41"
            r="7.5"
            fill="#c54838"
            stroke="#f5f2e9"
            strokeWidth="1.5"
          />
          <rect
            x="33.5"
            y="12"
            width="5"
            height="22"
            rx="2.5"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.2"
          />
        </g>
      );
      break;
    case 'tetris':
      art = (
        <g>
          {[
            [16, 16, '#c54838'],
            [28, 16, '#c54838'],
            [40, 16, '#c54838'],
            [28, 28, '#c54838'],
            [16, 42, '#d3af66'],
            [16, 52, '#d3af66'],
            [28, 52, '#d3af66'],
            [42, 40, '#f5f2e9'],
            [52, 40, '#f5f2e9'],
            [42, 50, '#f5f2e9'],
            [52, 50, '#f5f2e9'],
          ].map(([x, y, fill], idx) => (
            <rect
              key={idx}
              x={Number(x)}
              y={Number(y)}
              width="10"
              height="10"
              rx="2"
              fill={String(fill)}
              stroke="#172a3a"
              strokeWidth="1.2"
            />
          ))}
        </g>
      );
      break;
    case 'rubiks':
      art = (
        <g stroke="#172a3a" strokeWidth="1.4" strokeLinejoin="round">
          <polygon points="36,12 56,23 36,34 16,23" fill="#f5f2e9" />
          <polygon points="16,23 36,34 36,57 16,46" fill="#c54838" />
          <polygon points="56,23 36,34 36,57 56,46" fill="#d3af66" />
          <path
            d="M26 17.5l20 11M46 17.5l-20 11M26 28.5v23M46 28.5v23M16 34.5l20 11 20-11"
            fill="none"
            stroke="#172a3a"
            strokeWidth="1.1"
          />
        </g>
      );
      break;
    case 'gomoku':
      art = (
        <g>
          <rect
            x="13"
            y="13"
            width="46"
            height="46"
            rx="5"
            fill="#d8b37c"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
          <path
            d="M24 13v46M36 13v46M48 13v46M13 24h46M13 36h46M13 48h46"
            stroke="#57340f"
            strokeWidth="1"
            strokeOpacity="0.55"
          />
          {[18, 27, 36, 45, 54].map((pos, i) => (
            <circle
              key={pos}
              cx={pos}
              cy={pos}
              r="4.2"
              fill={i % 2 === 0 ? '#172a3a' : '#fffaf2'}
              stroke={i === 2 ? '#c54838' : '#172a3a'}
              strokeWidth={i === 2 ? '1.8' : '0.9'}
            />
          ))}
        </g>
      );
      break;
    case 'go':
      art = (
        <g>
          <rect
            x="13"
            y="13"
            width="46"
            height="46"
            rx="5"
            fill="#cfa668"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
          <path
            d="M24 13v46M36 13v46M48 13v46M13 24h46M13 36h46M13 48h46"
            stroke="#4c2d0c"
            strokeWidth="1.1"
            strokeOpacity="0.6"
          />
          <circle cx="24" cy="24" r="5" fill="#172a3a" />
          <circle cx="36" cy="24" r="5" fill="#f5f2e9" stroke="#172a3a" />
          <circle cx="36" cy="36" r="5" fill="#172a3a" />
          <circle cx="24" cy="36" r="5" fill="#f5f2e9" stroke="#172a3a" />
          <circle cx="48" cy="36" r="5" fill="#f5f2e9" stroke="#172a3a" />
          <circle cx="36" cy="48" r="5" fill="#c54838" />
        </g>
      );
      break;
    case 'chess':
      art = (
        <g>
          <path
            d="M22 54h28l-3-7H25l-3 7zm5-10h18l-2-15 5-4-4-7-5 3-3-6-3 6-5-3-4 7 5 4-2 15z"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="36" cy="14" r="2.5" fill="#c54838" />
        </g>
      );
      break;
    case 'xiangqi':
      art = (
        <g>
          <circle
            cx="36"
            cy="36"
            r="22"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="2.2"
          />
          <circle
            cx="36"
            cy="36"
            r="18"
            fill="none"
            stroke="#c54838"
            strokeWidth="1.4"
          />
          <text
            x="36"
            y="44"
            textAnchor="middle"
            fill="#c54838"
            fontFamily="'Noto Serif SC', 'Songti SC', serif"
            fontSize="24"
            fontWeight="700"
          >
            帥
          </text>
        </g>
      );
      break;
    case 'doudizhu':
      art = (
        <g>
          <rect
            x="15"
            y="17"
            width="26"
            height="38"
            rx="3.5"
            transform="rotate(-12 28 36)"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.4"
          />
          <rect
            x="29"
            y="16"
            width="28"
            height="40"
            rx="3.5"
            transform="rotate(8 43 36)"
            fill="#fffaf2"
            stroke="#c54838"
            strokeWidth="1.6"
          />
          <path
            d="M34 39l3-9 5 5 5-5 3 9z"
            fill="#c54838"
            stroke="#d3af66"
            strokeWidth="1"
          />
        </g>
      );
      break;
    case 'shengji':
      art = (
        <g>
          <rect
            x="19"
            y="14"
            width="34"
            height="44"
            rx="4"
            fill="#f5f2e9"
            stroke="#d3af66"
            strokeWidth="1.8"
          />
          <path
            d="M36 22c-6 7-11 11-11 16a6 6 0 0 0 9 5l-2 6h8l-2-6a6 6 0 0 0 9-5c0-5-5-9-11-16z"
            fill="#172a3a"
          />
          <circle cx="48" cy="20" r="4" fill="#c54838" />
        </g>
      );
      break;
    default:
      art = (
        <circle
          cx="36"
          cy="36"
          r="16"
          fill="#c54838"
          stroke="#d3af66"
          strokeWidth="2"
        />
      );
  }

  return (
    <svg
      className="venue-game-glyph venue-game-glyph--medallion"
      viewBox="0 0 72 72"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="66"
        height="66"
        rx="14"
        fill="#172a3a"
        stroke="#d3af66"
        strokeWidth="1.8"
      />
      <rect
        x="6.5"
        y="6.5"
        width="59"
        height="59"
        rx="11"
        fill="none"
        stroke="#d3af66"
        strokeOpacity="0.35"
        strokeWidth="0.9"
      />
      {art}
    </svg>
  );
}
