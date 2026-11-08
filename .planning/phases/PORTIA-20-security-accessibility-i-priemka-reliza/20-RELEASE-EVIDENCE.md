# 20-RELEASE-EVIDENCE: прогон релизного гейта

Commit: `c11adf6cd1e3f93f32800f91f8c70189d2e10682`
Node: v22.13.1
Режим: full
Начало: 2026-11-08T10:05:31.714Z
Каталог артефактов: `test-results/release-gate/c11adf6cd1e3-20261108T100531757Z`

## Гейты

| Gate | Команда | Exit | Статус | Passed/Failed/Skipped/Flaky | Артефакты | Данные |
|---|---|---|---|---|---|---|
| node-version | `node --version` | 0 | PASS | - | node-version-1.log | - |
| tree-clean | `git status --porcelain` | 0 | PASS | - | tree-clean-1.log | - |
| npm-ci | `npm.cmd ci` | 0 | PASS | - | npm-ci-1.log | - |
| unit | `npm.cmd test` | 0 | PASS | 1606/0/9/0 | unit-1.log | - |
| typecheck | `npm.cmd exec tsc -- --noEmit` | 0 | PASS | - | typecheck-1.log | - |
| build | `npm.cmd run build` | 0 | PASS | - | build-1.log | - |
| lint | `npm.cmd run lint` | 0 | PASS | - | lint-1.log | - |
| audit-prod | `npm.cmd audit --omit=dev` | 0 | PASS | - | audit-prod-1.log | - |
| audit-evidence | `node scripts/phase20-audit-check.mjs --verify` | 0 | PASS | - | audit-evidence-1.log | - |
| visual-manifest | `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts ; node scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | PASS | 49/0/0/0 | visual-manifest-1.log, visual-manifest-2.log | - |
| e2e-full | `npm.cmd run test:e2e -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --grep-invert @phase20 --output <артефакты>/e2e` | - | BLOCKED (ENV) | - | - | цель |
| ui-contract-offline | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-phone tests/e2e/specs/template-builder.spec.ts tests/e2e/specs/accessibility.spec.ts -g STAB-TMPL-01¦template builder --output <артефакты>/ui-contract-1 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-dpr125 --project=firefox-desktop --project=chromium-phone --project=webkit-phone tests/e2e/specs/template-builder.spec.ts -g D-61¦D-65 --output <артефакты>/ui-contract-2 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-phone tests/e2e/specs/editor-ui-contract.spec.ts tests/e2e/specs/image-framing.spec.ts --output <артефакты>/ui-contract-3 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=firefox-desktop --project=webkit-phone tests/e2e/specs/editor-ui-contract.spec.ts -g D-66 touch¦D-66 dialog¦D-67 «Справочник» section photo --output <артефакты>/ui-contract-4` | 1 | FAIL | 139/11/14/0 | ui-contract-offline-1.log, ui-contract-offline-1-results.json, ui-contract-1/, ui-contract-offline-2.log, ui-contract-offline-2-results.json, ui-contract-2/, ui-contract-offline-3.log, ui-contract-offline-3-results.json, ui-contract-3/, ui-contract-offline-4.log, ui-contract-offline-4-results.json, ui-contract-4/ | offline D-68 |
| visual-approved | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-desktop --project=chromium-dpr125 tests/e2e/visual --grep-invert @phase20 --output <артефакты>/visual-approved-1 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-phone --project=webkit-phone --project=firefox-desktop tests/e2e/visual --grep-invert @phase20 --output <артефакты>/visual-approved-2` | 1 | FAIL | 19/2/54/0 | visual-approved-1.log, visual-approved-1-results.json, visual-approved-1/, visual-approved-2.log, visual-approved-2-results.json, visual-approved-2/ | offline D-68 |
| visual-phase20 | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-desktop --project=chromium-phone tests/e2e/visual/phase20.spec.ts --output <артефакты>/visual-phase20-1` | 0 | BLOCKED (ENV) | 32/0/2/0 | visual-phase20-1.log, visual-phase20-1-results.json, visual-phase20-1/ | offline D-68 |
| mutation-attest | `npm.cmd run test:e2e:preflight:mutation` | - | BLOCKED (ENV) | - | - | staging |
| e2e-mutation | `npm.cmd run test:e2e:mutation -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --output <артефакты>/e2e-mutation ; npm.cmd run test:e2e:mutation -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure tests/e2e/specs/editor-layout.spec.ts --output <артефакты>/e2e-mutation-2` | - | BLOCKED (ENV) | - | - | staging |
| staging-live | `npm.cmd run test:staging-live` | - | BLOCKED (ENV) | - | - | staging |

Причины:

- e2e-full: missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET
- ui-contract-offline: 9 failed, 0 flaky/retried; first: specs/template-builder.spec.ts:453 [chromium-desktop] [STAB-TMPL-01] D-55 the downloaded PNG is the archive card
- visual-approved: 1 failed, 0 flaky/retried; first: visual/motion.spec.ts:24 [chromium-desktop] [STAB-BASE-03] approved web and Vivian motion states
- visual-phase20: 2 test(s) skipped as BLOCKED
- mutation-attest: missing environment variable(s): PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- e2e-mutation: missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET, PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- staging-live: mutation-attest is BLOCKED

## Перенесённые находки 19-REVIEW (D-33)

| ID | Статус | Коммит | Тест | Примечание |
|---|---|---|---|---|
| WR-03 | fixed | 2bb0b38 | lib/image-upload.test.ts :: uploadGate (WR-03) | 20-SECURITY-MATRIX.md; 20-17 |
| WR-05 | fixed | 062f256 | lib/editor-save-status.test.ts :: employeeRequestFailure, EmployeeProfilesEditor (WR-05) | 20-SECURITY-MATRIX.md; 20-17 |
| IN-01 | fixed | 87d7769 | lib/rich-text-media.test.ts :: IN-01 | 20-SECURITY-MATRIX.md; 20-18 |
| IN-02 | fixed | a8a0395 | lib/phase19-acceptance.test.ts :: IN-02 | 20-SECURITY-MATRIX.md; 20-18 |
| IN-03 | fixed | 062f256 | lib/editor-save-status.test.ts :: ОТОЗВАТЬ (IN-03) | 20-SECURITY-MATRIX.md; 20-17 |
| IN-04 | fixed | a8a0395 | lib/phase19-acceptance.test.ts :: IN-04 | 20-SECURITY-MATRIX.md; 20-18 |
| IN-05 | disposition | - | нет теста: исправление не вносилось | D-09: fallback колонок рейтинга оставлен, production baseline без production-доступа проверить нельзя (D-14); условие удаления записано в lib/portia-employees.ts |

## Решения D-35..D-45

| Решение | Статус | Доказательство |
|---|---|---|
| D-36(б) staging | PASS по фикстуре (LIMITATION: строки main на staging не было) | 20-CLASS-MIGRATION-EVIDENCE.md: runId p20cls-20261104-a7k2, seed/push/verify/cleanup exit 0, residual 0; supabase-rls-reviewer PASS-WITH-NOTES (статический); sha256 миграции 0037b930... |
| D-36(б) production | ОЖИДАЕТ ВЛАДЕЛЬЦА | миграция 20261104000000 на production не применялась; действие владельца, дата не заполнена |
| D-47 staging | BLOCKED (OWNER): функция удалена в 20-33 | заметки, маршрут /api/content/notes, спека editor-notes.spec.ts и lib/editor-notes.test.ts удалены в 20-33 (ddbf427, 59b107c); исторический результат 2026-11-05 (20/20 на staging, 20-EDITOR-NOTES-EVIDENCE.md) относится к удалённому коду; миграция удаления 20261106000000 на staging не применена |
| D-47 production | ОЖИДАЕТ ВЛАДЕЛЬЦА | на production не применены ни 20261104000100 (хранилище заметок), ни 20261106000000 (его удаление); решение и применение за владельцем, вместе или не применять вовсе |
| T-20-31 | PASS | lib/editor-outline.test.ts: 40 тестов, 40 pass, 0 fail (раздел «tab permissions (T-20-31)»: права ключей broadcastSections и searchRecommendationSections); входит и в гейт unit на чистом checkout (1606 pass, 0 fail) |
| D-43/D-44/D-37 | PASS (unit-тесты) / BLOCKED (ENV) (e2e) | unit: lib/portia-desktop.test.ts, search-index, search-recommendations, virus-classes, portia-content-normalize - 165 тестов, 165 pass; tests/e2e/specs/search-global-keys.spec.ts идёт в гейте e2e-full, который BLOCKED (ENV): нет цели с публичными значениями и данными |
| D-40..D-42 | BLOCKED (ENV) | tests/e2e/specs/editor-layout.spec.ts идёт в mutation lane (гейт e2e-mutation), нужен аттестованный isolated staging; mutation-attest BLOCKED (ENV) |
| D-39/D-45 | PASS (offline D-68; гейт visual-phase20 в целом BLOCKED (ENV)) | кадры «class icons» и «spider at rest» в @phase20 пройдены на chromium-desktop и chromium-phone (32 пройдено из 34, 2 пропуска - reviewer BLOCKED (ENV)); фиксированные данные 20-12, не доказательство реальных данных |

## Визуальная приёмка владельца (D-68)

| Пункт | Статус | Доказательство |
|---|---|---|
| Общий вердикт | ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08 | owner_verdict: accepted; owner_verdict_date: 2026-11-08; owner_verdict_commit: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1; источник: 20-58-SUMMARY.md; дословно (20-58-SUMMARY.md): «а) чтобы шаблон был почти индетичен как дата базы вирусов, Б) да В)да. принято» |
| Эталоны 20-12 | 56 строк реестра; BLOCKED/FAIL из 20-12-SUMMARY.md: phone-webkit--webkit-phone класс (г), 58293 px, baseline не заменён (FAIL); motion-vivian-activity и motion-vivian-offended BLOCKED (CAPTURE); reviewer-пара Promotion BLOCKED (ENV); firefox-desktop teardown `browserContext.close ... _maybeDontRestoreTabs ... undefined` в 20-12 (среда, не пиксели) | tests/e2e/visual/phase20-baselines.json; коммит вердикта реестра: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1 |
| Код продукта | НЕ ИЗМЕНЁН | git diff --name-only 0c2a59d1d1a7 c11adf6cd1e3 -- app components public lib (без *.test.*) |

## Окружение (только имена)

| Переменная | Задана |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | нет |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | нет |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | нет |
| PORTIA_PROMOTION_DEVICE_SECRET | нет |
| PORTIA_E2E_BASE_URL | нет |
| PORTIA_E2E_MUTATION_CONFIRM | нет |
| PORTIA_E2E_TARGET_ENVIRONMENT | нет |
| PORTIA_E2E_TARGET_ID | нет |
| PORTIA_E2E_SUPABASE_URL | нет |
| PORTIA_E2E_PRODUCTION_PROJECT_IDS | нет |
| PORTIA_E2E_ISOLATED_PROJECT_IDS | нет |

## Итог

Итог: FAIL

- e2e-full: BLOCKED (ENV) - missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET
- ui-contract-offline: FAIL - 9 failed, 0 flaky/retried; first: specs/template-builder.spec.ts:453 [chromium-desktop] [STAB-TMPL-01] D-55 the downloaded PNG is the archive card
- visual-approved: FAIL - 1 failed, 0 flaky/retried; first: visual/motion.spec.ts:24 [chromium-desktop] [STAB-BASE-03] approved web and Vivian motion states
- visual-phase20: BLOCKED (ENV) - 2 test(s) skipped as BLOCKED
- mutation-attest: BLOCKED (ENV) - missing environment variable(s): PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- e2e-mutation: BLOCKED (ENV) - missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET, PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- staging-live: BLOCKED (ENV) - mutation-attest is BLOCKED
- PW-07: owner waiver accepted
- PW-10: owner waiver accepted

## Запуск и среда

- Release candidate: `c11adf6cd1e3f93f32800f91f8c70189d2e10682` (HEAD после коммитов Task 1: RED `3bf72f7`, GREEN `c11adf6`). Запуск: `node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit c11adf6cd1e3f93f32800f91f8c70189d2e10682` из временной копии `portia-release-c11adf6cd1e3-20261108T100531757Z` (создана и удалена раннером, `git worktree list` без неё). Артефакты первой ошибки: `test-results/release-gate/c11adf6cd1e3-20261108T100531757Z/` (результаты JSON, trace, логи сервера).
- Node 22.13.1 (`%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`). npm: встроенный в этот Node npm 10.9.2 не запускает `npm ci` (MODULE_NOT_FOUND `node-gyp/bin/node-gyp.js`; первая попытка запуска раннера на том же commit, артефакты `c11adf6cd1e3-20261108T100427008Z`, все npm-гейты FAIL/BLOCKED (DEP) по этой причине, в протокол не входит). Второй запуск: npm 11.19.0 из установки Node по умолчанию вызывается обёрткой `npm.cmd` в начале PATH и исполняется найденным первым Node 22.13.1. Это среда, не код.
- Офлайн-гейты (`ui-contract-offline`, `visual-approved`, `visual-phase20`): production-сборка копии и `next start` на 127.0.0.1:3100 под `tests/e2e/harness/offline-supabase.cjs` с выдуманными значениями `OFFLINE_ENV`, Playwright CLI копии напрямую, `--retries=0 --fail-on-flaky-tests --update-snapshots=none` (визуальные). Из окружения процессов убраны переменные mutation, staging, привилегированные и реальные публичные имена; в протокол попадают только имена. Сервер каждого гейта остановлен раннером по PID и проверен: на 3100 после прогона 0 слушателей. Режим данных «offline D-68» - UI-контракт и эталоны на стартовом контенте, не доказательство реальных данных, ролей или сохранения.
- Гейты `e2e-full`, `mutation-attest`, `e2e-mutation`, `staging-live` не запускались: нет цели с публичными значениями и нет аттестованного isolated staging (BLOCKED (ENV)); под заглушку они не переводились.
- Production не затрагивался, `.env*` не читались, Supabase не вызывался, `tests/e2e/visual/__screenshots__` не менялись.

## Красный ui-contract-offline

Гейт FAIL: 9 упавших в шаге 1 (template-builder на chromium-desktop и chromium-phone: D-55 PNG, local image and long text, encoding failure, card too long, D-65 layout) и 2 в шаге 2 (D-65 на chromium-desktop и chromium-dpr125), шаги 3 и 4 зелёные (87/0/3 и 8/0/4). Причина по вложению diagnostics: непредусмотренное консольное событие `Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set` (плюс разрешённый 404 `/api/promotion/status`). Повторный частичный прогон `--only npm-ci,ui-contract-offline` на том же commit (артефакты `c11adf6cd1e3-20261108T101640603Z`) дал те же 9 упавших в шаге 1: результат детерминирован. В 20-58 те же проверки на H6 давали 40/0/2 и 15/0/5. Причина расхождения не установлена (кандидаты: флаги раннера `--trace`/`--fail-on-flaky-tests`, чистая установка зависимостей npm 11.19.0); кадры и допуски диагностики не менялись.

## Открытые блокеры 20-12, записанные без исправления

| Блокер | Строка гейта | Статус |
|---|---|---|
| `phone-webkit--webkit-phone`: класс (г), 58293 px, у прежнего одобренного кадра полоса прокрутки, у нового её нет; baseline не заменён | visual-approved | FAIL (воспроизведён этим прогоном: 58293 px на webkit-phone) |
| `motion-vivian-activity`, `motion-vivian-offended`: BLOCKED (CAPTURE), кадр не воспроизводится между одинаковыми прогонами | visual-approved | FAIL в одном из двух кадров на каждый прогон (этот прогон: vivian-activity, 3110 px) |
| baselines reviewer-пары Promotion (PC и телефон) | visual-phase20 | BLOCKED (ENV): нет аттестованного staging (19-VERIFICATION); 2 теста пропущены |
| firefox-desktop: прерывистый сбой завершения `browserContext.close ... _maybeDontRestoreTabs ... undefined` | visual-approved | в этом прогоне не проявился (firefox-desktop: 1 тест пройден, 0 упавших); остаётся прерывистой средой, не пикселями, и не засчитывается как PASS гейта |

Базовые кадры не заменялись и политика допусков не менялась: красный гейт - допустимый итог репетиции.

## Унаследованные пробелы Phase 19

- CR-01 (таймер медиа): исправлен в 19-15 (STAB-MEDIA-03 на Chromium desktop и phone); firefox-desktop-вариант - PW-07, waiver принят владельцем 2026-11-04.
- STAB-PROM-15 (приёмка Promotion на isolated staging, физические PC и телефон): BLOCKED, открыт; прогон mw1loqa9_c9451c80 и роль reviewer на staging - долг Phase 19/20.
- BLOCKED (DATA): пустые состояния и populated-ячейки на целевых данных (19-VERIFICATION, 19-19..22) остаются BLOCKED; офлайн-заглушка их не закрывает.

## Безопасность и зависимости

- Production dependency audit: `npm audit --omit=dev` - `found 0 vulnerabilities` (гейт audit-prod PASS). Dev audit: 16 moderate, 0 high, 0 critical, disposition `accepted` (20-DEPENDENCY-AUDIT.md, гейт audit-evidence PASS).
- Матрица безопасности (20-SECURITY-MATRIX.md): подтверждённых неисправленных high нет, блокеров релиза 0; medium-находки SEC20-01, 03, 04, 08, 09, 12, 13, 16, 17 описаны в релизном реестре (D-09).
- CSP: кандидат доставляется только как Content-Security-Policy-Report-Only; enforcement заблокирован до физической проверки PC/phone (D-05).
- По D-05/D-08/D-14 физическая LAN-проверка CSP относится к локальной production-сборке; опубликованные HTTPS, HSTS и `upgrade-insecure-requests` остаются отдельным ограничением доказательств (LIMITATION).

## Известное ограничение гейтов

- `visual-approved` и `e2e-full` считают пропуск по условию проекта (`test.skip(project !== ...)`) как SKIPPED, поэтому гейт не сможет стать PASS, пока в отчёте есть такие пропуски (в этом прогоне visual-approved: 54 пропуска, ui-contract-offline принимает их по правилу «тест прошёл на другом проекте»). Для визуальных гейтов правило не распространено; записано в deferred-items.md.
