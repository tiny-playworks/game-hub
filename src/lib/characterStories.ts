import { CHARACTER_DEFS, type CharacterExpression } from './playerCharacters';

export interface StoryLine {
  speaker: 'character' | 'player';
  textKey: string;
  expression?: CharacterExpression;
}
export interface CharacterStory {
  id: string;
  characterId: string;
  stage: 1 | 2 | 3;
  titleKey: string;
  lines: StoryLine[];
}
export const CHARACTER_STORIES: CharacterStory[] = CHARACTER_DEFS.flatMap(
  (character) =>
    ([1, 2, 3] as const).map((stage) => ({
      id: `${character.id}-${stage}`,
      characterId: character.id,
      stage,
      titleKey: `story.${character.id}.${stage}.title`,
      lines: [
        {
          speaker: 'character',
          textKey: `story.${character.id}.${stage}.0`,
          expression: 'normal',
        },
        { speaker: 'player', textKey: `story.${character.id}.${stage}.1` },
        {
          speaker: 'character',
          textKey: `story.${character.id}.${stage}.2`,
          expression: stage === 3 ? 'frustrated' : 'normal',
        },
        {
          speaker: 'character',
          textKey: `story.${character.id}.${stage}.3`,
          expression: 'happy',
        },
      ],
    })),
);
export function getCharacterStory(
  characterId: string,
  stage: number,
): CharacterStory | undefined {
  return CHARACTER_STORIES.find(
    (story) => story.characterId === characterId && story.stage === stage,
  );
}
