import { useId, useState } from 'react';
import { getCharacterAsset } from '@/assets/characters';
import { getCharacterSheet } from '@/assets/characters/sheets';
import { useCharacters } from '@/hooks/useCosmetics';
import type { CharacterDef, CharacterExpression } from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-12 w-12 min-h-12 min-w-12 text-sm',
  md: 'h-16 w-16 min-h-16 min-w-16 text-lg',
  lg: 'h-24 w-24 min-h-24 min-w-24 text-2xl',
  xl: 'h-80 w-56 text-6xl',
  cutin: 'h-96 w-64 text-6xl',
};

export interface CharacterPortraitSlotProps {
  character: CharacterDef;
  size?: keyof typeof sizeClass;
  expression?: CharacterExpression;
  label: string;
  className?: string;
  outfit?: string;
  fit?: 'contain' | 'cover';
}

/**
 * 小尺寸使用头像，大尺寸使用透明立绘；缺少资源或加载失败时保留渐变占位。
 */
export function CharacterPortraitSlot({
  character,
  size = 'md',
  expression = 'normal',
  label,
  className,
  outfit,
  fit,
}: CharacterPortraitSlotProps) {
  const clipId = useId();
  const initial = character.name.slice(0, 1);
  const isPortrait = size === 'xl' || size === 'cutin';
  const characters = useCharacters();
  const sheet = getCharacterSheet(
    character.id,
    expression,
    isPortrait,
    outfit ?? characters.outfitByCharacter?.[character.id],
  );
  const path =
    !isPortrait && expression === 'normal'
      ? character.avatar
      : character.expressions?.[expression];
  const src =
    sheet?.src ??
    (character.portraitKey && path ? getCharacterAsset(path) : undefined);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasImage = src && src !== failedSource;
  const viewport = sheet?.viewBox.split(' ').map(Number);
  return (
    <div
      role="img"
      aria-label={label}
      data-character-art={sheet ? 'sheet' : 'portrait'}
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-semibold',
        hasImage && isPortrait
          ? 'border border-transparent'
          : cn(
              'border border-border bg-linear-to-br shadow-inner',
              character.accent,
            ),
        sizeClass[size],
        className,
        // 占位为浅色渐变，文字必须深色。
        'text-slate-900',
      )}
    >
      {hasImage && sheet ? (
        <svg
          aria-hidden="true"
          viewBox={sheet.viewBox}
          preserveAspectRatio={
            fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
          }
          className="h-full w-full"
        >
          {fit === 'contain' && viewport && (
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={viewport[0]}
                  y={viewport[1]}
                  width={viewport[2]}
                  height={viewport[3]}
                />
              </clipPath>
            </defs>
          )}
          <image
            href={sheet.src}
            width={sheet.width}
            height={sheet.height}
            clipPath={fit === 'contain' ? `url(#${clipId})` : undefined}
            // SVG <image> 支持加载失败回调；规则按 HTML 标签白名单误报
            onError={() => setFailedSource(sheet.src)} // rslint-disable-line react/no-unknown-property
          />
        </svg>
      ) : hasImage ? (
        <img
          src={src}
          alt=""
          draggable={false}
          loading={isPortrait ? 'eager' : 'lazy'}
          onError={() => setFailedSource(src)}
          className={cn(
            'h-full w-full',
            (fit ?? (isPortrait ? 'contain' : 'cover')) === 'contain'
              ? 'object-contain'
              : 'object-cover',
            isPortrait
              ? 'object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.2)]'
              : 'object-top',
          )}
        />
      ) : (
        initial
      )}
    </div>
  );
}
