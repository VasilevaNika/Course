import { describe, expect, it } from 'vitest';
import { content } from '../lib/content';
import { computeXp, evaluate } from '../lib/game';
import { emptyProgress, normalizeProgress } from '../lib/progress';
import { migrateV1toV2, type ProgressV1 } from './migrate';
import { currentStreak } from './streak';

const T0 = new Date(2026, 10, 10, 14, 0).getTime();

function v1(extra: Partial<ProgressV1> = {}): ProgressV1 {
  const { version: _v, days: _d, streak: _s, longNotes: _l, ...base } = emptyProgress(T0);
  return { ...base, version: 1, activeDays: {}, ...extra };
}

describe('migrateV1toV2', () => {
  it('activeDays → days с topics, остальные счётчики нулевые; серия без заморозок', () => {
    const p = migrateV1toV2(v1({ activeDays: { '2026-11-08': 2, '2026-11-09': 1 } }));
    expect(p.version).toBe(2);
    expect(p.days).toEqual({
      '2026-11-08': { topics: 2, reviews: 0, materials: 0, perfectQuizzes: 0, notes: 0 },
      '2026-11-09': { topics: 1, reviews: 0, materials: 0, perfectQuizzes: 0, notes: 0 },
    });
    expect(p.streak).toEqual({ freezes: 0, freezeAwards: {}, revengeUsed: {} });
    expect('activeDays' in p).toBe(false);
  });

  it('все остальные поля переносятся как есть', () => {
    const old = v1({
      topics: { 'py-oop': { doneAt: T0, best: 3, lastReviewAt: T0 + 1 } },
      reviews: 4,
      perfectQuizzes: 2,
      materialsOpened: { 'py-oop:1': true },
      notes: { 'py-oop': 'коротко' },
      exams: { 'boss-python-sql': { attempts: 2, best: 0.85, passedAt: T0, bestTimeSec: 400 } },
      bestStreak: 6,
      flags: { night: true },
      openGood: 3,
      achievements: { 'first-topic': T0 },
      rewards: { 'first-topic': { claimedAt: T0, issuedAt: T0 + 5 } },
      dailyGoal: 4,
    });
    const { activeDays: _a, version: _v, ...same } = old;
    expect(migrateV1toV2(old)).toMatchObject(same);
  });

  it('уже написанные заметки от 50 символов попадают в longNotes (их правка не засчитается как новая)', () => {
    const p = migrateV1toV2(v1({ notes: { a: 'д'.repeat(50), b: 'коротко' } }));
    expect(p.longNotes).toEqual({ a: true });
  });

  it('серия, ачивки за день и XP после миграции те же', () => {
    const old = v1({
      topics: { 'py-oop': { doneAt: T0, best: 3 } },
      perfectQuizzes: 1,
      activeDays: { '2026-11-08': 5, '2026-11-09': 1, '2026-11-10': 1 },
    });
    const p = migrateV1toV2(old);
    expect(currentStreak(p.days, '2026-11-10')).toBe(3);
    expect(evaluate(p, content)).toEqual(expect.arrayContaining(['first-topic', 'combo-5', 'streak-3', 'flawless']));
    // Перенесённые дни не дают новых XP: в v1 за дни ничего не начислялось.
    expect(computeXp(p, content)).toBe(computeXp({ ...p, days: {} }, content));
  });
});

describe('normalizeProgress + миграция', () => {
  it('version 1 из localStorage/импорта мигрирует автоматически', () => {
    const p = normalizeProgress({ version: 1, materialsV2: true, activeDays: { '2026-11-10': 1 }, topics: { a: { doneAt: T0, best: 2 } } });
    expect(p.version).toBe(2);
    expect(p.days['2026-11-10'].topics).toBe(1);
    expect(p.topics).toEqual({ a: { doneAt: T0, best: 2 } });
  });

  it('битые activeDays отбрасываются при миграции', () => {
    const p = normalizeProgress({ version: 1, activeDays: { '2026-11-10': 'много', 'не-дата': 2, '2026-11-09': 1 } });
    expect(Object.keys(p.days)).toEqual(['2026-11-09']);
  });

  it('повторная нормализация мигрированного прогресса ничего не меняет', () => {
    const once = normalizeProgress({ version: 1, materialsV2: true, activeDays: { '2026-11-10': 2 }, notes: { a: 'д'.repeat(60) } });
    expect(normalizeProgress(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
