import { useEffect } from 'react';
import { useProgress } from '../ProgressContext';
import { daysWord } from '../lib/words';
import { FlameIcon } from './icons';

const POP_MS = 2600;

/** Короткая анимация «+1 к серии» под шапкой, когда день стал активным. */
export default function StreakPop() {
  const { toasts, dismissToast } = useProgress();
  const pop = toasts.find((t) => t.kind === 'streak');

  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => dismissToast(pop.id), POP_MS);
    return () => window.clearTimeout(t);
  }, [pop, dismissToast]);

  if (!pop || pop.kind !== 'streak') return null;
  return (
    <div className="streak-pop" role="status" key={pop.id}>
      <FlameIcon size={26} className="streak-pop__flame" />
      <span>
        <strong>+1 к серии</strong>
        <span className="streak-pop__sub">
          {pop.streak} {daysWord(pop.streak)} подряд
        </span>
      </span>
    </div>
  );
}
