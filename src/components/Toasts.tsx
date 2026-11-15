import { useEffect } from 'react';
import { useProgress, type Toast } from '../ProgressContext';

const TOAST_MS = 6000;

/**
 * Небольшие уведомления в углу — сейчас это «цель дня выполнена».
 * Ачивки и празднования — полноэкранные (AchievementUnlock, Celebration), «+1 к серии» — StreakPop.
 */
export default function Toasts() {
  const { toasts } = useProgress();
  const visible = toasts.filter((t): t is Extract<Toast, { kind: 'goal' }> => t.kind === 'goal');
  if (!visible.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {visible.slice(-3).map((t) => (
        <GoalToast key={t.id} id={t.id} goal={t.goal} />
      ))}
    </div>
  );
}

function GoalToast({ id, goal }: { id: number; goal: number }) {
  const { dismissToast } = useProgress();

  useEffect(() => {
    const t = window.setTimeout(() => dismissToast(id), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [id, dismissToast]);

  return (
    <div className="toast toast--goal">
      <div className="toast__body">
        <span className="eyebrow">Цель дня выполнена</span>
        <strong className="toast__title">
          {goal} из {goal} — так держать!
        </strong>
        <span className="muted small">Серия продолжается. Можно на этом остановиться или взять ещё тему.</span>
      </div>
      <button className="toast__close" aria-label="Закрыть" onClick={() => dismissToast(id)}>
        ×
      </button>
    </div>
  );
}
