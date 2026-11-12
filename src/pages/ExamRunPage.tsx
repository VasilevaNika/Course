import { useEffect, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content, type Exam } from '../lib/content';
import {
  buildExam,
  formatTime,
  missingRequirements,
  recordExam,
  recordExamFinish,
  recordOpenAnswers,
  SPEEDRUN_SEC,
  type ExamOutcome,
  type ExamSet,
  type SelfRating,
} from '../lib/exam';
import { clearRun, loadRun, saveRun, type RunPhase } from '../lib/examRun';
import { computeXp } from '../lib/game';
import { confetti } from '../lib/confetti';

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
  if (missingRequirements(progress, exam).length) {
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

type Phase = 'intro' | RunPhase | 'done';

const RATING_LABEL: Record<SelfRating, string> = { good: 'знала', partial: 'частично', bad: 'не знала' };

function ExamRun({ exam }: { exam: Exam }) {
  const { progress, replace, update } = useProgress();
  // Незаконченный бой этого босса продолжается с того же места.
  const [saved] = useState(() => loadRun(exam.id));
  const [set, setSet] = useState<ExamSet>(() => saved?.set ?? buildExam(content, exam));
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? 'intro');
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [answers, setAnswers] = useState<(number | null)[]>(saved?.answers ?? []);
  const [startedAt, setStartedAt] = useState(saved?.startedAt ?? 0);
  const [outcome, setOutcome] = useState<ExamOutcome | null>(saved?.outcome ?? null);
  const [xpGain, setXpGain] = useState(saved?.xpGain ?? 0);
  const [ratings, setRatings] = useState<SelfRating[]>(saved?.ratings ?? []);
  const [revealed, setRevealed] = useState(false);
  const [totalSec, setTotalSec] = useState(0);
  const [speedrun, setSpeedrun] = useState(false);

  const active = phase === 'mcq' || phase === 'result' || phase === 'open';

  // Сохраняем бой после каждого шага.
  useEffect(() => {
    if (phase === 'mcq' || phase === 'result' || phase === 'open') {
      saveRun({ v: 1, examId: exam.id, set, phase, index, answers, startedAt, outcome, ratings, xpGain });
    }
  }, [exam.id, set, phase, index, answers, startedAt, outcome, ratings, xpGain]);

  // Уход по меню посреди боя — спросить. Бой сохранён, так что это не потеря, а пауза.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Выйти из боя? Он сохранится — вернёшься и продолжишь с этого места. Таймер при этом идёт.')) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  // Закрытие вкладки посреди боя.
  useEffect(() => {
    if (!active) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [active]);

  function start() {
    setSet(buildExam(content, exam));
    setAnswers(Array(exam.mcq).fill(null));
    setIndex(0);
    setOutcome(null);
    setXpGain(0);
    setRatings([]);
    setRevealed(false);
    setSpeedrun(false);
    setStartedAt(Date.now());
    setPhase('mcq');
    window.scrollTo(0, 0);
  }

  function finishMcq() {
    const correct = answers.filter((a, i) => a !== null && set.mcq[i].options[a].correct).length;
    const r = recordExam(progress, exam, correct);
    setXpGain(computeXp(r.progress, content) - computeXp(progress, content));
    replace(r.progress);
    setOutcome(r.outcome);
    setPhase('result');
    window.scrollTo(0, 0);
    if (r.outcome.passed) confetti(2);
  }

  function rate(r: SelfRating) {
    update((p) => recordOpenAnswers(p, [r]));
    const nextRatings = [...ratings, r];
    setRatings(nextRatings);
    setRevealed(false);
    if (index + 1 < set.open.length) {
      setIndex(index + 1);
      return;
    }
    // Конец боя: время считается целиком — тест и открытые вопросы.
    const sec = Math.round((Date.now() - startedAt) / 1000);
    setTotalSec(sec);
    const fin = recordExamFinish(progress, exam, Boolean(outcome?.passed), sec);
    if (fin.progress !== progress) update((p) => recordExamFinish(p, exam, Boolean(outcome?.passed), sec).progress);
    setSpeedrun(fin.speedrun);
    clearRun();
    setPhase('done');
    window.scrollTo(0, 0);
  }

  function abandon() {
    if (!window.confirm('Бросить бой? Результат тестовой части, если она пройдена, уже сохранён.')) return;
    clearRun();
    setPhase('intro');
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
          <li>
            Нужно ответить правильно минимум на {Math.ceil(exam.pass * exam.mcq - 1e-9)} из {exam.mcq} (
            {Math.round(exam.pass * 100)}%).
          </li>
          <li>Затем {exam.open} открытых вопроса — ответь вслух или письменно, открой эталон и честно оцени себя.</li>
        </ol>
        <p className="muted small">
          Пройти весь бой быстрее {SPEEDRUN_SEC / 60} минут — отдельная ачивка. Если придётся отвлечься, бой сохранится.
        </p>
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
        <fieldset className="card question slide-in" key={index}>
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
                finishMcq();
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
        <button className="link-btn small" onClick={abandon}>
          Бросить бой
        </button>
      </div>
    );
  }

  if (phase === 'result' && outcome) {
    return (
      <div className="exam">
        <div className={`card result pop-in ${outcome.passed ? 'result--ok' : 'result--bad'}`}>
          <span className="eyebrow">{outcome.passed ? 'Босс повержен' : 'Босс устоял'}</span>
          <p className="result__score">
            {outcome.correct} из {outcome.total} · {Math.round(outcome.ratio * 100)}%
          </p>
          <p className="muted small">
            Время идёт: <Timer startedAt={startedAt} /> — бой закончится после открытых вопросов.
          </p>
          {xpGain > 0 && <p className="xp-gain">+{xpGain} XP</p>}
          {!outcome.passed && <p>Нужно {Math.round(exam.pass * 100)}%. Разбери ошибки ниже и возвращайся.</p>}
          <button
            className="btn btn--primary"
            onClick={() => {
              setIndex(0);
              setPhase('open');
              window.scrollTo(0, 0);
            }}
          >
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
          <Timer startedAt={startedAt} />
        </div>
        <div className="card slide-in" key={index}>
          <p className="muted small exam__topic">{content.blocks.find((b) => b.id === q.block)?.title}</p>
          <p className="exam__q">{q.q}</p>
          <p className="muted small">Ответь вслух, как на собеседовании, или набросай тезисы. Потом сверься с эталоном.</p>
          <textarea className="notes" placeholder="Тезисы ответа (не сохраняются)" />
          {!revealed ? (
            <button className="btn btn--primary" onClick={() => setRevealed(true)}>
              Показать эталон
            </button>
          ) : (
            <div className="reveal-answer">
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
            </div>
          )}
        </div>
        <button className="link-btn small" onClick={abandon}>
          Бросить бой
        </button>
      </div>
    );
  }

  // done
  const st = progress.exams[exam.id];
  return (
    <div className="card exam-intro pop-in">
      <span className="eyebrow">Собеседование окончено</span>
      <h1>{exam.title}</h1>
      {outcome && (
        <p>
          Тест: {outcome.correct}/{outcome.total} ({Math.round(outcome.ratio * 100)}%) —{' '}
          {outcome.passed ? 'сдано' : 'не сдано'}. Весь бой занял {formatTime(totalSec)}
          {speedrun && ' — спидран!'}.
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
          Всего попыток: {st.attempts}, лучший результат {Math.round(st.best * 100)}%
          {st.bestTimeSec !== undefined && `, лучшее время ${formatTime(st.bestTimeSec)}`}.
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
