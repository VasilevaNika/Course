// Сохранение незаконченного боя, чтобы он переживал уход со страницы и выгрузку вкладки.
import type { ExamOutcome, ExamSet, SelfRating } from './exam';

const KEY = 'nika-course:exam-run:v1';

export type RunPhase = 'mcq' | 'result' | 'open';

export type SavedRun = {
  v: 1;
  examId: string;
  set: ExamSet;
  phase: RunPhase;
  index: number;
  answers: (number | null)[];
  startedAt: number;
  outcome: ExamOutcome | null;
  ratings: SelfRating[];
  xpGain: number;
};

function isSavedRun(x: unknown): x is SavedRun {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Partial<SavedRun>;
  return (
    r.v === 1 &&
    typeof r.examId === 'string' &&
    (r.phase === 'mcq' || r.phase === 'result' || r.phase === 'open') &&
    typeof r.index === 'number' &&
    typeof r.startedAt === 'number' &&
    Array.isArray(r.answers) &&
    Array.isArray(r.ratings) &&
    !!r.set &&
    Array.isArray(r.set.mcq) &&
    Array.isArray(r.set.open) &&
    r.answers.length === r.set.mcq.length
  );
}

export function loadRun(examId?: string): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run: unknown = JSON.parse(raw);
    if (!isSavedRun(run)) return null;
    return examId && run.examId !== examId ? null : run;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    /* хранилище недоступно — бой просто не переживёт перезагрузку */
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
