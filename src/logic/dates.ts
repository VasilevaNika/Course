// Арифметика локальных дат в формате 'YYYY-MM-DD'.
import { dayKey } from '../lib/progress';

/** Полдень этой даты — переходы на летнее/зимнее время не сдвигают день. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function shiftDay(key: string, delta: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d.getTime());
}

/** Сколько дней от a до b (b позже → положительное). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** 0 = понедельник … 6 = воскресенье. */
export function weekdayMon(key: string): number {
  return (parseDay(key).getDay() + 6) % 7;
}
