import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content } from '../lib/content';
import { formatTime, missingRequirements } from '../lib/exam';
import { FINAL_EXAM_ID, XP } from '../lib/game';

const blockTitle = (id: string) => content.blocks.find((b) => b.id === id)?.title ?? id;
const examTitle = (id: string) => content.exams.find((e) => e.id === id)?.title ?? id;

export default function ExamListPage() {
  const { progress } = useProgress();

  return (
    <>
      <h1>Боссы</h1>
      <p className="muted">
        Симулятор техсобеса: случайные тестовые вопросы из блоков с таймером, затем открытые вопросы с самооценкой.
        Босс повержен, если в тестовой части не меньше 80% правильных. Финальный босс открывается после трёх остальных.
      </p>
      <ul className="boss-list">
        {content.exams.map((exam) => {
          const st = progress.exams[exam.id];
          const missing = missingRequirements(progress, exam);
          const locked = missing.length > 0;
          const reward = exam.id === FINAL_EXAM_ID ? XP.finalBoss : XP.boss;
          return (
            <li key={exam.id} className={`card boss ${locked ? 'boss--locked' : ''} ${st?.passedAt ? 'boss--passed' : ''}`}>
              <div className="boss__head">
                <h2>{exam.title}</h2>
                {st?.passedAt && <span className="pill pill--ok">повержен</span>}
                {locked && <span className="pill">закрыт</span>}
              </div>
              <p className="muted small">{exam.blocks.map(blockTitle).join(' · ')}</p>
              <p className="small">
                {exam.mcq} тестовых + {exam.open} открытых · порог {Math.round(exam.pass * 100)}% · +{reward} XP за первую победу
              </p>
              {st && (
                <p className="small boss__stats">
                  Попыток: {st.attempts} · лучший результат {Math.round(st.best * 100)}%
                  {st.bestTimeSec !== undefined && <> · лучшее время {formatTime(st.bestTimeSec)}</>}
                  {st.passedAt && <> · повержен {new Date(st.passedAt).toLocaleDateString('ru-RU')}</>}
                </p>
              )}
              {locked ? (
                <p className="small muted">Сначала победи: {missing.map(examTitle).join(', ')}.</p>
              ) : (
                <Link to={`/exam/${exam.id}`} className={`btn ${st?.passedAt ? '' : 'btn--primary'} boss__go`}>
                  {st ? 'Сразиться ещё раз' : 'В бой'}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
