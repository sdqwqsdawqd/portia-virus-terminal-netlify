---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
artifact: release-reconciliation
status: in-progress
final_release_commit: a05a6019e867a39a42e2d33b9e4f176d281bc659
release_candidate_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_base: 3efb53d859098f1329138bc067b8ee88399ba41e
---

# 20-RECONCILIATION: сверка релиза Phase 20 (D-70)

Документ создан планом 20-15. Итоговый release commit (FRC) — `a05a6019e867a39a42e2d33b9e4f176d281bc659`: GREEN-коммит `--verify-lineage`. С этого момента до конца плана меняются только `.planning/**`, `scripts/phase20-release-gate.mjs` и `lib/phase20-release-gate.test.ts`; это проверяет `--verify-reconciliation` (Task 3).

Полный прогон раннера на FRC выполняется; разделы ниже заполняются по его протоколу.
