import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { allTopics, content, findTopic } from '../lib/content';
import { dayKey, nextTopicId, topicsForReview } from '../lib/progress';
import { questLocked } from '../logic/daily';
import { questPassed } from '../logic/streak';
import StatusBar from '../components/StatusBar';
import RoadMap, { MAP_CURRENT_ID } from '../components/RoadMap';

const orderedIds = allTopics.map((t) => t.id);
const firstName = content.meta.learner.split(' ')[0];

function greeting(hour: number) {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function MapPage() {
  const { progress } = useProgress();
  const now = Date.now();
  const nextId = nextTopicId(progress, orderedIds);
  const next = nextId ? findTopic(nextId) : undefined;
  const review = topicsForReview(progress, orderedIds, now);
  const doneTotal = orderedIds.filter((id) => progress.topics[id]).length;

  const showOnMap = () =>
    document.getElementById(MAP_CURRENT_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <>
      <section className="hero">
        <h1>
          {greeting(new Date(now).getHours())}, {firstName}
        </h1>
        <p className="muted">
          {content.meta.goal} · пройдено {doneTotal} из {orderedIds.length} тем
        </p>
      </section>

      <StatusBar />

      <section className="quick">
        {next ? (
          <div className="card card--accent quick__card">
            <span className="eyebrow">Продолжить</span>
            <Link to={`/topic/${next.topic.id}`} className="quick__title quick__link">
              {next.topic.title}
            </Link>
            <span className="muted">
              {next.block.title} · ~{next.topic.minutes} мин
            </span>
            <div className="row quick__actions">
              <Link to={`/topic/${next.topic.id}`} className="btn btn--primary btn--small">
                Начать тему
              </Link>
              <button className="btn btn--small" onClick={showOnMap}>
                Показать на карте
              </button>
            </div>
          </div>
        ) : (
          <div className="card card--accent quick__card">
            <span className="eyebrow">Всё пройдено</span>
            <span className="quick__title">Все темы курса закрыты</span>
            <span className="muted">Самое время повторять и добивать боссов.</span>
          </div>
        )}
        <DailyCard />
        <div className="card quick__card">
          <span className="eyebrow">На повторение</span>
          {review.length === 0 ? (
            <span className="muted">Пока пусто. Темы появятся здесь через 5 дней после прохождения.</span>
          ) : (
            <ul className="review-list">
              {review.slice(0, 4).map((id) => (
                <li key={id}>
                  <Link to={`/topic/${id}`}>{findTopic(id)!.topic.title}</Link>
                </li>
              ))}
              {review.length > 4 && <li className="muted">и ещё {review.length - 4}</li>}
            </ul>
          )}
        </div>
      </section>

      <h2 className="map-heading">Карта курса</h2>
      <RoadMap review={review} />
    </>
  );
}

/** Карточка «Квест дня» на карте: сколько из трёх заданий выполнено. */
function DailyCard() {
  const { progress, now } = useProgress();
  if (questLocked(progress)) return null;
  const day = progress.days[dayKey(now)];
  const done = (questPassed(day) ? 1 : 0) + (day?.tasksDone?.length ?? 0);
  return (
    <div className={`card quick__card daily-card ${day?.chest ? 'is-done' : ''}`}>
      <span className="eyebrow">Квест дня</span>
      <span className="quick__title">{day?.chest ? 'Сундук открыт' : `Выполнено ${done} из 3`}</span>
      <div className="daily-progress__steps">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`daily-step ${i < done ? 'is-done' : ''}`} />
        ))}
      </div>
      <Link to="/daily" className={`btn btn--small ${day?.chest ? '' : 'btn--primary'}`}>
        {day?.chest ? 'Посмотреть' : 'К квесту'}
      </Link>
    </div>
  );
}
