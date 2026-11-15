import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { dayKey, todayCount, type Progress } from './lib/progress';
import { confetti } from './lib/confetti';
import { loadProgress, saveProgress } from './lib/storage';
import { applyAchievements } from './lib/game';
import { content } from './lib/content';
import { applyDaily } from './logic/daily';
import { currentStreak, isActiveDay, STREAK_MILESTONES } from './logic/streak';

export type CelebrationKind = 'milestone' | 'chest' | 'revenge';

export type Toast =
  | { id: number; kind: 'achievement'; achievementId: string }
  | { id: number; kind: 'goal'; goal: number }
  /** Короткая анимация «+1 к серии» — день только что стал активным. */
  | { id: number; kind: 'streak'; streak: number }
  /** Полноэкранный экран: отметка серии, сундук дня, реванш. */
  | { id: number; kind: 'celebration'; celebration: CelebrationKind; streak: number };

type ToastInput =
  | { kind: 'achievement'; achievementId: string }
  | { kind: 'goal'; goal: number }
  | { kind: 'streak'; streak: number }
  | { kind: 'celebration'; celebration: CelebrationKind; streak: number };

type Ctx = {
  progress: Progress;
  /** Применить чистое преобразование к прогрессу; результат сразу сохраняется в localStorage. */
  update: (fn: (p: Progress) => Progress) => void;
  /** Заменить прогресс целиком. silent — не показывать тосты за открытые при этом ачивки (импорт). */
  replace: (p: Progress, opts?: { silent?: boolean }) => void;
  toasts: Toast[];
  pushToast: (t: ToastInput) => void;
  dismissToast: (id: number) => void;
  /** Текущее время; обновляется раз в минуту, чтобы баннеры и смена дня срабатывали без перезагрузки. */
  now: number;
};

const ProgressCtx = createContext<Ctx | null>(null);

let toastSeq = 0;

/** Ежедневное обслуживание + ачивки за один шаг (на загрузке — без тостов: заморозки, уже открытые ачивки). */
function prepare(p: Progress, now = Date.now()): Progress {
  return applyAchievements(applyDaily(p, content, now), content, now).progress;
}

type DaySnapshot = { day: string; active: boolean; chest: boolean };

function snapshot(p: Progress, now: number): DaySnapshot {
  const day = dayKey(now);
  return { day, active: isActiveDay(p.days[day]), chest: Boolean(p.days[day]?.chest) };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => prepare(loadProgress()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const silent = useRef(false);
  // Сколько тем было сегодня на прошлом шаге — чтобы поймать момент выполнения дневной цели.
  const prevToday = useRef<number | null>(null);
  // Состояние дня на прошлом шаге — чтобы поймать «день стал активным» и «сундук открыт».
  const prevDay = useRef<DaySnapshot | null>(null);

  const push = useCallback((items: ToastInput[]) => {
    if (items.length) setToasts((t) => [...t, ...items.map((x) => ({ ...x, id: ++toastSeq }) as Toast)]);
  }, []);
  const pushToast = useCallback((t: ToastInput) => push([t]), [push]);

  // После каждого действия: квест дня и серия, ачивки, тосты; затем сохранение.
  useEffect(() => {
    const ts = Date.now();
    const daily = applyDaily(progress, content, ts);
    const { progress: next, unlocked } = applyAchievements(daily, content, ts);
    if (next !== progress) {
      setProgress(next);
      if (unlocked.length && !silent.current) push(unlocked.map((achievementId) => ({ kind: 'achievement' as const, achievementId })));
      return; // сохраним на следующем проходе
    }

    const quiet = silent.current;
    silent.current = false;

    const snap = snapshot(progress, ts);
    const before = prevDay.current;
    prevDay.current = snap;
    if (!quiet && before && before.day === snap.day) {
      const streak = currentStreak(progress.days, snap.day);
      const events: ToastInput[] = [];
      if (!before.active && snap.active) {
        if (STREAK_MILESTONES.includes(streak)) events.push({ kind: 'celebration', celebration: 'milestone', streak });
        else events.push({ kind: 'streak', streak });
      }
      if (!before.chest && snap.chest) events.push({ kind: 'celebration', celebration: 'chest', streak });
      push(events);
    }

    const today = todayCount(progress, ts);
    const goalBefore = prevToday.current;
    prevToday.current = today;
    if (!quiet && goalBefore !== null && goalBefore < progress.dailyGoal && today >= progress.dailyGoal) {
      push([{ kind: 'goal', goal: progress.dailyGoal }]);
      confetti(1);
    }
    saveProgress(progress);
  }, [progress, push]);

  // Раз в минуту: обновить «сейчас» и, если наступил новый день, применить заморозки и новый квест.
  useEffect(() => {
    const tick = () => {
      const ts = Date.now();
      setNow(ts);
      // Событий «+1 к серии» при смене дня не будет: снимок дня сравнивается только внутри одной даты.
      setProgress((p) => applyDaily(p, content, ts));
    };
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Если сайт открыт в двух вкладках — подхватываем изменения из другой.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('nika-course:progress')) {
        silent.current = true;
        setProgress(loadProgress());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => fn(p)), []);
  const replace = useCallback((p: Progress, opts?: { silent?: boolean }) => {
    silent.current = Boolean(opts?.silent);
    setProgress(p);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <ProgressCtx.Provider value={{ progress, update, replace, toasts, pushToast, dismissToast, now }}>
      {children}
    </ProgressCtx.Provider>
  );
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
