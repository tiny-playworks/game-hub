import {
  CHARACTER_LINE_TRIGGERS,
  getCharacterById,
  type LineTrigger,
} from '@/lib/playerCharacters';
import { mixSeed, mulberry32 } from '@/lib/seededRandom';
import type { RiichiEffect, RiichiMatchState } from './engine';

export const SPEECH_DURATION_MS = 2500;
export const CUT_IN_DURATION_MS = 900;

export interface CharacterMoment {
  id: string;
  seat: number;
  kind: LineTrigger;
  characterId: string;
  lineKey: string;
}

export function isCutInMoment(moment: CharacterMoment): boolean {
  return (
    moment.kind === 'riichi' || moment.kind === 'ron' || moment.kind === 'tsumo'
  );
}

/** 台词使用独立的随机流，不改变牌山或 AI 决策。 */
export function createCharacterMoments(
  match: RiichiMatchState,
  effects: RiichiEffect[],
  playerCharacterId: string,
): CharacterMoment[] {
  return effects.flatMap((effect) => {
    if (effect.type !== 'moment') return [];
    const character = getCharacterById(
      match.seatCharacters[effect.seat] ?? playerCharacterId,
    );
    const lines = character.lines[effect.kind];
    if (!lines.length) return [];
    const random = mulberry32(
      mixSeed(
        match.seed,
        match.turn,
        effect.seat,
        CHARACTER_LINE_TRIGGERS.indexOf(effect.kind),
      ),
    );
    return [
      {
        id: `${match.seed}:${match.turn}:${effect.seat}:${effect.kind}`,
        seat: effect.seat,
        kind: effect.kind,
        characterId: character.id,
        lineKey: lines[Math.floor(random() * lines.length)],
      },
    ];
  });
}
