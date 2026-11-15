// Миграция на реальном экспорте прогресса (tests/fixtures/progress-v1.json).
// Если файла нет, тесты пропускаются — файл с личными данными в репозиторий класть не обязательно.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content } from '../lib/content';
import { applyAchievements, computeXp } from '../lib/game';
import { normalizeProgress } from '../lib/progress';
import { applyDaily } from './daily';

const FILE = resolve(__dirname, '../../tests/fixtures/progress-v1.json');
const has = existsSync(FILE);

describe.skipIf(!has)('миграция реального экспорта v1', () => {
  const raw = has ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  const p = has ? normalizeProgress(raw) : (undefined as never);

  it('файл действительно version 1 и мигрирует в version 2', () => {
    expect(raw.version).toBe(1);
    expect(p.version).toBe(2);
  });

  it('пройденные темы, ачивки, награды, заметки и боссы не потерялись', () => {
    expect(Object.keys(p.topics).sort()).toEqual(Object.keys(raw.topics ?? {}).sort());
    expect(p.achievements).toEqual(raw.achievements ?? {});
    expect(p.rewards).toEqual(raw.rewards ?? {});
    expect(p.notes).toEqual(raw.notes ?? {});
    expect(p.exams).toEqual(raw.exams ?? {});
    expect(p.reviews).toBe(raw.reviews ?? 0);
    expect(p.perfectQuizzes).toBe(raw.perfectQuizzes ?? 0);
  });

  it('каждый активный день перенесён с тем же числом тем', () => {
    const active = Object.entries<number>(raw.activeDays ?? {}).filter(([, n]) => typeof n === 'number');
    expect(Object.keys(p.days).sort()).toEqual(active.map(([k]) => k).sort());
    for (const [k, n] of active) expect(p.days[k].topics, k).toBe(n);
  });

  it('XP не уменьшился, открытые ачивки не закрылись после первого запуска', () => {
    const before = computeXp(p, content);
    const after = applyAchievements(applyDaily(p, content), content).progress;
    expect(computeXp(after, content)).toBeGreaterThanOrEqual(before);
    for (const id of Object.keys(p.achievements)) expect(after.achievements[id]).toBe(p.achievements[id]);
    expect(after.bestStreak).toBeGreaterThanOrEqual(raw.bestStreak ?? 0);
  });

  it('экспорт → импорт после миграции без потерь', () => {
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});
