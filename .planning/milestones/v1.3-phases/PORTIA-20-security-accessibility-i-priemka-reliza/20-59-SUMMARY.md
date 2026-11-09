---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 59
subsystem: release-gate
tags: [D-69, G4, G5, npm-cli, project-skips, STAB-REL-01, STAB-REL-02, STAB-REL-03]
requires:
  - phase: PORTIA-20
    provides: "20-13 rehearsal FAIL (D-69 gap closure), 20-30 runner, 20-12 baselines"
provides:
  - "scripts/phase20-release-gate.mjs: --npm-cli, строка npm: в протоколе и receipt, единое правило пропусков по проекту на уровне гейта"
  - "lib/phase20-release-gate.test.ts: 108 тестов (было 85)"
affects: [20-60, 20-63]
key-files:
  modified:
    - scripts/phase20-release-gate.mjs
    - lib/phase20-release-gate.test.ts
    - tests/e2e/visual/desktop.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
key-decisions:
  - "D-69 G5: npm прогона явный и записанный; без --npm-cli поведение прежнее (npm.cmd из PATH); сбой встроенного npm 10.9.2 переносного Node не скрывается обёрткой"
  - "D-69 G4: пропуск по проекту = условие доказано исходником спека + тот же тест прошёл без повтора на другом проекте в любом шаге того же прогона того же гейта"
status: complete
outcome: complete
plan_head_before: 66ef0da4626033f9928a9c63759dce2cf48f30a3
plan_head_after: 3babecdd4647bd8d1ffb9d52495e66a00a84cd37
commits: 5
actuals:
  tokens: 21000
  tasks: 2
  commits: 5
---

# Phase 20 Plan 59: честный npm (G5) и единое правило пропусков по проекту (G4) Summary

Релизный раннер теперь запускает npm явно (`--npm-cli`) и записывает его версию и источник в протокол; пропуск по условию проекта одинаково засчитывается в `ui-contract-offline`, `visual-approved`, `visual-phase20` и `e2e-full` только при доказательстве условия исходником спека и проходе того же теста на другом проекте в том же прогоне гейта. Продукт не менялся; эталоны (`tests/e2e/visual/__screenshots__`) не менялись.

PLAN_BASE: 66ef0da4626033f9928a9c63759dce2cf48f30a3

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 RED | ed665e2 | RED for the explicit npm (8 of 93 тестов падали) |
| 1 GREEN | 5944ed5 | explicit and recorded npm of the release runner (G5) |
| 2 RED | 094aec2 | RED for the gate-level project-skip rule (14 из 109 падали) |
| 2 GREEN | 85c2484 | one gate-level project-skip rule (G4), desktop.spec |
| docs | 3babecd | deferred-items: G4 и G5 закрыты |

`commits: 5` измерено `git rev-list --count 66ef0da..HEAD` на 3babecd (до коммита этого SUMMARY).

## Task 1: npm (G5)

### Диагноз среды (без исправления)

Переносной Node 22.13.1 в `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64` не трогался.

- `ls -la node_modules/npm/node_modules/node-gyp/bin` показывает только `.` и `..` (каталог пуст);
- `node-gyp/package.json`: `"bin": "./bin/node-gyp.js"`;
- встроенный npm: `10.9.2`;
- npm установки по умолчанию (`C:/Program Files/nodejs`): `11.19.0`, `engines.node` = `^20.17.0 || >=22.9.0`, то есть Node 22.13.1 допустим (допущение плана подтверждено).

Вывод: встроенный npm 10.9.2 неполный (нет исполняемого файла, который он сам требует через `require.resolve` в `@npmcli/run-script`) — неисправность распаковки в %TEMP%, не кода. Ремонт (свежая официальная распаковка) — вариант владельца.

### Что сделано

- `--run … --npm-cli <npm-cli.js>`: каждый npm-шаг идёт как `<process.execPath> <npm-cli.js> <аргументы>` без shell и без подмены PATH; шаги `node` и `git` не меняются. Путь проверяется до `git worktree add` (GateError `npm-cli-invalid`: пусто, не `npm-cli.js`, нет файла).
- `<npm> --version` измеряется один раз в копии тем же способом вызова до первого npm-гейта; `receipt.json` получает `npm: { version, source }`, при сбое измерения `version: null` и `error`, npm-гейты всё равно идут.
- Протокол: строка `npm: <x.y.z> (<источник>)` сразу после `Node:`; команда npm-шагов в таблице показывает фактический вызов (`node <путь>/npm-cli.js ci`).
- `--verify-evidence`: нет строки `npm:` — ошибка; формат не распознан — ошибка; `npm: неизвестно …` при вердикте PASS/PASS-WITH-OWNER-WAIVERS — ошибка.

### Реальные прогоны (из основной папки, Node 22.13.1, раннер сам создаёт и удаляет копию)

1. verify 3, с флагом: `--run --commit HEAD --only node-version,tree-clean,npm-ci,unit --npm-cli "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` на 5944ed5, каталог `test-results/release-gate/5944ed577bf8-20261108T130845755Z`, итог PASS, exit 0: node-version PASS (v22.13.1), tree-clean PASS, npm-ci PASS (379 packages), unit PASS 1614/0/9 skipped. Строка в gates.md: `npm: 11.19.0 (--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js)`; в `receipt.json` `npm.version = 11.19.0`.
2. verify 4, контрольный, без флага, переносной Node первым в PATH: `--run --commit HEAD --only node-version,tree-clean,npm-ci`, каталог `test-results/release-gate/5944ed577bf8-20261108T131113672Z`, итог FAIL, exit 1: npm-ci FAIL, `npm-ci-1.log` содержит `npm error code MODULE_NOT_FOUND` / `Cannot find module 'node-gyp/bin/node-gyp.js'` (стек через `@npmcli/run-script/lib/make-spawn-args.js` переносного Node). Строка в gates.md: `npm: 10.9.2 (PATH npm.cmd)`. Это ожидаемое доказательство неисправности среды, не провал задачи.

Обе копии удалены раннером (`git worktree list` без `portia-release-`).

Промежуточное состояние: `--verify-evidence` на нынешнем `20-RELEASE-EVIDENCE.md` (прогон c11adf6) сообщает `npm line is missing` — это единственная ошибка; новый протокол с этой строкой создаст 20-63.

### RED

8 из 93 тестов падали (85 проходили): все новые тесты npm (выбор вызова, чек пути до worktree, receipt и gates.md, прежнее поведение без флага, неизмеримый npm, строка в renderEvidence, проверка в verifyEvidence, usage).

## Task 2: пропуски по проекту (G4)

### Правило

`classifyPlaywright` засчитывает пропуск как «по проекту», если одновременно: (1) текст аннотации `skip` равен причине вызова `test.skip(<условие>, <причина>)` в том же спеке, а условие `projectConditionSkips` признал состоящим только из признаков проекта; (2) тот же тест (файл и название) прошёл без повтора на другом проекте в любом шаге того же прогона того же гейта. `runGate` сначала выполняет и читает отчёты всех шагов, затем классифицирует каждый шаг с объединённым множеством проходов и картой «файл → доказанные причины» (исходники читаются из копии раннера, `tests/e2e/<file>`).

Закрытый список форм условия: `testInfo.project.name` или `test.info().project.name` в сравнении со строкой (`===`, `!==`, `==`, `!=`) или с `.endsWith`/`.startsWith`/`.includes` строки; `isMobile`, `hasTouch` (если файл не объявляет их сам); беспараметровая стрелочная функция того же файла с таким телом; `.has`/`.includes` имени проекта у константы того же файла из одних строк; `!`, `&&`, `||`, скобки. Всё остальное (данные, `true`, неизвестные имена, переменные) не доказывает ничего. Комментарии и содержимое строк маскируются перед разбором.

Гейты: `projectSkips: true` у `e2e-full`, `ui-contract-offline`, `visual-approved`, `visual-phase20` (`strictSkips` у них остаётся); `e2e-mutation` и `staging-live` не тронуты. Ячейка счётчиков: `passed/failed/skipped/flaky (по проекту N)`; `--verify-evidence` принимает PASS строгого гейта только когда `skipped - N = 0`, ошибка при N на гейте без правила и при N больше skipped; прежний формат читается.

### RED

14 из 109 тестов падали (95 проходили). Два теста, которые проходили на RED (`stays SKIPPED…`, `ANOTHER gate`), описывают поведение, не требующее перемен.

### Повторная классификация отчётов 20-13 (только чтение)

Каталог `test-results/release-gate/c11adf6cd1e3-20261108T100531757Z`, функции раннера, объединённое множество проходов по шагам гейта.

| Гейт | Шаги | passed | failed | skipped | по проекту (исходники c11adf6) | по проекту (исходники текущей копии) | прочие пропуски |
|------|------|--------|--------|---------|-------------------------------|--------------------------------------|-----------------|
| visual-approved | 2 (FAIL, FAIL) | 19 | 2 | 54 | 48 | 50 | 6 на c11adf6, 4 на текущих |
| ui-contract-offline | 4 (FAIL, FAIL, PASS, PASS) | 139 | 11 | 14 | 14 | 14 | 0 |

Прочие пропуски visual-approved по именам:
- 4 пропуска `visual/motion.spec.ts:8` («Phase 15 pixel authority is pinned to chromium-desktop.»): условие доказано, но тест не прошёл на chromium-desktop (в 20-13 упал `motion-vivian-activity`), поэтому проход на другом проекте отсутствует;
- 2 пропуска `visual/desktop.spec.ts:64` («No device-specific approved row is declared for chromium-desktop / firefox-desktop.») на исходниках c11adf6: там это `test.skip(true, …)`, условие не доказывается; на исходниках текущей копии (правка Task 2) оба пропуска объяснены.

visual-approved остаётся FAIL из-за двух упавших тестов (`phone-webkit` 58293 px и `motion-vivian-activity`), как ожидалось; цифры не подгонялись. ui-contract-offline: 14 пропусков из 14 теперь объяснены доказательством по исходнику; два шага остаются красными из-за упавших template-builder (причина не установлена, запись в deferred-items.md осталась `open`).

### Пропуски спеков гейтов, которые правило не признало

Скан `tests/e2e/visual` и `tests/e2e/specs`: 31 вызов `test.skip` признан условием проекта; 39 пропусков с `BLOCKED` не засчитываются никогда; один пропуск по данным:

- `tests/e2e/specs/editor-ui-contract.spec.ts:872`: `test.skip(!before, \`no height of the block of 20-53 was measured on the project ${testInfo.project.name}\`)` — текст называет проект, условие данные (`blockHeightBefore[...]`); честно держит свой гейт в SKIPPED до отдельного решения.

### Гейты с правилом и без

С правилом: `e2e-full`, `ui-contract-offline`, `visual-approved`, `visual-phase20`. Без правила: `e2e-mutation`, `staging-live` (живые полосы: пропущенный живой тест — доказательство только с аттестованным staging-run, STAB-REL-01); остальные гейты Playwright не запускают.

### Правка спека

`tests/e2e/visual/desktop.spec.ts`, «approved declared device project»: безусловный `test.skip(true, …)` внутри `if (!target)` заменён на `test.skip(!declaredDeviceProjects.includes(testInfo.project.name), …)` с той же причиной; константа из трёх проектов; что и как тест снимает — не менялось. После пропуска оставлена недостижимая `throw` для сужения типа (tsc). `tests/e2e/visual/__screenshots__` не менялся.

## Verification

Node 22.13.1, основная папка:
- `node --experimental-strip-types --test lib/phase20-release-gate.test.ts`: 108 tests, 108 pass, 0 fail (было 85).
- `node --experimental-strip-types --test lib/*.test.ts`: 1638 tests, 1635 pass, 0 fail, 3 skipped.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: 0 errors, 17 warnings (те же 17, что до плана; перечислять заново не требуется, новых нет).
- `--plan`: 17 гейтов.
- Acceptance: `--npm-cli` вне комментариев 7 строк; `projectSkips: true` 4; `по проекту` 6; `export function projectConditionSkips` 1; `пропуск по данным не засчитывается` в тестах 1; `includes(testInfo.project.name)` в desktop.spec 1; `status: closed (20-59)` 2; `status: open` в deferred-items 4 (было 5); worktree `portia-release-` нет; `git diff --stat` по `__screenshots__` пуст.

## Deviations from Plan

**1. [Rule 3 - тесты 20-13] Две фикстуры одиночного отчёта переписаны.** Тесты `classifyPlaywright (D-68): a skip by project condition…` и `runGate offline (D-68): ui-contract-offline accepts… visual-approved does not` проверяли прежнее правило (проход в том же отчёте без доказательства исходником). Правило расширено планом, поэтому они теперь требуют доказательства и дополнены случаем «без исходника — SKIPPED». Поведение 20-13 по существу сохранено (BLOCKED, только-пропущенные, чужие гейты).

**2. [Rule 2 - расширение списка форм] Добавлены `.includes(строка)` на имени проекта и операторы `==`, `!=`.** План называет `.endsWith`/`.startsWith`, но спеки `search.spec.ts`, `search-click.spec.ts`, `search-global-keys.spec.ts` (e2e-full) используют `isPhone = () => test.info().project.name.includes("phone")`; без этого их пропуски остались бы неучтёнными. Форма так же состоит только из признаков проекта; остальные ограничения плана сохранены.

**3. [Rule 3 - тип] В desktop.spec после `test.skip(...)` оставлена недостижимая `throw` вместо присваивания без `| undefined`.** Иначе tsc: TS2352. Поведение теста не менялось.

**4. Отчёт Playwright читается сразу после шага для всех гейтов** (нужно, потому что следующий шаг перезаписывает `results.json`); для шага, завершившегося как BLOCKED по env/сети, копия отчёта теперь тоже сохраняется, если он есть. Статусы и порядок шагов не менялись.

**5. Комментарий у флага `--npm-cli` — три строки, а не одна** (плюс две строки у правила G4).

## Known Stubs

None.

## Threat Flags

None. Новый флаг принимает путь из командной строки и проверяет его (`npm-cli.js`, существующий файл) до создания копии; npm запускается как `node <npm-cli.js>` без shell. Новых пакетов не устанавливалось (`npm ci` только по lockfile во временной копии раннера). Production, Supabase и staging не затрагивались; значения окружения в протокол не попадают.

## Deferred Issues

- `ui-contract-offline` красный на c11adf6 (template-builder, `Blocked script execution in 'about:srcdoc'`): причина не установлена, запись `open` (отдельный план 20-60).
- `editor-ui-contract.spec.ts:872` — пропуск по данным удерживает свой гейт в SKIPPED до отдельного решения.
- Ремонт переносного Node 22.13.1 — вариант владельца.

## Self-Check: PASSED

- Файлы: `scripts/phase20-release-gate.mjs`, `lib/phase20-release-gate.test.ts`, `tests/e2e/visual/desktop.spec.ts`, `deferred-items.md` найдены.
- Коммиты ed665e2, 5944ed5, 094aec2, 85c2484, 3babecd — предки HEAD.
- Каталоги артефактов обоих прогонов существуют; `portia-release-*` worktree не осталось; порт 3100 не использовался (офлайн-гейты в этом плане не запускались).
