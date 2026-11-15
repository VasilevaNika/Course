// Модель прогресса и чистые функции над ней (без React и localStorage — их удобно тестировать).
import { migrateV1toV2, type ProgressV1 } from '../logic/migrate';

export type TopicProgress = { doneAt: number; best: number; lastReviewAt?: number };

export type ExamProgress = {
  attempts: number;
  best: number;
  passedAt?: number;
  bestTimeSec?: number;
};

/** Статистика одного дня (локальная дата 'YYYY-MM-DD'). */
export type DayStats = {
  topics: number; // новые темы
  reviews: number; // повторения тем
  materials: number; // открыто материалов
  perfectQuizzes: number; // мини-тестов 3/3
  notes: number; // тем, где заметка впервые стала ≥50 символов
  /** Ежедневный тест: лучший результат дня и закреплённые за днём вопросы. */
  quest?: { best: number; total: number; questionIds: string[] };
  /** Побочные задания, закреплённые за днём (выбираются один раз, чтобы квест не менялся в течение дня). */
  tasks?: string[];
  tasksDone?: string[]; // id выполненных побочных заданий
  chest?: true; // все три задания выполнены
  frozen?: true; // день закрыт заморозкой или реваншем
  revenge?: true; // день восстановлен реваншем
};

export type StreakState = {
  freezes: number; // 0..2
  freezeAwards: Record<string, true>; // `${начало серии}:${отметка}` — за эту отметку заморозка уже выдана
  revengeUsed: Record<string, true>; // дата пропущенного дня, по которому реванш уже использован
};

export type Progress = {
  version: 2;
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
  /** Темы, заметка к которым уже доходила до 50 символов (days[d].notes считает только «впервые»). */
  longNotes: Record<string, true>;
  exams: Record<string, ExamProgress>;
  days: Record<string, DayStats>; // 'YYYY-MM-DD' (локальная дата)
  streak: StreakState;
  bestStreak: number;
  flags: { night?: true; early?: true; speedrun?: true; oldGuard?: true };
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
/** Заметка от стольких символов засчитывается в побочное задание «note». */
export const NOTE_MIN_CHARS = 50;

export function emptyProgress(now = Date.now()): Progress {
  return {
    version: 2,
    updatedAt: now,
    topics: {},
    reviews: 0,
    perfectQuizzes: 0,
    materialsOpened: {},
    materialsV2: true,
    notes: {},
    longNotes: {},
    exams: {},
    days: {},
    streak: { freezes: 0, freezeAwards: {}, revengeUsed: {} },
    bestStreak: 0,
    flags: {},
    openGood: 0,
    achievements: {},
    rewards: {},
    dailyGoal: DEFAULT_DAILY_GOAL,
  };
}

export function emptyDay(): DayStats {
  return { topics: 0, reviews: 0, materials: 0, perfectQuizzes: 0, notes: 0 };
}

type DayCounter = 'topics' | 'reviews' | 'materials' | 'perfectQuizzes' | 'notes';

/** +1 к счётчику дня (создаёт день, если его ещё нет). */
export function bumpDay(days: Record<string, DayStats>, key: string, field: DayCounter): Record<string, DayStats> {
  const d = days[key] ?? emptyDay();
  return { ...days, [key]: { ...d, [field]: d[field] + 1 } };
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
const isTrue = (x: unknown): x is true => x === true;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';

function rec<T>(v: unknown, check: (x: unknown) => x is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (check(x)) out[k] = x;
  return out;
}

/**
 * Приводит произвольный JSON (из localStorage или импорта) к валидному Progress version 2.
 * version 1 сначала мигрирует (migrateV1toV2). Битые поля заменяются значениями по умолчанию.
 * Бросает ошибку, если это явно не прогресс.
 */
export function normalizeProgress(input: unknown): Progress {
  if (!isObj(input) || (input.version !== 1 && input.version !== 2)) {
    throw new Error('Это не файл прогресса (нет version: 1 или 2)');
  }
  const src: Record<string, unknown> =
    input.version === 1
      ? (migrateV1toV2({
          ...(input as unknown as ProgressV1),
          activeDays: rec(input.activeDays, isNum),
          notes: rec(input.notes, isStr),
        }) as unknown as Record<string, unknown>)
      : input;

  const base = emptyProgress(num(src.updatedAt, Date.now()));
  const notes = rec(src.notes, isStr);
  const streak = isObj(src.streak) ? src.streak : {};
  const flags = isObj(src.flags) ? src.flags : {};
  return {
    ...base,
    topics: rec(src.topics, (x): x is TopicProgress => isObj(x) && isNum(x.doneAt) && isNum(x.best)),
    reviews: num(src.reviews, 0),
    perfectQuizzes: num(src.perfectQuizzes, 0),
    // Старый прогресс (без materialsV2): индексы материалов указывают на старый список — сбрасываем.
    materialsOpened: src.materialsV2 === true ? rec(src.materialsOpened, isTrue) : {},
    materialsV2: true,
    notes,
    longNotes: isObj(src.longNotes) ? rec(src.longNotes, isTrue) : longNotesOf(notes),
    exams: rec(src.exams, (x): x is ExamProgress => isObj(x) && isNum(x.attempts) && isNum(x.best)),
    days: normalizeDays(src.days),
    streak: {
      freezes: Math.max(0, Math.min(2, Math.round(num(streak.freezes, 0)))),
      freezeAwards: rec(streak.freezeAwards, isTrue),
      revengeUsed: rec(streak.revengeUsed, isTrue),
    },
    bestStreak: num(src.bestStreak, 0),
    flags: {
      ...(flags.night === true ? { night: true as const } : {}),
      ...(flags.early === true ? { early: true as const } : {}),
      ...(flags.speedrun === true ? { speedrun: true as const } : {}),
      ...(flags.oldGuard === true ? { oldGuard: true as const } : {}),
    },
    openGood: num(src.openGood, 0),
    achievements: rec(src.achievements, isNum),
    rewards: rec(src.rewards, (x): x is { claimedAt: number; issuedAt?: number } => isObj(x) && isNum(x.claimedAt)),
    dailyGoal: Math.max(1, Math.round(num(src.dailyGoal, DEFAULT_DAILY_GOAL))),
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const strings = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : undefined);

function normalizeDays(v: unknown): Record<string, DayStats> {
  const out: Record<string, DayStats> = {};
  if (!isObj(v)) return out;
  for (const [key, d] of Object.entries(v)) {
    if (!DAY_RE.test(key) || !isObj(d)) continue;
    const day: DayStats = {
      topics: num(d.topics, 0),
      reviews: num(d.reviews, 0),
      materials: num(d.materials, 0),
      perfectQuizzes: num(d.perfectQuizzes, 0),
      notes: num(d.notes, 0),
    };
    const q = d.quest;
    if (isObj(q) && isNum(q.best) && isNum(q.total)) {
      day.quest = { best: q.best, total: q.total, questionIds: strings(q.questionIds) ?? [] };
    }
    const tasks = strings(d.tasks);
    if (tasks) day.tasks = tasks;
    const done = strings(d.tasksDone);
    if (done) day.tasksDone = done;
    if (d.chest === true) day.chest = true;
    if (d.frozen === true) day.frozen = true;
    if (d.revenge === true) day.revenge = true;
    out[key] = day;
  }
  return out;
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
 * - days[d].topics / reviews растут только за «настоящие» прохождения (первое или повторение),
 *   чтобы перепрохождение в тот же день не накручивало счётчик;
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

  const key = dayKey(now);
  const counted = outcome.firstPass || outcome.review;
  const reachedMax = score === total && (prev?.best ?? 0) < total;
  if (score === total && (counted || reachedMax)) {
    next.perfectQuizzes = p.perfectQuizzes + 1;
    next.days = bumpDay(next.days, key, 'perfectQuizzes');
  }

  if (counted) {
    next.days = bumpDay(next.days, key, outcome.firstPass ? 'topics' : 'reviews');
    const hour = new Date(now).getHours();
    if (hour >= 23 || hour < 5) next.flags = { ...next.flags, night: true };
    else if (hour < 9) next.flags = { ...next.flags, early: true };
  }

  return { progress: next, outcome };
}

export function markMaterialOpened(p: Progress, topicId: string, index: number, now = Date.now()): Progress {
  const key = `${topicId}:${index}`;
  if (p.materialsOpened[key]) return p;
  return {
    ...p,
    updatedAt: now,
    materialsOpened: { ...p.materialsOpened, [key]: true },
    days: bumpDay(p.days, dayKey(now), 'materials'),
  };
}

export function setNote(p: Progress, topicId: string, text: string, now = Date.now()): Progress {
  const notes = { ...p.notes };
  if (text.trim()) notes[topicId] = text;
  else delete notes[topicId];
  // Заметка впервые доросла до 50 символов — засчитываем в день (за ту же тему повторно не считаем).
  if (text.trim().length >= NOTE_MIN_CHARS && !p.longNotes[topicId]) {
    return {
      ...p,
      updatedAt: now,
      notes,
      longNotes: { ...p.longNotes, [topicId]: true },
      days: bumpDay(p.days, dayKey(now), 'notes'),
    };
  }
  return { ...p, updatedAt: now, notes };
}

/** Темы с заметкой от 50 символов — для старого прогресса, где longNotes ещё нет. */
export function longNotesOf(notes: Record<string, string>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const [id, text] of Object.entries(notes)) if (text.trim().length >= NOTE_MIN_CHARS) out[id] = true;
  return out;
}

export function setDailyGoal(p: Progress, goal: number, now = Date.now()): Progress {
  return { ...p, updatedAt: now, dailyGoal: Math.max(1, Math.min(20, Math.round(goal))) };
}

/** Сколько тем пройдено сегодня (новые + повторения) — для дневной цели. */
export function todayCount(p: Progress, now = Date.now()): number {
  const d = p.days[dayKey(now)];
  return d ? d.topics + d.reviews : 0;
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
