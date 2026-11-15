import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useProgress, type CelebrationKind } from '../ProgressContext';
import { XP } from '../lib/game';
import { daysWord } from '../lib/words';
import { confetti } from '../lib/confetti';
import { ChestIcon, FlameIcon, ShieldIcon } from './icons';

const LEAVE_MS = 280;

/**
 * Полноэкранные экраны празднования: отметка серии (3, 7, 14, 30, 50, 100), сундук дня, реванш.
 * Показываются раньше экранов ачивок (AchievementUnlock ждёт, пока их нет).
 */
export default function Celebration() {
  const { toasts } = useProgress();
  const c = toasts.find((t) => t.kind === 'celebration');
  if (!c || c.kind !== 'celebration') return null;
  return <Screen key={c.id} toastId={c.id} kind={c.celebration} streak={c.streak} />;
}

function milestoneText(n: number): string {
  if (n >= 100) return 'Сто дней. Это уже не привычка, а образ жизни.';
  if (n >= 50) return 'Полсотни дней подряд — такое мало кому удаётся.';
  if (n >= 30) return 'Целый месяц без пропусков. Знания складываются в систему.';
  if (n >= 14) return 'Две недели огня. Ритм найден — держим его.';
  if (n >= 7) return 'Неделя подряд! За неё ещё и заморозка — на случай, если день выпадет.';
  return 'Три дня подряд — серия началась. Не дай огоньку погаснуть.';
}

function content(kind: CelebrationKind, streak: number): { eyebrow: string; title: string; text: string; xp?: number; icon: ReactNode } {
  if (kind === 'chest')
    return {
      eyebrow: 'Сундук дня',
      title: 'Все задания выполнены',
      text: 'Тест и оба побочных задания — сундук открыт. Завтра будет новый квест.',
      xp: XP.chest,
      icon: <ChestIcon size={70} open />,
    };
  if (kind === 'revenge')
    return {
      eyebrow: 'Реванш удался',
      title: `Серия спасена: ${streak} ${daysWord(streak)}`,
      text: 'Вчерашний день засчитан. Огонёк снова горит.',
      xp: XP.revenge,
      icon: <ShieldIcon size={58} />,
    };
  return {
    eyebrow: 'Серия',
    title: `${streak} ${daysWord(streak)} подряд!`,
    text: milestoneText(streak),
    icon: <FlameIcon size={62} />,
  };
}

function Screen({ toastId, kind, streak }: { toastId: number; kind: CelebrationKind; streak: number }) {
  const { dismissToast } = useProgress();
  const [leaving, setLeaving] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const c = content(kind, streak);

  function close() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => dismissToast(toastId), LEAVE_MS);
  }

  useEffect(() => {
    confetti(kind === 'milestone' && streak >= 30 ? 2 : 1.3);
    btn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`unlock unlock--${kind} ${leaving ? 'unlock--leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`celebrate-${toastId}`}
      onClick={close}
    >
      <div className="unlock__card" onClick={(e) => e.stopPropagation()}>
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
            <span className="unlock__medal-icon">{c.icon}</span>
            {kind === 'milestone' && <span className="unlock__medal-badge">{streak}</span>}
            <span className="unlock__shine" />
          </span>
        </div>
        <p className="unlock__eyebrow">{c.eyebrow}</p>
        <h2 className="unlock__title" id={`celebrate-${toastId}`}>
          {c.title}
        </h2>
        <p className="unlock__cond">{c.text}</p>
        {c.xp && <p className="unlock__xp">+{c.xp} XP</p>}
        <div className="unlock__actions">
          <button ref={btn} className="btn btn--primary" onClick={close}>
            {kind === 'milestone' ? 'Так держать' : 'Ура!'}
          </button>
        </div>
      </div>
    </div>
  );
}
