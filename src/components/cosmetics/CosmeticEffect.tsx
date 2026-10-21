import type { CSSProperties } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EffectMotif, type EffectMotifKind } from './EffectMotif';
import { RiichiStickArt } from './RiichiStickArt';

const themes: Record<
  string,
  { color: string; accent: string; motif: EffectMotifKind }
> = {
  'riichi-default': { color: '#d9ba78', accent: '#fff3ce', motif: 'classic' },
  'riichi-sparks': { color: '#f2ab5b', accent: '#fff1bd', motif: 'fireworks' },
  'riichi-sakura': { color: '#eeb1c5', accent: '#ffe8cc', motif: 'petals' },
  'riichi-lightning': {
    color: '#78cde8',
    accent: '#e7faff',
    motif: 'lightning',
  },
  'riichi-ink': { color: '#c8d2d8', accent: '#f5f0e2', motif: 'ink' },
  'win-default': { color: '#d9ba78', accent: '#fff3ce', motif: 'classic' },
  'win-fireworks': { color: '#edbd6b', accent: '#fff3c4', motif: 'fireworks' },
  'win-sakura': { color: '#f1a9c2', accent: '#fff1da', motif: 'petals' },
  'win-dragon': { color: '#dcb66a', accent: '#fff1c7', motif: 'dragon' },
  'win-galaxy': { color: '#b6adf0', accent: '#e2e6ff', motif: 'galaxy' },
  'win-mio': { color: '#8bcfc8', accent: '#dcfff4', motif: 'water' },
  'win-chitose': { color: '#b4cc97', accent: '#e8edbd', motif: 'bamboo' },
  'win-aya': { color: '#f48b8c', accent: '#ffe2bf', motif: 'lightning' },
  'win-yoru': { color: '#b9c8ee', accent: '#edf0ff', motif: 'moon' },
  'win-tsubaki': { color: '#dca064', accent: '#ffdd9c', motif: 'camellia' },
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
  const reduced = useReducedMotion();
  const staticMode = still || reduced;
  return (
    <span
      className={staticMode ? 'cosmetic-effect is-still' : 'cosmetic-effect'}
      data-cosmetic-effect={id}
      data-motif={theme.motif}
      data-kind={kind}
      style={
        {
          '--effect-color': theme.color,
          '--effect-accent': theme.accent,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="cosmetic-effect-glow" />
      <span className="cosmetic-effect-orbit">
        <EffectMotif kind={theme.motif} />
      </span>
      {!staticMode && (
        <>
          <span className="cosmetic-effect-sweep" />
          <span className="cosmetic-effect-wave" />
        </>
      )}
      {kind === 'riichi' && (
        <span className="cosmetic-riichi-stick" data-riichi-design={id}>
          <RiichiStickArt design={id} />
        </span>
      )}
      {!staticMode &&
        Array.from({ length: kind === 'win' ? 20 : 14 }, (_, index) => (
          <i
            className="cosmetic-particle"
            key={index}
            style={
              {
                '--particle': index,
                '--angle': `${index * 137.508}deg`,
                '--distance': `${72 + (index % 5) * 20}px`,
                '--delay': `${(index % 6) * 45}ms`,
                '--drift': `${-45 + (index % 7) * 15}px`,
                '--x': `${7 + ((index * 37) % 86)}%`,
                '--size': `${4 + (index % 4) * 2}px`,
              } as CSSProperties
            }
          />
        ))}
    </span>
  );
}
