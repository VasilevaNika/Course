import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  dayKey,
  emptyProgress,
  markMaterialOpened,
  nextTopicId,
  normalizeProgress,
  recordQuiz,
  setNote,
  shuffle,
  topicsForReview,
} from './progress';
import { allTopics, content } from './content';

const T0 = new Date(2026, 10, 10, 14, 0).getTime(); // 10 ноября, 14:00 локального времени

describe('recordQuiz', () => {
  it('не засчитывает тему при 1/3', () => {
    const p = emptyProgress(T0);
    const { progress, outcome } = recordQuiz(p, 'py-oop', 1, 3, T0);
    expect(outcome.passed).toBe(false);
    expect(progress).toBe(p);
  });

  it('засчитывает тему при 2/3 и считает день', () => {
    const { progress, outcome } = recordQuiz(emptyProgress(T0), 'py-oop', 2, 3, T0);
    expect(outcome).toMatchObject({ passed: true, firstPass: true, review: false });
    expect(progress.topics['py-oop']).toEqual({ doneAt: T0, best: 2 });
    expect(progress.activeDays[dayKey(T0)]).toBe(1);
    expect(progress.perfectQuizzes).toBe(0);
  });

  it('3/3 с первого раза = идеальный тест', () => {
    const { progress } = recordQuiz(emptyProgress(T0), 'py-oop', 3, 3, T0);
    expect(progress.perfectQuizzes).toBe(1);
  });

  it('пересдача в тот же день не накручивает счётчики, но улучшает best', () => {
    let p = recordQuiz(emptyProgress(T0), 'py-oop', 2, 3, T0).progress;
    p = recordQuiz(p, 'py-oop', 3, 3, T0 + 1000).progress;
    expect(p.topics['py-oop'].best).toBe(3);
    expect(p.perfectQuizzes).toBe(1); // впервые довела до 3/3
    expect(p.activeDays[dayKey(T0)]).toBe(1);
    p = recordQuiz(p, 'py-oop', 3, 3, T0 + 2000).progress;
    expect(p.perfectQuizzes).toBe(1);
    expect(p.reviews).toBe(0);
  });

  it('пересдача через 3+ дня = повторение, следующее — через 3 дня от повторения', () => {
    let p = recordQuiz(emptyProgress(T0), 'py-oop', 2, 3, T0).progress;
    const r1 = recordQuiz(p, 'py-oop', 2, 3, T0 + 2 * DAY_MS);
    expect(r1.outcome.review).toBe(false);
    const t3 = T0 + 3 * DAY_MS;
    const r2 = recordQuiz(r1.progress, 'py-oop', 2, 3, t3);
    expect(r2.outcome.review).toBe(true);
    p = r2.progress;
    expect(p.reviews).toBe(1);
    expect(p.topics['py-oop'].lastReviewAt).toBe(t3);
    expect(p.activeDays[dayKey(t3)]).toBe(1);
    expect(recordQuiz(p, 'py-oop', 3, 3, t3 + DAY_MS).outcome.review).toBe(false);
  });

  it('ставит флаги ночи и утра', () => {
    const night = new Date(2026, 10, 10, 23, 30).getTime();
    const early = new Date(2026, 10, 10, 7, 0).getTime();
    expect(recordQuiz(emptyProgress(), 'a', 2, 3, night).progress.flags).toEqual({ night: true });
    expect(recordQuiz(emptyProgress(), 'a', 2, 3, early).progress.flags).toEqual({ early: true });
    expect(recordQuiz(emptyProgress(), 'a', 2, 3, T0).progress.flags).toEqual({});
  });
});

describe('карта', () => {
  const ids = allTopics.map((t) => t.id);

  it('следующая тема — первая непройденная по порядку', () => {
    let p = emptyProgress(T0);
    expect(nextTopicId(p, ids)).toBe(ids[0]);
    p = recordQuiz(p, ids[0], 2, 3, T0).progress;
    expect(nextTopicId(p, ids)).toBe(ids[1]);
  });

  it('на повторение — темы старше 5 дней, самые давние первыми', () => {
    let p = recordQuiz(emptyProgress(), ids[1], 2, 3, T0).progress;
    p = recordQuiz(p, ids[0], 2, 3, T0 + DAY_MS).progress;
    expect(topicsForReview(p, ids, T0 + 5 * DAY_MS)).toEqual([ids[1]]);
    expect(topicsForReview(p, ids, T0 + 7 * DAY_MS)).toEqual([ids[1], ids[0]]);
  });
});

describe('материалы и заметки', () => {
  it('отметка материала идемпотентна', () => {
    const p1 = markMaterialOpened(emptyProgress(), 'py-oop', 0);
    expect(p1.materialsOpened).toEqual({ 'py-oop:0': true });
    expect(markMaterialOpened(p1, 'py-oop', 0)).toBe(p1);
  });

  it('пустая заметка удаляется', () => {
    const p1 = setNote(emptyProgress(), 'x', 'текст');
    expect(p1.notes).toEqual({ x: 'текст' });
    expect(setNote(p1, 'x', '   ').notes).toEqual({});
  });
});

describe('normalizeProgress', () => {
  it('отклоняет не-прогресс', () => {
    expect(() => normalizeProgress({ foo: 1 })).toThrow();
    expect(() => normalizeProgress(null)).toThrow();
  });

  it('чинит битые поля и сохраняет валидные', () => {
    const p = normalizeProgress({
      version: 1,
      topics: { a: { doneAt: 1, best: 2 }, b: 'мусор' },
      dailyGoal: 'x',
      flags: { night: true, early: 'yes' },
    });
    expect(p.topics).toEqual({ a: { doneAt: 1, best: 2 } });
    expect(p.dailyGoal).toBe(3);
    expect(p.flags).toEqual({ night: true });
    expect(p.notes).toEqual({});
  });

  it('экспорт → импорт без потерь', () => {
    let p = recordQuiz(emptyProgress(T0), 'py-oop', 3, 3, T0).progress;
    p = setNote(markMaterialOpened(p, 'py-oop', 1, T0), 'py-oop', 'заметка', T0);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('старый прогресс без materialsV2: отметки материалов сбрасываются, остальное цело', () => {
    const old = {
      version: 1,
      topics: { 'py-oop': { doneAt: T0, best: 3 } },
      materialsOpened: { 'py-oop:0': true, 'py-oop:3': true },
      notes: { 'py-oop': 'заметка' },
      achievements: { explorer: T0 },
    };
    const p = normalizeProgress(old);
    expect(p.materialsOpened).toEqual({});
    expect(p.materialsV2).toBe(true);
    expect(p.topics).toEqual(old.topics);
    expect(p.notes).toEqual(old.notes);
    expect(p.achievements).toEqual({ explorer: T0 }); // открытые ачивки не отбираются
  });

  it('прогресс с materialsV2 сохраняет отметки', () => {
    const p = normalizeProgress({ version: 1, materialsV2: true, materialsOpened: { 'py-oop:2': true } });
    expect(p.materialsOpened).toEqual({ 'py-oop:2': true });
  });

  it('новый прогресс сразу с флагом', () => {
    expect(emptyProgress().materialsV2).toBe(true);
  });
});

describe('shuffle', () => {
  it('сохраняет элементы и не мутирует исходный массив', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('контент', () => {
  it('у каждого вопроса ≥2 вариантов и пояснение, id тем уникальны', () => {
    const ids = allTopics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of content.blocks)
      for (const t of b.topics) {
        expect(t.quiz.length).toBeGreaterThan(0);
        for (const q of t.quiz) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.explain).toBeTruthy();
        }
      }
  });
});
