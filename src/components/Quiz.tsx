import { useState } from 'react';
import { useProgress } from '../ProgressContext';
import { content, type QuizQuestion } from '../lib/content';
import { recordQuiz, shuffle, type QuizOutcome } from '../lib/progress';
import { computeXp } from '../lib/game';

type Option = { text: string; correct: boolean };

/** Варианты перемешиваются при каждом показе; в JSON правильный — options[0]. */
function prepare(questions: QuizQuestion[]): Option[][] {
  return questions.map((q) => shuffle(q.options.map((text, i) => ({ text, correct: i === 0 }))));
}

type Props = { topicId: string; questions: QuizQuestion[]; onPass?: (o: QuizOutcome) => void };

export default function Quiz({ topicId, questions, onPass }: Props) {
  const { progress, replace } = useProgress();
  const [options, setOptions] = useState(() => prepare(questions));
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [xpGain, setXpGain] = useState(0);

  const checked = outcome !== null;
  const allAnswered = answers.every((a) => a !== null);

  function check() {
    const score = answers.filter((a, qi) => a !== null && options[qi][a].correct).length;
    const r = recordQuiz(progress, topicId, score, questions.length);
    // Без XP за ачивки — их покажет отдельный тост.
    setXpGain(computeXp(r.progress, content) - computeXp(progress, content));
    replace(r.progress);
    setOutcome(r.outcome);
    if (r.outcome.passed) onPass?.(r.outcome);
  }

  function retry() {
    setOptions(prepare(questions));
    setAnswers(questions.map(() => null));
    setOutcome(null);
  }

  return (
    <div className="quiz">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="question" disabled={checked}>
          <legend>
            <span className="question__num">{qi + 1}.</span> {q.q}
          </legend>
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
                    name={`${topicId}-q${qi}`}
                    checked={chosen}
                    onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                  />
                  <span>{opt.text}</span>
                </label>
              );
            })}
          </div>
          {checked && (
            <p className={`explain ${answers[qi] !== null && options[qi][answers[qi]!].correct ? 'explain--ok' : 'explain--bad'}`}>
              {q.explain}
            </p>
          )}
        </fieldset>
      ))}

      {!checked ? (
        <button className="btn btn--primary" disabled={!allAnswered} onClick={check}>
          Проверить
        </button>
      ) : (
        <div className={`result ${outcome.passed ? 'result--ok' : 'result--bad'}`}>
          <p className="result__score">
            {outcome.score} из {outcome.total}
          </p>
          <p>{resultText(outcome)}</p>
          {xpGain > 0 && <p className="xp-gain">+{xpGain} XP</p>}
          <button className="btn" onClick={retry}>
            Пройти ещё раз
          </button>
        </div>
      )}
    </div>
  );
}

function resultText(o: QuizOutcome): string {
  if (!o.passed) return 'Пока не засчитано — нужно минимум 2 правильных ответа. Перечитай пояснения и попробуй снова.';
  if (o.firstPass) return o.score === o.total ? 'Без единой ошибки! Тема засчитана.' : 'Тема засчитана.';
  if (o.review) return 'Повторение засчитано — знания закреплены.';
  return 'Верно, но тема уже засчитана. Повторение засчитается, когда пройдёт 3 дня с последнего прохождения.';
}
