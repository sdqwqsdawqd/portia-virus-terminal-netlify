# 20-RELEASE-EVIDENCE: прогон релизного гейта

Commit: `a05a6019e867a39a42e2d33b9e4f176d281bc659`
Node: v22.13.1
npm: 11.19.0 (--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js)
Режим: full
Начало: 2026-11-08T18:47:22.729Z
Каталог артефактов: `test-results/release-gate/a05a6019e867-20261108T184722771Z`

## Гейты

| Gate | Команда | Exit | Статус | Passed/Failed/Skipped/Flaky | Артефакты | Данные |
|---|---|---|---|---|---|---|
| node-version | `node --version` | 0 | PASS | - | node-version-1.log | - |
| tree-clean | `git status --porcelain` | 0 | PASS | - | tree-clean-1.log | - |
| npm-ci | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js ci` | 0 | PASS | - | npm-ci-1.log | - |
| unit | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js test` | 0 | PASS | 1683/0/9/0 | unit-1.log | - |
| typecheck | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js exec tsc -- --noEmit` | 0 | PASS | - | typecheck-1.log | - |
| build | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run build` | 0 | PASS | - | build-1.log | - |
| lint | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run lint` | 0 | PASS | - | lint-1.log | - |
| audit-prod | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js audit --omit=dev` | 0 | PASS | - | audit-prod-1.log | - |
| audit-evidence | `node scripts/phase20-audit-check.mjs --verify` | 0 | PASS | - | audit-evidence-1.log | - |
| visual-manifest | `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts ; node scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | PASS | 49/0/0/0 | visual-manifest-1.log, visual-manifest-2.log | - |
| e2e-full | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run test:e2e -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --grep-invert @phase20 --output <артефакты>/e2e` | - | BLOCKED (ENV) | - | - | цель |
| ui-contract-offline | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-phone tests/e2e/specs/template-builder.spec.ts tests/e2e/specs/accessibility.spec.ts -g STAB-TMPL-01¦template builder --output <артефакты>/ui-contract-1 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-dpr125 --project=firefox-desktop --project=chromium-phone --project=webkit-phone tests/e2e/specs/template-builder.spec.ts -g D-61¦D-65 --output <артефакты>/ui-contract-2 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=chromium-desktop --project=chromium-phone tests/e2e/specs/editor-ui-contract.spec.ts tests/e2e/specs/image-framing.spec.ts --output <артефакты>/ui-contract-3 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --project=firefox-desktop --project=webkit-phone tests/e2e/specs/editor-ui-contract.spec.ts -g D-66 touch¦D-66 dialog¦D-67 «Справочник» section photo --output <артефакты>/ui-contract-4` | 0 | PASS | 150/0/14/0 (по проекту 14) | ui-contract-offline-1.log, ui-contract-offline-1-results.json, ui-contract-1/, ui-contract-offline-2.log, ui-contract-offline-2-results.json, ui-contract-2/, ui-contract-offline-3.log, ui-contract-offline-3-results.json, ui-contract-3/, ui-contract-offline-4.log, ui-contract-offline-4-results.json, ui-contract-4/ | offline D-68 |
| visual-approved | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-desktop --project=chromium-dpr125 tests/e2e/visual --grep-invert @phase20 --output <артефакты>/visual-approved-1 ; node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-phone --project=webkit-phone --project=firefox-desktop tests/e2e/visual --grep-invert @phase20 --output <артефакты>/visual-approved-2` | 0 | PASS | 21/0/54/0 (по проекту 54) | visual-approved-1.log, visual-approved-1-results.json, visual-approved-1/, visual-approved-2.log, visual-approved-2-results.json, visual-approved-2/ | offline D-68 |
| visual-phase20 | `node node_modules/@playwright/test/cli.js test --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --update-snapshots=none --project=chromium-desktop --project=chromium-phone tests/e2e/visual/phase20.spec.ts --output <артефакты>/visual-phase20-1` | 0 | BLOCKED (ENV) | 32/0/2/0 | visual-phase20-1.log, visual-phase20-1-results.json, visual-phase20-1/ | offline D-68 |
| mutation-attest | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run test:e2e:preflight:mutation` | - | BLOCKED (ENV) | - | - | staging |
| e2e-mutation | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run test:e2e:mutation -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure --output <артефакты>/e2e-mutation ; node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run test:e2e:mutation -- --retries=0 --fail-on-flaky-tests --trace=retain-on-first-failure tests/e2e/specs/editor-layout.spec.ts --output <артефакты>/e2e-mutation-2` | - | BLOCKED (ENV) | - | - | staging |
| staging-live | `node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run test:staging-live` | - | BLOCKED (ENV) | - | - | staging |

Причины:

- e2e-full: missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET
- ui-contract-offline: 2 skip(s) by project condition; each such test passed on another project in this gate run; 5 skip(s) by project condition; each such test passed on another project in this gate run; 3 skip(s) by project condition; each such test passed on another project in this gate run; 4 skip(s) by project condition; each such test passed on another project in this gate run
- visual-approved: 14 skip(s) by project condition; each such test passed on another project in this gate run; 40 skip(s) by project condition; each such test passed on another project in this gate run
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
| T-20-31 | PASS | lib/editor-outline.test.ts: 40 тестов, 40 pass, 0 fail (раздел «tab permissions (T-20-31)»: права ключей broadcastSections и searchRecommendationSections); перепроверено в основной папке на FRC a05a6019e867 (Node 22.13.1, `node --experimental-strip-types --test lib/editor-outline.test.ts`); входит и в гейт unit на чистой копии (1692 tests, 1683 pass, 0 fail, 9 skipped) |
| D-43/D-44/D-37 | PASS (unit-тесты) / BLOCKED (ENV) (e2e) | unit: lib/portia-desktop.test.ts, search-index, search-recommendations, virus-classes, portia-content-normalize - 165 тестов, 165 pass, 0 fail (перепроверено в основной папке на FRC a05a6019e867); tests/e2e/specs/search-global-keys.spec.ts идёт в гейте e2e-full, который BLOCKED (ENV): нет цели с публичными значениями и данными |
| D-40..D-42 | BLOCKED (ENV) | tests/e2e/specs/editor-layout.spec.ts идёт в mutation lane (гейт e2e-mutation), нужен аттестованный isolated staging; mutation-attest BLOCKED (ENV) |
| D-39/D-45 | PASS (offline D-68; гейт visual-phase20 в целом BLOCKED (ENV)) | кадры «class icons» и «spider at rest» в @phase20 пройдены на chromium-desktop и chromium-phone (visual-phase20 на a05a6019e867: 32 пройдено из 34, 2 пропуска - reviewer BLOCKED (ENV)); фиксированные данные 20-12, не доказательство реальных данных |

## Визуальная приёмка владельца (D-68)

| Пункт | Статус | Доказательство |
|---|---|---|
| Общий вердикт | ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08 | owner_verdict: accepted; owner_verdict_date: 2026-11-08; owner_verdict_commit: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1; источник: 20-58-SUMMARY.md; дословно (20-58-SUMMARY.md): «а) чтобы шаблон был почти индетичен как дата базы вирусов, Б) да В)да. принято» |
| Эталоны 20-12 | 60 строк реестра | tests/e2e/visual/phase20-baselines.json; коммит вердикта реестра: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1 |
| Код продукта | НЕ ИЗМЕНЁН | git diff --name-only 0c2a59d1d1a7 a05a6019e867 -- app components public lib (без *.test.*) |

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

Итог: BLOCKED

- e2e-full: BLOCKED (ENV) - missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET
- visual-phase20: BLOCKED (ENV) - 2 test(s) skipped as BLOCKED
- mutation-attest: BLOCKED (ENV) - missing environment variable(s): PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- e2e-mutation: BLOCKED (ENV) - missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET, PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS
- staging-live: BLOCKED (ENV) - mutation-attest is BLOCKED
- PW-07: owner waiver accepted
- PW-10: owner waiver accepted

## Закрытие пунктов репетиции 20-13 (D-69)

Повтор репетиции 20-13 после планов 20-59..20-62 выполнен в 20-63 на release candidate `f49aa00f2b98` (BLOCKED) и повторён в 20-15 полным прогоном на итоговом release commit FRC `a05a6019e867a39a42e2d33b9e4f176d281bc659`. Протоколы 20-13 (c11adf6, итог FAIL, коммит 46d9704) и 20-63 (f49aa00f2b98, итог BLOCKED) остаются в истории git.

| Пункт | План | Коммиты | Доказательство | Итог в этом прогоне |
|---|---|---|---|---|
| G1: консольное событие `Blocked script execution in 'about:srcdoc'` в ui-contract-offline | 20-60 | a6a77ae (причина), 7c06c4d (RED), 3e27b1e (GREEN), abdc4c4 (deferred-items) | причина: снимки DOM трассировки Playwright (флаг раннера `--trace`) в песочнице скрытого кадра `measureCardPage`, класс T, продукт не менялся; правило ожидаемого события только в пяти тестах с PNG, охранные unit-тесты | ui-contract-offline PASS 150/0/14 (по проекту 14), offline D-68 |
| G2: эталон `phone-webkit--webkit-phone` (класс (г), 58293 px) | 20-61 | 4f96258 (причина), b58051c (замена эталона), d901593 (план закрыт) | причина: одобренный кадр Phase 15 снят в переходном состоянии (закрытое окно «Настройки» ещё в потоке, полоса прокрутки 10 px); строка реестра `accepted-redesign`, `supersedes` = одобренный hash; допуски и маски не менялись | visual-approved PASS 21/0/54 (по проекту 54), offline D-68; webkit-phone пройден |
| G3: воспроизводимость кадров движения Вивьян | 20-62 | cf36225 (RED), cc3f13e (GREEN), dee25d5 (три эталона заменены), 7a36547 (план закрыт) | три причины расхождения (старт паука при парковке часов, фаза росы паутины, конечные переходы Вивьян) плюс оборванный `/api/employees`; шесть прогонов подряд 0 px; три кадра заменены классом `deterministic-capture`, политика `motion:*` не менялась | visual-approved PASS 21/0/54 (по проекту 54), offline D-68 |
| G4: пропуск по условию проекта в визуальных гейтах и e2e-full | 20-59 | 094aec2 (RED), 85c2484 (GREEN), 3babecd (deferred-items) | единое правило уровня гейта: условие доказано исходником спека и тот же тест прошёл на другом проекте того же прогона; пропуск по данным и BLOCKED не засчитываются | ui-contract-offline (по проекту 14) и visual-approved (по проекту 54) PASS; счётчики с суффиксом «(по проекту N)» |
| G5: npm прогона явный и записанный | 20-59 | ed665e2 (RED), 5944ed5 (GREEN) | флаг `--npm-cli`, строка `npm:` в протоколе и receipt.json, `--verify-evidence` отвергает протокол без неё | строка `npm: 11.19.0 (--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js)`; npm-ci PASS |

Код продукта после вердикта владельца 0c2a59d1d1a7 не менялся (20-60, 20-61, 20-62, 20-63, 20-14 и 20-15 изменили только тесты, фикстуры, эталоны, раннер и документы); «Код продукта» в таблице выше посчитан раннером от 0c2a59d1d1a7 до FRC. Действующий вердикт владельца раннер читает функцией `readEffectiveOwnerVerdict` (цепочка `owner_verdict_renews`); звеньев нет, поэтому результат равен 20-58-SUMMARY.md.

## Открытые блокеры

Итог BLOCKED, а не PASS: полосы среды не имеют цели. FAIL продукта, UI-контракта и эталонов в этом прогоне нет. Каждая BLOCKED-полоса внесена в реестр принятых долгов (D-70) в 20-RECONCILIATION.md; принятие риска владельцем (D-70) не превращает BLOCKED в PASS.

| Блокер | Строка гейта | Статус |
|---|---|---|
| baselines reviewer-пары Promotion (PC и телефон): нет аттестованного staging проверяющего (19-VERIFICATION); 2 теста пропущены | visual-phase20 | BLOCKED (ENV) |
| нет цели с публичными значениями (адрес и ключ Supabase, секрет устройства Promotion) и данными | e2e-full | BLOCKED (ENV) |
| нет аттестованного isolated staging (переменные подтверждения мутаций, цели и проектов не заданы) | mutation-attest, e2e-mutation, staging-live | BLOCKED (ENV) |
| firefox-desktop: прерывистый сбой завершения `browserContext.close ... _maybeDontRestoreTabs ... undefined` | ui-contract-offline, visual-approved | в этом прогоне не проявился: 0 из 3 запусков с firefox-desktop (ui-contract-offline шаги 2 и 4, visual-approved шаг 2); остаётся прерывистой средой, не пикселями, и не засчитывается как PASS гейта |
| решения владельца D-36(б) production и D-47 production: миграции на production не применялись | таблица «Решения D-35..D-45» | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| записи a11y редактора 20-46, 20-50, 20-53 в deferred-items.md (status: open): не вызваны этим планом, не гейт этого прогона | deferred-items.md | открыты, без изменений |

Физическая приёмка PC и телефона (20-14) этим протоколом не засчитывается и не заменяется: по D-70 владелец принял риск без пошаговой проверки (вердикт «ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)», не PASS, 20-UAT.md); это не результат гейтов. Базовые кадры не заменялись, политика допусков не менялась.

## Запуск и среда

- Итоговый release commit (FRC): `a05a6019e867a39a42e2d33b9e4f176d281bc659` — GREEN-коммит `--verify-lineage` плана 20-15 (код продукта не менялся с 0c2a59d1d1a7). Release candidate: `f49aa00f2b9833f962fa3fa890117e98a4abf362` (20-63, итог BLOCKED). Файлы после FRC меняются только в `.planning/**`, `scripts/phase20-release-gate.mjs`, `lib/phase20-release-gate.test.ts` и `lib/phase20-release-notes.test.ts` (утверждение о реальных release notes: draft сменился на final); это проверяет `--verify-reconciliation`.
- Запуск полного прогона из основной папки: `node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit a05a6019e867a39a42e2d33b9e4f176d281bc659 --npm-cli "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`, временная копия `portia-release-a05a6019e867-20261108T184722771Z` создана и удалена раннером (`git worktree list` без неё, порт 3100 свободен), прогон 2026-11-08T18:47:22.729Z - 2026-11-08T18:55:26.697Z, один полный прогон, повторов нет. Артефакты: `test-results/release-gate/a05a6019e867-20261108T184722771Z/`.
- Node раннера и всех гейтов: 22.13.1 (`%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`).
- npm: `11.19.0`, из установки Node 24.21.0 по умолчанию на машине (`C:/Program Files/nodejs/node_modules/npm`); он принадлежит другой установке Node и исполняется Node раннера 22.13.1 через `--npm-cli` (допустим: `engines.node` npm 11.19.0 = `^20.17.0 || >=22.9.0`). Причина: встроенный npm 10.9.2 переносного Node 22.13.1 не выполняет `npm ci` (`MODULE_NOT_FOUND`, `node-gyp/bin/node-gyp.js`, каталог `node_modules/npm/node_modules/node-gyp/bin` пуст — неполная распаковка, неисправность среды; см. 20-59 и deferred-items.md). Переносной Node не чинился. Это среда, не код проекта.
- Офлайн-гейты (`ui-contract-offline`, `visual-approved`, `visual-phase20`): production-сборка копии и `next start` на 127.0.0.1:3100 под `tests/e2e/harness/offline-supabase.cjs` с выдуманными значениями `OFFLINE_ENV`, Playwright CLI копии напрямую, `--retries=0 --fail-on-flaky-tests --update-snapshots=none` (визуальные). Из окружения процессов убраны переменные mutation, staging, привилегированные и реальные публичные имена; в протокол попадают только имена. Сервер каждого гейта остановлен раннером по PID. Режим данных «offline D-68» — UI-контракт и эталоны на стартовом контенте, не доказательство реальных данных, ролей или сохранения.
- Гейты `e2e-full`, `mutation-attest`, `e2e-mutation`, `staging-live` не запускались: нет цели с публичными значениями и нет аттестованного isolated staging (BLOCKED (ENV)); под заглушку они не переводились.
- Production не затрагивался, файлы окружения `.env*` не читались, Supabase не вызывался, `tests/e2e/visual/__screenshots__` и политика допусков не менялись; реестр эталонов `phase20-baselines.json` на этом commit: 60 строк.
- Проверки основной папки на FRC (Node 22.13.1, `node --experimental-strip-types --test`, без сборки и сервера): `lib/editor-outline.test.ts` — 40 тестов, 40 pass; пять файлов D-43/D-44/D-37 — 165 тестов, 165 pass.

## Безопасность и зависимости

- Production dependency audit: `npm audit --omit=dev` — `found 0 vulnerabilities` (гейт audit-prod PASS). Dev audit: 16 moderate, 0 high, 0 critical, disposition `accepted` (20-DEPENDENCY-AUDIT.md, гейт audit-evidence PASS: «dependency audit evidence verified»).
- Матрица безопасности (20-SECURITY-MATRIX.md): подтверждённых неисправленных high нет, блокеров релиза 0 (раздел «Блокеры релиза (D-12)»); medium-находки SEC20-01, 03, 04, 08, 09, 12, 13, 16, 17 описаны в релизном реестре (D-09).
- CSP: кандидат доставляется только как Content-Security-Policy-Report-Only; enforcement заблокирован до физической проверки PC/phone (D-05).
- По D-05/D-08/D-14 физическая LAN-проверка CSP относится к локальной production-сборке; опубликованные HTTPS, HSTS и `upgrade-insecure-requests` остаются отдельным ограничением доказательств (LIMITATION).

## Унаследованные пробелы Phase 19

- CR-01 (таймер медиа): исправлен в 19-15 (STAB-MEDIA-03 на Chromium desktop и phone); firefox-desktop-вариант — PW-07, waiver принят владельцем 2026-11-04.
- STAB-PROM-15 (приёмка Promotion на isolated staging, физические PC и телефон): BLOCKED, открыт; прогон mw1loqa9_c9451c80 и роль reviewer на staging — долг Phase 19/20.
- BLOCKED (DATA): пустые состояния и populated-ячейки на целевых данных (19-VERIFICATION, 19-19..22) остаются BLOCKED; офлайн-заглушка их не закрывает.

## Известное ограничение гейтов

- Пропуск по условию проекта (`test.skip(project !== ...)`) с 20-59 засчитывается на уровне гейта во всех офлайн-гейтах и в `e2e-full` только при двух доказательствах сразу: условие подтверждено исходником спека, тот же тест прошёл без повтора на другом проекте того же прогона. В этом прогоне ui-contract-offline: 14 пропусков по проекту, visual-approved: 54. Пропуск по данным и пропуск с причиной BLOCKED не засчитываются никогда; живые полосы `e2e-mutation` и `staging-live` остаются строгими.
- В гейте unit на чистой копии 9 тестов пропущены (в основной папке 3): в том числе 6 тестов границы охранника проекта (`lib/phase16-guard-boundary.test.ts`) пропускаются как BLOCKED (ENV), пока неотслеживаемого `.claude/hooks/guard.mjs` нет; такой пропуск не засчитывается как проверка границы.
