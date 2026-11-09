---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 18
subsystem: testing
tags: [staging, playwright, content-matrix, restoration]
requires:
  - phase: 19-17
    provides: guarded staging wrapper and acceptance snapshot conventions
provides:
  - owner verdict B for employee matrix source
  - guarded empty and populated content matrix runner with snapshot restoration
  - fake-client tests for idempotency, concurrency, and recovery
affects: [19-19, STAB-DESK-08, STAB-APP-02, STAB-APP-10]
actuals:
  tokens: 9353
  tasks: 2
  commits: 5
commits: 5
plan_head_before: 2f8611f4369c7efa9337180c999c9a6464016994
plan_head_after: 0c72ef6bab0ef0b7c59fac354e8c9f382b794b3c
tech-stack:
  added: []
  patterns: [guarded staging mutation, temporary snapshot, payload hash check, explicit restore]
key-files:
  created: [scripts/phase19-matrix-data.mjs, lib/phase19-matrix-data.test.ts]
  modified: [scripts/phase16-staging.mjs, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-OWNER-DECISIONS.md]
key-decisions:
  - "Владелец (Qloxz), 2026-11-04: B — серверный источник «Сотрудников» не менять."
  - "Опция --staging-employees явно отказывает с matrix-employees-unavailable при вердикте B."
patterns-established:
  - "Матричный прогон сохраняет снимок вне репозитория, проверяет хеш перед восстановлением и оставляет открытый манифест при чужой правке."
requirements-completed: []
duration: 17min
completed: 2026-11-04
status: complete
---

# Phase 19 Plan 18: Матрица данных staging

**Владелец выбрал B для «Сотрудников»; guarded-инструмент проверен на фиктивном клиенте и подготавливает пустой и заполненный контент с возвратом снимка.**

## Performance

- **Duration:** около 17 минут
- **Completed:** 2026-11-04
- **Tasks:** 2 выполнены, 1 пропущена по вердикту владельца
- **Files modified:** 6 (включая RED evidence и deferred ledger)

## Accomplishments

- Пункт 12 `19-OWNER-DECISIONS.md` содержит дословный вердикт `Владелец (Qloxz), 2026-11-04: B` и строку сводной таблицы.
- `matrix-run`, `matrix-restore`, `matrix-residual` доступны через существующий `resolveStagingTarget`. Открытый манифест запрещает новый прогон; чужая правка payload запрещает restore.
- `empty` очищает шесть списков; `populated` добавляет локальные обложки, фото-блок, новости/квест и вирус с «Ё». Исходный payload сохраняется во временном каталоге ОС.
- При B `--staging-employees` отказывает до записи в БД. Живая таблица и код `/api/employees` не менялись.

## Task Commits

1. **Task 1, verdict B:** `a9234b2` — `docs(19-18)`.
2. **Task 2:** пропущена по вердикту B; коммита нет.
3. **Task 3, RED:** `5291fbe` — `test(19-18)`.
4. **Task 3, GREEN:** `0c72ef6` — `feat(19-18)`.

Измеренный диапазон `plan_head_before..plan_head_after` содержит 5 коммитов: три перечисленных коммита 19-18 и два параллельных коммита Phase 20 (`a4f542b`, `7411807`). Они не входят в изменения этого плана.

## Verification

- RED: `lib/phase19-matrix-data.test.ts` — целевая проверка пустого payload упала на ожидаемом assertion; `19-18-RED.json` получил `RED_EVIDENCE_OK`.
- GREEN: целевые тесты `65 pass, 0 fail`; весь `npm.cmd test` — `1106 pass, 0 fail, 3 existing skipped`.
- `npm.cmd exec tsc -- --noEmit`, ESLint изменённых файлов, `npm.cmd run build`, тест визуального манифеста и `--verify-promotion` — успешно.
- Общий `npm.cmd run lint` не прошёл: 32 существующие ошибки в скриптах `.agents/skills/` и `.claude/skills/`. Команда с исключением этих двух каталогов прошла с 14 существующими warnings. Записано в `deferred-items.md`.
- Живой staging в Task 3 не запускался; browser-матрица и реальный restore остаются работой 19-19.

## Deviations from Plan

- **Вердикт B:** Task 2 пропущена по вердикту B. `--staging-employees` оставлен синтаксически доступным, но отказывает с `matrix-employees-unavailable`, поскольку приложение не читает такой источник.
- **Правило 2, безопасность:** дочерний Playwright не получает ключ администратора и DB URL; отчёт JSON принимается только если он создан текущим прогоном.

## Issues Encountered

- Общий lint имеет существующие ошибки вне изменённых файлов; исправление чужих skill-скриптов вне плана.
- Параллельные коммиты Phase 20 попали в измеренный диапазон ledger. В этом плане не стадились и не коммитились файлы Phase 20.

## Next Phase Readiness

- 19-19 может запускать матрицу контента только на доказанно изолированном staging и затем проверять реальный restore.
- «Сотрудники: empty» на обоих проектах и «Сотрудники: stale» на desktop остаются **BLOCKED (DATA)**. STAB-APP-02, STAB-APP-10 и STAB-DESK-08 не отмечены PASS по этим свидетельствам.

## Self-Check: PASSED

- Файлы `scripts/phase19-matrix-data.mjs`, `lib/phase19-matrix-data.test.ts`, `scripts/phase16-staging.mjs` и пункт 12 решения существуют.
- Коммиты `a9234b2`, `5291fbe`, `0c72ef6` являются предками HEAD.
