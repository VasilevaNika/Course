import { describe, expect, it } from 'vitest';
import {
  applyAchievements,
  claimReward,
  computeXp,
  evaluate,
  levelFor,
  levelInfo,
  markRewardIssued,
  rankFor,
  rewardStatus,
} from './game';
import { content, type Content } from './content';
import {
  DAY_MS,
  dayKey,
  emptyDay,
  emptyProgress,
  markMaterialOpened,
  recordQuiz,
  setNote,
  type DayStats,
  type Progress,
} from './progress';
import { shiftDay } from '../logic/dates';

const T0 = new Date(2026, 10, 10, 14, 0).getTime();
const day = (offset: number) => shiftDay(dayKey(T0), offset);
const stats = (): DayStats => emptyDay();
const q = (best: number, total: number) => ({ best, total, questionIds: [] as string[] });
/** Активные дни (по одной теме) с from по to включительно (смещения от T0). */
function activeRange(from: number, to: number): Progress['days'] {
  const out: Progress['days'] = {};
  for (let i = from; i <= to; i++) out[day(i)] = { ...stats(), topics: 1 };
  return out;
}

/** Маленький контент для точных проверок. */
const mini: Content = {
  meta: content.meta,
  blocks: [
    { id: 'py', title: 'Py', kind: 'repeat', description: '', topics: [topic('a'), topic('b', true)] },
    { id: 'de', title: 'DE', kind: 'new', description: '', topics: [topic('c', true)] },
  ],
  open_questions: [],
  exams: [
    { id: 'boss-x', title: '', blocks: [], open_blocks: [], mcq: 1, open: 0, pass: 0.8 },
    { id: 'final', title: '', blocks: [], open_blocks: [], mcq: 1, open: 0, pass: 0.8, requires: ['boss-x'] },
  ],
  achievements: content.achievements,
};

function topic(id: string, isNew = false) {
  return { id, title: id, new: isNew, minutes: 1, recap: [], materials: [], quiz: [] };
}

function withTopics(ids: string[], p: Progress = emptyProgress(T0)): Progress {
  const topics = { ...p.topics };
  for (const id of ids) topics[id] = { doneAt: T0, best: 2 };
  return { ...p, topics };
}

describe('XP', () => {
  it('пустой прогресс = 0 XP, уровень 1, Железо', () => {
    expect(computeXp(emptyProgress(), mini)).toBe(0);
    expect(levelInfo(emptyProgress(), mini)).toMatchObject({ xp: 0, level: 1, rank: 'Железо', inLevel: 0 });
  });

  it('считает все источники', () => {
    let p = withTopics(['a', 'b']); // 50 + 80
    p = { ...p, perfectQuizzes: 2, reviews: 3 }; // 40 + 30
    p = markMaterialOpened(markMaterialOpened(p, 'a', 0), 'a', 1); // 10
    p = { ...p, exams: { 'boss-x': { attempts: 2, best: 0.9, passedAt: T0 }, final: { attempts: 1, best: 0.5 } } }; // 200
    p = { ...p, achievements: { 'first-topic': T0, 'unknown-id': T0 } }; // 30, неизвестная не считается
    expect(computeXp(p, mini)).toBe(50 + 80 + 40 + 30 + 10 + 200 + 30);
  });

  it('финальный босс даёт 500', () => {
    const p = { ...emptyProgress(), exams: { final: { attempts: 1, best: 1, passedAt: T0 } } };
    expect(computeXp(p, mini)).toBe(500);
  });

  it('пересдачи и повторный импорт не дают лишнего XP', () => {
    let p = recordQuiz(emptyProgress(T0), 'a', 3, 3, T0).progress;
    const once = computeXp(p, mini);
    p = recordQuiz(p, 'a', 3, 3, T0 + 1000).progress;
    p = JSON.parse(JSON.stringify(p));
    expect(computeXp(p, mini)).toBe(once);
    expect(once).toBe(50 + 20);
  });

  it('уровни и ранги на границах', () => {
    expect(levelFor(249)).toBe(1);
    expect(levelFor(250)).toBe(2);
    expect(levelFor(500)).toBe(3);
    const table: [number, string][] = [
      [1, 'Железо'], [2, 'Железо'], [3, 'Бронза'], [4, 'Бронза'], [5, 'Серебро'], [6, 'Серебро'],
      [7, 'Золото'], [8, 'Золото'], [9, 'Платина'], [11, 'Платина'], [12, 'Алмаз'], [14, 'Алмаз'],
      [15, 'Мастер'], [18, 'Мастер'], [19, 'Грандмастер'], [40, 'Грандмастер'],
    ];
    for (const [lvl, name] of table) expect(rankFor(lvl), `level ${lvl}`).toBe(name);
  });
});

describe('XP за ежедневные квесты', () => {
  it('тест +40, 5/5 ещё +20, задание +10, сундук +30, реванш +50', () => {
    const p: Progress = {
      ...emptyProgress(),
      days: {
        [day(-2)]: { ...stats(), quest: q(5, 5), tasks: ['note', 'perfect'], tasksDone: ['note', 'perfect'], chest: true },
        [day(-1)]: { ...stats(), quest: q(3, 5), tasks: ['note', 'perfect'], tasksDone: ['note'] }, // не сдан
        [day(0)]: { ...stats(), frozen: true, revenge: true },
      },
    };
    expect(computeXp(p, mini)).toBe(40 + 20 + 2 * 10 + 30 + 10 + 50);
  });

  it('лучший результат дня считается один раз; 3/3 при маленьком пуле — без бонуса за 5/5', () => {
    const p = (quest: ReturnType<typeof q>) => ({ ...emptyProgress(), days: { [day(0)]: { ...stats(), quest } } });
    expect(computeXp(p(q(4, 5)), mini)).toBe(40);
    expect(computeXp(p(q(3, 3)), mini)).toBe(40);
    expect(computeXp(p(q(0, 5)), mini)).toBe(0);
  });
});

describe('evaluate', () => {
  it('ничего не открыто на старте', () => {
    expect(evaluate(emptyProgress(), content)).toEqual([]);
  });

  it('первая тема и новые земли', () => {
    expect(evaluate(withTopics(['a']), mini)).toEqual(['first-topic']);
    expect(evaluate(withTopics(['c']), mini).sort()).toEqual(
      ['block-de', 'first-topic', 'new-lands'].sort(),
    );
  });

  it('ачивки с полем block — одно правило по полю, без кода на каждую', () => {
    const custom: Content = {
      ...mini,
      achievements: [
        { id: 'any-name', title: '', condition: '', reward: '', rarity: 'silver', block: 'py' },
        { id: 'other', title: '', condition: '', reward: '', rarity: 'silver', block: 'de' },
        { id: 'no-such-block', title: '', condition: '', reward: '', rarity: 'silver', block: 'zzz' },
      ],
    };
    expect(evaluate(withTopics(['a']), custom)).toEqual([]);
    expect(evaluate(withTopics(['a', 'b']), custom)).toEqual(['any-name']);
    expect(evaluate(withTopics(['a', 'b', 'c']), custom).sort()).toEqual(['any-name', 'other']);
  });

  it('ачивки за блоки из roadmap.json открываются по своему блоку', () => {
    const blockAch = content.achievements.filter((a) => a.block);
    expect(blockAch.length).toBe(content.blocks.length);
    for (const b of content.blocks) {
      const ids = evaluate(withTopics(b.topics.map((t) => t.id)), content).filter((id) => id.startsWith('block-'));
      expect(ids, b.id).toEqual(blockAch.filter((a) => a.block === b.id).map((a) => a.id));
    }
  });

  it('блок и весь курс', () => {
    const ids = evaluate(withTopics(['a', 'b', 'c']), mini);
    expect(ids).toEqual(expect.arrayContaining(['block-py', 'block-de', 'completionist']));
    expect(evaluate(withTopics(['a', 'c']), mini)).not.toContain('completionist');
  });

  it('комбо за день — по days[d].topics', () => {
    const p = (n: number) => ({ ...emptyProgress(), days: { [day(0)]: { ...stats(), topics: n, reviews: 9 } } });
    expect(evaluate(p(4), mini)).not.toContain('combo-5');
    expect(evaluate(p(5), mini)).toContain('combo-5');
    expect(evaluate(p(9), mini)).not.toContain('combo-10');
    expect(evaluate(p(10), mini)).toEqual(expect.arrayContaining(['combo-5', 'combo-10']));
  });

  it('серии по истории и по bestStreak', () => {
    const three = { ...emptyProgress(), days: activeRange(-12, -10) };
    expect(evaluate(three, mini)).toContain('streak-3');
    expect(evaluate(three, mini)).not.toContain('streak-7');
    expect(evaluate({ ...emptyProgress(), bestStreak: 7 }, mini)).toEqual(expect.arrayContaining(['streak-3', 'streak-7']));
  });

  it('серии 14/30/50/100 — по bestStreak, не пропадают после сгоревшей серии', () => {
    const ids = (best: number) => evaluate({ ...emptyProgress(), bestStreak: best }, mini).filter((id) => id.startsWith('streak-'));
    expect(ids(13)).toEqual(['streak-3', 'streak-7']);
    expect(ids(14)).toEqual(['streak-3', 'streak-7', 'streak-14']);
    expect(ids(49)).toEqual(['streak-3', 'streak-7', 'streak-14', 'streak-30']);
    expect(ids(100)).toEqual(['streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-50', 'streak-100']);
  });
});

describe('evaluate: ежедневные квесты и серия', () => {
  const withDays = (days: Progress['days'], extra: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...extra, days });
  const has = (p: Progress, id: string) => evaluate(p, mini).includes(id);
  /** n дней подряд, начиная с offset, с заданной статистикой. */
  const run = (from: number, n: number, d: Partial<DayStats>) => {
    const out: Progress['days'] = {};
    for (let i = 0; i < n; i++) out[day(from + i)] = { ...stats(), ...d };
    return out;
  };

  it('dq-first: сданный ежедневный тест; несданный не считается', () => {
    expect(has(withDays({ [day(0)]: { ...stats(), quest: q(3, 5) } }), 'dq-first')).toBe(false);
    expect(has(withDays({ [day(0)]: { ...stats(), quest: q(4, 5) } }), 'dq-first')).toBe(true);
  });

  it('dq-flawless: только 5/5', () => {
    expect(has(withDays({ [day(0)]: { ...stats(), quest: q(4, 5) } }), 'dq-flawless')).toBe(false);
    expect(has(withDays({ [day(0)]: { ...stats(), quest: q(3, 3) } }), 'dq-flawless')).toBe(false);
    expect(has(withDays({ [day(0)]: { ...stats(), quest: q(5, 5) } }), 'dq-flawless')).toBe(true);
  });

  it('dq-10 и dq-30: число дней со сданным тестом', () => {
    expect(has(withDays(run(-20, 9, { quest: q(4, 5) })), 'dq-10')).toBe(false);
    expect(has(withDays(run(-20, 10, { quest: q(4, 5) })), 'dq-10')).toBe(true);
    expect(has(withDays(run(-40, 29, { quest: q(5, 5) })), 'dq-30')).toBe(false);
    expect(has(withDays(run(-40, 30, { quest: q(5, 5) })), 'dq-30')).toBe(true);
  });

  it('dq-chest-7: 7 сундуков, не обязательно подряд', () => {
    const days = { ...run(-20, 3, { chest: true }), ...run(-10, 3, { chest: true }) };
    expect(has(withDays(days), 'dq-chest-7')).toBe(false);
    expect(has(withDays({ ...days, [day(0)]: { ...stats(), chest: true } }), 'dq-chest-7')).toBe(true);
  });

  it('dq-perfect-week: 7 сундуков подряд; разрыв в один день — не считается', () => {
    expect(has(withDays(run(-6, 7, { chest: true })), 'dq-perfect-week')).toBe(true);
    const gap = { ...run(-7, 3, { chest: true }), ...run(-3, 4, { chest: true }) };
    expect(has(withDays(gap), 'dq-perfect-week')).toBe(false);
    expect(has(withDays(gap), 'dq-chest-7')).toBe(true);
  });

  it('dq-weekend: суббота и воскресенье одних выходных', () => {
    const pass = { ...stats(), quest: q(4, 5) };
    // 2026-11-14 — суббота, 2026-11-15 — воскресенье.
    expect(has(withDays({ '2026-11-14': pass, '2026-11-15': pass }), 'dq-weekend')).toBe(true);
    // Воскресенье и следующая суббота — разные выходные.
    expect(has(withDays({ '2026-11-08': pass, '2026-11-14': pass }), 'dq-weekend')).toBe(false);
    expect(has(withDays({ '2026-11-14': pass, '2026-11-15': { ...stats(), quest: q(2, 5) } }), 'dq-weekend')).toBe(false);
  });

  it('dq-old-guard: по флагу, который ставит ежедневный тест', () => {
    expect(has(withDays({}, { flags: { oldGuard: true } }), 'dq-old-guard')).toBe(true);
    expect(has(withDays({}), 'dq-old-guard')).toBe(false);
  });

  it('streak-freeze: замороженный день; день реванша не считается заморозкой', () => {
    expect(has(withDays({ [day(-1)]: { ...stats(), frozen: true } }), 'streak-freeze')).toBe(true);
    const revenge = withDays({ [day(-1)]: { ...stats(), frozen: true, revenge: true } });
    expect(has(revenge, 'streak-freeze')).toBe(false);
    expect(has(revenge, 'streak-revenge')).toBe(true);
  });

  it('streak-phoenix: серия от 7 сгорела, и новая дошла до 7', () => {
    const first = run(-30, 7, { topics: 1 });
    expect(has(withDays(first), 'streak-phoenix')).toBe(false);
    expect(has(withDays({ ...first, ...run(-10, 6, { topics: 1 }) }), 'streak-phoenix')).toBe(false);
    expect(has(withDays({ ...first, ...run(-10, 7, { topics: 1 }) }), 'streak-phoenix')).toBe(true);
    // Короткая первая серия не считается.
    expect(has(withDays({ ...run(-30, 6, { topics: 1 }), ...run(-10, 7, { topics: 1 }) }), 'streak-phoenix')).toBe(false);
    // Заморозка не рвёт серию — это одна серия, а не «снова».
    expect(has(withDays({ ...run(-20, 7, { topics: 1 }), [day(-13)]: { ...stats(), frozen: true }, ...run(-12, 7, { topics: 1 }) }), 'streak-phoenix')).toBe(false);
  });
});

describe('evaluate', () => {

  it('счётчики и флаги', () => {
    let p: Progress = { ...emptyProgress(), perfectQuizzes: 10, reviews: 5, openGood: 5 };
    p = { ...p, flags: { night: true, early: true, speedrun: true } };
    for (let i = 0; i < 15; i++) p = markMaterialOpened(p, 't', i);
    for (let i = 0; i < 5; i++) p = setNote(p, `t${i}`, 'x');
    expect(evaluate(p, mini).sort()).toEqual(
      ['flawless', 'sniper', 'review-5', 'talker', 'night-raid', 'morning-farm', 'speedrun', 'explorer', 'notes-5'].sort(),
    );
  });

  it('боссы', () => {
    const p1 = { ...emptyProgress(), exams: { 'boss-x': { attempts: 1, best: 0.5 } } };
    expect(evaluate(p1, mini)).toEqual([]);
    const p2 = { ...emptyProgress(), exams: { 'boss-x': { attempts: 1, best: 0.9, passedAt: T0 } } };
    expect(evaluate(p2, mini)).toEqual(['first-boss']);
    const p3 = { ...emptyProgress(), exams: { final: { attempts: 1, best: 0.9, passedAt: T0 } } };
    expect(evaluate(p3, mini)).toEqual(expect.arrayContaining(['first-boss', 'all-bosses']));
  });

  it('каждая ачивка из контента имеет правило', () => {
    // Максимальный прогресс должен открыть всё — иначе в roadmap.json появилась ачивка без логики.
    let p: Progress = withTopics(content.blocks.flatMap((b) => b.topics.map((t) => t.id)));
    p = { ...p, perfectQuizzes: 10, reviews: 5, openGood: 5, bestStreak: 100 };
    p = { ...p, flags: { night: true, early: true, speedrun: true, oldGuard: true } };
    const days: Progress['days'] = {};
    // Две серии по 7 дней с разрывом (феникс), 30 сданных тестов на 5/5 с сундуком (включая выходные),
    // один замороженный и один восстановленный реваншем день.
    for (let i = 0; i < 40; i++) {
      if (i === 8) continue;
      days[dayKey(T0 - i * DAY_MS)] = { ...stats(), topics: i === 0 ? 10 : 1, quest: q(5, 5), chest: true };
    }
    days[dayKey(T0 - 40 * DAY_MS)] = { ...stats(), frozen: true };
    days[dayKey(T0 - 41 * DAY_MS)] = { ...stats(), frozen: true, revenge: true };
    p = { ...p, days, exams: { final: { attempts: 1, best: 1, passedAt: T0 } } };
    for (let i = 0; i < 15; i++) p = markMaterialOpened(p, 't', i);
    for (let i = 0; i < 5; i++) p = setNote(p, `t${i}`, 'x');
    expect(evaluate(p, content).sort()).toEqual(content.achievements.map((a) => a.id).sort());
  });
});

describe('applyAchievements', () => {
  it('записывает только новые, с датой, и не трогает старые', () => {
    const p = withTopics(['a']);
    const r1 = applyAchievements(p, mini, T0);
    expect(r1.unlocked).toEqual(['first-topic']);
    expect(r1.progress.achievements).toEqual({ 'first-topic': T0 });
    const r2 = applyAchievements(withTopics(['c'], r1.progress), mini, T0 + 5);
    expect(r2.unlocked.sort()).toEqual(['block-de', 'new-lands']);
    expect(r2.progress.achievements['first-topic']).toBe(T0);
  });

  it('без изменений возвращает тот же объект', () => {
    const p = applyAchievements(withTopics(['a']), mini, T0).progress;
    expect(applyAchievements(p, mini, T0 + 1).progress).toBe(p);
  });

  it('обновляет bestStreak и не уменьшает его', () => {
    const p = { ...emptyProgress(), days: activeRange(-1, 0) };
    expect(applyAchievements(p, mini, T0).progress.bestStreak).toBe(2);
    expect(applyAchievements({ ...p, bestStreak: 9 }, mini, T0).progress.bestStreak).toBe(9);
  });
});

describe('награды', () => {
  const ach = content.achievements.find((a) => a.id === 'first-topic')!;

  it('проходит цепочку locked → available → requested → issued', () => {
    let p = emptyProgress();
    expect(rewardStatus(p, ach.id, ach.reward)).toBe('locked');
    expect(claimReward(p, ach.id)).toBe(p); // нельзя забрать закрытую
    p = applyAchievements(withTopics(['a']), mini, T0).progress;
    expect(rewardStatus(p, ach.id, ach.reward)).toBe('available');
    p = claimReward(p, ach.id, T0 + 1);
    expect(rewardStatus(p, ach.id, ach.reward)).toBe('requested');
    expect(claimReward(p, ach.id, T0 + 2).rewards[ach.id].claimedAt).toBe(T0 + 1);
    p = markRewardIssued(p, ach.id, T0 + 3);
    expect(rewardStatus(p, ach.id, ach.reward)).toBe('issued');
    expect(p.rewards[ach.id]).toEqual({ claimedAt: T0 + 1, issuedAt: T0 + 3 });
  });

  it('ачивка без награды', () => {
    const p = { ...emptyProgress(), achievements: { flawless: T0 } };
    expect(rewardStatus(p, 'flawless', '')).toBe('none');
  });
});
