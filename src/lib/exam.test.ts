import { describe, expect, it } from 'vitest';
import { content } from './content';
import { buildExam, formatTime, missingRequirements, recordExam, recordOpenAnswers, SPEEDRUN_SEC } from './exam';
import { computeXp, evaluate } from './game';
import { emptyProgress } from './progress';

const T0 = new Date(2026, 10, 10, 14, 0).getTime();
const exam = (id: string) => content.exams.find((e) => e.id === id)!;

/** Детерминированный генератор для воспроизводимых тестов. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

describe('buildExam', () => {
  for (const e of content.exams) {
    it(`${e.id}: ${e.mcq} вопросов без повторов только из своих блоков, ${e.open} открытых`, () => {
      const set = buildExam(content, e, seeded(7));
      expect(set.mcq).toHaveLength(e.mcq);
      expect(new Set(set.mcq.map((q) => q.q)).size).toBe(e.mcq);
      const allowed = new Set(content.blocks.filter((b) => e.blocks.includes(b.id)).flatMap((b) => b.topics.map((t) => t.id)));
      for (const q of set.mcq) {
        expect(allowed.has(q.topicId)).toBe(true);
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      }
      expect(set.open).toHaveLength(e.open);
      expect(new Set(set.open.map((q) => q.q)).size).toBe(e.open);
      for (const q of set.open) expect(e.open_blocks).toContain(q.block);
    });
  }

  it('правильный вариант — это options[0] из контента', () => {
    const set = buildExam(content, exam('boss-sql'), seeded(3));
    const byQ = new Map(content.blocks.flatMap((b) => b.topics.flatMap((t) => t.quiz.map((q) => [q.q, q.options[0]]))));
    for (const q of set.mcq) expect(q.options.find((o) => o.correct)!.text).toBe(byQ.get(q.q));
  });

  it('разные попытки дают разные наборы', () => {
    const a = buildExam(content, exam('final'), seeded(1)).mcq.map((q) => q.q);
    const b = buildExam(content, exam('final'), seeded(2)).mcq.map((q) => q.q);
    expect(a).not.toEqual(b);
  });
});

describe('recordExam', () => {
  const boss = exam('boss-backend'); // 12 вопросов, порог 0.8

  it('порог 80%: 9/12 не сдано, 10/12 сдано', () => {
    expect(recordExam(emptyProgress(), boss, 9, 600, T0).outcome.passed).toBe(false);
    expect(recordExam(emptyProgress(), boss, 10, 600, T0).outcome.passed).toBe(true);
  });

  it('ровно 80% засчитывается', () => {
    const final = exam('final'); // 20 вопросов
    expect(recordExam(emptyProgress(), final, 16, 600, T0).outcome.passed).toBe(true);
    expect(recordExam(emptyProgress(), final, 15, 600, T0).outcome.passed).toBe(false);
  });

  it('копит попытки, лучший результат и первое прохождение', () => {
    let p = recordExam(emptyProgress(), boss, 5, 700, T0).progress;
    expect(p.exams[boss.id]).toEqual({ attempts: 1, best: 5 / 12 });
    const r2 = recordExam(p, boss, 11, 650, T0 + 1);
    expect(r2.outcome.firstPass).toBe(true);
    p = r2.progress;
    expect(p.exams[boss.id]).toEqual({ attempts: 2, best: 11 / 12, passedAt: T0 + 1, bestTimeSec: 650 });
    const r3 = recordExam(p, boss, 10, 900, T0 + 2);
    expect(r3.outcome.firstPass).toBe(false);
    expect(r3.progress.exams[boss.id]).toEqual({ attempts: 3, best: 11 / 12, passedAt: T0 + 1, bestTimeSec: 650 });
    const r4 = recordExam(r3.progress, boss, 3, 100, T0 + 3);
    expect(r4.progress.exams[boss.id]).toMatchObject({ passedAt: T0 + 1, bestTimeSec: 650 });
  });

  it('спидран только при сдаче быстрее 8 минут', () => {
    expect(recordExam(emptyProgress(), boss, 12, SPEEDRUN_SEC, T0).progress.flags.speedrun).toBeUndefined();
    expect(recordExam(emptyProgress(), boss, 12, SPEEDRUN_SEC - 1, T0).progress.flags.speedrun).toBe(true);
    expect(recordExam(emptyProgress(), boss, 2, 60, T0).progress.flags.speedrun).toBeUndefined();
  });

  it('XP за босса начисляется один раз, финальный даёт 500, ачивки открываются', () => {
    let p = recordExam(emptyProgress(), boss, 12, 600, T0).progress;
    expect(computeXp(p, content)).toBe(200);
    p = recordExam(p, boss, 12, 600, T0 + 1).progress;
    expect(computeXp(p, content)).toBe(200);
    expect(evaluate(p, content)).toContain('first-boss');
    p = recordExam(p, exam('final'), 20, 600, T0 + 2).progress;
    expect(computeXp(p, content)).toBe(700);
    expect(evaluate(p, content)).toContain('all-bosses');
  });
});

describe('блокировка финала', () => {
  it('финал закрыт, пока не сданы три босса', () => {
    const final = exam('final');
    let p = emptyProgress();
    expect(missingRequirements(p, final).sort()).toEqual(['boss-backend', 'boss-de', 'boss-sql']);
    for (const id of ['boss-backend', 'boss-sql']) p = recordExam(p, exam(id), 12, 600, T0).progress;
    p = recordExam(p, exam('boss-de'), 3, 600, T0).progress; // провал не считается
    expect(missingRequirements(p, final)).toEqual(['boss-de']);
    p = recordExam(p, exam('boss-de'), 11, 600, T0).progress;
    expect(missingRequirements(p, final)).toEqual([]);
    expect(missingRequirements(p, exam('boss-sql'))).toEqual([]);
  });
});

describe('открытые вопросы', () => {
  it('«знала» увеличивает openGood', () => {
    const p = recordOpenAnswers(emptyProgress(), ['good', 'partial', 'good', 'bad'], T0);
    expect(p.openGood).toBe(2);
    const same = emptyProgress();
    expect(recordOpenAnswers(same, ['bad', 'partial'])).toBe(same);
  });

  it('formatTime', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3600)).toBe('60:00');
  });
});
