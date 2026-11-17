---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 08
subsystem: access-gate
tags: [gap-closure, access-gate, fail-closed, editor-first, tdd]
requires:
  - phase: PORTIA-23-01
    provides: resolveGate и экран доступа
  - phase: PORTIA-23-07
    provides: матрица безопасности и охваченные пути
provides:
  - "resolveGate: редактор решается до чтения флага закрытия"
  - "точный откат на open/none при отсутствующей RPC закрытия (PGRST202 / 42883 + имя функции) с одним предупреждением на процесс"
  - "accessGateLayout: чистая клиентски-безопасная раскладка экрана доступа"
affects: [PORTIA-25, PORTIA-26]
gap_ids_closed_in_code: [G-PORTIA-23-2, G-PORTIA-23-3]
actuals:
  tokens: 5000
  tasks: 2
  commits: 4
plan_head_before: 168b940e377c60eaa99eab29c4c7a8549fc4fcaf
plan_head_after: 2cb326159e3c836fc96ca4a524323318bb92aeee
tech-stack:
  added: []
  patterns: [editor-first gate, exact-signal fallback, onceWarn, pure layout helper with type-only imports]
key-files:
  created: [lib/access-gate-view.ts]
  modified: [lib/access-gate.ts, lib/access-gate.test.ts, components/portia-access-gate.tsx]
key-decisions:
  - "Откат на open только при AccessStoreError с sqlState ровно PGRST202 или 42883 и именем функции закрытия целым идентификатором в сообщении; всё остальное остаётся fail-closed (503)."
  - "Проверенный редактор получает решение редактора до чтения флага закрытия; бросивший или отклонённый editorAccess считается unavailable и не даёт права."
  - "Литерал имени RPC закрытия вынесен из продуктового кода (регэксп строится из accessRpc.closureEnabled): lib/access-closure.test.ts сканирует код на этот литерал."
requirements-completed: [ACC-01, ACC-02, ACC-08]
completed: 2026-11-14
status: complete
---

# Phase 23 Plan 08: закрытие G-PORTIA-23-2 и G-PORTIA-23-3 Summary

Шлюз доступа больше не отвечает 503 из-за неприменённой миграции закрытия: при отсутствующей RPC `closureEnabled` сайт открыт (рабочий стол и карточка заявки), редактор входит без чтения флага закрытия, а любой другой сбой закрытия по-прежнему даёт ошибку и 503. Это закрыто в коде; повторная приёмка владельцем ожидается (не PASS).

## Что сделано

**Задача 1 (tracer): отсутствующая функция -> open -> форма заявки**
- `lib/access-gate.ts`: `isMissingClosureFunction(error)` (AccessStoreError, sqlState ровно `PGRST202` или `42883`, имя функции целым идентификатором), `onceWarn(sink)`, необязательный `warn` в `GateDependencies`, по умолчанию `onceWarn(console.warn)` (одно предупреждение на процесс сервера, не на каждый опрос раз в 5 с). Предупреждение: фиксированный текст и `{ sqlState }`, без токена, куки, дайджеста, секрета и данных пользователя.
- `lib/access-gate-view.ts` (новый): `AccessGateView`, `accessGateLayout(view, cardOpen)`; только `import type` (иначе `node:crypto` попал бы в клиентский бандл). Русских строк в файле нет.
- `components/portia-access-gate.tsx`: рендерит по `accessGateLayout(view, cardOpen)`; разметка, классы, тексты, форма `id="access-nickname"`, опрос и фокус без изменений.

**Задача 2: редактор до флага закрытия, пины fail-closed и раскладки**
- `resolveGate`: сначала `readEditorAccess` (throw/reject -> `{ canEdit: false, unavailable: true }`); `canEdit === true` без `unavailable` -> решение редактора сразу, без каких-либо RPC. Дальше чтение флага с откатом; при закрытии ON и `unavailable` -> `Error("Editor verification unavailable.")` как раньше; второй вызов `editorAccess` в закрытой ветке убран, используется ответ первого.
- Тесты: 5 новых именованных тестов + тест Задачи 1 (итого в файле 12 тестов, 6 прежних не менялись).

## TDD

- RED 1 (`d6a4443`): тест "missing closure function opens the site with the request form (G-PORTIA-23-2/3)". Команда `node --experimental-strip-types --test --test-reporter=tap lib/access-gate.test.ts`, exit 1; 7 тестов, 6 pass, 1 fail. semanticAssessment: целевой тест выполнился и упал на `deepEqual` решения (resolveGate бросал ошибку вместо `open/none`), а не на синтаксисе/импорте/фикстуре. Формальный прогон `gsd_run check tdd-red-evidence` не выполнялся (в плане `type: execute`, не `type: tdd`); оценка семантическая, по выводу TAP.
- GREEN 1 (`6f7d199`): файл `lib/access-gate.test.ts` 7/7.
- RED 2 (`c455e0c`): `node --experimental-strip-types --test lib/access-gate.test.ts`, 12 тестов, 11 pass, 1 fail. semanticAssessment: упал именно "verified editor gets the desktop before the closure flag is read" на утверждении, что RPC не вызываются (закрытие читалось первым); остальные 4 новых теста уже проходили, так как пинят границу fail-closed, которая у кода и так была.
- GREEN 2 (`2cb3261`): полный набор зелёный.

## Проверка (локально, офлайн)

Форма запуска: напрямую через node 22.13.1 (npm из временной папки без node-gyp; `npm test`/`npm exec` не использовались).

| Команда | Результат |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` | exit 0; 1915 тестов, 1912 pass, 0 fail, 3 skipped (базовая линия 1909 / 1906 / 0 / 3) |
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| `node node_modules/eslint/bin/eslint.js lib/access-gate.ts lib/access-gate-view.ts lib/access-gate.test.ts components/portia-access-gate.tsx` | exit 0 |
| `git diff --name-only 0046f80ca35c01bb87e1475a0d316c2870484eb8 -- app/api lib/access-store.ts supabase/migrations` | пусто (пути матрицы безопасности не тронуты) |

Критерии приёмки: `isMissingClosureFunction` в `lib/access-gate.ts` — 2 вхождения; `accessGateLayout(view, cardOpen)` в компоненте — 1; `lib/access-gate-view.ts` существует; пять именованных тестов Задачи 2 — по 1 вхождению.

## Последствия решения "редактор первым"

- При закрытии OFF проверенный редактор теперь получает решение редактора, а не `open` с состоянием заявки этого устройства. Клиент рисует оба как рабочий стол плюс карточка заявки; единственное видимое отличие — карточка больше не показывает статус собственной визитёрской заявки редактора. Путь собственной заявки редактора в Promotion (`app/api/access/editor-request`) не затронут.
- Цена: `editorAccess` теперь выполняется на каждом опросе статуса. Для посетителей без сессии `getUser()` возвращается без сетевого вызова, а `getEditorAccess` возвращается рано (`lib/editor-access.ts`, строка 23), поэтому анонимные опросы не добавляют трафика в Supabase (T-23-19, accept).

## Обязательный перенос в Phase 25 (T-23-17)

Откат на open при отсутствующей функции принят владельцем как сигнал, но у него два остаточных окна:
- (a) если функцию закрытия удалят из базы при включённом флаге, сайт откроется;
- (b) устаревший кэш схемы: PostgREST возвращает `PGRST202`, пока функция уже существует, а кэш схемы ещё не перезагружен (например, сразу после применения миграций 21–23 при включённом закрытии); в этом окне не-редакторы получают режим open. Редакторы не затронуты (editor-first).

Требуемое действие перед включением закрытия на production: пересмотреть или убрать этот откат и подтвердить перезагрузку кэша схемы после применения миграций. Content API до Phase 25 всё равно публичны (23-RESEARCH.md, строка 229).

## Отклонения от плана

**1. [Rule 1 - Bug] Литерал имени RPC в продуктовом коде ломал ACC-09-скан**
- **Найдено в:** Задача 2 (первый полный прогон `lib/*.test.ts`).
- **Проблема:** комментарий в `lib/access-gate.ts` содержал литерал имени функции закрытия; `lib/access-closure.test.ts` ("ACC-09 ... no product code reads the flag in Phase 21") сканирует `app`, `components`, `lib` на этот литерал и упал (1 fail). В Задаче 1 полный набор не запускался (проверка плана — только файл гейта), поэтому коммит `6f7d199` содержал этот комментарий и промежуточно красный полный набор; исправлено в `2cb3261`.
- **Исправление:** литерал из комментария убран; регэксп и так строится из `accessRpc.closureEnabled`.
- **Коммит:** `2cb3261`.

**2. [Rule 1 - Bug] Сужение типа в новом тесте**
- В тесте "unavailable or failing editor verification..." `assert.equal(off.mode, "open")` сужал тип до `open`, и `tsc` отверг `off.editor`. Порядок двух утверждений поменян. Коммит `2cb3261`.

Иных отклонений нет. Побочное наблюдение (вне объёма, не правилось): в `lib/access-closure.test.ts` регэксп скана содержит символы backspace (`\x08`) вместо `\b`, из-за чего альтернативы `isClosureEnabled` и `setClosure` фактически не срабатывают; работают только строковые альтернативы.

## BLOCKED (не PASS)

- BLOCKED: живой ответ `/api/access/status` при неприменённых миграциях — живая база не доступна и не трогалась (CLAUDE.md, D-72).
- BLOCKED: вход редактора в браузере, отрисовка формы в реальном браузере — браузер/dev-сервер не запускались.
- BLOCKED: включённое закрытие (без применённых миграций включить нельзя), Postgres/RLS, staging/production.
- BLOCKED: `npm run build` — нет изолированного checkout без реальных `.env` (как в 23-07).
- BLOCKED: Playwright, физические устройства.
- Ожидает владельца: повторная проверка пунктов 2 и 3 UAT через `/gsd-verify-work 23` (23-UAT.md этим планом не менялся). Шаги проверки перечислены в разделе verification плана 23-08.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей: `app/api/**`, `lib/access-store.ts`, `supabase/migrations/**` не менялись; SQL не тронут, RLS-ревью не требуется. T-23-17..T-23-21 выполнены как в плане (T-23-19 принят).

## Коммиты

- `d6a4443` test(23-08): падающий тест отката при отсутствующей RPC закрытия
- `6f7d199` fix(23-08): отсутствующая RPC закрытия -> open и форма заявки
- `c455e0c` test(23-08): падающий тест "редактор первым" и пины fail-closed
- `2cb3261` fix(23-08): редактор до флага закрытия; прочие сбои остаются fail-closed

## Self-Check: PASSED

Файлы `lib/access-gate.ts`, `lib/access-gate-view.ts`, `lib/access-gate.test.ts`, `components/portia-access-gate.tsx` существуют; коммиты `d6a4443`, `6f7d199`, `c455e0c`, `2cb3261` присутствуют в истории ветки `design/stage-1-desktop`.
