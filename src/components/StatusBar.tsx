import { useProgress } from '../ProgressContext';
import { content } from '../lib/content';
import { currentStreak, levelInfo } from '../lib/game';
import { todayCount } from '../lib/progress';

const RANK_CLASS: Record<string, string> = {
  Железо: 'iron',
  Бронза: 'bronze',
  Серебро: 'silver',
  Золото: 'gold',
  Платина: 'platinum',
  Алмаз: 'diamond',
  Мастер: 'master',
  Грандмастер: 'grandmaster',
};

function daysWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

export default function StatusBar() {
  const { progress } = useProgress();
  const now = Date.now();
  const info = levelInfo(progress, content);
  const streak = currentStreak(progress.activeDays, now);
  const today = todayCount(progress, now);
  const goalDone = today >= progress.dailyGoal;
  const pct = Math.round((info.inLevel / info.perLevel) * 100);

  return (
    <section className="statusbar card">
      <div className="statusbar__rank">
        <span className={`rank-badge rank-badge--${RANK_CLASS[info.rank] ?? 'iron'}`}>
          {info.level}
        </span>
        <div>
          <div className="statusbar__rank-name">{info.rank}</div>
          <div className="muted small">уровень {info.level}</div>
        </div>
      </div>
      <div className="statusbar__xp">
        <div className="statusbar__xp-head">
          <span>{info.xp} XP</span>
          <span className="muted small">
            {info.inLevel}/{info.perLevel} до уровня {info.level + 1}
          </span>
        </div>
        <div className="pbar__track">
          <div className="pbar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="statusbar__facts">
        <div className="fact">
          <span className="fact__value">{streak}</span>
          <span className="fact__label">{daysWord(streak)} подряд</span>
        </div>
        <div className={`fact ${goalDone ? 'fact--done' : ''}`}>
          <span className="fact__value">
            {today}/{progress.dailyGoal}
          </span>
          <span className="fact__label">{goalDone ? 'цель дня выполнена' : 'тем сегодня'}</span>
        </div>
      </div>
    </section>
  );
}
