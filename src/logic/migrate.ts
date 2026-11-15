// Миграции формата прогресса.
import { longNotesOf, type Progress } from '../lib/progress';

/** Формат прогресса version 1: вместо days — activeDays (дата → тем пройдено за день). */
export type ProgressV1 = Omit<Progress, 'version' | 'days' | 'streak' | 'longNotes' | 'flags'> & {
  version: 1;
  activeDays: Record<string, number>;
  flags: { night?: true; early?: true; speedrun?: true };
};

/**
 * v1 → v2: activeDays превращается в подневную статистику, серия начинается без заморозок.
 * В v1 activeDays считал и новые темы, и повторения вместе — переносим всё в topics, как в спецификации.
 * longNotes заполняем по уже написанным заметкам, чтобы их правка не засчитывалась как «новая заметка».
 */
export function migrateV1toV2(v1: ProgressV1): Progress {
  const { activeDays, ...rest } = v1;
  const days: Progress['days'] = {};
  for (const [d, n] of Object.entries(activeDays ?? {})) {
    days[d] = { topics: n, reviews: 0, materials: 0, perfectQuizzes: 0, notes: 0 };
  }
  return {
    ...rest,
    version: 2,
    days,
    longNotes: longNotesOf(v1.notes ?? {}),
    streak: { freezes: 0, freezeAwards: {}, revengeUsed: {} },
  };
}
