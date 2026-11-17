# 19 — Disposition of code review findings (19-REVIEW.md)

Дата: 2026-11-04. Статусы: `open` — не решено; `fixed` — исправлено с коммитом и проверкой; `phase-20` — перенесено с причиной; `disposition-20` — Phase 20 не исправляла находку и записала явное решение по D-09..D-12 в `20-SECURITY-MATRIX.md`. Никакая находка не закрыта молча.

| ID | Severity | Файл | Статус | Заметка |
|----|----------|------|--------|---------|
| CR-01 | Critical | components/portia-desktop-media.tsx:48-58 | fixed | `14e04c6` (19-15); свёрнутые обложки «Справочника» passed на обоих Chromium в «Прогоне C» (`media-offscreen.spec.ts`, populated). |
| WR-01 | Warning | scripts/phase16-staging.mjs:38-53 | fixed | `5e105bb` (19-17); unit-тесты DB URL/query guard. |
| WR-02 | Warning | scripts/phase19-acceptance.mjs:256,262,357,359 | fixed | `362eb6a` (19-17); unit-тесты snapshot и scoped shift/teardown. |
| WR-03 | Warning | app/api/uploads/route.ts:18-25,35 | fixed | `2bb0b38` (20-17); тест `uploadGate: a retryable auth failure is 503 server, not a false 403 (WR-03)` в `lib/image-upload.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| WR-04 | Warning | components/portia-promotion.tsx:326-333 | fixed | `b02ef1b` (19-16); unit-тесты сохранения статуса и замка. Видимое поведение — owner UAT 19-21. |
| WR-05 | Warning | components/portia-editor.tsx:1808,1834-1835 | fixed | `062f256` (20-17); тесты `employeeRequestFailure: no connection is the network text, never the raw exception (WR-05)` и `EmployeeProfilesEditor does not send a second PATCH or POST while one is running (WR-05)` в `lib/editor-save-status.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| WR-06 | Warning | lib/portia-promotion-reviewer.ts:30,112-114 | fixed | `f471ad5` (19-16); unit-тесты нормализации ника. Видимое поведение — owner UAT 19-21. |
| WR-07 | Warning | tests/e2e/specs/search.spec.ts:88,115-121 | fixed | `57a25c8`, `2f01a18` (19-19); ненулевой ё/е результат passed на обоих Chromium в populated, пустой источник даёт BLOCKED (DATA), таймер управляется `page.clock`. |
| IN-01 | Info | components/portia-desktop-dossier.tsx:128-161 | fixed | `87d7769` (20-18); тест `IN-01: trailing period stays out of the GIF link` в `lib/rich-text-media.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| IN-02 | Info | scripts/phase19-acceptance.mjs:235 | fixed | `a8a0395` (20-18); тест `IN-02: an inherited object key is an unknown participant label, not a late failure` в `lib/phase19-acceptance.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| IN-03 | Info | components/portia-editor.tsx:2189 | fixed | `062f256` (20-17); тест `«ОТОЗВАТЬ» asks first through ConfirmDialog and is disabled while a request runs (IN-03)` в `lib/editor-save-status.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| IN-04 | Info | scripts/phase19-acceptance.mjs:185 | fixed | `a8a0395` (20-18); тест `IN-04: a dirty teardown prints the work directory path and no secrets, a clean one does not` в `lib/phase19-acceptance.test.ts`. Строка в `20-SECURITY-MATRIX.md` (D-33). |
| IN-05 | Info | lib/portia-employees.ts:507-511 | disposition-20 | Не исправлено, явное решение D-09 (production недоступен по правилам проекта и D-14): fallback оставлен, комментарий в `lib/portia-employees.ts` указывает на baseline-миграцию и условие удаления. См. `20-SECURITY-MATRIX.md`, раздел «Перенесённые находки 19-REVIEW (D-33)», строка IN-05. |
