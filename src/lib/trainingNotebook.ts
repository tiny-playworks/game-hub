import type { TrainingCategory } from '../../shared/contracts/replay';
import { isTrainingCategory } from './riichiTraining';
import { readLocalResume, writeLocalResume } from './localResume';

export interface PracticeQuestion {
  id: string;
  source: 'starter' | 'replay';
  sourceId: string;
  problemId: string;
  category: TrainingCategory;
}
export interface PracticeNote extends PracticeQuestion {
  favorite: boolean;
  attempts: { id: string; at: number; matched: boolean }[];
  dueAt: number;
  streak: number;
}
export interface TrainingNotebook {
  schema: 1;
  notes: PracticeNote[];
}
const SLOT = 'training-notebook';
const DAY = 86400000;
const isTime = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isSafeInteger(v) &&
  v >= 0 &&
  v <= 8640000000000000;

export function readTrainingNotebook(owner: string): TrainingNotebook {
  const raw = readLocalResume<TrainingNotebook>(owner, SLOT)?.data;
  const notes = raw?.schema === 1 && Array.isArray(raw.notes) ? raw.notes : [];
  const valid = notes.filter(
    (n) =>
      n &&
      typeof n.id === 'string' &&
      n.id.length < 500 &&
      ['starter', 'replay'].includes(n.source) &&
      typeof n.sourceId === 'string' &&
      typeof n.problemId === 'string' &&
      isTrainingCategory(n.category) &&
      typeof n.favorite === 'boolean' &&
      isTime(n.dueAt) &&
      Number.isInteger(n.streak) &&
      n.streak >= 0 &&
      Array.isArray(n.attempts) &&
      n.attempts.length <= 20 &&
      n.attempts.every(
        (a) =>
          a &&
          typeof a.id === 'string' &&
          isTime(a.at) &&
          typeof a.matched === 'boolean',
      ),
  );
  return { schema: 1, notes: valid.slice(0, 200) };
}

export function updatePracticeNote(
  owner: string,
  question: PracticeQuestion,
  change: { favorite: boolean } | { attemptId: string; matched: boolean },
): boolean {
  const book = readTrainingNotebook(owner);
  const old = book.notes.find((n) => n.id === question.id);
  const note: PracticeNote = old ?? {
    ...question,
    favorite: false,
    attempts: [],
    dueAt: 0,
    streak: 0,
  };
  if ('favorite' in change) note.favorite = change.favorite;
  else if (!note.attempts.some((a) => a.id === change.attemptId)) {
    note.streak = change.matched ? note.streak + 1 : 0;
    note.dueAt =
      Date.now() +
      DAY *
        (change.matched ? [1, 3, 7, 14, 30][Math.min(4, note.streak - 1)] : 1);
    const attempts = [
      ...note.attempts,
      { id: change.attemptId, at: Date.now(), matched: change.matched },
    ];
    // Keep the first answer as a stable baseline, plus the latest nineteen.
    note.attempts =
      attempts.length > 20 ? [attempts[0], ...attempts.slice(-19)] : attempts;
  }
  const rest = book.notes.filter((n) => n.id !== note.id);
  if (!old && rest.length >= 200) {
    let removable = rest.length - 1;
    while (removable >= 0 && rest[removable].favorite) removable--;
    if (removable < 0) return false;
    rest.splice(removable, 1);
  }
  return writeLocalResume(owner, SLOT, { schema: 1, notes: [note, ...rest] });
}

export function practiceNotePath(note: PracticeQuestion): string {
  const params =
    note.source === 'starter'
      ? new URLSearchParams({ practice: 'starter', lesson: note.sourceId })
      : new URLSearchParams({
          matchId: note.sourceId,
          question: note.problemId,
        });
  return `/replays/training?${params}`;
}

export const STARTER_LESSONS: {
  id: string;
  category: TrainingCategory;
  correct: number;
}[] = [
  { id: 'shape', category: 'shanten', correct: 1 },
  { id: 'sequence', category: 'ukeire', correct: 0 },
  { id: 'visible', category: 'ukeire', correct: 2 },
  { id: 'safe', category: 'dealIn', correct: 1 },
  { id: 'riichi', category: 'riichi', correct: 0 },
  { id: 'dama', category: 'dama', correct: 2 },
];
export function starterQuestion(
  lesson: (typeof STARTER_LESSONS)[number],
): PracticeQuestion {
  return {
    id: `starter-v1:${lesson.id}`,
    source: 'starter',
    sourceId: lesson.id,
    problemId: lesson.id,
    category: lesson.category,
  };
}
