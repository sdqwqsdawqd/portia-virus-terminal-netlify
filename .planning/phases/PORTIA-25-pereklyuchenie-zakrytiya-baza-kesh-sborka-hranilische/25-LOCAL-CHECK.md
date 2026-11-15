# 25 - Полная локальная проверка

Дата: 2026-11-15. Проверяемый HEAD: `b1457c2` (код и SQL фазы на нём равны проверенному ревью коммиту `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`: после него менялись только документы и тесты). Node: v22.13.1 (эталон, из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`, найден на PATH).

## Почему `run.sh` сам не отработал

`bash .claude/skills/portia-check/run.sh build` запускался 2026-11-15 19:58:46 UTC и завершился кодом 1 на первом шаге («unit tests», `npm test --silent`): в этой среде сломан `npm` под временным Node (`Cannot find module 'node-gyp/bin/node-gyp.js'`; тот же сбой дал `npm run build` при запуске `webServer` Playwright в 25-10, 19:42:38 UTC). Это дефект среды, не кода. Дальше шаги выполнены прямыми эквивалентами тем же Node и теми же инструментами; сборка выполнена `next build` напрямую, а скан `postbuild` запущен явно.

## Исключённый тест (красное окно владельца)

Тест `lib/security-matrix.test.ts` «the real audit evidence verifies: both audits on one commit, production clean, one disposition per dev advisory» красный: `package.json` изменился после снятия аудита зависимостей (строка `postbuild` из 25-09), отчёт устарел. По решению владельца в этом запуске он вынесен в красное окно и исключён шаблоном `--test-skip-pattern`; `scripts/phase20-audit-check.mjs --capture` не запускался, архивный `20-DEPENDENCY-AUDIT.json` не менялся: переснимает оркестратор после плана. Пока этого нет, «полный `npm test` без красных» не достигнут; запуск без исключения записан отдельной строкой ниже (код 1, один красный тест).

## Команды

Прямые эквиваленты шагов `run.sh`, по порядку.

| Команда | Код выхода | Итог | Время UTC |
|---|---|---|---|
| `node --experimental-strip-types --test --test-skip-pattern="the real audit evidence verifies" lib/*.test.ts` (эквивалент `npm test`; свежесть матрицы Phase 25 входит) | 0 | tests 2226, pass 2223, fail 0, skipped 3, cancelled 0 (плюс один исключённый тест аудита, см. выше) | 2026-11-15 19:57:38 - 19:57:48 |
| `node node_modules/typescript/bin/tsc --noEmit` (эквивалент `npm exec tsc -- --noEmit`) | 0 | 0 ошибок, вывод пуст | 2026-11-15 19:57:59 - 19:58:02 |
| `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` (эквивалент `npm run lint`) | 0 | 17 problems (0 errors, 17 warnings; столько же было в 24-LOCAL-CHECK; в файлах, изменённых планом 25-10, предупреждений нет) | 2026-11-15 19:58:02 - 19:58:21 |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | 0 | tests 49, pass 49, fail 0, skipped 0 | 2026-11-15 19:58:21 - 19:58:27 |
| `node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded. | 2026-11-15 19:58:27 - 19:58:28 |
| `node node_modules/next/dist/bin/next build` (эквивалент `npm run build`; данные источника по `.env.local` читает сам Next) | 0 | Compiled successfully, 3 статические страницы | 2026-11-15 19:58:34 - 19:58:41 |
| `node scripts/phase25-build-scan.mjs` (то, что запускает `postbuild`) | 0 | build scan: 0 markers in 457 files | 2026-11-15 19:58:41 |
| `node --experimental-strip-types --test lib/*.test.ts` (без исключения, для записи) | 1 | tests 2227, pass 2223, fail 1, skipped 3: красный только «the real audit evidence verifies» (устаревший аудит, см. выше) | 2026-11-15 19:59:01 - 19:59:11 |
| `bash .claude/skills/portia-check/run.sh build` (сам скрипт) | 1 | остановился на шаге unit tests: сломан `npm` (см. выше) | 2026-11-15 19:58:46 - 19:58:47 |

Пропуски unit-набора (3) — прежние opt-in живые наборы, не выполняемые обычным запуском: `live Promotion database verification is opt-in` (нужен `npm run test:promotion-live` на изолированном тестовом проекте) и два набора `staging live ...` (нужен `npm run test:staging-live`, меняет данные). Они не заменяются и не засчитаны; в живых линиях ниже они BLOCKED.

Режим `--verify` визуального манифеста не запускался; после проверок `git status` не показал изменений отслеживаемых файлов, кроме прежних `.planning/milestone.lock` и `.planning/state.json`. Сборка и сканирование выполнены на HEAD с кодом 0; запуск `next start` для браузерной спецификации и его результаты записаны в `25-BROWSER-EVIDENCE.md`.

Строка `== all checks passed` самого `run.sh` не получена (скрипт остановился на `npm`); прямые эквиваленты шагов, по порядку, завершились кодом 0 (unit: без одного исключённого теста аудита по решению владельца), 2026-11-15 19:58:41 UTC. Это запись о прямых эквивалентах, не о самом `run.sh`.

## BLOCKED

Ни один пункт ниже не засчитан как пройденный.

- BLOCKED: сам `bash .claude/skills/portia-check/run.sh` (сломан `npm` временного Node).
- BLOCKED: `npm run build` с реальным источником данных и Playwright по данным (нет чтения данных; браузерная спецификация 25-10 идёт с подменой всех `/api/**`).
- BLOCKED: живые роли (посетитель, одобренный посетитель, редактор, владелец) на настоящей аутентификации.
- BLOCKED: Postgres/RLS, функции подписанного чтения и политики Storage на живой базе, анонимный отказ чтения по публичному ключу.
- BLOCKED: staging и production, применение миграций и включение закрытия (ОЖИДАЕТ ВЛАДЕЛЬЦА по `25-OWNER-CHECKLIST.md`).
- BLOCKED: Netlify CDN, заголовки и сброс кэша, `postbuild` на Netlify.
- BLOCKED: физические устройства и другие движки браузера.
- BLOCKED: живые наборы `test:promotion-live` и `test:staging-live` (нет изолированного проекта).
