import { emptyProgress, normalizeProgress, type Progress } from './progress';

const KEY = 'nika-course:progress:v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch (e) {
    console.warn('Не удалось прочитать прогресс, начинаем с нуля', e);
  }
  return emptyProgress();
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    console.warn('Не удалось сохранить прогресс', e);
  }
}

export function exportProgress(p: Progress): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nika-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readProgressFile(file: File): Promise<Progress> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Файл не похож на JSON');
  }
  return normalizeProgress(data);
}
