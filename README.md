# Дата-квест Ники

Персональный мини-курс «Python backend → Data Engineer»: карта тем, материалы, мини-тесты,
симулятор техсобеса и ачивки с реальными наградами.

**Сайт:** https://vasilevanika.github.io/Course/

Прогресс хранится в браузере (localStorage). Чтобы перенести его на другое устройство —
«Настройки → Скачать прогресс», затем «Загрузить из файла» на новом устройстве.

## Разработка

```bash
npm install
npm run dev      # локальный сервер
npm test         # unit-тесты (vitest)
npm run build    # сборка в dist/
```

Контент курса — `content/roadmap.json`. Спецификация проекта — `CLAUDE.md`.

## Деплой

Каждый пуш в `main` собирает сайт и публикует его на GitHub Pages
(`.github/workflows/deploy.yml`). В PR тот же workflow только прогоняет тесты и сборку.

Однократная настройка репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Адрес сайта — `/<имя репозитория>/`: в CI `base` для Vite берётся из имени репозитория
(переменная `BASE_PATH`), локально по умолчанию `/Course/`.
