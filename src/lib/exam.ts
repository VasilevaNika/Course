// Симулятор собеседования («боссы»). Только чистые функции.
import type { Content, Exam, OpenQuestion } from './content';
import { shuffle, type Progress } from './progress';

/** Спидран: пройти весь бой (тест + открытые вопросы) быстрее, чем за 8 минут. */
export const SPEEDRUN_SEC = 8 * 60;

export type ExamOption = { text: string; correct: boolean };
export type ExamQuestion = { topicId: string; topicTitle: string; q: string; options: ExamOption[]; explain: string };
export type ExamSet = { mcq: ExamQuestion[]; open: OpenQuestion[] };

/**
 * Собирает попытку: N случайных вопросов из пула без повторов (варианты перемешаны,
 * правильный в JSON — options[0]) и открытые вопросы из open_blocks.
 */
export function buildExam(content: Content, exam: Exam, rnd: () => number = Math.random): ExamSet {
  const pool = content.blocks
    .filter((b) => exam.blocks.includes(b.id))
    .flatMap((b) => b.topics.flatMap((t) => t.quiz.map((q) => ({ t, q }))));
  const mcq = shuffle(pool, rnd)
    .slice(0, exam.mcq)
    .map(({ t, q }) => ({
      topicId: t.id,
      topicTitle: t.title,
      q: q.q,
      explain: q.explain,
      options: shuffle(q.options.map((text, i) => ({ text, correct: i === 0 })), rnd),
    }));
  const open = shuffle(
    content.open_questions.filter((q) => exam.open_blocks.includes(q.block)),
    rnd,
  ).slice(0, exam.open);
  return { mcq, open };
}

export function isExamPassed(p: Progress, examId: string): boolean {
  return Boolean(p.exams[examId]?.passedAt);
}

/** Экзамены из requires, которые ещё не сданы. Пустой массив = доступен. */
export function missingRequirements(p: Progress, exam: Exam): string[] {
  return (exam.requires ?? []).filter((id) => !isExamPassed(p, id));
}

export type ExamOutcome = {
  correct: number;
  total: number;
  ratio: number;
  passed: boolean;
  /** Сдан впервые (даёт XP за босса). */
  firstPass: boolean;
};

/**
 * Записывает результат тестовой части (сразу после неё, чтобы попытка не терялась,
 * если открытые вопросы бросить). Сдано, если доля правильных ≥ exam.pass.
 */
export function recordExam(
  p: Progress,
  exam: Exam,
  correct: number,
  now = Date.now(),
): { progress: Progress; outcome: ExamOutcome } {
  const total = exam.mcq;
  const ratio = total > 0 ? correct / total : 0;
  const passed = ratio >= exam.pass - 1e-9;
  const prev = p.exams[exam.id];
  const firstPass = passed && !prev?.passedAt;

  const entry = {
    ...prev,
    attempts: (prev?.attempts ?? 0) + 1,
    best: Math.max(prev?.best ?? 0, ratio),
    ...(prev?.passedAt ? { passedAt: prev.passedAt } : passed ? { passedAt: now } : {}),
  };

  const next: Progress = { ...p, updatedAt: now, exams: { ...p.exams, [exam.id]: entry } };
  return { progress: next, outcome: { correct, total, ratio, passed, firstPass } };
}

/**
 * Конец всего боя (тест + открытые вопросы). Время считается целиком.
 * Для сданной попытки обновляет лучшее время и при < 8 минут ставит флаг спидрана.
 */
export function recordExamFinish(
  p: Progress,
  exam: Exam,
  passed: boolean,
  totalSec: number,
  now = Date.now(),
): { progress: Progress; speedrun: boolean } {
  const prev = p.exams[exam.id];
  if (!passed || !prev) return { progress: p, speedrun: false };
  const speedrun = totalSec < SPEEDRUN_SEC;
  const next: Progress = {
    ...p,
    updatedAt: now,
    exams: { ...p.exams, [exam.id]: { ...prev, bestTimeSec: Math.min(prev.bestTimeSec ?? Infinity, totalSec) } },
  };
  if (speedrun) next.flags = { ...p.flags, speedrun: true };
  return { progress: next, speedrun };
}

export type SelfRating = 'good' | 'partial' | 'bad';

/** Самооценка по открытым вопросам: каждый «знала» увеличивает openGood. */
export function recordOpenAnswers(p: Progress, ratings: SelfRating[], now = Date.now()): Progress {
  const good = ratings.filter((r) => r === 'good').length;
  if (!good) return p;
  return { ...p, updatedAt: now, openGood: p.openGood + good };
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
