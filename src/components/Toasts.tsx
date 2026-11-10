import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProgress, type Toast } from '../ProgressContext';
import { content } from '../lib/content';

const TOAST_MS = 6000;

export default function Toasts() {
  const { toasts } = useProgress();
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.slice(-3).map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useProgress();
  const a = content.achievements.find((x) => x.id === toast.achievementId);

  useEffect(() => {
    const t = window.setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast.id, dismissToast]);

  if (!a) return null;
  return (
    <div className="toast">
      <div className="toast__body">
        <span className="eyebrow">Ачивка открыта</span>
        <strong className="toast__title">{a.title}</strong>
        <span className="muted small">
          {a.condition}
          {a.reward ? ` · награда: ${a.reward}` : ''}
        </span>
        <Link to="/achievements" className="small" onClick={() => dismissToast(toast.id)}>
          К ачивкам
        </Link>
      </div>
      <button className="toast__close" aria-label="Закрыть" onClick={() => dismissToast(toast.id)}>
        ×
      </button>
    </div>
  );
}
