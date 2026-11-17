---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 17
subsystem: security
tags: [uploads, editor, employees, a11y, d-33, wr-03, wr-05, in-03]
requires:
  - phase: PORTIA-19
    provides: /api/uploads route, EmployeeProfilesEditor, EditorAccessManager, review findings WR-03/WR-05/IN-03
provides:
  - "uploadGate: решение 503/403/413 до разбора тела /api/uploads"
  - "employeeRequestFailure: единый русский текст отказа редактора сотрудников"
  - "Дедупликация сохранения и добавления сотрудника; подтверждение «ОТОЗВАТЬ»"
affects: [20-10, STAB-SEC-05, STAB-A11Y-01, STAB-A11Y-03]
status: complete
actuals:
  tokens: 36000
  tasks: 2
  commits: 4
plan_head_before: 93c07728c3c38603607aaf97f0405e17ef9622dd
plan_head_after: 062f2566292194406f02037fb4abc644d8900610
tech-stack:
  added: []
  patterns:
    - "Чистая функция решения (uploadGate) без импортов @/ — проверяется node-тестом; порядок в маршруте доказывается позициями в исходнике"
    - "Region-scoped source-тесты: участок исходника между function EmployeeProfilesEditor и function EditorAccessManager"
key-files:
  created: []
  modified:
    - lib/image-upload.ts
    - lib/image-upload.test.ts
    - app/api/uploads/route.ts
    - lib/editor-save-status.ts
    - lib/editor-save-status.test.ts
    - components/portia-editor.tsx
    - lib/editor-tabs.test.ts
key-decisions:
  - "Проверка openTabs ушла из маршрута в uploadGate; тесты editor-tabs.test.ts теперь читают lib/image-upload.ts (поведение 403 при пустом списке сохранено и покрыто тестом uploadGate)."
  - "403 sheet-employee при удалении по-прежнему показывает текст сервера, а не «Сессия истекла»: в employeeRequestFailure передаётся status undefined для этого кода."
requirements-completed: [STAB-SEC-05, STAB-A11Y-01, STAB-A11Y-03]
---

# Phase 20 Plan 17: WR-03, WR-05, IN-03 из ревью фазы 19 Summary

/api/uploads отвечает 503 при сбое проверки прав и 413 по объявленному Content-Length до разбора тела; редактор сотрудников показывает только русские тексты отказа, не шлёт повторные PATCH/POST, а «ОТОЗВАТЬ» требует подтверждения.

## Что сделано

**Задача 1 (tracer, WR-03).** `uploadGate({ authRetryable, user, access, contentLength })` в `lib/image-upload.ts` (+ `UPLOAD_ENVELOPE_BYTES` = 64 KiB). Порядок: retryable auth -> 503 server; access отсутствует/unavailable -> 503 server; нет user/canEdit/openTabs -> 403 forbidden; Content-Length > 4 MiB + 64 KiB -> 413 size; иначе null. Маршрут берёт `error` из `getUser()`, использует `isAuthRetryableFetchError`, вызывает `getEditorAccess` только при не-retryable, и `uploadGate` стоит до `request.formData()`. Проверки type/size/signature, путь и catch -> 500 не менялись; каталог `uploadRefusal` и лимит не тронуты.

**Задача 2 (TDD, WR-05 и IN-03).** `employeeRequestFailure` в `lib/editor-save-status.ts`. В `EmployeeProfilesEditor` загрузка, сохранение, добавление и удаление разделяют сбой транспорта и отказ сервера, тело читается через `.json().catch(() => ({}))`, `error.message` в участке: 0 (было 4). `saveInflight` (промис текущего сохранения) и `addInflight` (флаг) исключают второй запрос. В `EditorAccessManager` «ОТОЗВАТЬ» открывает `ConfirmDialog` («Отозвать доступ?»), кнопка disabled при `state === "saving"`.

## TDD: RED -> GREEN

- RED (задача 1), коммит c680a65: `node --experimental-strip-types --test lib/image-upload.test.ts` -> pass 4, fail 7. Тест порядка падал на утверждении об `isAuthRetryableFetchError` в маршруте; тесты uploadGate падали с `imageUpload.uploadGate is not a function`. Семантическая оценка: целевые тесты выполнились и упали на планируемом поведении, не на синтаксисе/импорте (namespace-импорт сделан именно для этого). Классификатор `check tdd-red-evidence` не запускался (нет gsd_run в среде исполнителя); оценка ручная.
- GREEN (задача 1), 2bb0b38: pass 11, fail 0.
- RED (задача 2), 469eb07: `lib/editor-save-status.test.ts` -> pass 31, fail 9 (`saveStatus.employeeRequestFailure is not a function` + три region-scoped source-теста). Семантическая оценка аналогична; ручная.
- GREEN (задача 2), 062f256: pass 40, fail 0 в файле.

## Проверка

- `npm test`: 1136 pass, 0 fail. `tsc --noEmit`: чисто.
- ESLint по изменённым файлам: 0 errors (2 существующих warning `<img>`). Полный `npm run lint` даёт 32 errors в `.agents/skills/**` и `.claude/skills/**` (`no-require-imports`) — вне области плана, к изменениям не относятся.
- Acceptance: `error.message` в участке EmployeeProfilesEditor = 0; `<ConfirmDialog` в EditorAccessManager = 1; `employeeRequestFailure` в portia-editor.tsx = 9; `uploadGate`/`isAuthRetryableFetchError` в маршруте >= 1.

## Deviations from Plan

**1. [Rule 1 - Bug] Тесты editor-tabs.test.ts проверяли исходник маршрута**
- **Found during:** Task 2, полный `npm test`
- **Issue:** Два теста (`roster and uploads respect the tab list`, `empty list refuses content and uploads`) искали `access.openTabs.length` в `app/api/uploads/route.ts`; проверка перенесена в uploadGate по плану.
- **Fix:** Тесты читают `lib/image-upload.ts` и дополнительно проверяют вызовы `uploadGate(` и `getEditorAccess(` в маршруте.
- **Files modified:** lib/editor-tabs.test.ts
- **Commit:** 062f256

**2. [Rule 1 - Bug] Регулярное выражение IN-03 теста**
- `[^>]*` останавливалось на `>` стрелочной функции; заменено на явное `onClick=\{[^\n]*\}>ОТОЗВАТЬ<`. Коммит 062f256.

## Остаточный риск (для 20-SECURITY-MATRIX / 20-10 Task 3)

- STAB-SEC-05: запросы без Content-Length ограничены платформенным лимитом и доступны только авторизованным редакторам; проверка `file.size` после разбора остаётся. Живой сбой Supabase auth на staging не воспроизводился и PASS не объявляется: поведение подтверждено чистой функцией uploadGate и порядком в исходнике.
- Поведение дедупликации и ConfirmDialog проверено source-тестами и типами; браузерная проверка (UI) не выполнялась.

## Известные заглушки

Нет.

## Self-Check: PASSED

- Файлы существуют: lib/image-upload.ts, lib/image-upload.test.ts, app/api/uploads/route.ts, lib/editor-save-status.ts, lib/editor-save-status.test.ts, components/portia-editor.tsx, lib/editor-tabs.test.ts.
- Коммиты в HEAD: c680a65, 2bb0b38, 469eb07, 062f256.
