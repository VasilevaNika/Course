// Серия дней, заморозки и реванш. Только чистые функции; «сегодня» передаётся строкой 'YYYY-MM-DD'.
import { emptyDay, type DayStats, type Progress } from '../lib/progress';
import { daysBetween, shiftDay } from './dates';

export const DAILY_SIZE = 5;
export const REVENGE_SIZE = 10;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
export const REVENGE_MIN_STREAK = 3;
/** Отметки серии, на которых показывается экран празднования. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Сколько верных нужно из total: 80% (4/5, 8/10), с округлением вверх. */
export function passMark(total: number): number {
  return Math.ceil(total * 0.8 - 1e-9);
}

/** Ежедневный тест дня сдан. */
export function questPassed(day: DayStats | undefined): boolean {
  const q = day?.quest;
  return Boolean(q && q.total > 0 && q.best >= passMark(q.total));
}

/** Ежедневный тест сдан без ошибок на полном наборе (5/5). */
export function questPerfect(day: DayStats | undefined): boolean {
  const q = day?.quest;
  return Boolean(q && q.total >= DAILY_SIZE && q.best >= q.total);
}

/** Активный день: пройдена хотя бы одна тема (новая или повторение) или сдан ежедневный тест. */
export function isActiveDay(day: DayStats | undefined): boolean {
  return Boolean(day && (day.topics + day.reviews > 0 || questPassed(day)));
}

/** День держит серию: активный или замороженный. */
export function keepsStreak(day: DayStats | undefined): boolean {
  return isActiveDay(day) || Boolean(day?.frozen);
}

/** Серия, которая заканчивается ровно в этот день: длина и дата начала. */
export function runEndingAt(days: Record<string, DayStats>, end: string): { length: number; start?: string } {
  let key = end;
  let length = 0;
  let start: string | undefined;
  while (keepsStreak(days[key])) {
    length++;
    start = key;
    key = shiftDay(key, -1);
  }
  return { length, start };
}

/** Текущая серия: до сегодня, а если сегодня ещё не активен — до вчера (до конца дня не обнуляется). */
export function streakRun(days: Record<string, DayStats>, today: string): { length: number; start?: string } {
  return runEndingAt(days, keepsStreak(days[today]) ? today : shiftDay(today, -1));
}

export function currentStreak(days: Record<string, DayStats>, today: string): number {
  return streakRun(days, today).length;
}

/** Все серии в истории по порядку. */
export function streakRuns(days: Record<string, DayStats>): { start: string; end: string; length: number }[] {
  const keys = Object.keys(days).filter((k) => keepsStreak(days[k])).sort();
  const runs: { start: string; end: string; length: number }[] = [];
  for (const k of keys) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(last.end, k) === 1) {
      last.end = k;
      last.length++;
    } else runs.push({ start: k, end: k, length: 1 });
  }
  return runs;
}

export function longestStreak(days: Record<string, DayStats>): number {
  return Math.max(0, ...streakRuns(days).map((r) => r.length));
}

/**
 * Закрывает заморозками пропущенные дни между последним днём серии и вчера.
 * Заморозок меньше, чем пропусков — ничего не тратим: серия сгорает, заморозки остаются на будущее.
 * Повторный вызов ничего не меняет (пропусков уже нет).
 */
export function applyFreezes(p: Progress, today: string): Progress {
  const last = Object.keys(p.days)
    .filter((k) => k < today && keepsStreak(p.days[k]))
    .sort()
    .pop();
  if (!last) return p;
  const missed = daysBetween(last, today) - 1;
  if (missed <= 0 || missed > p.streak.freezes) return p;
  const days = { ...p.days };
  for (let i = 1; i <= missed; i++) {
    const k = shiftDay(last, i);
    days[k] = { ...(days[k] ?? emptyDay()), frozen: true };
  }
  return { ...p, days, streak: { ...p.streak, freezes: p.streak.freezes - missed } };
}

/** +1 заморозка за каждые 7 дней текущей серии, максимум 2 на руках. Каждая отметка — один раз. */
export function awardFreezes(p: Progress, today: string): Progress {
  const run = streakRun(p.days, today);
  if (!run.start) return p;
  let freezes = p.streak.freezes;
  let freezeAwards = p.streak.freezeAwards;
  for (let mark = FREEZE_EVERY; mark <= run.length; mark += FREEZE_EVERY) {
    const key = `${run.start}:${mark}`;
    if (freezeAwards[key]) continue;
    freezeAwards = { ...freezeAwards, [key]: true };
    freezes = Math.min(MAX_FREEZES, freezes + 1);
  }
  if (freezeAwards === p.streak.freezeAwards) return p;
  return { ...p, streak: { ...p.streak, freezes, freezeAwards } };
}

export type DayMark = 'active' | 'frozen' | 'missed' | 'today' | 'future' | 'none';

/**
 * Отметка дня для ленты недели и календаря.
 * «Пропущен» — только прошедшие дни после самого первого дня серии (до начала занятий — 'none').
 * Сегодня: 'active', если уже активен, иначе 'today'.
 */
export function dayMark(days: Record<string, DayStats>, key: string, today: string): DayMark {
  if (key > today) return 'future';
  if (isActiveDay(days[key])) return 'active';
  if (days[key]?.frozen) return 'frozen';
  if (key === today) return 'today';
  const first = Object.keys(days).filter((k) => keepsStreak(days[k])).sort()[0];
  return first && key > first ? 'missed' : 'none';
}

export type Revenge = { missed: string; lost: number };

/**
 * Реванш доступен сегодня, если вчера — единственный пропуск, который оборвал серию ≥3,
 * и по этой сгоревшей серии реванш ещё не использовали.
 */
export function revengeAvailable(p: Progress, today: string): Revenge | null {
  const missed = shiftDay(today, -1);
  if (keepsStreak(p.days[missed]) || p.streak.revengeUsed[missed]) return null;
  const lost = runEndingAt(p.days, shiftDay(today, -2)).length;
  return lost >= REVENGE_MIN_STREAK ? { missed, lost } : null;
}

/**
 * Записывает попытку реванша (одна попытка на сгоревшую серию).
 * Сдан (≥80%) — пропущенный день замораживается и серия восстанавливается.
 */
export function recordRevenge(
  p: Progress,
  today: string,
  correct: number,
  total: number,
  now = Date.now(),
): { progress: Progress; passed: boolean } {
  const r = revengeAvailable(p, today);
  if (!r) return { progress: p, passed: false };
  const passed = total > 0 && correct >= passMark(total);
  const streak = { ...p.streak, revengeUsed: { ...p.streak.revengeUsed, [r.missed]: true as const } };
  const days = passed
    ? { ...p.days, [r.missed]: { ...(p.days[r.missed] ?? emptyDay()), frozen: true as const, revenge: true as const } }
    : p.days;
  return { progress: { ...p, updatedAt: now, days, streak }, passed };
}
