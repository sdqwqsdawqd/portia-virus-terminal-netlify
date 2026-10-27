# Stack Research

**Domain:** приложение повышений и квалификационных тестов внутри PORTIA OS
**Researched:** 2026-10-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.4.2 | UI и Route Handlers | Уже закреплён и проверен проектом; отдельный сервис не нужен |
| React | 19.2.4 | Пошаговый тест и редактор | Текущая оконная система и редактор уже React-компоненты |
| Supabase/PostgreSQL | текущий проект | Активные запросы, задания, тесты и три последних результата | RLS и проверенные owner/editor RPC уже используются |
| Google Sheets API | существующая интеграция | Только чтение Portia!A61:E85 | Источник ника, звания, следующего звания, анти-спидрана и даты |

### Supporting Libraries

Новых runtime-зависимостей не требуется. Таймер строится на серверных timestamps и обычном React; случайный выбор — на сервере через Web Crypto/достаточный системный генератор, а не через новую библиотеку.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| node:test | Проверка переходов состояний, дедлайнов, очистки и прав | Использовать чистые функции, как в content/editor модулях |
| Headless Edge/CDP | Проверка теста, потери фокуса и мобильной раскладки | Не считать headless единственным доказательством visibility/focus |
| SQL preflight/rollback | Безопасное применение новых таблиц и RLS | Повторить guard-first схему Phase 12 |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Отдельный state-management пакет | Масштаб мал, увеличит связанность | Чистые reducer/state-machine функции |
| Фоновый cron как обязательная часть | Netlify может не гарантировать точное время запуска | Ленивая очистка при чтении/записи плюс необязательная scheduled cleanup |
| Клиентский источник времени | Пользователь меняет часы или восстанавливает старую вкладку | Серверные timestamps и проверка API |
| Запись в Google Sheet | Пользователь запретил, создаёт двойной источник истины | Таблица только для чтения; workflow хранится в Supabase |

## Compatibility

- Новая trusted-вкладка уже предусмотрена в `tabRegistry`: `kind: "trusted"`.
- Существующее приложение «Сотрудники» продолжает читать строки 2–35; новый reader ограничивается A61:E85.
- `git.create_tag` и deployment не относятся к реализации функции.

## Sources

- Локальный `package.json`
- `lib/editor-tabs.ts` и тест D-24/D-25
- `lib/portia-employees.ts` и существующая Google Sheets интеграция
- `supabase/phase12_apply.sql` и `supabase/portia_setup.sql`
- Подтверждённая владельцем модель `.planning/notes/povyshenie-model.md`

---
*Stack research for: PORTIA v1.2 «Повышение»*
*Researched: 2026-10-27*

