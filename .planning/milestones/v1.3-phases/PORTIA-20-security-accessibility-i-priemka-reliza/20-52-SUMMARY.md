---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 52
subsystem: docs
tags: [image-framing, employee-photo, owner-decision, gap-closure, no-migration]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-51 кадр картинки ImageFraming и показ на шести поверхностях сайта"
provides:
  - "решение владельца по D-63 п. 6: вариант b, фото сотрудников без выбора кадра"
  - "20-EMPLOYEE-FRAMING-EVIDENCE.md с разделом «Решение владельца»"
affects: [20-53, 20-54]

employee_framing: b

outcome: complete

actuals:
  tokens: 1100
  tasks: 1
  commits: 1

plan_head_before: 4d18e1c030e298f76b93efc1e3dfccea5be58280
plan_head_after: 69050f99a2042aeb00ce669aabd6d4570ee08b0a
commits: 1

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EMPLOYEE-FRAMING-EVIDENCE.md
  modified: []

key-decisions:
  - "Владелец выбрал вариант «b»: фото сотрудников без выбора кадра в этом цикле. Миграции и кода нет; план 20-53 не подключает кадр к полю «Фото сотрудника»; галерея 20-54 сообщает это владельцу."

requirements-addressed: []
requirements-completed: []

coverage:
  - id: D1
    description: "Решение владельца по хранению кадра фото сотрудника записано с дословным ответом, датой 2026-11-07 и вариантом «b» до любой правки кода"
    verification:
      - kind: other
        ref: "grep -c 'Решение владельца' 20-EMPLOYEE-FRAMING-EVIDENCE.md (>= 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "При варианте «b» кода и миграции нет"
    verification:
      - kind: other
        ref: "git diff --name-only 4d18e1c HEAD -- supabase lib components: пусто"
        status: pass
    human_judgment: false
  - id: D3
    description: "Выбор видимой части фото сотрудника во вкладке «Сотрудники»"
    verification: []
    human_judgment: true
    rationale: "Не реализуется по решению владельца (вариант «b»); это не PASS и не BLOCKED, а осознанный отказ в этом цикле"

duration: ~5 min
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 52: Кадр фото сотрудника — решение владельца Summary

**Владелец решил, что фото сотрудников во вкладке «Сотрудники» остаются без выбора видимой части (вариант «b»): ответ записан дословно, миграции и кода нет, остальные задачи плана не выполнялись.**

employee_framing: b

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-11-07
- **Tasks:** 1 из 3 (Task 1 — решение владельца; Task 2 и Task 3 по плану при «b» не выполняются)
- **Commits:** 1 (задача) + коммит метаданных
- **Files:** 1 новый документ

## Accomplishments

- В `20-EMPLOYEE-FRAMING-EVIDENCE.md` записан раздел «Решение владельца»: дата 2026-11-07, вариант «b», дословный ответ «b — без выбора для сотрудников», ответ про staging «Не важно (выбран «b»)».
- Список миграций для staging не показывался: он нужен только для «a».
- Для 20-53 и 20-54 записано следствие: кадр к полю «Фото сотрудника» не подключается, галерея сообщает владельцу, что выбор видимой части у фото сотрудников не сделан по его решению.

## Task Commits

1. **Task 1: Решение владельца (checkpoint:decision)** — `69050f9` (docs)
2. **Task 2 (миграция, lib, портрет, ревью):** не выполнялась, вариант «b».
3. **Task 3 (staging, матрица, UAT):** не выполнялась, вариант «b».

## Deviations from Plan

None — план выполнен по ветке «b»: запись решения, коммит документа, `employee_framing: b` в SUMMARY.

## Not Done (по решению владельца)

- Миграция `20261107000000_portia_employee_photo_framing.sql`, `lib/portia-employees.ts`, портрет в `components/portia-desktop.tsx`, тесты.
- Ревью `supabase-rls-reviewer`, staging (`scripts/phase16-staging.mjs` не запускался), production.
- Строка `OWNER-MIG-EMPLOYEE-FRAMING` в `20-UAT.md` и строка миграции в `20-SECURITY-MATRIX.md`: миграции нет.
- Требования STAB-SEC-05 и STAB-REL-08 в реестре не отмечались (`requirements-completed: []`).

## Known Stubs

None.

## Threat Flags

None — файлы кода и базы не менялись.

## Issues Encountered

None.

## Self-Check: PASSED

- FOUND: `.planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EMPLOYEE-FRAMING-EVIDENCE.md`
- FOUND: коммит 69050f9 в истории HEAD
- `git diff --name-only 4d18e1c HEAD -- supabase lib components` пусто
