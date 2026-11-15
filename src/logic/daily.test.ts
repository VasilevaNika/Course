import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, dayKey, emptyProgress, markMaterialOpened, recordQuiz, setNote, type Progress } from '../lib/progress';
import { shiftDay } from './dates';
import {
  applyDaily,
  dailyQuest,
  ensureDailyPlan,
  findQuestion,
  questLocked,
  recordDailyQuiz,
  syncDay,
  topicWeight,
} from './daily';
import { currentStreak, isActiveDay } from './streak';
import { day, makeContent, withTopics } from './testkit';

const TODAY = '2026-11-10';
const NOW = new Date(2026, 10, 10, 14, 0).getTime();
const ago = (days: number) => NOW - days * DAY_MS;
const topicOf = (id: string) => id.slice(0, id.lastIndexOf(':'));
const perTopic = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ({ ...m, [topicOf(id)]: (m[topicOf(id)] ?? 0) + 1 }), {});

const c10 = makeContent(10); // 10 тем × 3 вопроса
const all10 = c10.blocks[0].topics.map((t) => t.id);

beforeEach(() => vi.useFakeTimers({ now: NOW }));
afterEach(() => vi.useRealTimers());

describe('dailyQuest: подбор вопросов', () => {
  it('квест закрыт, пока не пройдено ни одной темы', () => {
    const p = emptyProgress(NOW);
    expect(questLocked(p)).toBe(true);
    expect(dailyQuest(TODAY, p, c10)).toEqual({ questionIds: [], tasks: [] });
    expect(ensureDailyPlan(p, c10, TODAY)).toBe(p);
  });

  it('детерминирован: одна дата → один результат', () => {
    const p = withTopics(all10.slice(0, 6), ago(10));
    expect(dailyQuest(TODAY, p, c10)).toEqual(dailyQuest(TODAY, JSON.parse(JSON.stringify(p)), c10));
  });

  it('разные даты дают разные наборы', () => {
    const p = withTopics(all10, ago(10));
    const sets = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((date) => dailyQuest(date, p, c10).questionIds.join()));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('5 разных вопросов только из пройденных тем', () => {
    const p = withTopics(['t1', 't3', 't5', 't7'], ago(5));
    const { questionIds } = dailyQuest(TODAY, p, c10);
    expect(questionIds).toHaveLength(5);
    expect(new Set(questionIds).size).toBe(5);
    for (const id of questionIds) expect(['t1', 't3', 't5', 't7']).toContain(topicOf(id));
    for (const id of questionIds) expect(findQuestion(c10, id)).toBeTruthy();
  });

  it('не больше 2 вопросов из одной темы, если пул позволяет', () => {
    const p = withTopics(['t0', 't1', 't2'], ago(5)); // 9 вопросов в 3 темах — лимит выполним
    for (let i = 0; i < 30; i++) {
      const counts = perTopic(dailyQuest(shiftDay(TODAY, i), p, c10).questionIds);
      expect(Math.max(...Object.values(counts)), `день ${i}`).toBeLessThanOrEqual(2);
    }
  });

  it('если пул не позволяет — лимит снимается (2 темы × 3 вопроса)', () => {
    const { questionIds } = dailyQuest(TODAY, withTopics(['t0', 't1'], ago(5)), c10);
    expect(questionIds).toHaveLength(5);
    expect(Math.max(...Object.values(perTopic(questionIds)))).toBe(3);
  });

  it('в пуле меньше 5 — берутся все', () => {
    const { questionIds } = dailyQuest(TODAY, withTopics(['t4'], ago(1)), c10);
    expect(questionIds.slice().sort()).toEqual(['t4:0', 't4:1', 't4:2']);
  });

  it('вчерашние вопросы не повторяются, если без них остаётся ≥5', () => {
    let p = withTopics(['t0', 't1', 't2', 't3'], ago(5)); // 12 вопросов
    const yesterday = dailyQuest(shiftDay(TODAY, -1), p, c10).questionIds;
    p = { ...p, days: { [shiftDay(TODAY, -1)]: day({ quest: { best: 5, total: 5, questionIds: yesterday } }) } };
    const today = dailyQuest(TODAY, p, c10).questionIds;
    expect(today.filter((id) => yesterday.includes(id))).toEqual([]);
  });

  it('если после исключения вчерашних останется меньше 5 — вчерашние разрешены', () => {
    let p = withTopics(['t0', 't1'], ago(5)); // 6 вопросов: 6 − 5 = 1
    const yesterday = ['t0:0', 't0:1', 't0:2', 't1:0', 't1:1'];
    p = { ...p, days: { [shiftDay(TODAY, -1)]: day({ quest: { best: 5, total: 5, questionIds: yesterday } }) } };
    expect(dailyQuest(TODAY, p, c10).questionIds).toHaveLength(5);
  });

  it('вес темы: 1 + дней с последнего касания, ×2 при best < 3', () => {
    let p = withTopics(['t0'], ago(4), 3);
    p = withTopics(['t1'], ago(4), 2, p);
    p = { ...p, topics: { ...p.topics, t2: { doneAt: ago(20), best: 3, lastReviewAt: ago(1) } } };
    expect(topicWeight(p, 't0', TODAY)).toBe(5);
    expect(topicWeight(p, 't1', TODAY)).toBe(10);
    expect(topicWeight(p, 't2', TODAY)).toBe(2); // считается от lastReviewAt
    expect(topicWeight(p, 't9', TODAY)).toBe(0);
  });

  it('давнее и слабое выпадает чаще свежего и сильного', () => {
    let p = withTopics(['t0', 't1', 't2', 't3', 't4'], ago(0), 3); // свежие, 3/3: вес 1
    p = withTopics(['t5'], ago(30), 2, p); // давняя и слабая: вес 62
    let old = 0;
    let fresh = 0;
    for (let i = 0; i < 60; i++) {
      const counts = perTopic(dailyQuest(shiftDay(TODAY, i), p, c10).questionIds);
      old += counts.t5 ?? 0;
      fresh += counts.t0 ?? 0;
    }
    expect(old).toBeGreaterThan(fresh * 2);
  });
});

describe('dailyQuest: побочные задания', () => {
  it('два разных задания из пула', () => {
    const { tasks } = dailyQuest(TODAY, withTopics(['t0'], ago(10)), c10);
    expect(tasks).toHaveLength(2);
    expect(new Set(tasks).size).toBe(2);
  });

  it('«Пройди новую тему» не выбирается, когда все темы пройдены', () => {
    const p = withTopics(all10, ago(10));
    for (let i = 0; i < 40; i++) expect(dailyQuest(shiftDay(TODAY, i), p, c10).tasks).not.toContain('new-topic');
  });

  it('«Повтори тему» не выбирается, когда нет темы старше 3 дней', () => {
    const p = withTopics(['t0', 't1'], ago(2));
    for (let i = 0; i < 40; i++) expect(dailyQuest(TODAY, p, c10, { salt: String(i) }).tasks).not.toContain('review');
  });

  it('«Повтори тему» иногда выпадает, когда старая тема есть', () => {
    const p = withTopics(['t0'], ago(3));
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) dailyQuest(shiftDay(TODAY, i), p, c10).tasks.forEach((t) => seen.add(t));
    expect(seen).toContain('review');
    expect(seen).toContain('new-topic');
  });

  it('реванш: 10 вопросов со своей последовательностью', () => {
    const p = withTopics(all10, ago(10));
    const revenge = dailyQuest(TODAY, p, c10, { size: 10, salt: 'revenge' }).questionIds;
    expect(revenge).toHaveLength(10);
    expect(new Set(revenge).size).toBe(10);
  });
});

describe('квест дня: закрепление, попытки, задания, сундук', () => {
  it('закреплённый квест не меняется, когда прогресс меняется в течение дня', () => {
    let p = ensureDailyPlan(withTopics(['t0', 't1', 't2'], ago(10)), c10, TODAY);
    const plan = p.days[TODAY];
    expect(plan.quest).toMatchObject({ best: 0, total: 5 });
    expect(plan.tasks).toHaveLength(2);
    p = withTopics(['t3', 't4', 't5'], NOW, 1, p);
    expect(ensureDailyPlan(p, c10, TODAY)).toBe(p);
    expect(p.days[TODAY]).toBe(plan);
  });

  it('засчитывается лучший результат дня; сдан при ≥4/5 → день активен', () => {
    let p = ensureDailyPlan(withTopics(['t0', 't1', 't2'], ago(10)), c10, TODAY);
    const ids = p.days[TODAY].quest!.questionIds;
    const answers = (right: number) => ids.map((id, i) => ({ id, correct: i < right }));
    p = recordDailyQuiz(p, TODAY, answers(3), NOW);
    expect(p.days[TODAY].quest!.best).toBe(3);
    expect(isActiveDay(p.days[TODAY])).toBe(false);
    p = recordDailyQuiz(p, TODAY, answers(4), NOW);
    p = recordDailyQuiz(p, TODAY, answers(2), NOW);
    expect(p.days[TODAY].quest!.best).toBe(4);
    expect(isActiveDay(p.days[TODAY])).toBe(true);
  });

  it('тема, где все вопросы теста верны, получает lastReviewAt; с ошибкой — нет', () => {
    let p = withTopics(['t0', 't1'], ago(10));
    p = { ...p, days: { [TODAY]: day({ quest: { best: 0, total: 4, questionIds: ['t0:0', 't0:1', 't1:0', 't1:1'] } }) } };
    p = recordDailyQuiz(p, TODAY, [
      { id: 't0:0', correct: true },
      { id: 't0:1', correct: true },
      { id: 't1:0', correct: true },
      { id: 't1:1', correct: false },
    ], NOW);
    expect(p.topics.t0.lastReviewAt).toBe(NOW);
    expect(p.topics.t1.lastReviewAt).toBeUndefined();
    expect(p.reviews).toBe(0); // это не повторение темы — только отметка для «На повторение»
  });

  it('«Старая гвардия»: верный ответ по теме, пройденной 30+ дней назад', () => {
    let p = withTopics(['t0'], ago(30));
    p = withTopics(['t1'], ago(29), 3, p);
    p = { ...p, days: { [TODAY]: day({ quest: { best: 0, total: 2, questionIds: ['t0:0', 't1:0'] } }) } };
    expect(recordDailyQuiz(p, TODAY, [{ id: 't0:0', correct: false }, { id: 't1:0', correct: true }], NOW).flags.oldGuard).toBeUndefined();
    expect(recordDailyQuiz(p, TODAY, [{ id: 't0:0', correct: true }, { id: 't1:0', correct: false }], NOW).flags.oldGuard).toBe(true);
  });

  it('без закреплённого квеста попытка не записывается', () => {
    const p = withTopics(['t0'], ago(1));
    expect(recordDailyQuiz(p, TODAY, [{ id: 't0:0', correct: true }], NOW)).toBe(p);
  });

  it('задания отмечаются по статистике дня, сундук — когда сданы тест и оба задания', () => {
    let p: Progress = withTopics(['t0'], ago(10));
    p = { ...p, days: { [TODAY]: day({ quest: { best: 0, total: 3, questionIds: ['t0:0', 't0:1', 't0:2'] }, tasks: ['materials-2', 'note'] }) } };
    p = syncDay(markMaterialOpened(markMaterialOpened(p, 't0', 0, NOW), 't0', 1, NOW), TODAY);
    expect(p.days[TODAY].tasksDone).toEqual(['materials-2']);
    p = syncDay(setNote(p, 't0', 'з'.repeat(50), NOW), TODAY);
    expect(p.days[TODAY].tasksDone).toEqual(['materials-2', 'note']);
    expect(p.days[TODAY].chest).toBeUndefined(); // тест ещё не сдан
    p = syncDay(recordDailyQuiz(p, TODAY, ['t0:0', 't0:1', 't0:2'].map((id) => ({ id, correct: true })), NOW), TODAY);
    expect(p.days[TODAY].chest).toBe(true);
    expect(syncDay(p, TODAY)).toBe(p);
  });

  it('задания «новая тема», «3/3» и «повтори» считаются по мини-тестам', () => {
    let p: Progress = withTopics(['t0'], ago(5), 2);
    p = { ...p, days: { [TODAY]: day({ tasks: ['new-topic', 'perfect'] }) } };
    p = syncDay(recordQuiz(p, 't1', 3, 3, NOW).progress, TODAY);
    expect(p.days[TODAY].tasksDone).toEqual(['new-topic', 'perfect']);
    let r: Progress = withTopics(['t0'], ago(5), 2);
    r = { ...r, days: { [TODAY]: day({ tasks: ['review', 'note'] }) } };
    r = syncDay(recordQuiz(r, 't0', 2, 3, NOW).progress, TODAY);
    expect(r.days[TODAY].tasksDone).toEqual(['review']);
  });
});

describe('applyDaily', () => {
  it('ничего не меняется — тот же объект', () => {
    const p = applyDaily(withTopics(['t0', 't1'], ago(3)), c10);
    expect(applyDaily(p, c10)).toBe(p);
  });

  it('после полуночи закрепляет квест нового дня, вчерашний остаётся как был', () => {
    vi.setSystemTime(new Date(2026, 10, 10, 23, 59));
    let p = applyDaily(withTopics(['t0', 't1', 't2', 't3'], ago(5)), c10);
    const yesterdayIds = p.days['2026-11-10'].quest!.questionIds;
    vi.setSystemTime(new Date(2026, 10, 11, 0, 1));
    p = applyDaily(p, c10);
    expect(p.days['2026-11-10'].quest!.questionIds).toEqual(yesterdayIds);
    expect(p.days['2026-11-11'].quest!.questionIds.filter((id) => yesterdayIds.includes(id))).toEqual([]);
  });

  it('на смене года: заморозка закрывает 31 декабря, серия продолжается', () => {
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0));
    let p = withTopics(['t0'], ago(60));
    p = { ...p, streak: { freezes: 1, freezeAwards: {}, revengeUsed: {} }, days: { '2026-12-29': day({ topics: 1 }), '2026-12-30': day({ topics: 1 }) } };
    p = applyDaily(p, c10);
    expect(p.days['2026-12-31'].frozen).toBe(true);
    expect(p.streak.freezes).toBe(0);
    expect(currentStreak(p.days, dayKey(Date.now()))).toBe(3);
  });

  it('седьмой день серии даёт заморозку и обновляет лучшую серию', () => {
    let p = withTopics(['t0'], ago(10));
    const days: Progress['days'] = {};
    for (let i = 0; i < 7; i++) days[shiftDay(TODAY, -i)] = day({ topics: 1 });
    p = applyDaily({ ...p, days }, c10);
    expect(p.streak.freezes).toBe(1);
    expect(p.bestStreak).toBe(7);
  });
});
