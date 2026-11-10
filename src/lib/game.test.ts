import { describe, expect, it } from 'vitest';
import {
  applyAchievements,
  claimReward,
  computeXp,
  currentStreak,
  evaluate,
  levelFor,
  levelInfo,
  longestStreak,
  markRewardIssued,
  rankFor,
  rewardStatus,
} from './game';
import { content, type Content } from './content';
import { DAY_MS, dayKey, emptyProgress, markMaterialOpened, recordQuiz, setNote, type Progress } from './progress';

const T0 = new Date(2026, 10, 10, 14, 0).getTime();
const day = (offset: number) => dayKey(T0 + offset * DAY_MS);

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

describe('серия', () => {
  it('пусто = 0', () => {
    expect(currentStreak({}, T0)).toBe(0);
    expect(longestStreak({})).toBe(0);
  });

  it('считает до сегодня', () => {
    const days = { [day(0)]: 1, [day(-1)]: 2, [day(-2)]: 1, [day(-4)]: 1 };
    expect(currentStreak(days, T0)).toBe(3);
  });

  it('если сегодня пусто — считает до вчера', () => {
    const days = { [day(-1)]: 1, [day(-2)]: 1 };
    expect(currentStreak(days, T0)).toBe(2);
  });

  it('пропуск позавчера обрывает серию', () => {
    expect(currentStreak({ [day(-2)]: 1, [day(-3)]: 1 }, T0)).toBe(0);
  });

  it('нулевые значения не считаются активным днём', () => {
    expect(currentStreak({ [day(0)]: 0, [day(-1)]: 1 }, T0)).toBe(1);
  });

  it('через переход на зимнее время и границу месяца/года', () => {
    const days: Record<string, number> = {};
    for (const d of ['2026-10-24', '2026-10-25', '2026-10-26', '2026-12-30', '2026-12-31', '2027-01-01'])
      days[d] = 1;
    expect(currentStreak(days, new Date(2026, 9, 26, 10).getTime())).toBe(3);
    expect(longestStreak(days)).toBe(3);
    expect(currentStreak(days, new Date(2027, 0, 1, 23).getTime())).toBe(3);
  });

  it('самая длинная серия в истории', () => {
    const days = { [day(-10)]: 1, [day(-9)]: 1, [day(-8)]: 1, [day(-7)]: 1, [day(-1)]: 1, [day(0)]: 1 };
    expect(longestStreak(days)).toBe(4);
  });
});

describe('evaluate', () => {
  it('ничего не открыто на старте', () => {
    expect(evaluate(emptyProgress(), content)).toEqual([]);
  });

  it('первая тема и новые земли', () => {
    expect(evaluate(withTopics(['a']), mini)).toEqual(['first-topic']);
    expect(evaluate(withTopics(['c']), mini).sort()).toEqual(
      ['block-clear', 'de-block', 'first-topic', 'new-lands'].sort(),
    );
  });

  it('блок и весь курс', () => {
    const ids = evaluate(withTopics(['a', 'b', 'c']), mini);
    expect(ids).toEqual(expect.arrayContaining(['block-clear', 'de-block', 'completionist']));
    expect(evaluate(withTopics(['a', 'c']), mini)).not.toContain('completionist');
  });

  it('комбо за день', () => {
    const p = (n: number) => ({ ...emptyProgress(), activeDays: { [day(0)]: n } });
    expect(evaluate(p(4), mini)).not.toContain('combo-5');
    expect(evaluate(p(5), mini)).toContain('combo-5');
    expect(evaluate(p(9), mini)).not.toContain('combo-10');
    expect(evaluate(p(10), mini)).toEqual(expect.arrayContaining(['combo-5', 'combo-10']));
  });

  it('серии по истории и по bestStreak', () => {
    const three = { ...emptyProgress(), activeDays: { [day(-12)]: 1, [day(-11)]: 1, [day(-10)]: 1 } };
    expect(evaluate(three, mini)).toContain('streak-3');
    expect(evaluate(three, mini)).not.toContain('streak-7');
    expect(evaluate({ ...emptyProgress(), bestStreak: 7 }, mini)).toEqual(expect.arrayContaining(['streak-3', 'streak-7']));
  });

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
    p = { ...p, perfectQuizzes: 10, reviews: 5, openGood: 5, bestStreak: 7, flags: { night: true, early: true, speedrun: true } };
    p = { ...p, activeDays: { [day(0)]: 10 }, exams: { final: { attempts: 1, best: 1, passedAt: T0 } } };
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
    expect(r2.unlocked.sort()).toEqual(['block-clear', 'de-block', 'new-lands']);
    expect(r2.progress.achievements['first-topic']).toBe(T0);
  });

  it('без изменений возвращает тот же объект', () => {
    const p = applyAchievements(withTopics(['a']), mini, T0).progress;
    expect(applyAchievements(p, mini, T0 + 1).progress).toBe(p);
  });

  it('обновляет bestStreak и не уменьшает его', () => {
    const p = { ...emptyProgress(), activeDays: { [day(-1)]: 1, [day(0)]: 1 } };
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
