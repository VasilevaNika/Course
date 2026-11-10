import { useRef, useState } from 'react';
import { useProgress } from '../ProgressContext';
import { emptyProgress, setDailyGoal } from '../lib/progress';
import { exportProgress, readProgressFile } from '../lib/storage';

export default function SettingsPage() {
  const { progress, update, replace } = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onImport(file: File) {
    try {
      const p = await readProgressFile(file);
      if (!window.confirm('Заменить текущий прогресс данными из файла?')) return;
      replace(p);
      setMessage({ ok: true, text: `Прогресс загружен: ${Object.keys(p.topics).length} тем пройдено.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Не удалось прочитать файл' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onReset() {
    if (!window.confirm('Удалить весь прогресс, заметки и историю? Это нельзя отменить. Сначала лучше сделать экспорт.')) return;
    replace(emptyProgress());
    setMessage({ ok: true, text: 'Прогресс сброшен.' });
  }

  return (
    <div className="settings">
      <h1>Настройки</h1>

      <section className="card">
        <h2>Дневная цель</h2>
        <p className="muted">Сколько тем в день ты хочешь проходить.</p>
        <div className="goal">
          <button className="btn" aria-label="Меньше" onClick={() => update((p) => setDailyGoal(p, p.dailyGoal - 1))}>
            −
          </button>
          <span className="goal__value">{progress.dailyGoal}</span>
          <button className="btn" aria-label="Больше" onClick={() => update((p) => setDailyGoal(p, p.dailyGoal + 1))}>
            +
          </button>
          <span className="muted">тем в день</span>
        </div>
      </section>

      <section className="card">
        <h2>Резервная копия</h2>
        <p className="muted">
          Прогресс хранится только в этом браузере. Скачай файл, чтобы перенести его на другое устройство
          или не потерять при очистке браузера.
        </p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => exportProgress(progress)}>
            Скачать прогресс
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Загрузить из файла
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
            }}
          />
        </div>
        {message && <p className={message.ok ? 'msg msg--ok' : 'msg msg--bad'}>{message.text}</p>}
      </section>

      <section className="card card--danger">
        <h2>Сброс</h2>
        <p className="muted">Начать курс с чистого листа.</p>
        <button className="btn btn--danger" onClick={onReset}>
          Сбросить прогресс
        </button>
      </section>
    </div>
  );
}
