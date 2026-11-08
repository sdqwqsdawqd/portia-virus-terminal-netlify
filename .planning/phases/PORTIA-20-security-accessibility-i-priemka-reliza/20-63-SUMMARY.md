---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 63
subsystem: release-gate
tags: [D-69, G6, release-rehearsal, STAB-REL-01, STAB-REL-02, STAB-REL-03]
status: in-progress
release_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_head_before: 03e890a0135ff20f02b4ab68fe39642fff84c39f
---

# Phase 20 Plan 63: повтор релизной репетиции на новом release commit (G6) Summary

PLAN_BASE: 03e890a0135ff20f02b4ab68fe39642fff84c39f

Черновик: Task 1 выполнен до выбора release commit, Task 2 в работе.

## Task 1: условие и release commit

- Условие (verify 1): файлов продукта (`app components public lib`, без `*.test.*`), изменённых после 0c2a59d1d1a7: 0. Звеньев `owner_verdict_renews` в SUMMARY фазы нет (`grep -l '^owner_verdict_renews:'` пусто).
- RED: 87a6a6c, 12 из 120 тестов `lib/phase20-release-gate.test.ts` падали (нет `readEffectiveOwnerVerdict`).
- GREEN: 5b9cce4, 120 из 120.
- Release commit RC: `f49aa00f2b9833f962fa3fa890117e98a4abf362` (первый кандидат 5b9cce4 отвергнут: частичный прогон `5b9cce438b14-20261108T181153338Z`, typecheck FAIL TS2531 в тесте цепочки, исправлено fix-коммитом).
