---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "10"
subsystem: owner-decisions
tags: [migration, staging, style-direction, blocked-evidence]
requires: [22-02 style-options, 22-09 migration-freeze-and-security-matrix]
provides: [owner-migration-decision, owner-style-direction-C]
affects: [PORTIA-23, PORTIA-25, PORTIA-26, PORTIA-27]
tech-stack:
  added: []
  patterns: [verbatim-owner-decision, explicit-blocked-live-evidence]
key-files:
  created:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-10-SUMMARY.md
  modified:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-MIGRATION-APPLY.md
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-STYLE-DIRECTION.md
    - lib/style-tokens.test.ts
key-decisions:
  - "Владелец 2026-11-12: «оставить blocked C» — миграции остаются неприменёнными, staging BLOCKED (ENV), production ОЖИДАЕТ ВЛАДЕЛЬЦА."
  - "Владелец 2026-11-12: «оставить blocked C» — для Phase 26 выбрано направление C: мягкие поверхности, острые элементы управления и вкладки, статусы-капсулы."
requirements-completed: [UI-01, USR-01, USR-06, USR-08]
actuals:
  tokens: 509
  tasks: 3
  commits: 2
commits: 2
plan_head_before: befd02ceda836f65b853098152bcac19c2571576
plan_head_after: ece4b24b7b8db5cdd5d1459245877acc20d0c280
duration: 20m
completed: 2026-11-12
status: complete
---

# Phase 22 Plan 10: решения владельца о миграции и стиле

**Владелец оставил пять миграций неприменёнными и выбрал направление C для Phase 26; запись сохраняет staging и живые проверки в состоянии BLOCKED.**

## Accomplishments

- В `22-MIGRATION-APPLY.md` записан дословный ответ «оставить blocked C» от 2026-11-12. Миграции не применялись; staging `BLOCKED (ENV)`, production `ОЖИДАЕТ ВЛАДЕЛЬЦА`.
- В `22-STYLE-DIRECTION.md` записан выбор C с датой и словами владельца. Таблица значений A/B/C осталась прежней.
- `22-SECURITY-MATRIX.md` не менялась: применения на staging не было. Роли, живые Postgres/RLS, гонка двух редакторов, удержание журнала на живых строках и устройства не объявлены проверенными.

## Task Commits

1. **Задачи 1–2 — ответы владельца:** получены до исполнения плана, без коммита.
2. **Задача 3 — исправление проверки кириллицы:** `9aaafc6`.
3. **Задача 3 — запись обоих решений:** `ece4b24`.

## Verification

- `node --experimental-strip-types --test lib/security-matrix.test.ts lib/style-tokens.test.ts`: 56 тестов, 56 PASS, 0 FAIL; exit 0.
- `git diff --check` по изменённым файлам: без ошибок.
- Никаких команд Supabase, SQL или staging push не выполнялось. Production не затронут.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Исправлена проверка русского слова «владелец»**
- **Found during:** Task 3, проверка записи выбора C.
- **Issue:** `/\bвладелец\b/iu` в JavaScript не находит кириллическое слово из-за ASCII-семантики `\b`; изначально 55 тестов прошли, 1 упал.
- **Fix:** Unicode-совместимые границы по буквам, цифрам и подчёркиванию с сохранением требования отдельного слова.
- **Files modified:** `lib/style-tokens.test.ts`.
- **Verification:** повторный целевой прогон 56/56.
- **Committed in:** `9aaafc6`.

## Deferred Issues

- Применение миграций и проверка живых Postgres/RLS, ролей, конкуренции и журнала остаются `BLOCKED (ENV)` до отдельного решения и безопасного стенда; физические устройства — до Phase 27.
- Ответ «оставить blocked C» не является отдельным подтверждением ранее перечисленных рисков или разрешением на production.

## Known Stubs

Новых заглушек нет. Ответ API `503 pending-database` — намеренное закрытое состояние до применения миграций.

## Self-Check: PASSED

Файлы записи решения, направления стиля, матрицы, теста и этой сводки существуют. Коммиты `9aaafc6` и `ece4b24` — предки HEAD. По сохранённой базе плана `befd02c` измерены два коммита.
