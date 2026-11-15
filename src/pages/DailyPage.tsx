import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { allTopics, content } from '../lib/content';
import { computeXp } from '../lib/game';
import { dayKey, lastTouch, nextTopicId, type Progress } from '../lib/progress';
import { daysWord } from '../lib/words';
import { daysBetween } from '../logic/dates';
import { applyDaily, dailyQuest, findQuestion, questLocked, recordDailyQuiz, TASKS, type TaskId } from '../logic/daily';
import {
  currentStreak,
  DAILY_SIZE,
  MAX_FREEZES,
  passMark,
  questPassed,
  recordRevenge,
  REVENGE_SIZE,
  revengeAvailable,
} from '../logic/streak';
import MultiQuiz, { type MultiQuizItem } from '../components/MultiQuiz';
import { CheckIcon, ChestIcon, FlameIcon, ShieldIcon, SnowIcon } from '../components/icons';

const orderedIds = allTopics.map((t) => t.id);

function toItems(ids: string[]): MultiQuizItem[] {
  return ids.flatMap((id) => {
    const found = findQuestion(content, id);
    return found ? [{ id, ...found }] : [];
  });
}

/** XP, который даст изменение (с учётом заданий и сундука, которые отметятся после записи). */
function xpDelta(before: Progress, after: Progress): number {
  return computeXp(applyDaily(after, content), content) - computeXp(before, content);
}

const dateTitle = (ts: number) =>
  new Date(ts).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

export default function DailyPage() {
  const { progress, replace, pushToast, now } = useProgress();
  const today = dayKey(now);
  const [running, setRunning] = useState<'quest' | null>(null);
  const [revengeIds, setRevengeIds] = useState<string[] | null>(null);

  const next = nextTopicId(progress, orderedIds);
  const streak = currentStreak(progress.days, today);
  const revenge = revengeAvailable(progress, today);

  if (questLocked(progress)) {
    return (
      <>
        <PageHead now={now} />
        <section className="card daily-locked">
          <span className="eyebrow">Квест закрыт</span>
          <h2>Пройди первую тему, чтобы открыть ежедневные квесты</h2>
          <p className="muted">
            Каждый день здесь будет тест из {DAILY_SIZE} вопросов по пройденным темам и два небольших задания.
          </p>
          {next && (
            <Link to={`/topic/${next}`} className="btn btn--primary">
              К первой теме
            </Link>
          )}
        </section>
      </>
    );
  }

  const day = progress.days[today];
  const quest = day?.quest;
  const passed = questPassed(day);
  const tasks = (day?.tasks ?? []) as TaskId[];
  const done = new Set(day?.tasksDone ?? []);
  const doneCount = (passed ? 1 : 0) + tasks.filter((t) => done.has(t)).length;

  function checkQuest(results: { id: string; correct: boolean }[]) {
    const after = recordDailyQuiz(progress, today, results);
    const score = results.filter((r) => r.correct).length;
    const need = passMark(results.length);
    replace(after);
    const ok = score >= need;
    return {
      passed: ok,
      xp: xpDelta(progress, after),
      text: ok
        ? score === results.length
          ? 'Без единой ошибки! Ежедневный тест сдан.'
          : 'Ежедневный тест сдан. Засчитывается лучший результат дня.'
        : `Нужно ${need} из ${results.length}. Перечитай пояснения и попробуй ещё раз — попыток сколько угодно.`,
    };
  }

  function startRevenge() {
    setRevengeIds(dailyQuest(today, progress, content, { size: REVENGE_SIZE, salt: 'revenge' }).questionIds);
  }

  function checkRevenge(results: { id: string; correct: boolean }[]) {
    const score = results.filter((r) => r.correct).length;
    const r = recordRevenge(progress, today, score, results.length);
    replace(r.progress);
    if (r.passed) {
      pushToast({ kind: 'celebration', celebration: 'revenge', streak: currentStreak(r.progress.days, today) });
    }
    return {
      passed: r.passed,
      xp: xpDelta(progress, r.progress),
      text: r.passed
        ? 'Реванш удался — вчерашний день закрыт, серия восстановлена.'
        : `Нужно ${passMark(results.length)} из ${results.length}. Серия сгорела, но новая начинается сегодня.`,
    };
  }

  return (
    <>
      <PageHead now={now} />

      {(revenge || revengeIds) && (
        <section className="card daily-revenge">
          <div className="daily-card__head">
            <span className="daily-icon daily-icon--revenge">
              <ShieldIcon size={22} />
            </span>
            <div>
              <span className="eyebrow">Второй шанс</span>
              <h2>Реванш</h2>
            </div>
          </div>
          {!revengeIds && revenge && (
            <>
              <p>
                Вчера серия в {revenge.lost} {daysWord(revenge.lost)} оборвалась. Сдай двойной тест —{' '}
                {REVENGE_SIZE} вопросов, нужно {passMark(REVENGE_SIZE)} верных, — и вчерашний день засчитается.
              </p>
              <p className="muted small">Одна попытка, доступно только сегодня.</p>
              <button className="btn btn--primary" onClick={startRevenge}>
                Принять вызов
              </button>
            </>
          )}
          {revengeIds && (
            <MultiQuiz name="revenge" items={toItems(revengeIds)} retry={false} onCheck={checkRevenge} onClose={() => setRevengeIds(null)} />
          )}
        </section>
      )}

      <section className="daily-progress card">
        <div className="daily-progress__steps" aria-label={`Выполнено ${doneCount} из 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`daily-step ${i < doneCount ? 'is-done' : ''}`} />
          ))}
        </div>
        <span className="muted small">
          {doneCount === 3 ? 'Квест дня выполнен' : `Выполнено ${doneCount} из 3 — за все три сундук дня`}
        </span>
      </section>

      <section className={`card daily-main ${passed ? 'is-done' : ''}`}>
        <div className="daily-card__head">
          <span className="daily-icon">{passed ? <CheckIcon size={20} /> : '1'}</span>
          <div>
            <span className="eyebrow">Основное задание</span>
            <h2>Ежедневный тест</h2>
          </div>
        </div>
        {quest && (
          <>
            <p className="muted">
              {quest.total} {quest.total === 1 ? 'вопрос' : quest.total < 5 ? 'вопроса' : 'вопросов'} по пройденным темам —
              давно не повторённые и слабые выпадают чаще. Сдан при {passMark(quest.total)} из {quest.total}.
            </p>
            {quest.best > 0 && (
              <p className="daily-best">
                Лучший результат сегодня: <strong>{quest.best} из {quest.total}</strong>
                {passed ? ' — сдан' : ''}
              </p>
            )}
            {running === 'quest' ? (
              <MultiQuiz name="daily" items={toItems(quest.questionIds)} onCheck={checkQuest} onClose={() => setRunning(null)} />
            ) : (
              <button className={`btn ${passed ? '' : 'btn--primary'}`} onClick={() => setRunning('quest')}>
                {quest.best > 0 ? 'Пройти ещё раз' : 'Начать тест'}
              </button>
            )}
          </>
        )}
      </section>

      <section className="card">
        <span className="eyebrow">Побочные задания</span>
        <ul className="daily-tasks">
          {tasks.map((id) => (
            <TaskRow key={id} id={id} done={done.has(id)} progress={progress} today={today} next={next} />
          ))}
        </ul>
      </section>

      <section className={`card daily-chest ${day?.chest ? 'is-open' : ''}`}>
        <ChestIcon size={64} open={Boolean(day?.chest)} className="daily-chest__icon" />
        <div>
          <span className="eyebrow">Сундук дня</span>
          <h2>{day?.chest ? 'Открыт' : 'Закрыт'}</h2>
          <p className="muted">
            {day?.chest
              ? 'Все три задания выполнены. Завтра — новый квест.'
              : 'Выполни тест и оба побочных задания, чтобы открыть сундук и получить XP.'}
          </p>
        </div>
      </section>

      <section className="card daily-streak">
        <div className="daily-streak__item">
          <FlameIcon size={22} className={streak > 0 ? 'flame-on' : 'flame-off'} />
          <span>
            Серия: <strong>{streak} {daysWord(streak)}</strong>
          </span>
        </div>
        <div className="daily-streak__item">
          <SnowIcon size={20} className="snow" />
          <span>
            Заморозки: <strong>{progress.streak.freezes} из {MAX_FREEZES}</strong>
          </span>
        </div>
        <p className="muted small">
          Активный день — пройдена тема или сдан ежедневный тест. За каждые 7 дней серии — заморозка: она закроет
          пропущенный день, если их хватит на все пропуски.
        </p>
      </section>
    </>
  );
}

function PageHead({ now }: { now: number }) {
  return (
    <section className="hero">
      <h1>Ежедневный квест</h1>
      <p className="muted">{dateTitle(now)} · новый квест в полночь</p>
    </section>
  );
}

function TaskRow({ id, done, progress, today, next }: { id: TaskId; done: boolean; progress: Progress; today: string; next?: string }) {
  const task = TASKS[id];
  if (!task) return null;
  const target = taskLink(id, progress, today, next);
  return (
    <li className={`daily-task ${done ? 'is-done' : ''}`}>
      <span className="daily-task__check">{done && <CheckIcon size={14} />}</span>
      <span className="daily-task__title">{task.title}</span>
      {!done && target && (
        <Link to={target} className="btn btn--small">
          Перейти
        </Link>
      )}
    </li>
  );
}

/** Куда вести по заданию: новая тема — следующая по порядку, повторение — самая давняя из подходящих. */
function taskLink(id: TaskId, p: Progress, today: string, next?: string): string | undefined {
  if (id === 'review') {
    const old = orderedIds
      .filter((t) => p.topics[t] && daysBetween(dayKey(lastTouch(p.topics[t])), today) >= 3)
      .sort((a, b) => lastTouch(p.topics[a]) - lastTouch(p.topics[b]))[0];
    return old ? `/topic/${old}` : undefined;
  }
  if (id === 'perfect' && !next) {
    const weak = orderedIds.find((t) => p.topics[t] && p.topics[t].best < 3);
    return weak ? `/topic/${weak}` : undefined;
  }
  const topic = next ?? orderedIds.filter((t) => p.topics[t]).pop();
  return topic ? `/topic/${topic}` : undefined;
}
