import { Link, useNavigate } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content } from '../lib/content';
import { claimReward, rewardStatus, XP } from '../lib/game';

const fmt = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export default function AchievementsPage() {
  const { progress, update } = useProgress();
  const navigate = useNavigate();
  const opened = content.achievements.filter((a) => progress.achievements[a.id]).length;

  return (
    <>
      <h1>Ачивки</h1>
      <p className="muted">
        Открыто {opened} из {content.achievements.length}. Каждая ачивка даёт +{XP.achievement} XP, а некоторые — реальную
        награду: нажми «Забрать» и покажи купон.
      </p>
      <ul className="ach-grid">
        {content.achievements.map((a) => {
          const at = progress.achievements[a.id];
          const status = rewardStatus(progress, a.id, a.reward);
          return (
            <li key={a.id} className={`card ach ${at ? 'ach--open' : 'ach--locked'}`}>
              <div className="ach__icon" aria-hidden>
                {a.title.slice(0, 1)}
              </div>
              <h2 className="ach__title">{a.title}</h2>
              <p className="ach__cond muted small">{a.condition}</p>
              {at && <p className="small ach__date">открыта {fmt(at)}</p>}
              {a.reward && (
                <div className="ach__reward">
                  <span className="small">
                    <span className="muted">Награда:</span> {a.reward}
                  </span>
                  {status === 'available' && (
                    <button
                      className="btn btn--primary btn--small"
                      onClick={() => {
                        update((p) => claimReward(p, a.id));
                        navigate(`/coupon/${a.id}`);
                      }}
                    >
                      Забрать
                    </button>
                  )}
                  {status === 'requested' && (
                    <Link to={`/coupon/${a.id}`} className="btn btn--small">
                      Запрошена · купон
                    </Link>
                  )}
                  {status === 'issued' && (
                    <span className="pill pill--ok">выдана {fmt(progress.rewards[a.id].issuedAt!)}</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
