# MindMap — договорённости проекта

Общение с пользователем — на русском.

## Цель
Веб-редактор интеллект-карт с функциональным паритетом с XMind (десктоп/веб).
Копируем только функционал. Название, логотип, иконки, ассеты и визуальный
дизайн XMind НЕ использовать. Рабочее название — «MindMap», оформление
нейтральное; все цвета и шрифты — в токенах (`frontend/src/styles/tokens.css`),
чтобы бренд подставить позже.

## Стек
- Фронтенд: React + TypeScript + Vite, состояние — Zustand.
- Отрисовка карты: SVG + собственный движок раскладок (не Canvas).
- Бэкенд: Python, FastAPI, Pydantic.
- База: PostgreSQL, SQLAlchemy 2 + Alembic. Карта хранится JSONB-документом.
- Авторизация: почта + пароль (argon2), JWT в httpOnly-cookie (access + refresh);
  регистрация, вход, выход, смена пароля.
- Файлы (картинки, вложения): S3-совместимое хранилище (локально MinIO).
- Запуск: Docker Compose — одна команда (`docker compose up --build`) поднимает
  базу, MinIO, бэкенд и фронтенд. Есть `.env.example` и README.

## Структура репозитория
```
/backend            FastAPI-приложение (app/), Alembic (alembic/)
/frontend           Vite + React + TS (src/)
docker-compose.yml
README.md
CLAUDE.md
```

## Модель данных (минимум)
- `users` — id, email, password_hash, created_at.
- `maps` — id, owner_id, title, document (JSONB, содержит листы), created_at, updated_at.
- `map_versions` — id, map_id, document (JSONB), title, created_at (история версий).
- `map_shares` — id, map_id, token, role (`view` | `edit`), created_at.

Формат документа (JSONB): `{ "version": 1, "sheets": [ { "id", "title",
"rootTopic": { "id", "title", "children": [...] }, ... } ] }` — близко к
content.json XMind, чтобы упростить импорт/экспорт .xmind.

## Тесты
С этапа 6 тесты вернули (решение пользователя). Новый функционал — с тестами:
- `backend/tests` — pytest (отдельная база mindmap_test): `docker compose exec backend pytest -q`;
- `frontend/src/__tests__` — Vitest (happy-dom): `npm test`;
- `frontend/e2e` — Playwright против запущенного стека: `npm run e2e`.
Плюс ручная проверка в браузере.

## Режим работы
- Работать, пока чек-лист этапа не проходит полностью; между этапами не ждать
  подтверждения, останавливаться только перед необратимыми решениями.
- Функционал не упрощать молча: если что-то нельзя или сделано частично —
  сказать прямо и отметить в чек-листе.
- После каждого этапа — короткий отчёт и чек-лист со статусами.
- Коммиты — в https://github.com/mfbulat/nodea.

## Этапы
1. Каркас: авторизация, список карт (создать, переименовать, удалить,
   дублировать), автосохранение в базу, история версий.
2. Ядро редактора: темы (центральная/основные/подтемы/плавающие), клавиши,
   drag&drop, мультивыделение, буфер, undo/redo, масштаб, раскладки
   (Mind Map ×3, Logic, Brace, Org, Tree, Timeline ×2, Fishbone, Tree Table,
   Matrix, раскладка ветки), стили.
3. Элементы: связи, границы, сводки, выноски, маркеры, стикеры, метки,
   заметки, ссылки, изображения, вложения, LaTeX, задачи, комментарии, листы.
4. Импорт/экспорт: .xmind, Markdown, OPML, FreeMind; PNG, SVG, PDF, MD, OPML,
   Word, Excel, PowerPoint.
5. Режимы: outliner, ZEN, презентация, поиск, фильтр, «только ветка», шаблоны.
6. Совместная работа: доступ по ссылке, Yjs + WebSocket, курсоры.

## Вне MVP
ИИ-функции, мобильные приложения, вход через Google.

## Архитектура редактора (frontend/src/editor)
- `model.ts` — типы документа (Topic, Sheet, TopicStyle, StructureId) и утилиты дерева.
- `themes.ts` — темы оформления; `resolveStyle` = тема → радужные ветки → стиль темы.
- `measure.ts` — измерение текста (canvas) и размеров темы по форме.
- `layout.ts` — движок раскладок: каждая структура раскладывает поддерево в блок
  относительно своей темы; у ветки может быть своя `structure`.
- `store.ts` — Zustand-хранилище редактора: выделение, правка, undo/redo (снимки
  документа через immer), буфер, операции над темами. Документ живёт в `store/doc.ts`
  (автосохранение с debounce и `base_revision`).
- `MapCanvas.tsx` — SVG-отрисовка и мышь; `useEditorKeys.ts` — клавиатура и буфер обмена.
- В dev-режиме хранилища доступны в консоли как `window.__mm` (для ручной проверки).
- Синтетические события клавиатуры приходят без `e.code` — сравнивать через `is()`.

## Совместная работа (этап 6)
- Ссылки доступа: `map_shares` (view/edit), страница `/s/:token`, `GET /api/shared/{token}`.
- Документ в CRDT: плоская схема nodes/sheets/order — `backend/app/ydoc.py` и
  `frontend/src/collab/ydoc.ts` должны совпадать.
- `backend/app/collab.py`: комната на карту (pycrdt-websocket), загрузка из базы,
  сохранение раз в секунду и при уходе последнего участника; правки зрителей отбрасываются.
- Клиент (`collab/session.ts`): в совместном режиме документ не PATCH-ится, undo — `Y.UndoManager`
  (только свои правки), присутствие — awareness (курсор, выделение, лист).
- Откат версии через REST заменяет содержимое живой комнаты (`rooms.reset`).
