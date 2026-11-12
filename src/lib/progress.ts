// Модель прогресса и чистые функции над ней (без React и localStorage — их удобно тестировать).

export type TopicProgress = { doneAt: number; best: number; lastReviewAt?: number };

export type ExamProgress = {
  attempts: number;
  best: number;
  passedAt?: number;
  bestTimeSec?: number;
};

export type Progress = {
  version: 1;
  updatedAt: number;
  topics: Record<string, TopicProgress>;
  reviews: number; // успешные повторения
  perfectQuizzes: number; // мини-тесты 3/3
  materialsOpened: Record<string, true>; // ключ `${topicId}:${index}`
  /**
   * Отметки materialsOpened уже по новому списку материалов (с полем lang).
   * Без флага прогресс старый: индексы материалов поменялись, отметки сбрасываются при загрузке.
   */
  materialsV2?: true;
  notes: Record<string, string>;
  exams: Record<string, ExamProgress>;
  activeDays: Record<string, number>; // 'YYYY-MM-DD' (локальная дата) -> тем пройдено за день
  bestStreak: number;
  flags: { night?: true; early?: true; speedrun?: true };
  openGood: number; // открытых вопросов с самооценкой «знала»
  achievements: Record<string, number>; // id -> когда открыта
  rewards: Record<string, { claimedAt: number; issuedAt?: number }>;
  dailyGoal: number;
};

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Минимум правильных ответов из 3, чтобы тема засчиталась. */
export const PASS_SCORE = 2;
/** Через сколько дней пересдача считается повторением. */
export const REVIEW_MIN_DAYS = 3;
/** Через сколько дней тема попадает в «На повторение». */
export const REVIEW_SUGGEST_DAYS = 5;
export const DEFAULT_DAILY_GOAL = 3;

export function emptyProgress(now = Date.now()): Progress {
  return {
    version: 1,
    updatedAt: now,
    topics: {},
    reviews: 0,
    perfectQuizzes: 0,
    materialsOpened: {},
    materialsV2: true,
    notes: {},
    exams: {},
    activeDays: {},
    bestStreak: 0,
    flags: {},
    openGood: 0,
    achievements: {},
    rewards: {},
    dailyGoal: DEFAULT_DAILY_GOAL,
  };
}

/** Локальная дата в формате YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Приводит произвольный JSON (из localStorage или импорта) к валидному Progress.
 * Неизвестные/битые поля заменяются значениями по умолчанию. Бросает ошибку, если это явно не прогресс.
 */
export function normalizeProgress(input: unknown): Progress {
  if (!isObj(input) || input.version !== 1) {
    throw new Error('Это не файл прогресса (нет version: 1)');
  }
  const base = emptyProgress(num(input.updatedAt, Date.now()));
  const rec = <T>(v: unknown, check: (x: unknown) => x is T): Record<string, T> => {
    const out: Record<string, T> = {};
    if (isObj(v)) for (const [k, x] of Object.entries(v)) if (check(x)) out[k] = x;
    return out;
  };
  return {
    ...base,
    topics: rec(input.topics, (x): x is TopicProgress => isObj(x) && typeof x.doneAt === 'number' && typeof x.best === 'number'),
    reviews: num(input.reviews, 0),
    perfectQuizzes: num(input.perfectQuizzes, 0),
    // Старый прогресс (без materialsV2): индексы материалов указывают на старый список — сбрасываем.
    materialsOpened: input.materialsV2 === true ? rec(input.materialsOpened, (x): x is true => x === true) : {},
    materialsV2: true,
    notes: rec(input.notes, (x): x is string => typeof x === 'string'),
    exams: rec(input.exams, (x): x is ExamProgress => isObj(x) && typeof x.attempts === 'number' && typeof x.best === 'number'),
    activeDays: rec(input.activeDays, (x): x is number => typeof x === 'number'),
    bestStreak: num(input.bestStreak, 0),
    flags: isObj(input.flags)
      ? {
          ...(input.flags.night === true ? { night: true as const } : {}),
          ...(input.flags.early === true ? { early: true as const } : {}),
          ...(input.flags.speedrun === true ? { speedrun: true as const } : {}),
        }
      : {},
    openGood: num(input.openGood, 0),
    achievements: rec(input.achievements, (x): x is number => typeof x === 'number'),
    rewards: rec(input.rewards, (x): x is { claimedAt: number; issuedAt?: number } => isObj(x) && typeof x.claimedAt === 'number'),
    dailyGoal: Math.max(1, Math.round(num(input.dailyGoal, DEFAULT_DAILY_GOAL))),
  };
}

export type QuizOutcome = {
  score: number;
  total: number;
  passed: boolean;
  /** Тема засчитана впервые. */
  firstPass: boolean;
  /** Засчитано повторение (пересдача через 3+ дня после последнего прохождения). */
  review: boolean;
};

/** Дата последнего прохождения/повторения темы. */
export function lastTouch(tp: TopicProgress): number {
  return tp.lastReviewAt ?? tp.doneAt;
}

/**
 * Записывает результат мини-теста. Возвращает новый прогресс и что произошло.
 * Правила:
 * - тема засчитывается при score ≥ 2;
 * - пересдача ≥2 через 3+ дня после последнего прохождения = повторение;
 * - activeDays растёт только за «настоящие» прохождения (первое или повторение), чтобы
 *   перепрохождение в тот же день не накручивало счётчик;
 * - perfectQuizzes растёт за 3/3, если попытка засчиталась или впервые довела best до максимума.
 */
export function recordQuiz(
  p: Progress,
  topicId: string,
  score: number,
  total: number,
  now = Date.now(),
): { progress: Progress; outcome: QuizOutcome } {
  const passed = score >= Math.min(PASS_SCORE, total);
  const prev = p.topics[topicId];
  const outcome: QuizOutcome = { score, total, passed, firstPass: false, review: false };
  if (!passed) return { progress: p, outcome };

  const next: Progress = { ...p, updatedAt: now, topics: { ...p.topics } };

  if (!prev) {
    outcome.firstPass = true;
    next.topics[topicId] = { doneAt: now, best: score };
  } else {
    const t: TopicProgress = { ...prev, best: Math.max(prev.best, score) };
    if (now - lastTouch(prev) >= REVIEW_MIN_DAYS * DAY_MS) {
      outcome.review = true;
      t.lastReviewAt = now;
      next.reviews = p.reviews + 1;
    }
    next.topics[topicId] = t;
  }

  const counted = outcome.firstPass || outcome.review;
  const reachedMax = score === total && (prev?.best ?? 0) < total;
  if (score === total && (counted || reachedMax)) next.perfectQuizzes = p.perfectQuizzes + 1;

  if (counted) {
    const key = dayKey(now);
    next.activeDays = { ...p.activeDays, [key]: (p.activeDays[key] ?? 0) + 1 };
    const hour = new Date(now).getHours();
    if (hour >= 23 || hour < 5) next.flags = { ...next.flags, night: true };
    else if (hour < 9) next.flags = { ...next.flags, early: true };
  }

  return { progress: next, outcome };
}

export function markMaterialOpened(p: Progress, topicId: string, index: number, now = Date.now()): Progress {
  const key = `${topicId}:${index}`;
  if (p.materialsOpened[key]) return p;
  return { ...p, updatedAt: now, materialsOpened: { ...p.materialsOpened, [key]: true } };
}

export function setNote(p: Progress, topicId: string, text: string, now = Date.now()): Progress {
  const notes = { ...p.notes };
  if (text.trim()) notes[topicId] = text;
  else delete notes[topicId];
  return { ...p, updatedAt: now, notes };
}

export function setDailyGoal(p: Progress, goal: number, now = Date.now()): Progress {
  return { ...p, updatedAt: now, dailyGoal: Math.max(1, Math.min(20, Math.round(goal))) };
}

export function todayCount(p: Progress, now = Date.now()): number {
  return p.activeDays[dayKey(now)] ?? 0;
}

/** Первая непройденная тема в порядке обучения. */
export function nextTopicId(p: Progress, orderedIds: string[]): string | undefined {
  return orderedIds.find((id) => !p.topics[id]);
}

/** Темы, пройденные (или повторённые) ≥5 дней назад — от самых давних. */
export function topicsForReview(p: Progress, orderedIds: string[], now = Date.now()): string[] {
  return orderedIds
    .filter((id) => {
      const t = p.topics[id];
      return t && now - lastTouch(t) >= REVIEW_SUGGEST_DAYS * DAY_MS;
    })
    .sort((a, b) => lastTouch(p.topics[a]) - lastTouch(p.topics[b]));
}

/** Тасование Фишера–Йейтса (возвращает новый массив). */
export function shuffle<T>(items: readonly T[], rnd: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
