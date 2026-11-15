import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { dayKey } from '../lib/progress';
import { daysWord } from '../lib/words';
import { parseDay, shiftDay, weekdayMon } from '../logic/dates';
import { currentStreak, dayMark, isActiveDay, MAX_FREEZES, type DayMark } from '../logic/streak';
import { FlameIcon, SnowIcon } from './icons';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MARK_TITLE: Record<DayMark, string> = {
  active: 'активный день',
  frozen: 'заморожен',
  missed: 'пропущен',
  today: 'сегодня',
  future: '',
  none: '',
};

/** Огонёк серии в шапке; по клику — панель с неделей, заморозками и календарём месяца. */
export default function StreakFlame() {
  const { progress, now } = useProgress();
  const today = dayKey(now);
  const streak = currentStreak(progress.days, today);
  const lit = isActiveDay(progress.days[today]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="flame" ref={box}>
      <button
        className={`flame__btn ${lit ? 'is-lit' : ''}`}
        aria-expanded={open}
        aria-label={`Серия ${streak} ${daysWord(streak)}${lit ? '' : ', сегодня ещё не активна'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <FlameIcon size={20} className="flame__icon" />
        <span className="flame__num">{streak}</span>
      </button>
      {open && <StreakPanel today={today} onNavigate={() => setOpen(false)} />}
    </div>
  );
}

function StreakPanel({ today, onNavigate }: { today: string; onNavigate: () => void }) {
  const { progress } = useProgress();
  const streak = currentStreak(progress.days, today);
  const lit = isActiveDay(progress.days[today]);
  const monday = shiftDay(today, -weekdayMon(today));
  const week = WEEK.map((label, i) => ({ label, key: shiftDay(monday, i) }));

  return (
    <div className="flame-panel" role="dialog" aria-label="Серия">
      <div className="flame-panel__head">
        <FlameIcon size={30} className={streak > 0 ? 'flame-on' : 'flame-off'} />
        <div>
          <strong className="flame-panel__count">
            {streak} {daysWord(streak)}
          </strong>
          <span className="muted small">{lit ? 'Сегодня засчитан' : 'Пройди тему или ежедневный тест, чтобы засчитать сегодня'}</span>
        </div>
      </div>

      <ol className="week">
        {week.map(({ label, key }) => {
          const mark = dayMark(progress.days, key, today);
          return (
            <li key={key} className={`week__day week__day--${mark}`} title={MARK_TITLE[mark]}>
              <span className="week__label">{label}</span>
              <span className="week__dot">
                {mark === 'active' && <FlameIcon size={14} />}
                {mark === 'frozen' && <SnowIcon size={13} />}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flame-panel__stats">
        <span>
          <SnowIcon size={14} className="snow" /> Заморозки: <strong>{progress.streak.freezes} из {MAX_FREEZES}</strong>
        </span>
        <span>
          Лучшая серия: <strong>{progress.bestStreak}</strong>
        </span>
      </div>

      <MonthCalendar today={today} />

      <Link to="/daily" className="btn btn--primary btn--small flame-panel__cta" onClick={onNavigate}>
        К ежедневному квесту
      </Link>
    </div>
  );
}

function MonthCalendar({ today }: { today: string }) {
  const { progress } = useProgress();
  const [offset, setOffset] = useState(0);
  const base = parseDay(today);
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12);
  const firstKey = dayKey(first.getTime());
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = weekdayMon(firstKey);
  const title = first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="month">
      <div className="month__head">
        <button className="month__nav" aria-label="Предыдущий месяц" onClick={() => setOffset((o) => o - 1)}>
          ‹
        </button>
        <span className="month__title">{title}</span>
        <button className="month__nav" aria-label="Следующий месяц" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}>
          ›
        </button>
      </div>
      <div className="month__grid">
        {WEEK.map((w) => (
          <span key={w} className="month__wd">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = shiftDay(firstKey, i);
          const mark = dayMark(progress.days, key, today);
          return (
            <span key={key} className={`month__day month__day--${mark}`} title={MARK_TITLE[mark]}>
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="month__legend small muted">
        <span><i className="legend legend--active" /> активен</span>
        <span><i className="legend legend--frozen" /> заморожен</span>
        <span><i className="legend legend--missed" /> пропущен</span>
      </div>
    </div>
  );
}
