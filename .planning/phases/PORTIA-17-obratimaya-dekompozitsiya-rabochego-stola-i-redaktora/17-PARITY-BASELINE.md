# Phase 17: эталон parity-gate до нарезки

Снят на нетронутом коде перед первой правкой Phase 17 (план 17-01, Task 1).

- **HEAD:** `55f51d60d60362da55b28dd8010156d2260cdf85` (ветка `design/stage-1-desktop`)
- **Node для gate:** 22.13.1 (`%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`, первым в PATH). Машинный Node по умолчанию: 24.21.0.
- **Незакоммиченные tracked-файлы на момент снятия:** только `.planning/STATE.md`, `.planning/milestone.lock`, `.planning/state.json` (код чист).

## Шаги gate

| Шаг | Исход |
|-----|-------|
| `npm test` | exit 0; tests 650, pass 649, fail 0, skipped 1, cancelled 0 |
| `npm exec tsc -- --noEmit` | exit 0 |
| `npm run lint` | exit 0; 0 errors, 18 warnings (17 `@next/next/no-img-element`, 1 `react-hooks/exhaustive-deps`; все уже существующие) |
| `npm run build` | exit 0 |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | exit 0; tests 37, pass 37, fail 0 |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | exit 0; "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded." |
| `npm exec playwright -- test --list` | exit 1: BLOCKED (ENV) |
| `npm exec playwright -- test tests/e2e/visual --retries=0 --update-snapshots=none` | exit 1: BLOCKED (ENV), ни один тест не запускался |

Причина BLOCKED: `playwright.config.ts` на загрузке вызывает `scripts/phase15-e2e-preflight.mjs visitor`, который печатает
`[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY.`
В окружении процесса нет `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (значения лежат только в `.env.local`, который по правилам проекта не читается и не копируется в окружение). Окружение не менялось, ключи не подставлялись. Node 22.13.1 был подключён, так что причина не версия Node, а отсутствие env (ENV/DATA, не TOOLING по Node).

После обоих Playwright-запусков `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст (0 строк).

## Визуальная дорожка tests/e2e/visual: тест x проект

Список тестов взят статическим чтением spec-файлов (`--list` недоступен). Исход каждой ячейки: **BLOCKED (ENV)**, тест не запускался. Это не pass и не skip. Колонка "по коду" показывает, что произошло бы при запуске: pixel authority закреплён за `chromium-desktop` (`test.skip` в `beforeEach` для остальных проектов); устройство-специфичные строки объявлены в `desktop.spec.ts`.

| Spec | chromium-desktop | chromium-dpr125 | firefox-desktop | webkit-phone | chromium-phone | по коду |
|------|------------------|-----------------|-----------------|--------------|----------------|---------|
| apps.spec.ts (`[STAB-BASE-03] approved public application: <name>`, цикл по приложениям) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | skip везде кроме chromium-desktop |
| desktop.spec.ts `approved desktop and window shell` | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | без skip в beforeEach |
| desktop.spec.ts `approved declared device project` | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | skip для проектов без объявленной device-строки |
| editor.spec.ts `approved signed-out editor access` | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | skip везде кроме chromium-desktop |
| motion.spec.ts `approved web and Vivian motion states` | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | skip везде кроме chromium-desktop |
| promotion.spec.ts `approved safe Promotion participant lookup` | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | BLOCKED (ENV) | skip везде кроме chromium-desktop |

Ни одна ячейка не passed. Для Phase 17 это значит: пиксельная parity-проверка недоступна, пока владелец не предоставит preflight-окружение; доказательство переносов опирается на `scripts/phase17-move-parity.mjs` (чистый перенос строк), source-тесты, tsc, lint, build и `--verify-promotion` (байты утверждённых снимков).

Правило сравнения для Task 2: исход не должен стать хуже эталона. Строки BLOCKED с той же причиной регрессией не считаются; записывать их как pass нельзя.
