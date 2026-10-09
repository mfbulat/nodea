import { defineConfig } from '@playwright/test'

// Перед запуском поднимите стек: docker compose up -d
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:5173', viewport: { width: 1400, height: 900 }, locale: 'ru-RU' },
  reporter: 'list',
  retries: 1,
})
