// Ежедневный квест: тест из 5 вопросов по пройденным темам + 2 побочных задания, сундук за все три.
import type { Content, QuizQuestion, Topic } from '../lib/content';
import { DAY_MS, dayKey, emptyDay, lastTouch, shuffle, type DayStats, type Progress } from '../lib/progress';
import { daysBetween, shiftDay } from './dates';
import { seededRandom } from './random';
import { applyFreezes, awardFreezes, DAILY_SIZE, longestStreak, questPassed } from './streak';

export const MAX_PER_TOPIC = 2;
/** Тема «давно пройдена» для ачивки «Старая гвардия». */
export const OLD_TOPIC_DAYS = 30;

export type TaskId = 'new-topic' | 'materials-2' | 'perfect' | 'note' | 'review';

export const TASKS: Record<TaskId, { title: string; done: (d: DayStats) => boolean }> = {
  'new-topic': { title: 'Пройди новую тему', done: (d) => d.topics >= 1 },
  'materials-2': { title: 'Открой 2 материала', done: (d) => d.materials >= 2 },
  perfect: { title: 'Сдай мини-тест на 3/3', done: (d) => d.perfectQuizzes >= 1 },
  note: { title: 'Напиши заметку к теме (от 50 символов)', done: (d) => d.notes >= 1 },
  review: { title: 'Повтори тему, пройденную 3+ дня назад', done: (d) => d.reviews >= 1 },
};
const TASK_ORDER: TaskId[] = ['new-topic', 'materials-2', 'perfect', 'note', 'review'];

export const questionId = (topicId: string, index: number) => `${topicId}:${index}`;

/** Вопрос по id `${topicId}:${index}` (или undefined, если контент поменялся). */
export function findQuestion(content: Content, id: string): { topic: Topic; question: QuizQuestion } | undefined {
  const cut = id.lastIndexOf(':');
  const topicId = id.slice(0, cut);
  const index = Number(id.slice(cut + 1));
  for (const b of content.blocks)
    for (const t of b.topics) if (t.id === topicId && t.quiz[index]) return { topic: t, question: t.quiz[index] };
  return undefined;
}

const topicOf = (id: string) => id.slice(0, id.lastIndexOf(':'));

/** Квест закрыт, пока не пройдена ни одна тема. */
export function questLocked(p: Progress): boolean {
  return Object.keys(p.topics).length === 0;
}

/** Вес темы: 1 + дней с последнего касания, ×2 если best < 3. Давнее и слабое выпадает чаще. */
export function topicWeight(p: Progress, topicId: string, date: string): number {
  const t = p.topics[topicId];
  if (!t) return 0;
  const age = Math.max(0, daysBetween(dayKey(lastTouch(t)), date));
  return (1 + age) * (t.best < 3 ? 2 : 1);
}

function availableTasks(p: Progress, content: Content, date: string): TaskId[] {
  const topics = content.blocks.flatMap((b) => b.topics);
  return TASK_ORDER.filter((id) => {
    if (id === 'new-topic') return topics.some((t) => !p.topics[t.id]);
    if (id === 'review') return Object.values(p.topics).some((t) => daysBetween(dayKey(lastTouch(t)), date) >= 3);
    return true;
  });
}

/**
 * Квест дня — детерминирован по дате (seed = хеш 'YYYY-MM-DD', ГПСЧ mulberry32).
 * size/salt — для реванша (10 вопросов, своя последовательность).
 */
export function dailyQuest(
  date: string,
  p: Progress,
  content: Content,
  opts: { size?: number; salt?: string } = {},
): { questionIds: string[]; tasks: TaskId[] } {
  const size = opts.size ?? DAILY_SIZE;
  const rnd = seededRandom(opts.salt ? `${date}:${opts.salt}` : date);
  if (questLocked(p)) return { questionIds: [], tasks: [] };

  const tasks = shuffle(availableTasks(p, content, date), rnd).slice(0, 2);

  let pool: string[] = [];
  for (const b of content.blocks)
    for (const t of b.topics) if (p.topics[t.id]) t.quiz.forEach((_, i) => pool.push(questionId(t.id, i)));

  // Не повторять вчерашний тест, если без него вопросов всё ещё хватает.
  const yesterday = new Set(p.days[shiftDay(date, -1)]?.quest?.questionIds ?? []);
  const fresh = pool.filter((id) => !yesterday.has(id));
  if (fresh.length >= size) pool = fresh;

  if (pool.length <= size) return { questionIds: shuffle(pool, rnd), tasks };

  const remaining = new Map<string, string[]>();
  for (const id of pool) {
    const t = topicOf(id);
    remaining.set(t, [...(remaining.get(t) ?? []), id]);
  }
  const taken = new Map<string, number>();
  const out: string[] = [];
  while (out.length < size) {
    let candidates = [...remaining.keys()].filter((t) => remaining.get(t)!.length && (taken.get(t) ?? 0) < MAX_PER_TOPIC);
    // Лимит 2 на тему — только «если пул позволяет».
    if (!candidates.length) candidates = [...remaining.keys()].filter((t) => remaining.get(t)!.length);
    const weights = candidates.map((t) => topicWeight(p, t, date));
    let r = rnd() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < candidates.length - 1 && r >= weights[i]) r -= weights[i++];
    const topic = candidates[i];
    const qs = remaining.get(topic)!;
    out.push(qs.splice(Math.floor(rnd() * qs.length), 1)[0]);
    taken.set(topic, (taken.get(topic) ?? 0) + 1);
  }
  return { questionIds: out, tasks };
}

/**
 * Закрепляет квест за сегодняшним днём (вопросы и задания), чтобы прогресс в течение дня его не менял.
 * Ничего не делает, пока квест закрыт или уже закреплён.
 */
export function ensureDailyPlan(p: Progress, content: Content, today: string): Progress {
  const d = p.days[today];
  if (questLocked(p) || (d?.quest && d.tasks)) return p;
  const plan = dailyQuest(today, p, content);
  const day: DayStats = {
    ...(d ?? emptyDay()),
    quest: d?.quest ?? { best: 0, total: plan.questionIds.length, questionIds: plan.questionIds },
    tasks: d?.tasks ?? plan.tasks,
  };
  return { ...p, days: { ...p.days, [today]: day } };
}

export type AnswerResult = { id: string; correct: boolean };

/**
 * Записывает попытку ежедневного теста: засчитывается лучший результат дня.
 * Тема, по которой все вопросы теста отвечены верно, получает lastReviewAt = сейчас.
 */
export function recordDailyQuiz(p: Progress, today: string, results: AnswerResult[], now = Date.now()): Progress {
  const day = p.days[today];
  if (!day?.quest) return p;
  const score = results.filter((r) => r.correct).length;

  const allRight = new Map<string, boolean>();
  for (const r of results) allRight.set(topicOf(r.id), (allRight.get(topicOf(r.id)) ?? true) && r.correct);
  const topics = { ...p.topics };
  for (const [t, ok] of allRight) if (ok && topics[t]) topics[t] = { ...topics[t], lastReviewAt: now };

  const oldGuard = results.some((r) => {
    const t = p.topics[topicOf(r.id)];
    return r.correct && t && now - t.doneAt >= OLD_TOPIC_DAYS * DAY_MS;
  });

  return {
    ...p,
    updatedAt: now,
    topics,
    flags: oldGuard ? { ...p.flags, oldGuard: true } : p.flags,
    days: { ...p.days, [today]: { ...day, quest: { ...day.quest, best: Math.max(day.quest.best, score) } } },
  };
}

/** Отмечает выполненные побочные задания и сундук дня (только растёт, ничего не снимает). */
export function syncDay(p: Progress, today: string): Progress {
  const day = p.days[today];
  if (!day?.tasks) return p;
  const done = new Set(day.tasksDone ?? []);
  for (const id of day.tasks) if (TASKS[id as TaskId]?.done(day)) done.add(id);
  const tasksDone = day.tasks.filter((id) => done.has(id));
  const chest = day.chest || (questPassed(day) && tasksDone.length === day.tasks.length);
  if (tasksDone.length === (day.tasksDone?.length ?? 0) && chest === Boolean(day.chest)) return p;
  return { ...p, days: { ...p.days, [today]: { ...day, tasksDone, ...(chest ? { chest: true as const } : {}) } } };
}

/**
 * Всё ежедневное обслуживание за один вызов (на загрузке и после каждого действия):
 * заморозки за пропуски → квест дня → задания и сундук → новые заморозки → лучшая серия.
 * Возвращает тот же объект, если ничего не изменилось.
 */
export function applyDaily(p: Progress, content: Content, now = Date.now()): Progress {
  const today = dayKey(now);
  let next = applyFreezes(p, today);
  next = ensureDailyPlan(next, content, today);
  next = syncDay(next, today);
  next = awardFreezes(next, today);
  const best = Math.max(next.bestStreak, longestStreak(next.days));
  if (best !== next.bestStreak) next = { ...next, bestStreak: best };
  return next;
}
