# Phase 21: отложенные находки

## 21-02 (SEC-08): подпись аудита зависимостей Phase 20 устарела после подъёма next

- Тест: `lib/security-matrix.test.ts` "the real audit evidence verifies: both audits on one commit, production clean, one disposition per dev advisory".
- Падение: `stale report: package-lock.json changed after the audit was captured` и `stale report: package.json changed after the audit was captured` (`scripts/phase20-audit-check.mjs`, `verifyAuditReport`).
- Причина: `20-DEPENDENCY-AUDIT.json` хранит sha256 `package.json` и `package-lock.json`. Любое изменение этих файлов (в том числе SEC-08, коммит 255ec54) делает отчёт устаревшим. Это детерминированное следствие подъёма, а не дефект кода.
- Не исправлено в 21-02: пересъёмка (`node scripts/phase20-audit-check.mjs --capture`) перезаписывает подписанные доказательства Phase 20, ходит в реестр npm и выходит за `files_modified` плана 21-02 и его правило "один standalone-коммит". Решение за владельцем/оркестратором.
- Рекомендация: пересъёмка аудита и обновление dev-dispositions отдельным шагом (например, в 21-07, где уже закрывается красное окно security-matrix), либо отдельный quick-таск. Статус: OPEN, красный тест остаётся до этого шага.

**Закрыто 2026-11-09 (коммит 21ef19c), решение владельца «1 — исправить сейчас»:** аудит пересобран (`--capture` на 92b8405, машинный npm 11.19.0 / Node 24.21.0, потому что npm из временного Node 22.13.1 падает без `node-gyp`). Production 0 находок; dev 8 moderate (все от GHSA-g3hv-75wg-m249) вместо 16; dispositions обновлены; `--verify` проходит. `lib/*.test.ts` под Node 22.13.1: 1742 теста, 1737 pass, 2 fail (ожидаемое красное окно security-matrix, закроет 21-07), 3 skipped. Статус: RESOLVED.
