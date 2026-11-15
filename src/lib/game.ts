// Геймификация: XP, уровни, ранги, серия дней, ачивки. Только чистые функции.
import type { Content } from './content';
import type { Progress } from './progress';
import { shiftDay, weekdayMon } from '../logic/dates';
import { longestStreak, questPassed, questPerfect, streakRuns } from '../logic/streak';

export const XP = {
  topic: 50,
  newTopic: 80,
  perfectQuiz: 20,
  review: 10,
  material: 5,
  boss: 200,
  finalBoss: 500,
  achievement: 30,
  dailyQuest: 40, // ежедневный тест сдан (раз в день)
  dailyPerfect: 20, // ежедневный тест на 5/5
  dailyTask: 10, // побочное задание
  chest: 30, // сундук дня
  revenge: 50, // серия восстановлена реваншем
} as const;

export const XP_PER_LEVEL = 250;
export const FINAL_EXAM_ID = 'final';

/** XP вычисляется из прогресса (не хранится), чтобы ретраи и импорт не давали двойных начислений. */
export function computeXp(p: Progress, content: Content): number {
  let xp = 0;
  for (const block of content.blocks)
    for (const t of block.topics) if (p.topics[t.id]) xp += t.new ? XP.newTopic : XP.topic;
  xp += p.perfectQuizzes * XP.perfectQuiz;
  xp += p.reviews * XP.review;
  xp += Object.keys(p.materialsOpened).length * XP.material;
  for (const exam of content.exams)
    if (p.exams[exam.id]?.passedAt) xp += exam.id === FINAL_EXAM_ID ? XP.finalBoss : XP.boss;
  const known = new Set(content.achievements.map((a) => a.id));
  xp += Object.keys(p.achievements).filter((id) => known.has(id)).length * XP.achievement;
  for (const d of Object.values(p.days)) {
    if (questPassed(d)) xp += XP.dailyQuest;
    if (questPassed(d) && questPerfect(d)) xp += XP.dailyPerfect;
    xp += (d.tasksDone?.length ?? 0) * XP.dailyTask;
    if (d.chest) xp += XP.chest;
    if (d.revenge) xp += XP.revenge;
  }
  return xp;
}

export function levelFor(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

const RANKS: [minLevel: number, name: string][] = [
  [19, 'Грандмастер'],
  [15, 'Мастер'],
  [12, 'Алмаз'],
  [9, 'Платина'],
  [7, 'Золото'],
  [5, 'Серебро'],
  [3, 'Бронза'],
  [1, 'Железо'],
];

export function rankFor(level: number): string {
  return (RANKS.find(([min]) => level >= min) ?? RANKS[RANKS.length - 1])[1];
}

export type LevelInfo = { xp: number; level: number; rank: string; inLevel: number; perLevel: number };

export function levelInfo(p: Progress, content: Content): LevelInfo {
  const xp = computeXp(p, content);
  const level = levelFor(xp);
  return { xp, level, rank: rankFor(level), inLevel: xp - (level - 1) * XP_PER_LEVEL, perLevel: XP_PER_LEVEL };
}

// Серия дней, заморозки и реванш — в src/logic/streak.ts.

// ---------- Ачивки ----------

const count = (r: Record<string, unknown>) => Object.keys(r).length;

/** id всех ачивок, условия которых выполнены. Неизвестные id из контента никогда не выполнены. */
export function evaluate(p: Progress, content: Content): string[] {
  const done = (id: string) => Boolean(p.topics[id]);
  const blockDone = (blockId: string) => {
    const b = content.blocks.find((x) => x.id === blockId);
    return Boolean(b && b.topics.length > 0 && b.topics.every((t) => done(t.id)));
  };
  const days = Object.entries(p.days).sort(([a], [b]) => (a < b ? -1 : 1));
  const maxDay = Math.max(0, ...days.map(([, d]) => d.topics));
  const streak = Math.max(p.bestStreak, longestStreak(p.days));
  const allTopics = content.blocks.flatMap((b) => b.topics);
  const deBlock = content.blocks.find((b) => b.id === 'de');
  const passedQuests = days.filter(([, d]) => questPassed(d)).length;
  const chestDays = days.filter(([, d]) => d.chest).map(([k]) => k);
  const runs = streakRuns(p.days);

  const rules: Record<string, () => boolean> = {
    'first-topic': () => count(p.topics) >= 1,
    'combo-5': () => maxDay >= 5,
    'combo-10': () => maxDay >= 10,
    flawless: () => p.perfectQuizzes >= 1,
    sniper: () => p.perfectQuizzes >= 10,
    'streak-3': () => streak >= 3,
    'streak-7': () => streak >= 7,
    'dq-first': () => passedQuests >= 1,
    'dq-flawless': () => days.some(([, d]) => questPassed(d) && questPerfect(d)),
    'dq-10': () => passedQuests >= 10,
    'dq-30': () => passedQuests >= 30,
    'dq-chest-7': () => chestDays.length >= 7,
    'dq-perfect-week': () => chestDays.some((k) => [1, 2, 3, 4, 5, 6].every((i) => p.days[shiftDay(k, i)]?.chest)),
    'dq-weekend': () =>
      days.some(([k, d]) => weekdayMon(k) === 5 && questPassed(d) && questPassed(p.days[shiftDay(k, 1)])),
    'dq-old-guard': () => Boolean(p.flags.oldGuard),
    'streak-14': () => streak >= 14,
    'streak-30': () => streak >= 30,
    'streak-50': () => streak >= 50,
    'streak-100': () => streak >= 100,
    'streak-freeze': () => days.some(([, d]) => d.frozen && !d.revenge),
    'streak-revenge': () => days.some(([, d]) => d.revenge),
    // Была серия от 7, она сгорела (после неё началась другая), и новая тоже дошла до 7.
    'streak-phoenix': () => runs.some((r, i) => r.length >= 7 && runs.slice(i + 1).some((n) => n.length >= 7)),
    'night-raid': () => Boolean(p.flags.night),
    'morning-farm': () => Boolean(p.flags.early),
    explorer: () => count(p.materialsOpened) >= 15,
    'notes-5': () => Object.values(p.notes).filter((n) => n.trim()).length >= 5,
    'new-lands': () => Boolean(deBlock?.topics.some((t) => done(t.id))),
    'review-5': () => p.reviews >= 5,
    'first-boss': () => Object.values(p.exams).some((e) => e.passedAt),
    speedrun: () => Boolean(p.flags.speedrun),
    talker: () => p.openGood >= 5,
    'all-bosses': () => Boolean(p.exams[FINAL_EXAM_ID]?.passedAt),
    completionist: () => allTopics.length > 0 && allTopics.every((t) => done(t.id)),
  };

  // Ачивки с полем block — одно общее правило: пройдены все темы этого блока.
  const met = (a: Content['achievements'][number]) => (a.block ? blockDone(a.block) : (rules[a.id]?.() ?? false));
  return content.achievements.filter(met).map((a) => a.id);
}

/**
 * Обновляет производные поля (bestStreak) и записывает новые ачивки.
 * Открытые ачивки никогда не закрываются обратно. Возвращает тот же объект, если ничего не изменилось.
 */
export function applyAchievements(
  p: Progress,
  content: Content,
  now = Date.now(),
): { progress: Progress; unlocked: string[] } {
  const best = Math.max(p.bestStreak, longestStreak(p.days));
  let next = best !== p.bestStreak ? { ...p, bestStreak: best } : p;
  const unlocked = evaluate(next, content).filter((id) => !(id in next.achievements));
  if (unlocked.length) {
    const achievements = { ...next.achievements };
    for (const id of unlocked) achievements[id] = now;
    next = { ...next, achievements, updatedAt: now };
  }
  return { progress: next, unlocked };
}

// ---------- Награды ----------

export type RewardStatus = 'locked' | 'none' | 'available' | 'requested' | 'issued';

export function rewardStatus(p: Progress, id: string, reward: string): RewardStatus {
  if (!p.achievements[id]) return 'locked';
  if (!reward.trim()) return 'none';
  const r = p.rewards[id];
  if (!r) return 'available';
  return r.issuedAt ? 'issued' : 'requested';
}

export function claimReward(p: Progress, id: string, now = Date.now()): Progress {
  if (!p.achievements[id] || p.rewards[id]) return p;
  return { ...p, updatedAt: now, rewards: { ...p.rewards, [id]: { claimedAt: now } } };
}

export function markRewardIssued(p: Progress, id: string, now = Date.now()): Progress {
  const r = p.rewards[id];
  if (!r || r.issuedAt) return p;
  return { ...p, updatedAt: now, rewards: { ...p.rewards, [id]: { ...r, issuedAt: now } } };
}
