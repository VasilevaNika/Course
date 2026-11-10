import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Progress } from './lib/progress';
import { loadProgress, saveProgress } from './lib/storage';
import { applyAchievements } from './lib/game';
import { content } from './lib/content';

export type Toast = { id: number; achievementId: string };

type Ctx = {
  progress: Progress;
  /** Применить чистое преобразование к прогрессу; результат сразу сохраняется в localStorage. */
  update: (fn: (p: Progress) => Progress) => void;
  /** Заменить прогресс целиком. silent — не показывать тосты за открытые при этом ачивки (импорт). */
  replace: (p: Progress, opts?: { silent?: boolean }) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
};

const ProgressCtx = createContext<Ctx | null>(null);

let toastSeq = 0;

export function ProgressProvider({ children }: { children: ReactNode }) {
  // Уже открытые на старте ачивки (например, после обновления правил) записываем без тостов.
  const [progress, setProgress] = useState<Progress>(() => applyAchievements(loadProgress(), content).progress);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const silent = useRef(false);

  // После каждого действия: проверить ачивки, записать новые и показать тост.
  useEffect(() => {
    const { progress: next, unlocked } = applyAchievements(progress, content);
    if (next !== progress) {
      setProgress(next);
      if (unlocked.length && !silent.current) {
        setToasts((t) => [...t, ...unlocked.map((achievementId) => ({ id: ++toastSeq, achievementId }))]);
      }
      return; // сохраним на следующем проходе, уже с ачивками
    }
    silent.current = false;
    saveProgress(progress);
  }, [progress]);

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
    <ProgressCtx.Provider value={{ progress, update, replace, toasts, dismissToast }}>{children}</ProgressCtx.Provider>
  );
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
