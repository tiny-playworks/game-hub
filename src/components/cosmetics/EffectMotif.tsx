import dragonCrest from '@/assets/cosmetics/dragon-crest.webp';

export type EffectMotifKind =
  | 'classic'
  | 'fireworks'
  | 'petals'
  | 'lightning'
  | 'ink'
  | 'dragon'
  | 'galaxy'
  | 'water'
  | 'bamboo'
  | 'moon'
  | 'camellia';

/** Native geometry stays sharp; the engraved dragon uses a compressed alpha WebP. */
export function EffectMotif({ kind }: { kind: EffectMotifKind }) {
  if (kind === 'dragon')
    return (
      <img
        className="cosmetic-effect-art cosmetic-dragon-art"
        src={dragonCrest}
        alt=""
        decoding="async"
      />
    );
  return (
    <svg
      className="cosmetic-effect-art"
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden="true"
    >
      {kind === 'classic' && (
        <g stroke="currentColor">
          <circle cx="200" cy="200" r="123" strokeWidth="1" opacity=".35" />
          <circle
            cx="200"
            cy="200"
            r="111"
            strokeWidth="2"
            strokeDasharray="2 8"
            opacity=".6"
          />
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M200 42 358 200 200 358 42 200Z"
            strokeWidth="1.5"
          />
          <path
            d="M200 68 332 200 200 332 68 200Z"
            strokeWidth="1"
            opacity=".3"
          />
          {[0, 90, 180, 270].map((angle) => (
            <path
              key={angle}
              d="M200 17 205 40 200 63 195 40Z"
              transform={`rotate(${angle} 200 200)`}
              fill="currentColor"
              stroke="none"
            />
          ))}
        </g>
      )}
      {kind === 'fireworks' && (
        <g stroke="currentColor" strokeLinecap="round">
          {Array.from({ length: 16 }, (_, index) => (
            <g key={index} transform={`rotate(${index * 22.5} 200 200)`}>
              <path
                className="cosmetic-drawn"
                pathLength="1"
                d={`M200 168 Q${181 + (index % 3) * 9} 112 200 ${40 + (index % 4) * 11}`}
                strokeWidth={index % 2 ? 1 : 2.5}
              />
              <circle
                cx="200"
                cy={26 + (index % 4) * 11}
                r={index % 3 ? 2 : 3.5}
                fill="currentColor"
                stroke="none"
              />
              <path d="M207 113 217 91" strokeWidth="1" opacity=".5" />
            </g>
          ))}
          <circle cx="200" cy="200" r="43" strokeWidth=".7" opacity=".45" />
        </g>
      )}
      {(kind === 'petals' || kind === 'camellia') && (
        <g>
          <circle
            cx="200"
            cy="200"
            r="143"
            stroke="currentColor"
            strokeWidth=".7"
            opacity=".25"
          />
          {Array.from({ length: kind === 'petals' ? 5 : 9 }, (_, index) => (
            <path
              key={index}
              d={
                kind === 'petals'
                  ? 'M200 206C171 185 151 143 172 126C184 117 196 125 200 138C206 123 220 118 232 130C252 153 224 189 200 206Z'
                  : 'M200 211C159 190 147 138 175 121C198 108 234 120 239 149C243 178 219 198 200 211Z'
              }
              transform={`rotate(${index * (kind === 'petals' ? 72 : 40)} 200 200)`}
              fill="currentColor"
              fillOpacity={0.25 + (index % 3) * 0.13}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          ))}
          {kind === 'camellia' &&
            Array.from({ length: 6 }, (_, index) => (
              <ellipse
                key={index}
                cx="200"
                cy="174"
                rx="19"
                ry="34"
                transform={`rotate(${index * 60} 200 200)`}
                fill="currentColor"
                fillOpacity=".45"
                stroke="currentColor"
                strokeWidth=".7"
              />
            ))}
          <circle cx="200" cy="200" r="12" fill="var(--effect-accent)" />
          {Array.from({ length: 10 }, (_, index) => (
            <path
              key={index}
              d="M200 195 200 173"
              transform={`rotate(${index * 36} 200 200)`}
              stroke="var(--effect-accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      {kind === 'lightning' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path
            className="cosmetic-lightning-aura"
            d="M12 235 91 179 127 194 183 111 166 206 220 178 205 248 289 175 278 217 391 158"
            stroke="currentColor"
            strokeWidth="13"
            opacity=".25"
          />
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M12 235 91 179 127 194 183 111 166 206 220 178 205 248 289 175 278 217 391 158"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M127 194 98 132 125 145 148 65M220 178 262 119 248 155 307 115M205 248 161 304 177 267 113 302"
            stroke="var(--effect-accent)"
            strokeWidth="1.2"
          />
        </g>
      )}
      {kind === 'ink' && (
        <g stroke="currentColor" strokeLinecap="round">
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M282 87C197 33 87 93 76 187C64 284 164 345 252 306C328 274 351 178 307 126"
            strokeWidth="20"
            opacity=".83"
          />
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M290 83C182 25 66 107 77 215C86 297 196 351 277 291"
            strokeWidth="3"
            opacity=".45"
          />
          <path
            d="M280 84 327 118 314 126 291 105Z"
            fill="currentColor"
            stroke="none"
          />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <circle
              key={index}
              cx={60 + index * 51}
              cy={index % 2 ? 315 + index * 3 : 61 - index * 3}
              r={1.5 + (index % 3) * 1.7}
              fill="currentColor"
              stroke="none"
              opacity=".6"
            />
          ))}
        </g>
      )}
      {(kind === 'galaxy' || kind === 'moon') && (
        <g stroke="currentColor">
          <ellipse
            className="cosmetic-orbital"
            cx="200"
            cy="200"
            rx="164"
            ry="65"
            transform="rotate(-32 200 200)"
            strokeWidth="1"
            opacity=".65"
          />
          <ellipse
            cx="200"
            cy="200"
            rx="139"
            ry="110"
            transform="rotate(26 200 200)"
            strokeWidth=".6"
            opacity=".3"
          />
          {kind === 'moon' ? (
            <path
              d="M236 91C154 109 138 227 218 263C145 280 99 221 115 162C129 111 182 80 236 91Z"
              fill="currentColor"
              fillOpacity=".8"
              strokeWidth="1"
            />
          ) : (
            <g>
              <circle cx="200" cy="200" r="82" strokeWidth=".8" opacity=".5" />
              <circle
                cx="200"
                cy="200"
                r="13"
                fill="currentColor"
                fillOpacity=".6"
                stroke="none"
              />
            </g>
          )}
          {Array.from({ length: 12 }, (_, index) => (
            <path
              key={index}
              d="m0-5 1.3 3.7L5 0 1.3 1.3 0 5-1.3 1.3-5 0-1.3-1.3Z"
              fill="currentColor"
              stroke="none"
              transform={`translate(${40 + ((index * 83) % 320)} ${35 + ((index * 113) % 330)}) scale(${index % 3 === 0 ? 1.4 : 0.65})`}
            />
          ))}
        </g>
      )}
      {kind === 'water' && (
        <g stroke="currentColor">
          {[66, 94, 126, 159].map((radius, index) => (
            <ellipse
              key={radius}
              cx="200"
              cy="216"
              rx={radius}
              ry={radius * 0.49}
              strokeWidth={index ? 1 : 2}
              opacity={0.85 - index * 0.15}
            />
          ))}
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M182 86Q200 58 218 86C240 118 217 143 200 143S160 118 182 86Z"
            strokeWidth="1.5"
            fill="currentColor"
            fillOpacity=".12"
          />
          <path
            d="M106 213Q153 193 200 213T294 213M137 242Q200 261 263 242"
            strokeWidth=".8"
            opacity=".4"
          />
        </g>
      )}
      {kind === 'bamboo' && (
        <g stroke="currentColor">
          <path
            className="cosmetic-drawn"
            pathLength="1"
            d="M116 348Q137 205 109 60M264 354Q246 192 288 48"
            strokeWidth="4"
          />
          {[0, 1, 2, 3].map((index) => (
            <g
              key={index}
              transform={`translate(${index % 2 ? 259 : 124} ${104 + index * 53}) rotate(${index % 2 ? -25 : 20})`}
            >
              <path
                d="M0 0Q-58-46-88-22Q-41-16 0 0M0 0Q35-61 69-51Q36-13 0 0M0 0Q-21-58-46-60Q-39-20 0 0"
                fill="currentColor"
                fillOpacity=".52"
                strokeWidth=".7"
              />
              <path d="M-8 4 8-4" strokeWidth="3" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
