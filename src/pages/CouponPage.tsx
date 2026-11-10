import { Link, useParams } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content } from '../lib/content';
import { markRewardIssued } from '../lib/game';

const fmt = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Экран-купон: Ника показывает его мужу. Честная система, без сервера. */
export default function CouponPage() {
  const { id = '' } = useParams();
  const { progress, update } = useProgress();
  const a = content.achievements.find((x) => x.id === id);
  const reward = progress.rewards[id];

  if (!a || !reward) {
    return (
      <div className="card">
        <h1>Купона нет</h1>
        <p>
          Сначала открой ачивку и нажми «Забрать». <Link to="/achievements">К ачивкам</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="coupon-wrap">
      <div className={`coupon ${reward.issuedAt ? 'coupon--issued' : ''}`}>
        <span className="eyebrow">Купон на награду</span>
        <p className="coupon__reward">{a.reward}</p>
        <p className="coupon__for">
          за ачивку <strong>«{a.title}»</strong>
          <br />
          <span className="muted">{a.condition}</span>
        </p>
        <dl className="coupon__meta">
          <dt>Владелица</dt>
          <dd>{content.meta.learner}</dd>
          <dt>Ачивка открыта</dt>
          <dd>{fmt(progress.achievements[id])}</dd>
          <dt>Награда запрошена</dt>
          <dd>{fmt(reward.claimedAt)}</dd>
          {reward.issuedAt && (
            <>
              <dt>Выдана</dt>
              <dd>{fmt(reward.issuedAt)}</dd>
            </>
          )}
        </dl>
        {reward.issuedAt ? (
          <p className="coupon__stamp">Выдано</p>
        ) : (
          <button
            className="btn"
            onClick={() => {
              if (window.confirm('Награда уже получена? Купон будет погашен.')) update((p) => markRewardIssued(p, id));
            }}
          >
            Награда получена — погасить купон
          </button>
        )}
      </div>
      <p>
        <Link to="/achievements">← К ачивкам</Link>
      </p>
    </div>
  );
}
