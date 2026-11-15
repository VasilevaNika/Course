import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayKey, emptyProgress, type Progress } from '../lib/progress';
import { shiftDay } from './dates';
import {
  applyFreezes,
  awardFreezes,
  currentStreak,
  dayMark,
  isActiveDay,
  longestStreak,
  passMark,
  recordRevenge,
  revengeAvailable,
  streakRuns,
} from './streak';
import { activeDays, day } from './testkit';

const TODAY = '2026-11-10';
const d = (offset: number) => shiftDay(TODAY, offset);
/** Активные дни по смещениям от TODAY. */
const act = (...offsets: number[]) => activeDays(offsets.map(d));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const prog = (days: Progress['days'], freezes = 0): Progress => ({
  ...emptyProgress(),
  days,
  streak: { freezes, freezeAwards: {}, revengeUsed: {} },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('passMark', () => {
  it('80% с округлением вверх', () => {
    expect([1, 3, 4, 5, 10].map(passMark)).toEqual([1, 3, 4, 4, 8]);
  });
});

describe('isActiveDay', () => {
  it('пустой день и отсутствие дня — не активны', () => {
    expect(isActiveDay(undefined)).toBe(false);
    expect(isActiveDay(day())).toBe(false);
  });

  it('новая тема или повторение — активен', () => {
    expect(isActiveDay(day({ topics: 1 }))).toBe(true);
    expect(isActiveDay(day({ reviews: 1 }))).toBe(true);
  });

  it('ежедневный тест: сдан (≥4/5) — активен, не сдан — нет', () => {
    expect(isActiveDay(day({ quest: { best: 4, total: 5, questionIds: [] } }))).toBe(true);
    expect(isActiveDay(day({ quest: { best: 3, total: 5, questionIds: [] } }))).toBe(false);
    expect(isActiveDay(day({ quest: { best: 0, total: 0, questionIds: [] } }))).toBe(false);
  });

  it('материалы, заметки и заморозка сами по себе день активным не делают', () => {
    expect(isActiveDay(day({ materials: 5, notes: 2, perfectQuizzes: 0 }))).toBe(false);
    expect(isActiveDay(day({ frozen: true }))).toBe(false);
  });
});

describe('currentStreak', () => {
  it('пусто = 0', () => {
    expect(currentStreak({}, TODAY)).toBe(0);
  });

  it('считает до сегодня включительно', () => {
    expect(currentStreak(act(0, -1, -2, -4), TODAY)).toBe(3);
  });

  it('сегодня ещё не активен — считается до вчера и не обнуляется', () => {
    expect(currentStreak(act(-1, -2), TODAY)).toBe(2);
    expect(currentStreak({ ...act(-1, -2), [TODAY]: day({ materials: 3 }) }, TODAY)).toBe(2);
  });

  it('пропуск рвёт серию', () => {
    expect(currentStreak(act(-2, -3), TODAY)).toBe(0);
    expect(currentStreak(act(0, -2, -3), TODAY)).toBe(1);
  });

  it('замороженные дни не рвут серию и входят в неё', () => {
    expect(currentStreak({ ...act(0, -2, -3), [d(-1)]: day({ frozen: true }) }, TODAY)).toBe(4);
  });

  it('несданный ежедневный тест не спасает день', () => {
    expect(currentStreak({ ...act(-2), [d(-1)]: day({ quest: { best: 2, total: 5, questionIds: [] } }) }, TODAY)).toBe(0);
  });

  it('будущие дни не считаются', () => {
    expect(currentStreak(act(1, 2), TODAY)).toBe(0);
  });

  it('переход через полночь: в 23:59 и в 00:01 серия та же', () => {
    const days = act(-2, -1, 0);
    vi.setSystemTime(new Date(2026, 10, 10, 23, 59));
    expect(currentStreak(days, dayKey(Date.now()))).toBe(3);
    vi.setSystemTime(new Date(2026, 10, 11, 0, 1)); // новый день ещё пуст — серия считается до вчера
    expect(currentStreak(days, dayKey(Date.now()))).toBe(3);
    vi.setSystemTime(new Date(2026, 10, 12, 0, 1)); // целый день пропущен
    expect(currentStreak(days, dayKey(Date.now()))).toBe(0);
  });

  it('смена месяца, года и переход на зимнее время', () => {
    const days = activeDays(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-31', '2026-11-01', '2026-12-30', '2026-12-31', '2027-01-01']);
    expect(currentStreak(days, '2026-10-26')).toBe(3);
    expect(currentStreak(days, '2026-11-01')).toBe(2);
    expect(currentStreak(days, '2027-01-01')).toBe(3);
    expect(currentStreak(days, '2027-01-02')).toBe(3);
  });
});

describe('streakRuns / longestStreak', () => {
  it('все серии по порядку, заморозки внутри', () => {
    const days = { ...act(-10, -9, -8, -7, -1, 0), [d(-11)]: day({ frozen: true }) };
    expect(streakRuns(days)).toEqual([
      { start: d(-11), end: d(-7), length: 5 },
      { start: d(-1), end: TODAY, length: 2 },
    ]);
    expect(longestStreak(days)).toBe(5);
    expect(longestStreak({})).toBe(0);
  });

  it('через границу года', () => {
    expect(longestStreak(activeDays(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-03']))).toBe(3);
  });
});

describe('applyFreezes', () => {
  it('хватает заморозок — пропущенные дни замораживаются, заморозки тратятся', () => {
    const p = applyFreezes(prog(act(-3, -4, -5), 2), TODAY); // пропущены -2 и -1
    expect(p.days[d(-2)].frozen).toBe(true);
    expect(p.days[d(-1)].frozen).toBe(true);
    expect(p.streak.freezes).toBe(0);
    expect(currentStreak(p.days, TODAY)).toBe(5);
  });

  it('одного пропуска и одной заморозки хватает; лишние остаются', () => {
    const p = applyFreezes(prog(act(-2, -3), 2), TODAY);
    expect(p.days[d(-1)]).toMatchObject({ frozen: true });
    expect(p.streak.freezes).toBe(1);
  });

  it('не хватает — ничего не тратится, серия сгорает', () => {
    const before = prog(act(-3, -4), 1); // пропущено 2 дня, заморозка 1
    const p = applyFreezes(before, TODAY);
    expect(p).toBe(before);
    expect(currentStreak(p.days, TODAY)).toBe(0);
  });

  it('повторный вызов ничего не меняет', () => {
    const once = applyFreezes(prog(act(-2), 2), TODAY);
    expect(applyFreezes(once, TODAY)).toBe(once);
  });

  it('пропусков нет, истории нет или заморозок нет — тот же объект', () => {
    for (const p of [prog(act(-1), 2), prog(act(0, -1), 2), prog({}, 2), prog(act(-2), 0)]) expect(applyFreezes(p, TODAY)).toBe(p);
  });

  it('сохраняет статистику пропущенного дня (например, закреплённый квест)', () => {
    const quest = { best: 1, total: 5, questionIds: ['t0:0'] };
    const p = applyFreezes(prog({ ...act(-2), [d(-1)]: day({ quest }) }, 1), TODAY);
    expect(p.days[d(-1)]).toMatchObject({ frozen: true, quest });
  });

  it('через смену месяца', () => {
    const p = applyFreezes(prog(activeDays(['2026-10-30']), 2), '2026-11-02');
    expect(Object.keys(p.days).filter((k) => p.days[k].frozen).sort()).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('awardFreezes', () => {
  it('+1 за 7 дней серии', () => {
    const p = awardFreezes(prog(act(...range(-6, 0))), TODAY);
    expect(p.streak.freezes).toBe(1);
    expect(p.streak.freezeAwards).toEqual({ [`${d(-6)}:7`]: true });
  });

  it('6 дней — ничего', () => {
    const p = prog(act(...range(-5, 0)));
    expect(awardFreezes(p, TODAY)).toBe(p);
  });

  it('не больше 2 на руках', () => {
    const p = awardFreezes(prog(act(...range(-20, 0))), TODAY);
    expect(p.streak.freezes).toBe(2);
    expect(Object.keys(p.streak.freezeAwards)).toHaveLength(3); // отметки 7, 14, 21 отмечены
  });

  it('без двойного начисления: повторный вызов и потраченная заморозка не дают новую за ту же отметку', () => {
    const once = awardFreezes(prog(act(...range(-6, 0))), TODAY);
    expect(awardFreezes(once, TODAY)).toBe(once);
    const spent = { ...once, streak: { ...once.streak, freezes: 0 } };
    expect(awardFreezes(spent, TODAY)).toBe(spent);
  });

  it('новая серия начисляет заново, со своей датой начала', () => {
    let p = awardFreezes(prog(act(...range(-30, -24))), d(-24));
    p = { ...p, streak: { ...p.streak, freezes: 0 }, days: { ...p.days, ...act(...range(-6, 0)) } };
    p = awardFreezes(p, TODAY);
    expect(p.streak.freezes).toBe(1);
    expect(p.streak.freezeAwards[`${d(-6)}:7`]).toBe(true);
  });

  it('замороженные дни тоже идут в зачёт серии', () => {
    const p = awardFreezes(prog({ ...act(...range(-6, 0)), [d(-3)]: day({ frozen: true }) }), TODAY);
    expect(p.streak.freezes).toBe(1);
  });
});

describe('dayMark', () => {
  it('активен / заморожен / пропущен / сегодня / будущее / до начала занятий', () => {
    const days = { ...act(-3, -1), [d(-2)]: day({ frozen: true }) };
    expect(dayMark(days, d(-5), TODAY)).toBe('none');
    expect(dayMark(days, d(-3), TODAY)).toBe('active');
    expect(dayMark(days, d(-2), TODAY)).toBe('frozen');
    expect(dayMark({ ...days, [d(-2)]: day() }, d(-2), TODAY)).toBe('missed');
    expect(dayMark(days, TODAY, TODAY)).toBe('today');
    expect(dayMark({ ...days, ...act(0) }, TODAY, TODAY)).toBe('active');
    expect(dayMark(days, d(1), TODAY)).toBe('future');
  });
});

describe('реванш', () => {
  it('доступен, если серия ≥3 сгорела из-за ровно одного вчерашнего пропуска', () => {
    expect(revengeAvailable(prog(act(-2, -3, -4)), TODAY)).toEqual({ missed: d(-1), lost: 3 });
  });

  it('недоступен: серия была короче 3', () => {
    expect(revengeAvailable(prog(act(-2, -3)), TODAY)).toBeNull();
  });

  it('недоступен: пропущено два дня', () => {
    expect(revengeAvailable(prog(act(-3, -4, -5)), TODAY)).toBeNull();
  });

  it('недоступен: вчера активен или заморожен', () => {
    expect(revengeAvailable(prog(act(-1, -2, -3)), TODAY)).toBeNull();
    expect(revengeAvailable(prog({ ...act(-2, -3, -4), [d(-1)]: day({ frozen: true }) }), TODAY)).toBeNull();
  });

  it('доступен только в течение следующего дня', () => {
    expect(revengeAvailable(prog(act(-3, -4, -5)), d(1))).toBeNull();
  });

  it('сдан (≥8/10) — пропуск закрыт, серия восстановлена, второй раз недоступен', () => {
    const { progress, passed } = recordRevenge(prog(act(-2, -3, -4)), TODAY, 8, 10, 1);
    expect(passed).toBe(true);
    expect(progress.days[d(-1)]).toMatchObject({ frozen: true, revenge: true });
    expect(currentStreak(progress.days, TODAY)).toBe(4);
    expect(revengeAvailable(progress, TODAY)).toBeNull();
  });

  it('не сдан (7/10) — попытка потрачена, серия не восстановлена', () => {
    const { progress, passed } = recordRevenge(prog(act(-2, -3, -4)), TODAY, 7, 10, 1);
    expect(passed).toBe(false);
    expect(progress.days[d(-1)]).toBeUndefined();
    expect(progress.streak.revengeUsed).toEqual({ [d(-1)]: true });
    expect(revengeAvailable(progress, TODAY)).toBeNull();
  });

  it('недоступный реванш ничего не меняет', () => {
    const p = prog(act(-2, -3));
    expect(recordRevenge(p, TODAY, 10, 10).progress).toBe(p);
  });
});
