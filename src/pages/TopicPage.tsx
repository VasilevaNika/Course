import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { allTopics, findTopic, type Topic } from '../lib/content';
import { DAY_MS, lastTouch, markMaterialOpened, REVIEW_MIN_DAYS, setNote } from '../lib/progress';
import Quiz from '../components/Quiz';

export default function TopicPage() {
  const { id = '' } = useParams();
  const found = findTopic(id);
  if (!found) {
    return (
      <div className="card">
        <h1>Тема не найдена</h1>
        <p>
          <Link to="/">Вернуться на карту</Link>
        </p>
      </div>
    );
  }
  // key сбрасывает локальное состояние (тест, заметки) при переходе на другую тему.
  return <TopicView key={found.topic.id} topic={found.topic} blockTitle={found.block.title} />;
}

function TopicView({ topic, blockTitle }: { topic: Topic; blockTitle: string }) {
  const { progress, update } = useProgress();
  const tp = progress.topics[topic.id];
  const idx = allTopics.findIndex((t) => t.id === topic.id);
  const prev = allTopics[idx - 1];
  const next = allTopics[idx + 1];

  let statusLine = 'Тема ещё не пройдена — нужно ответить правильно хотя бы на 2 вопроса из 3.';
  if (tp) {
    const days = Math.floor((Date.now() - lastTouch(tp)) / DAY_MS);
    const when = new Date(lastTouch(tp)).toLocaleDateString('ru-RU');
    statusLine =
      days >= REVIEW_MIN_DAYS
        ? `Пройдена ${when}, лучший результат ${tp.best}/3. Прошло ${days} дн. — пересдача засчитается как повторение.`
        : `Пройдена ${when}, лучший результат ${tp.best}/3. Повторение засчитывается через ${REVIEW_MIN_DAYS} дня после прохождения.`;
  }

  return (
    <article className="topic">
      <nav className="crumbs">
        <Link to="/">Карта</Link> <span aria-hidden>›</span> <span>{blockTitle}</span>
      </nav>
      <header className="topic__head">
        <h1>
          {topic.title}
          {topic.new && <span className="tag">новое</span>}
        </h1>
        <p className="muted">~{topic.minutes} мин</p>
        <p className={`status-line ${tp ? 'status-line--done' : ''}`}>{statusLine}</p>
      </header>

      <section className="card">
        <h2>{topic.new ? 'Что изучить' : 'Что повторить'}</h2>
        <ul className="recap">
          {topic.recap.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Материалы</h2>
        <ul className="materials">
          {topic.materials.map((m, i) => {
            const opened = progress.materialsOpened[`${topic.id}:${i}`];
            return (
              <li key={m.url}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`material ${opened ? 'material--opened' : ''}`}
                  onClick={() => update((p) => markMaterialOpened(p, topic.id, i))}
                >
                  <span className="material__type">{m.type}</span>
                  <span className="material__title">{m.title}</span>
                  <span className="material__mark">{opened ? 'открыто' : ''}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <Notes topicId={topic.id} />

      <section className="card">
        <h2>Мини-тест</h2>
        <Quiz topicId={topic.id} questions={topic.quiz} />
      </section>

      <nav className="pager">
        {prev ? (
          <Link to={`/topic/${prev.id}`} className="pager__link">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/topic/${next.id}`} className="pager__link pager__link--next">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

function Notes({ topicId }: { topicId: string }) {
  const { progress, update } = useProgress();
  const [text, setText] = useState(progress.notes[topicId] ?? '');
  const [saved, setSaved] = useState(true);
  const pending = useRef<string | null>(null);

  // Автосохранение через 600 мс после последнего ввода.
  useEffect(() => {
    if (pending.current === null) return;
    const t = window.setTimeout(() => {
      const value = pending.current;
      if (value === null) return;
      pending.current = null;
      update((p) => setNote(p, topicId, value));
      setSaved(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [text, topicId, update]);

  // Не потерять ввод при уходе со страницы раньше таймера.
  useEffect(
    () => () => {
      const value = pending.current;
      if (value !== null) update((p) => setNote(p, topicId, value));
    },
    [topicId, update],
  );

  return (
    <section className="card">
      <div className="notes__head">
        <h2>Мои заметки</h2>
        <span className="muted small">{saved ? 'сохранено' : 'сохраняю…'}</span>
      </div>
      <textarea
        className="notes"
        value={text}
        placeholder="Что важно запомнить, вопросы, ссылки…"
        onChange={(e) => {
          pending.current = e.target.value;
          setText(e.target.value);
          setSaved(false);
        }}
      />
    </section>
  );
}
