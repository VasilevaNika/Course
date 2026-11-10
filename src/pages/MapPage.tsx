import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { allTopics, content, findTopic, kindLabel, type Topic } from '../lib/content';
import { nextTopicId, topicsForReview, type Progress } from '../lib/progress';
import ProgressBar from '../components/ProgressBar';
import StatusBar from '../components/StatusBar';

const orderedIds = allTopics.map((t) => t.id);

export default function MapPage() {
  const { progress } = useProgress();
  const now = Date.now();
  const nextId = nextTopicId(progress, orderedIds);
  const next = nextId ? findTopic(nextId) : undefined;
  const review = topicsForReview(progress, orderedIds, now);
  const doneTotal = orderedIds.filter((id) => progress.topics[id]).length;

  return (
    <>
      <StatusBar />

      <section className="hero">
        <h1>{content.meta.title}</h1>
        <p className="muted">
          {content.meta.goal} · пройдено {doneTotal} из {orderedIds.length} тем
        </p>
      </section>

      <section className="quick">
        {next ? (
          <Link to={`/topic/${next.topic.id}`} className="card card--accent quick__card">
            <span className="eyebrow">Продолжить</span>
            <span className="quick__title">{next.topic.title}</span>
            <span className="muted">
              {next.block.title} · ~{next.topic.minutes} мин
            </span>
          </Link>
        ) : (
          <div className="card card--accent quick__card">
            <span className="eyebrow">Всё пройдено</span>
            <span className="quick__title">Все темы курса закрыты</span>
            <span className="muted">Самое время повторять и готовиться к собесу.</span>
          </div>
        )}
        <div className="card quick__card">
          <span className="eyebrow">На повторение</span>
          {review.length === 0 ? (
            <span className="muted">
              Пока пусто. Темы появятся здесь через 5 дней после прохождения.
            </span>
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

      <ol className="blocks">
        {content.blocks.map((block, i) => {
          const done = block.topics.filter((t) => progress.topics[t.id]).length;
          return (
            <li key={block.id} className="card block" id={`block-${block.id}`}>
              <div className="block__head">
                <span className="block__num">{i + 1}</span>
                <div className="block__titles">
                  <h2>{block.title}</h2>
                  <span className={`badge badge--${block.kind}`}>{kindLabel[block.kind]}</span>
                </div>
              </div>
              <p className="muted">{block.description}</p>
              <ProgressBar value={done} max={block.topics.length} />
              <ul className="topics">
                {block.topics.map((t) => (
                  <TopicRow key={t.id} topic={t} progress={progress} reviewDue={review.includes(t.id)} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function TopicRow({ topic, progress, reviewDue }: { topic: Topic; progress: Progress; reviewDue: boolean }) {
  const tp = progress.topics[topic.id];
  const status = !tp ? 'todo' : reviewDue ? 'review' : 'done';
  const statusText = { todo: 'не пройдена', review: 'пора повторить', done: `пройдена · ${tp?.best}/3` }[status];
  return (
    <li>
      <Link to={`/topic/${topic.id}`} className={`topic-row topic-row--${status}`}>
        <span className="topic-row__dot" aria-hidden />
        <span className="topic-row__title">
          {topic.title}
          {topic.new && <span className="tag">новое</span>}
        </span>
        <span className="topic-row__status">{statusText}</span>
      </Link>
    </li>
  );
}
