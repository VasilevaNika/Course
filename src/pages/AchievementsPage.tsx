import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import Badge from '../components/Badge';
import { content, RARITIES, RARITY_LABEL, type Rarity } from '../lib/content';
import { claimReward, rewardStatus, XP } from '../lib/game';

const fmt = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

type Filter = 'all' | Rarity;

export default function AchievementsPage() {
  const { progress, update } = useProgress();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const all = content.achievements;
  const isOpen = (id: string) => Boolean(progress.achievements[id]);
  const opened = all.filter((a) => isOpen(a.id)).length;

  // Сначала открытые, потом закрытые; внутри — по редкости (бронза → легендарная), затем порядок из JSON.
  const list = useMemo(() => {
    const order = new Map(all.map((a, i) => [a.id, i]));
    return all
      .filter((a) => filter === 'all' || a.rarity === filter)
      .sort(
        (a, b) =>
          Number(isOpen(b.id)) - Number(isOpen(a.id)) ||
          RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
          order.get(a.id)! - order.get(b.id)!,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, progress.achievements]);

  const count = (r: Filter) => {
    const items = all.filter((a) => r === 'all' || a.rarity === r);
    return `${items.filter((a) => isOpen(a.id)).length}/${items.length}`;
  };

  return (
    <>
      <h1>Ачивки</h1>
      <p className="ach-counter">
        Открыто <strong>{opened}</strong> из {all.length}
      </p>
      <p className="muted">
        Каждая ачивка даёт +{XP.achievement} XP, а некоторые — реальную награду: нажми «Забрать» и покажи купон.
      </p>

      <div className="rarity-filter" role="group" aria-label="Фильтр по редкости">
        {(['all', ...RARITIES] as Filter[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`rarity-chip ${r !== 'all' ? `rarity-chip--${r}` : ''} ${filter === r ? 'is-active' : ''}`}
            aria-pressed={filter === r}
            onClick={() => setFilter(r)}
          >
            {r === 'all' ? 'Все' : RARITY_LABEL[r]} <span className="rarity-chip__count">{count(r)}</span>
          </button>
        ))}
      </div>

      <ul className="ach-grid">
        {list.map((a) => {
          const at = progress.achievements[a.id];
          const status = rewardStatus(progress, a.id, a.reward);
          return (
            <li key={a.id} className={`card ach ach--${a.rarity} ${at ? 'ach--open' : 'ach--locked'}`}>
              <span className={`rarity-tag rarity-tag--${a.rarity}`}>{RARITY_LABEL[a.rarity]}</span>
              <Badge
                achievement={a}
                locked={!at}
                size={72}
                showCondition
                title={<h2 className="ach__title">{a.title}</h2>}
                className="ach__badge"
              />
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
      {list.length === 0 && <p className="muted">Ачивок такой редкости нет.</p>}
    </>
  );
}
