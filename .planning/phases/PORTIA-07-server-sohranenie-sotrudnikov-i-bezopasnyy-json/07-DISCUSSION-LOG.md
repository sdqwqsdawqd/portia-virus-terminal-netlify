# Phase 7: Сервер: сохранение сотрудников и безопасный JSON - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 7-Сервер: сохранение сотрудников и безопасный JSON
**Areas discussed:** Лимит 34, Сохранение без таблицы, Детали «вне таблицы», Ник в написании Roblox

---

## Лимит 34

| Option | Description | Selected |
|--------|-------------|----------|
| Предупреждение в редакторе | Сервер замечает ники ниже 34-го слота, редактор показывает строку | |
| Только в журнале сервера | Запись в логах Netlify | |
| Строки после 34 не заполняются | В таблице ровно 34 места; правило в коде | ✓ |

**User's choice:** Лимит оставить; строки после 34 не заполняются.

---

## Сохранение без таблицы

| Option | Description | Selected |
|--------|-------------|----------|
| База + таблица фоном | Ищем в базе, таблицу без Roblox — только если нет в базе | |
| Доверять id из редактора | Любой id, без проверки | ✓ (then clarified) |
| Решай сам | | |

Newcomer not in DB while sheet is down: **Отказ с понятным текстом** ✓ / Сохранить всё равно.

Clarification: **id из базы — сразу, новый — через таблицу** ✓ / Всегда доверять id.

Response after save: **Только сохранённый профиль** ✓ / Всего сотрудника, если доступно / Решай сам.

---

## Детали «вне таблицы»

| Option | Description | Selected |
|--------|-------------|----------|
| Всё или ничего | Детали первыми, откат при сбое профиля | ✓ |
| Сохранить что вышло и назвать остальное | Как сейчас | |
| Решай сам | | |

Partial rule for title/rank/callsign: **Да, как у профиля** ✓ / Оставить как есть.

---

## Ник в написании Roblox

Old nicknames: **Показывать по Roblox** ✓ / Один раз исправить в базе / Только новые.

Sheet-delete refusal: user answered free text — «Если нет в таблице удаляется из сотрудников ведь это значит что он уволен, если он только строку поменял значит что он повысился».
Follow-up: Так и оставить / **Уволенному стирать профиль** ✓ → recorded as a deferred idea (new irreversible capability, own phase).

## Claude's Discretion

- Error wording, machine-readable delete refusal, known-id lookup, rollback mechanism, shared JSON-parse helper.

## Deferred Ideas

- Erase stored profiles of people removed from the sheet — own phase with a safety design.
