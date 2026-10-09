# MindMap

Веб-редактор интеллект-карт (рабочее название). Стек: React + TS + Vite + Zustand,
FastAPI + PostgreSQL (JSONB) + Alembic, S3-хранилище (MinIO), Docker Compose.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

Откройте http://localhost:5173 и зарегистрируйтесь.
Миграции базы применяются автоматически при старте бэкенда.

Сервисы: фронтенд `:5173` (проксирует `/api` в бэкенд), консоль MinIO `:9001`.

> Официальный образ `minio/minio` больше не публикуется на Docker Hub, поэтому
> используется совместимая сборка `pgsty/minio`. Можно заменить на любое
> S3-совместимое хранилище через переменные `S3_*`.

## Разработка

- Бэкенд и фронтенд монтируются в контейнеры и перезагружаются при изменениях.
- Новая миграция: `docker compose exec backend alembic revision -m "..."`.
- Проверка типов фронтенда: `cd frontend && npm install && npm run typecheck`.
- Тестовый пользователь для ручной проверки (создаётся регистрацией):
  `test@example.com` / `testpass123`.

## Тесты

Стек должен быть запущен (`docker compose up -d`).

```bash
docker compose exec backend pytest -q          # бэкенд: API, доступы, WebSocket-синхронизация
cd frontend && npm test                         # Vitest: раскладки, операции, форматы, CRDT
cd frontend && npx playwright install chromium && npm run e2e   # e2e в браузере, включая двух участников
```

## Совместная работа

«Поделиться» в редакторе создаёт ссылку `/s/<токен>` с правом просмотра или редактирования
(вход не обязателен). Изменения синхронизируются через Yjs поверх WebSocket (`/api/collab/<id>`),
документ сохраняет сервер комнаты. Видны участники, их курсоры и выделение.

## Продакшен

Задайте в `.env` свой `JWT_SECRET`, пароли базы и S3, `COOKIE_SECURE=true` (за HTTPS).
WebSocket-комнаты живут в памяти процесса бэкенда — запускайте один процесс uvicorn (без нескольких воркеров).
