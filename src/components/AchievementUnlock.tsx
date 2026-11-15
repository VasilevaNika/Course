import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content } from '../lib/content';
import { claimReward, XP } from '../lib/game';
import { confetti } from '../lib/confetti';

/** Сколько оверлей висит сам, если с ним не взаимодействуют. */
const AUTO_CLOSE_MS = 6500;
/** Длительность анимации ухода (совпадает с CSS). */
const LEAVE_MS = 280;

/**
 * Игровой экран «Ачивка открыта»: медаль вылетает с лучами и кольцами, текст выезжает по очереди.
 * Если открылось несколько ачивок сразу, они показываются по одной.
 */
export default function AchievementUnlock() {
  const { toasts } = useProgress();
  // Сначала экраны празднования серии/сундука, потом ачивки — по одному полноэкранному за раз.
  if (toasts.some((t) => t.kind === 'celebration')) return null;
  const current = toasts.find((t) => t.kind === 'achievement');
  if (!current || current.kind !== 'achievement') return null;
  const queued = toasts.filter((t) => t.kind === 'achievement').length - 1;
  // key — чтобы каждая следующая ачивка проигрывала анимацию с начала.
  return <Unlock key={current.id} toastId={current.id} achievementId={current.achievementId} queued={queued} />;
}

function Unlock({ toastId, achievementId, queued }: { toastId: number; achievementId: string; queued: number }) {
  const { dismissToast, update } = useProgress();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const a = content.achievements.find((x) => x.id === achievementId);

  function close(after?: () => void) {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      dismissToast(toastId);
      after?.();
    }, LEAVE_MS);
  }

  useEffect(() => {
    confetti(1.4);
    closeBtn.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => close(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!a) dismissToast(toastId);
  }, [a, toastId, dismissToast]);

  if (!a) return null;

  return (
    <div
      className={`unlock ${leaving ? 'unlock--leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`unlock-title-${toastId}`}
      onClick={() => close()}
    >
      <div
        className="unlock__card"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setPaused(true)}
        onTouchStart={() => setPaused(true)}
        onKeyDown={() => setPaused(true)}
      >
        <div className="unlock__stage" aria-hidden>
          <span className="unlock__rays" />
          <span className="unlock__ring unlock__ring--1" />
          <span className="unlock__ring unlock__ring--2" />
          <span className="unlock__sparks">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
          <span className="unlock__medal">
            <span className="unlock__medal-letter">{a.title.slice(0, 1)}</span>
            <span className="unlock__shine" />
          </span>
        </div>

        <p className="unlock__eyebrow">Ачивка открыта</p>
        <h2 className="unlock__title" id={`unlock-title-${toastId}`}>
          {a.title}
        </h2>
        <p className="unlock__cond">{a.condition}</p>
        <p className="unlock__xp">+{XP.achievement} XP</p>
        {a.reward && (
          <p className="unlock__reward">
            <span>Награда</span> {a.reward}
          </p>
        )}

        <div className="unlock__actions">
          {a.reward ? (
            <button
              className="btn btn--primary"
              onClick={() =>
                close(() => {
                  update((p) => claimReward(p, a.id));
                  navigate(`/coupon/${a.id}`);
                })
              }
            >
              Забрать награду
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => close(() => navigate('/achievements'))}>
              К ачивкам
            </button>
          )}
          <button ref={closeBtn} className="btn" onClick={() => close()}>
            {queued > 0 ? `Дальше (ещё ${queued})` : 'Круто!'}
          </button>
        </div>
      </div>
    </div>
  );
}
