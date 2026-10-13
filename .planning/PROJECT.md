# PORTIA OS — доработка сайта

## What This Is

Сайт ролевого отряда PORTIA из Roblox-игры Kurodzakura (https://portia-database.netlify.app): архив вирусов, сотрудники, рассылки и устав, оформленные как рабочий стол лаборанта «PORTIA OS». Next.js 16 + Supabase + Netlify, репозиторий sdqwqsdawqd/portia-virus-terminal-netlify, код в `site/`. Аудитория говорит по-русски, в основном с ПК, но и с телефонов.

## Core Value

Участник открывает сайт и сразу находит нужную запись; редактор правит её без потерь и без путаницы — и всё это выглядит как цельная «PORTIA OS».

## Business Context

Некоммерческий фанатский проект. Владелец — qloxzick@gmail.com; редакторы одобряются владельцем.

## Requirements

### Validated

- ✓ Рабочий стол PORTIA OS: окна с перетаскиванием и изменением размера за любой край, ярлыки, панель задач, обои SVG по цвету акцента — existing
- ✓ Архив вирусов, сотрудники (синхронизация с таблицей, максимум 34), рассылки, информация — existing
- ✓ Встроенные окна «Таблица» и «Устав» с масштабом Ctrl+колесо — existing (закоммичено в Phase 1)
- ✓ FIX-01 ручка ≡ в начале строки, без подписи — Phase 1
- ✓ FIX-02 «Устав»/«Таблица» на всё окно при любом масштабе — Phase 1
- ✓ FIX-03 поле редактора = шрифт той области сайта, которую оно правит (WYSIWYG) — Phase 1
- ✓ FIX-04 файл из Корзины на всё окно — Phase 1
- ✓ FIX-05 профиль Roblox по клику на портрет — Phase 1
- ✓ Dark Reader не перекрашивает сайт (meta darkreader-lock) — Phase 1
- ✓ Редактор с ревизиями (оптимистичное сохранение, защита от перезаписи), корзина, рекомендации — existing
- ✓ Вход владельца/редакторов через Supabase, RLS-функции portia_* — existing
- ✓ Кэш Netlify CDN с очисткой по тегам — existing

### Active

См. REQUIREMENTS.md (FIX-*, LOOK-*, EDIT-*, DESK-*, TEXT-*).

### Out of Scope

- Виджет «сводка» на рабочем столе — пользователь запретил
- SVG-паук вместо PNG — пользователю не понравилось; остаётся PNG
- Переименование/удаление метки «РЕВИЗИЯ N» — решено оставить как есть
- Netlify Blobs — зависал в рантайме Next, убран

## Context

- Карта кода: `.planning/codebase/` (7 документов, 2026-10-12).
- Направление дизайна «Электрофорез» (дорожки геля), договор в `.impeccable/surfaces/components-portia-desktop-tsx.md`; продуктовый контекст в `PRODUCT.md`.
- Палитра тёмно-бирюзовая, акценты ice/amber/red через `data-accent`; SVG-иконки в currentColor.
- Шрифты сейчас: Golos Text (интерфейс и тексты), Unbounded (заголовки), JetBrains Mono (коды, часы), IBM Plex Serif (только записи учёных); Georgia удалён. Поля редактора берут шрифт из общего CSS-правила с областью сайта (`.formatted-rich-input[data-area=…]`).
- Ветки: `fix/employee-refresh-and-speed` (ждёт PR), `design/stage-1-desktop` (текущая).

## Constraints

- Только русский интерфейс; шрифты обязаны поддерживать кириллицу.
- Работает на телефоне (узкие экраны, тач).
- Выкладка: только локально (localhost:3123), PR не создавать без явной просьбы.
- По SVG-анимациям, новым SVG и шрифту — сначала предложить варианты пользователю.
- Ponytail: минимальный полный дифф.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Порядок: баги → внешний вид → редактор → ярлыки → оформление текста | Быстрые исправления видны сразу | — Pending |
| Публикация только локально | Решение пользователя | — Pending |
| «РЕВИЗИЯ N» оставить | Решение пользователя | — Pending |
| Общую расстановку ярлыков задаёт только владелец | Решение пользователя | — Pending |
| Поле редактора выглядит как область сайта, которую оно правит (шрифт/размер/интервал из одного правила) | Уточнение пользователя в UAT Phase 1 | ✓ Phase 1 (01-04) |
| Переключатель БЕЛЫЙ/ЧЁРНЫЙ меняет только цвет и фон | Следствие WYSIWYG | ✓ Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-13 after Phase 1*
