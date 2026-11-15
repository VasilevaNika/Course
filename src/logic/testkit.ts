// Общие помощники для тестов src/logic (в сборку не попадает: импортируется только из *.test.ts).
import { content as real, type Content, type Topic } from '../lib/content';
import { emptyDay, emptyProgress, type DayStats, type Progress } from '../lib/progress';

/** Тема с n вопросами. */
export function topic(id: string, n = 3): Topic {
  return {
    id,
    title: id,
    minutes: 1,
    recap: [],
    materials: [],
    quiz: Array.from({ length: n }, (_, i) => ({ q: `${id} ${i}`, options: ['верно', 'нет'], explain: '' })),
  };
}

/** Контент из одного блока с темами t0..t{count-1}, по n вопросов. */
export function makeContent(count: number, n = 3): Content {
  return {
    ...real,
    blocks: [{ id: 'b', title: 'B', kind: 'repeat', description: '', topics: Array.from({ length: count }, (_, i) => topic(`t${i}`, n)) }],
  };
}

export const day = (d: Partial<DayStats> = {}): DayStats => ({ ...emptyDay(), ...d });

/** Прогресс, где темы пройдены в момент doneAt с результатом best. */
export function withTopics(ids: string[], doneAt: number, best = 3, p: Progress = emptyProgress(doneAt)): Progress {
  const topics = { ...p.topics };
  for (const id of ids) topics[id] = { doneAt, best };
  return { ...p, topics };
}

/** Активные (по одной теме) дни с ключами keys. */
export function activeDays(keys: string[]): Record<string, DayStats> {
  return Object.fromEntries(keys.map((k) => [k, day({ topics: 1 })]));
}
