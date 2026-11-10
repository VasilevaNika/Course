import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content, type Exam } from '../lib/content';
import {
  buildExam,
  formatTime,
  missingRequirements,
  recordExam,
  recordOpenAnswers,
  type ExamOutcome,
  type ExamSet,
  type SelfRating,
} from '../lib/exam';
import { computeXp } from '../lib/game';

export default function ExamRunPage() {
  const { id = '' } = useParams();
  const { progress } = useProgress();
  const exam = content.exams.find((e) => e.id === id);

  if (!exam) {
    return (
      <div className="card">
        <h1>Такого босса нет</h1>
        <Link to="/exam">К списку боссов</Link>
      </div>
    );
  }
  const missing = missingRequirements(progress, exam);
  if (missing.length) {
    return (
      <div className="card">
        <h1>{exam.title}</h1>
        <p>Этот босс пока закрыт — сначала победи остальных.</p>
        <Link to="/exam">К списку боссов</Link>
      </div>
    );
  }
  return <ExamRun key={exam.id} exam={exam} />;
}

type Phase = 'intro' | 'mcq' | 'result' | 'open' | 'done';

const RATING_LABEL: Record<SelfRating, string> = { good: 'знала', partial: 'частично', bad: 'не знала' };

function ExamRun({ exam }: { exam: Exam }) {
  const { progress, replace, update } = useProgress();
  const [set, setSet] = useState<ExamSet>(() => buildExam(content, exam));
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [outcome, setOutcome] = useState<ExamOutcome | null>(null);
  const [xpGain, setXpGain] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<SelfRating[]>([]);

  // Предупредить о потере попытки при закрытии вкладки посреди боя.
  useEffect(() => {
    if (phase !== 'mcq' && phase !== 'open') return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [phase]);

  function start() {
    setSet(buildExam(content, exam));
    setAnswers(Array(exam.mcq).fill(null));
    setIndex(0);
    setOutcome(null);
    setRatings([]);
    setRevealed(false);
    setStartedAt(Date.now());
    setPhase('mcq');
    window.scrollTo(0, 0);
  }

  function finishMcq(final: (number | null)[]) {
    const timeSec = Math.round((Date.now() - startedAt) / 1000);
    const correct = final.filter((a, i) => a !== null && set.mcq[i].options[a].correct).length;
    const r = recordExam(progress, exam, correct, timeSec);
    setXpGain(computeXp(r.progress, content) - computeXp(progress, content));
    replace(r.progress);
    setOutcome(r.outcome);
    setPhase('result');
    window.scrollTo(0, 0);
  }

  function rate(r: SelfRating) {
    update((p) => recordOpenAnswers(p, [r]));
    setRatings((x) => [...x, r]);
    setRevealed(false);
    if (index + 1 < set.open.length) setIndex(index + 1);
    else setPhase('done');
  }

  if (phase === 'intro') {
    return (
      <div className="card exam-intro">
        <span className="eyebrow">Босс</span>
        <h1>{exam.title}</h1>
        <ol className="recap">
          <li>
            {exam.mcq} тестовых вопросов из блоков:{' '}
            {exam.blocks.map((b) => content.blocks.find((x) => x.id === b)?.title).join(', ')}. Время идёт.
          </li>
          <li>Нужно ответить правильно минимум на {Math.ceil(exam.pass * exam.mcq - 1e-9)} из {exam.mcq} ({Math.round(exam.pass * 100)}%).</li>
          <li>
            Затем {exam.open} открытых вопроса — ответь вслух или письменно, открой эталон и честно оцени себя.
          </li>
        </ol>
        <p className="muted small">Сдать тестовую часть быстрее 8 минут — отдельная ачивка.</p>
        <div className="row">
          <button className="btn btn--primary" onClick={start}>
            Начать
          </button>
          <Link to="/exam" className="btn">
            Назад
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'mcq') {
    const q = set.mcq[index];
    const chosen = answers[index];
    const last = index === set.mcq.length - 1;
    return (
      <div className="exam">
        <div className="exam__bar">
          <span>
            Вопрос {index + 1} из {set.mcq.length}
          </span>
          <Timer startedAt={startedAt} />
        </div>
        <div className="pbar__track exam__progress">
          <div className="pbar__fill" style={{ width: `${(index / set.mcq.length) * 100}%` }} />
        </div>
        <fieldset className="card question" key={index}>
          <legend className="sr-only">Вопрос {index + 1}</legend>
          <p className="muted small exam__topic">{q.topicTitle}</p>
          <p className="exam__q">{q.q}</p>
          <div className="options">
            {q.options.map((opt, oi) => (
              <label key={oi} className={`option ${chosen === oi ? 'option--chosen' : ''}`}>
                <input
                  type="radio"
                  name={`exam-q${index}`}
                  checked={chosen === oi}
                  onChange={() => setAnswers((a) => a.map((v, i) => (i === index ? oi : v)))}
                />
                <span>{opt.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row exam__nav">
          <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Назад
          </button>
          {last ? (
            <button
              className="btn btn--primary"
              disabled={chosen === null}
              onClick={() => {
                const left = answers.filter((a) => a === null).length;
                if (left && !window.confirm(`Без ответа осталось вопросов: ${left}. Завершить тест?`)) return;
                finishMcq(answers);
              }}
            >
              Завершить тест
            </button>
          ) : (
            <button className="btn btn--primary" disabled={chosen === null} onClick={() => setIndex(index + 1)}>
              Дальше
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'result' && outcome) {
    return (
      <div className="exam">
        <div className={`card result ${outcome.passed ? 'result--ok' : 'result--bad'}`}>
          <span className="eyebrow">{outcome.passed ? 'Босс повержен' : 'Босс устоял'}</span>
          <p className="result__score">
            {outcome.correct} из {outcome.total} · {Math.round(outcome.ratio * 100)}%
          </p>
          <p>
            Время: {formatTime(outcome.timeSec)}
            {outcome.speedrun && ' — спидран!'}
          </p>
          {xpGain > 0 && <p className="xp-gain">+{xpGain} XP</p>}
          {!outcome.passed && <p>Нужно {Math.round(exam.pass * 100)}%. Разбери ошибки ниже и возвращайся.</p>}
          <button className="btn btn--primary" onClick={() => { setIndex(0); setPhase('open'); window.scrollTo(0, 0); }}>
            К открытым вопросам
          </button>
        </div>

        <h2>Разбор</h2>
        <ol className="review">
          {set.mcq.map((q, i) => {
            const a = answers[i];
            const ok = a !== null && q.options[a].correct;
            return (
              <li key={i} className={`card review__item ${ok ? 'review__item--ok' : 'review__item--bad'}`}>
                <p className="muted small">{q.topicTitle}</p>
                <p className="exam__q">{q.q}</p>
                {!ok && (
                  <p className="small">
                    Твой ответ: <span className="wrong">{a === null ? 'нет ответа' : q.options[a].text}</span>
                  </p>
                )}
                <p className="small">
                  Правильно: <strong>{q.options.find((o) => o.correct)!.text}</strong>
                </p>
                <p className={`explain ${ok ? 'explain--ok' : 'explain--bad'}`}>{q.explain}</p>
                <Link to={`/topic/${q.topicId}`} className="small">
                  Открыть тему
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (phase === 'open') {
    const q = set.open[index];
    return (
      <div className="exam">
        <div className="exam__bar">
          <span>
            Открытый вопрос {index + 1} из {set.open.length}
          </span>
          <span className="muted small">{content.blocks.find((b) => b.id === q.block)?.title}</span>
        </div>
        <div className="card" key={index}>
          <p className="exam__q">{q.q}</p>
          <p className="muted small">Ответь вслух, как на собеседовании, или набросай тезисы. Потом сверься с эталоном.</p>
          <textarea className="notes" placeholder="Тезисы ответа (не сохраняются)" />
          {!revealed ? (
            <button className="btn btn--primary" onClick={() => setRevealed(true)}>
              Показать эталон
            </button>
          ) : (
            <>
              <h3 className="exam__key-title">Что должно быть в ответе</h3>
              <ul className="recap">
                {q.key.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
              <p className="small muted">Как ты ответила?</p>
              <div className="row rate">
                {(['good', 'partial', 'bad'] as SelfRating[]).map((r) => (
                  <button key={r} className={`btn rate--${r}`} onClick={() => rate(r)}>
                    {RATING_LABEL[r]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // done
  const st = progress.exams[exam.id];
  return (
    <div className="card exam-intro">
      <span className="eyebrow">Собеседование окончено</span>
      <h1>{exam.title}</h1>
      {outcome && (
        <p>
          Тест: {outcome.correct}/{outcome.total} ({Math.round(outcome.ratio * 100)}%) —{' '}
          {outcome.passed ? 'сдано' : 'не сдано'}, время {formatTime(outcome.timeSec)}.
        </p>
      )}
      <p>
        Открытые вопросы:{' '}
        {(['good', 'partial', 'bad'] as SelfRating[])
          .map((r) => `${RATING_LABEL[r]} — ${ratings.filter((x) => x === r).length}`)
          .join(', ')}
        .
      </p>
      {st && (
        <p className="muted small">
          Всего попыток: {st.attempts}, лучший результат {Math.round(st.best * 100)}%.
        </p>
      )}
      <div className="row">
        <button className="btn btn--primary" onClick={start}>
          Ещё попытка
        </button>
        <Link to="/exam" className="btn">
          К боссам
        </Link>
      </div>
    </div>
  );
}

function Timer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="timer" aria-label="Прошло времени">
      {formatTime((now - startedAt) / 1000)}
    </span>
  );
}
