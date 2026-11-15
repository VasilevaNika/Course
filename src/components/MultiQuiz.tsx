import { useState } from 'react';
import type { QuizQuestion, Topic } from '../lib/content';
import { shuffle } from '../lib/progress';
import type { AnswerResult } from '../logic/daily';

export type MultiQuizItem = { id: string; topic: Topic; question: QuizQuestion };
export type MultiQuizVerdict = { passed: boolean; text: string; xp: number };

type Option = { text: string; correct: boolean };

/** Варианты перемешиваются при каждом показе; в JSON правильный — options[0]. */
const prepare = (items: MultiQuizItem[]): Option[][] =>
  items.map((it) => shuffle(it.question.options.map((text, i) => ({ text, correct: i === 0 }))));

type Props = {
  name: string;
  items: MultiQuizItem[];
  /** Записать результат; вернуть, что показать. */
  onCheck: (results: AnswerResult[]) => MultiQuizVerdict;
  /** Можно ли перепройти (ежедневный тест — да, реванш — нет). */
  retry?: boolean;
  onClose?: () => void;
};

/** Тест из вопросов разных тем: ежедневный квест и реванш. */
export default function MultiQuiz({ name, items, onCheck, retry = true, onClose }: Props) {
  const [options, setOptions] = useState(() => prepare(items));
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  const [verdict, setVerdict] = useState<(MultiQuizVerdict & { score: number }) | null>(null);

  const checked = verdict !== null;
  const answered = answers.filter((a) => a !== null).length;
  const isRight = (qi: number) => answers[qi] !== null && options[qi][answers[qi]!].correct;

  function check() {
    const results = items.map((it, qi) => ({ id: it.id, correct: isRight(qi) }));
    const score = results.filter((r) => r.correct).length;
    setVerdict({ ...onCheck(results), score });
  }

  function again() {
    setOptions(prepare(items));
    setAnswers(items.map(() => null));
    setVerdict(null);
  }

  return (
    <div className="quiz">
      {items.map((it, qi) => (
        <fieldset key={it.id} className="question" disabled={checked}>
          <legend>
            <span className="question__num">{qi + 1}.</span> {it.question.q}
          </legend>
          <p className="question__topic small muted">{it.topic.title}</p>
          <div className="options">
            {options[qi].map((opt, oi) => {
              const chosen = answers[qi] === oi;
              let cls = 'option';
              if (chosen) cls += ' option--chosen';
              if (checked && opt.correct) cls += ' option--correct';
              if (checked && chosen && !opt.correct) cls += ' option--wrong';
              return (
                <label key={oi} className={cls}>
                  <input
                    type="radio"
                    name={`${name}-q${qi}`}
                    checked={chosen}
                    onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                  />
                  <span>{opt.text}</span>
                </label>
              );
            })}
          </div>
          {checked && <p className={`explain ${isRight(qi) ? 'explain--ok' : 'explain--bad'}`}>{it.question.explain}</p>}
        </fieldset>
      ))}

      {!checked ? (
        <div className="row">
          <button className="btn btn--primary" disabled={answered < items.length} onClick={check}>
            Проверить
          </button>
          <span className="muted small">
            Отвечено {answered} из {items.length}
          </span>
        </div>
      ) : (
        <div className={`result ${verdict.passed ? 'result--ok' : 'result--bad'}`}>
          <p className="result__score">
            {verdict.score} из {items.length}
          </p>
          <p>{verdict.text}</p>
          {verdict.xp > 0 && <p className="xp-gain">+{verdict.xp} XP</p>}
          <div className="row">
            {retry && (
              <button className="btn" onClick={again}>
                Пройти ещё раз
              </button>
            )}
            {onClose && (
              <button className="btn" onClick={onClose}>
                Готово
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
