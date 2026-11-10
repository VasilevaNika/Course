import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Progress } from './lib/progress';
import { loadProgress, saveProgress } from './lib/storage';

type Ctx = {
  progress: Progress;
  /** Применить чистое преобразование к прогрессу; результат сразу сохраняется в localStorage. */
  update: (fn: (p: Progress) => Progress) => void;
  replace: (p: Progress) => void;
};

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(loadProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Если сайт открыт в двух вкладках — подхватываем изменения из другой.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('nika-course:progress')) setProgress(loadProgress());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => fn(p)), []);
  const replace = useCallback((p: Progress) => setProgress(p), []);

  return <ProgressCtx.Provider value={{ progress, update, replace }}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
