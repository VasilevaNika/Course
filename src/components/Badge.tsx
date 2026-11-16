import type { ReactNode } from 'react';
import { badgeUrl, type Achievement } from '../lib/content';
import { LockIcon } from './icons';

type Props = {
  achievement: Achievement;
  /** Ачивка ещё не открыта: серая иконка с замком. */
  locked?: boolean;
  /** Размер иконки в px. */
  size?: number;
  /** Показать условие под иконкой. */
  showCondition?: boolean;
  /** Анимация переворота медали (экран открытия). */
  flip?: boolean;
  /** Подпись над условием (например, заголовок карточки). */
  title?: ReactNode;
  className?: string;
};

/** Иконка ачивки из public/badges/achievement-icons/<id>.svg. */
export default function Badge({ achievement: a, locked = false, size = 64, showCondition = false, flip = false, title, className = '' }: Props) {
  return (
    <figure className={`badge-icon badge-icon--${a.rarity} ${locked ? 'is-locked' : ''} ${className}`}>
      <span className={`badge-icon__frame ${flip ? 'badge-icon__frame--flip' : ''}`} style={{ width: size, height: size }}>
        <img src={badgeUrl(a.id)} alt={a.title} width={size} height={size} loading="lazy" decoding="async" />
        {locked && (
          <span className="badge-icon__lock" title="Ещё не открыта">
            <LockIcon size={Math.max(12, Math.round(size * 0.2))} />
          </span>
        )}
      </span>
      {(showCondition || title) && (
        <figcaption className="badge-icon__caption">
          {title}
          {showCondition && <span className="badge-icon__cond">{a.condition}</span>}
          {locked && <span className="sr-only"> · ещё не открыта</span>}
        </figcaption>
      )}
    </figure>
  );
}
