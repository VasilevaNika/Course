/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages отдаёт сайт по адресу https://<user>.github.io/<repo>/.
// Имя репозитория можно переопределить переменной BASE_PATH при сборке.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/Course/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
