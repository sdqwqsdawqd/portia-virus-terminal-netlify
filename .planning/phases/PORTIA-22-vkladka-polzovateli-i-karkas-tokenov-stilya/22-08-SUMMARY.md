---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "08"
subsystem: database-security-review
tags: [supabase, rls, postgres, security-review, parity]
dependency-graph:
  requires:
    - 22-06 users roster and bulk approval
    - 21-06 access foundation and RLS review
  provides:
    - Phase 22 static RLS review with five closed findings and final reviewed commit
    - security review handoff for 22-09
  affects: [PORTIA-22-09, phase-22-security-matrix, users-management]
actuals:
  tokens: 9886
  tasks: 2
  commits: 4
plan_head_before: 8c9dc371925ee39ea7554040dbed70ad16ac20e8
plan_head_after: 3f95274bee2a1f380166f0dbd052de2d224928b1
tech-stack:
  added: []
  patterns:
    - pin a security verdict to the exact reviewed source commit
    - keep live database evidence BLOCKED after static review
key-files:
  created:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-RLS-REVIEW.md
  modified:
    - supabase/migrations/20261110000000_portia_users_tab.sql
    - lib/users-api.ts
    - app/api/users/route.ts
    - components/portia-users-tab.tsx
    - lib/portia-canonical-parity.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - supabase/fingerprint/expected/portia.fingerprint.json
key-decisions:
  - "RLS22-01..05 are fixed; the final static review of 9f2778c reports no new Phase 22 findings."
  - "SEC-M1 stays an accepted pre-existing baseline; live Postgres/RLS, roles and concurrency stay BLOCKED."
patterns-established:
  - "Re-review SQL, server callers, contracts and parity artifacts after security fixes."
requirements-completed: [USR-01, USR-04, USR-06, USR-07, USR-08]
duration: 12h58m
completed: 2026-11-12
status: complete
---

# Phase 22 Plan 08: RLS review summary

**Статическое ревью Phase 22 закрыло пять находок, устранило дополнительную проверку roster при одиночном одобрении и закрепило заключение `SECURED` за commit `9f2778c49f63ef44925170bcf07df8e98baf842e`.**

## Performance

- **Duration:** 12h58m календарного времени, включая паузу между исправлением и закрытием плана.
- **Started:** 2026-11-11T17:53:34Z (первый commit плана).
- **Completed:** 2026-11-12T06:52:02Z.
- **Tasks:** 2.
- **Commits:** 4, измерено `git rev-list --count 8c9dc371925ee39ea7554040dbed70ad16ac20e8..3f95274bee2a1f380166f0dbd052de2d224928b1`.

## Accomplishments

- Раунд 1 записал RLS22-01..05: три medium и два low, без critical/high. Все пять исправлены в `28611bf`, включая SQL, серверную валидацию, контрактные тесты, hash миграции, строки expected-authz и golden fingerprint.
- Дополнительное исправление `9f2778c` убрало самостоятельную проверку roster из одиночного одобрения. Повторный `supabase-rls-reviewer` проверил этот HEAD и вернул `SECURED`: новых находок Phase 22 нет.
- Итоговый проверенный commit и точный статический scope записаны в `22-RLS-REVIEW.md` для плана 22-09. Ранее принятый `SEC-M1` не объявлен новым дефектом Phase 22 и не снят.

## Task Commits

1. **Task 1 — initial review:** `fafb7d7` — запись раунда 1.
2. **Task 2 — fix and rereview:** `28611bf` — RLS22-01..05; `9f2778c` — одиночное одобрение; `3f95274` — итог раунда 2 и verdict.

## Verification

- Целевой набор SQL/API, access, fingerprint и canonical parity на Node 22.13.1: 342 PASS, 1 pre-existing SKIP, 0 FAIL.
- Общий unit-прогон на Node 22.13.1: 1885 PASS, 3 ожидаемых FAIL из открытого red-window `lib/security-matrix.test.ts`, 3 SKIP; gate подтвердил `red-window ok: 3 expected failures`.
- Полный `portia-check` запущен, но завершился до тестов: временная установка npm для Node 22 не содержит `node-gyp/bin/node-gyp.js` (`MODULE_NOT_FOUND`). Следующие шаги этого скрипта не выполнялись; прямые целевые проверки через `node.exe` выше прошли. Build не запускался.
- `git merge-base --is-ancestor 9f2778c HEAD` прошёл. После проверенного commit нет изменений в `supabase/migrations`, `lib/access-store.ts`, `lib/users-api.ts`, `lib/users-model.ts`, `lib/users-roster.ts`, `app/api/users`, `proxy.ts`.
- Миграция не применялась; живой Postgres/RLS, реальные роли, конкуренция, staging/production и физические устройства не проверялись.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Удалена лишняя проверка roster при одиночном одобрении**
- **Found during:** Task 2, повторная проверка security boundary.
- **Issue:** Отдельная проверка roster в single approve создавала второй источник решения поверх серверного/DB guard.
- **Fix:** Удалена зависимость от roster в одиночном сценарии и уточнены API/компонентные контракты.
- **Files modified:** `lib/users-api.ts`, `lib/users-api.test.ts`, `lib/users-component.test.ts`, `components/portia-users-tab.tsx`.
- **Verification:** Целевые тесты и повторное статическое ревью.
- **Committed in:** `9f2778c`.

Пять исправлений RLS22-01..05 являются запланированным циклом Task 2, а не отклонением.

## Deferred Issues

- Фактические ACL, RLS, PostgREST, `closed_tabs`, collation/Auth, retention при конкуренции, Netlify и staging остаются `BLOCKED` до безопасной среды и соответствующей фазы доказательства.
- Ранее принятый baseline `SEC-M1` сохраняет прежний статус. Статическое заключение `SECURED` относится только к проверенному scope Phase 22.
- Полный `portia-check` требует восстановить временную npm-инсталляцию Node 22; его type/lint/manifest-шаги не выполнялись этим запуском.

## Next Phase Readiness

План 22-09 может брать commit `9f2778c49f63ef44925170bcf07df8e98baf842e` как финальный проверенный источник для матрицы безопасности и frozen migration. Применение миграции и live-доказательства остаются отдельными gate.

## Self-Check: PASSED

Файлы ревью, сводки, SQL, API и route найдены; все четыре task-коммита являются предками HEAD.

---
*Phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya*
*Completed: 2026-11-12*
