import { Link, useLocation } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { dayKey } from '../lib/progress';
import { daysWord } from '../lib/words';
import { currentStreak, isActiveDay } from '../logic/streak';
import { FlameIcon } from './icons';

/** С 20:00 баннер «серия под угрозой», если сегодня ещё не активен. Push-уведомлений нет — только это. */
export const THREAT_HOUR = 20;

export default function StreakBanner() {
  const { progress, now } = useProgress();
  const { pathname } = useLocation();
  const today = dayKey(now);
  const streak = currentStreak(progress.days, today);
  if (new Date(now).getHours() < THREAT_HOUR || streak === 0 || isActiveDay(progress.days[today])) return null;

  return (
    <div className="streak-banner" role="status">
      <div className="container streak-banner__inner">
        <FlameIcon size={20} className="streak-banner__icon" />
        <span>
          <strong>Серия под угрозой: остался 1 квест.</strong>{' '}
          <span className="streak-banner__sub">
            {streak} {daysWord(streak)} подряд — пройди тему или ежедневный тест до полуночи.
          </span>
        </span>
        {pathname !== '/daily' && (
          <Link to="/daily" className="btn btn--small streak-banner__btn">
            К квесту
          </Link>
        )}
      </div>
    </div>
  );
}
