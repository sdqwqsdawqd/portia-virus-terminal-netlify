# 24 - Полная локальная проверка

Дата: 2026-11-15. Проверяемый HEAD: `2961f32d7f35240b79f869bbc2e89ddd68ec4858` (охваченные матрицей пути на нём равны `a9847aaf6f0fd869670d0b83fd78b3b48c56e54f`). Node: v22.13.1 (эталон, из `%TEMP%\portia-node-v22.13.1`).

## Почему `run.sh` сам не отработал

`bash .claude/skills/portia-check/run.sh` запускался 2026-11-15 09:58:12 UTC и завершился кодом 1 на первом шаге («unit tests», `npm test --silent`): в этой среде сломан `npm` под временным Node 22.13.1, любой `npm test`, `npm run` и `npm exec` падает с `npm error code MODULE_NOT_FOUND`, `Cannot find module 'node-gyp/bin/node-gyp.js'`. Это дефект временной копии Node, не проекта. Скрипт `run.sh` не обходился и не менялся; ниже те же шаги выполнены напрямую теми же программами (`node`, `tsc`, `eslint`), как их запускают `npm`-скрипты. Прогон самого `run.sh` не засчитан.

## Команды

Прямые эквиваленты шагов `run.sh`, по порядку.

| Команда | Код выхода | Итог | Время UTC |
|---|---|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` (эквивалент `npm test`, включая свежесть матрицы Phase 24) | 0 | tests 2103, pass 2100, fail 0, skipped 3, cancelled 0 | 2026-11-15 09:58:28 - 09:58:38 |
| `node node_modules/typescript/bin/tsc --noEmit` (эквивалент `npm exec tsc -- --noEmit`) | 0 | 0 ошибок, вывод пуст | 2026-11-15 09:58:38 - 09:58:41 |
| `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` (эквивалент `npm run lint`) | 0 | 17 problems (0 errors, 17 warnings) | 2026-11-15 09:58:41 - 09:58:58 |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | 0 | tests 49, pass 49, fail 0, skipped 0 | 2026-11-15 09:58:58 - 09:59:04 |
| `node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded. | 2026-11-15 09:59:04 |

Пропуски unit-набора (3) — прежние opt-in живые наборы, не выполняемые обычным `npm test`: `live Promotion database verification is opt-in` (нужен `npm run test:promotion-live` на изолированном проекте), `staging live concurrency` и `staging live role matrix` (нужен `npm run test:staging-live`). Тесты матрицы и доказательств Phase 24 не пропущены: `lib/security-matrix.test.ts` (51 тест) и `lib/phase24-evidence.test.ts` проходят без `skip`. Предупреждения lint (17) прежние, из несвязанных файлов (например, неиспользуемая `shaCache`); Phase 24 их не добавляет и не чинит.

Режим `--verify` визуального манифеста не запускался; после проверок `git status` не показал изменений в отслеживаемых файлах, кроме прежних `.planning/milestone.lock` и `.planning/state.json` владельца.

Итог прямых эквивалентов: == all checks passed (прямые эквиваленты шагов `run.sh`, не сам `run.sh`), 2026-11-15 09:59:04 UTC.

## BLOCKED

Ни один пункт ниже не засчитан как пройденный.

- BLOCKED: сам `bash .claude/skills/portia-check/run.sh` (сломан `npm` временного Node, см. выше).
- BLOCKED: `npm run build` на итоговом HEAD с реальным источником данных и Playwright по данным (нет чтения данных; браузерная сборка Task 1 с подменой `/api/**` была до исправлений раунда 1 и не заменяет эту проверку).
- BLOCKED: живые роли (посетитель, одобренный посетитель, редактор, владелец) на настоящей аутентификации.
- BLOCKED: Postgres/RLS и RPC шлюза на живой базе.
- BLOCKED: staging и production, включение закрытия (Phase 25).
- BLOCKED: Netlify CDN, заголовки кэша и `Set-Cookie` на GET `/api/content`.
- BLOCKED: физические устройства.
