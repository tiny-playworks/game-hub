import type { CSSProperties } from 'react';
import { RiichiStickArt } from './RiichiStickArt';

const themes: Record<
  string,
  { color: string; symbol: string; motion: string }
> = {
  'riichi-default': { color: '#e2ba69', symbol: '·', motion: 'spark' },
  'riichi-sparks': { color: '#ffa341', symbol: '✦', motion: 'spark' },
  'riichi-sakura': { color: '#ffb8cc', symbol: '❀', motion: 'fall' },
  'riichi-lightning': { color: '#91d8ff', symbol: 'ϟ', motion: 'bolt' },
  'riichi-ink': { color: '#d2d8de', symbol: '墨', motion: 'ink' },
  'win-default': { color: '#e2ba69', symbol: '✦', motion: 'spark' },
  'win-fireworks': { color: '#ffc868', symbol: '✧', motion: 'spark' },
  'win-sakura': { color: '#ffb8cc', symbol: '❀', motion: 'fall' },
  'win-dragon': { color: '#edc66e', symbol: '龍', motion: 'dragon' },
  'win-galaxy': { color: '#b7acff', symbol: '✦', motion: 'orbit' },
  'win-mio': { color: '#7bdfce', symbol: '◌', motion: 'orbit' },
  'win-chitose': { color: '#b8db91', symbol: '葉', motion: 'fall' },
  'win-aya': { color: '#ff747b', symbol: 'ϟ', motion: 'bolt' },
  'win-yoru': { color: '#b6bfff', symbol: '☾', motion: 'orbit' },
  'win-tsubaki': { color: '#e2a856', symbol: '✿', motion: 'fall' },
};

/** The shop and the live game share the same effect layer. CSS honors reduced motion. */
export function CosmeticEffect({
  id,
  kind,
  still = false,
}: {
  id: string;
  kind: 'riichi' | 'win';
  still?: boolean;
}) {
  const theme = themes[id] ?? themes[`${kind}-default`];
  return (
    <span
      className={still ? 'cosmetic-effect is-still' : 'cosmetic-effect'}
      data-cosmetic-effect={id}
      data-motion={theme.motion}
      data-kind={kind}
      style={{ '--effect-color': theme.color } as CSSProperties}
      aria-hidden="true"
    >
      {still ? (
        <span className="cosmetic-effect-emblem">{theme.symbol}</span>
      ) : (
        <span className="cosmetic-effect-halo" />
      )}
      {!still && (
        <span className="cosmetic-effect-emblem cosmetic-reduced-emblem">
          {theme.symbol}
        </span>
      )}
      {kind === 'riichi' && (
        <span className="cosmetic-riichi-stick" data-riichi-design={id}>
          <RiichiStickArt design={id} />
        </span>
      )}
      {!still && theme.motion === 'dragon' && (
        <span className="cosmetic-dragon-seal">龍</span>
      )}
      {!still &&
        Array.from({ length: 16 }, (_, index) => (
          <i
            key={index}
            style={
              {
                '--particle': index,
                '--angle': `${index * 22.5}deg`,
                '--distance': `${65 + (index % 4) * 23}px`,
                '--delay': `${(index % 4) * 40}ms`,
              } as CSSProperties
            }
          >
            {theme.symbol}
          </i>
        ))}
    </span>
  );
}
