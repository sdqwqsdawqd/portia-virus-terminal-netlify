---
phase: 15
status: issues_found
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .env.example
  - lib/e2e-actors.test.ts
  - lib/e2e-diagnostics.test.ts
  - lib/e2e-preflight.test.ts
  - lib/e2e-target-guard.test.ts
  - lib/e2e-visual-policy.test.ts
  - lib/phase15-visual-manifest.test.ts
  - package.json
  - playwright.config.ts
  - scripts/phase15-e2e-preflight.mjs
  - scripts/phase15-visual-manifest.mjs
  - tests/e2e/README.md
  - tests/e2e/fixtures/actors.ts
  - tests/e2e/fixtures/candidate-faults.ts
  - tests/e2e/fixtures/data/roster.json
  - tests/e2e/fixtures/determinism.ts
  - tests/e2e/fixtures/diagnostics.ts
  - tests/e2e/fixtures/target-guard.ts
  - tests/e2e/fixtures/visual-policy.ts
  - tests/e2e/pages/desktop.page.ts
  - tests/e2e/specs/roles.spec.ts
  - tests/e2e/visual-candidates/desktop.spec.ts
  - tests/e2e/visual-candidates/editor.spec.ts
  - tests/e2e/visual-candidates/motion.spec.ts
  - tests/e2e/visual-candidates/promotion.spec.ts
  - tests/e2e/visual-candidates/support.ts
  - tests/e2e/visual/apps.spec.ts
  - tests/e2e/visual/desktop.spec.ts
  - tests/e2e/visual/editor.spec.ts
  - tests/e2e/visual/motion.spec.ts
  - tests/e2e/visual/promotion.spec.ts
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
reviewed_at: 2026-11-01
---

# Phase 15 Code Review (инкрементальный повторный обзор)

**Diff base:** `b014aaf` -> HEAD. **Глубина:** standard.

## Резюме

Обзор повторный: проверены 31 файл, изменённый после `b014aaf`, плюс `tests/e2e/fixtures/test.ts` и `tests/e2e/specs/visitor.spec.ts` как контекст. Все шесть прежних находок пересмотрены по текущему коду. Критическая находка CR-01 больше не даёт ложного `READY`, но пробел покрытия остаётся (см. таблицу). Из остальных пяти закрыты WR-01, WR-02, WR-03 и IN-01. WR-04 закрыта частично.

Локально выполнено (только чтение, без `--verify`):
- `node --experimental-strip-types --test` для шести файлов `lib/e2e-*.test.ts` и `lib/phase15-visual-manifest.test.ts`: 64 теста, 64 пройдено. Запуск был на Node v24.21.0, а не на референсной 22.13.1.
- `node scripts/phase15-visual-manifest.mjs --verify-promotion`: "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded."

Критических дефектов в новом коде не найдено. Новые находки касаются согласованности preflight с рантаймом, остаточной широты пиксельных допусков и мелкого дублирования.

## Диспозиция прежних находок (15-REVIEW.md @ b014aaf)

| Прежний ID | Было | Статус сейчас | Доказательство |
|---|---|---|---|
| CR-01 | Critical: роли получают `READY` без серверной сессии | **Устранён как дефект, остаточный риск перенесён в WR-01 (понижен до Warning)** | `tests/e2e/fixtures/actors.ts:84-98`: `READY` возможен только при `sessionProof` со статусом `VERIFIED`, источником `server-probe` и совпадающей ролью. Иначе возвращается `BLOCKED/AUTHENTICATED_SESSION_UNPROVEN`. Фикстура `actor` (`tests/e2e/fixtures/test.ts:26`) вызывает `actorAvailability(actorRole)` без proof, поэтому все привилегированные дорожки делают `testInfo.skip`, а не проходят. `roles.spec.ts:26-40` закрепляет, что инвентарь ролей остаётся `BLOCKED`. Ложного прохода больше нет; реальной серверной авторизации по-прежнему нет, она отложена на Phase 16 и отражена в `evidence/15-ROLE-GATE.md`. |
| WR-01 | Warning: guard принимает непомеченный production | **Закрыт** | `tests/e2e/fixtures/target-guard.ts:34-83`: оба списка (`PORTIA_E2E_PRODUCTION_PROJECT_IDS`, `PORTIA_E2E_ISOLATED_PROJECT_IDS`) обязательны, проверяются на формат (20 символов a-z0-9), дубли и пересечение; цель обязана быть в isolated-списке (`unknown-target`) и не быть в production-списке. Покрыто `lib/e2e-target-guard.test.ts:58-100`. Остаётся допущение: списки задаёт оператор, удалённая проверка проекта не выполняется. Для fail-closed это приемлемо, как Info (IN-06). |
| WR-02 | Warning: срок allowlist считается от зафиксированной даты | **Закрыт** | `tests/e2e/fixtures/diagnostics.ts:119-123` теперь передаёт `new Date()`; константа `deterministicDiagnosticNow` удалена (`git diff`: строки 128-130). Фиксированное время остаётся только в `determinism.ts` для UI. |
| WR-03 | Warning: команда не самонастраивается | **Закрыт (с оговорками WR-03/WR-04/WR-05/WR-06 ниже)** | Добавлены `scripts/phase15-e2e-preflight.mjs`, npm-скрипты `test:e2e:preflight*`, вызов preflight в `playwright.config.ts:4-8`, `.env.example` с именами переменных и `tests/e2e/README.md` с последовательностью для чистой машины. Preflight печатает только имена переменных и коды (`phase15-e2e-preflight.mjs:12-21`), значения не отражаются (подтверждено `lib/e2e-preflight.test.ts`). |
| WR-04 | Warning: глобальный допуск 2 500 px скрывает регресс контрола | **Частично закрыт, остаётся открытым как WR-02** | Допуск стал единым политикой `visual-policy.ts`: потолок 2 300 (`:6`), для desktop-состояний 256 (`:33`). Но application, editor, promotion и motion по-прежнему получают 2 300 (`:34-40`), и введена новая широкая маска. |
| IN-01 | Info: verifier не связывает метаданные ревизии | **Закрыт** | `phase15-visual-manifest.mjs:131-193`: `verifyAuthority()` парсит и сверяет `Candidate set`, `Source commit` и `Local contract SHA-256` между approval, контрактом, frame map и inventory (каждое поле ровно один раз, иначе fail). Вызывается из `--verify-promotion`, `--promote-approved`, `--verify-approval`, `--verify-ui-map`. Ссылка на Figma-ревизию из прежней рекомендации устарела: Figma удалён из плана, роль источника играет локальный UI-контракт. |

## Warnings

### WR-01: sessionProof подделывается обычным объектом; привилегированные дорожки не реализованы (остаток прежнего CR-01, понижено)

**File:** `tests/e2e/fixtures/actors.ts:22-26, 84-99`
**Issue:** `ActorSessionProof` это структурный тип. Любой код может создать `{ role, status: "VERIFIED", source: "server-probe" }` без реальной серверной проверки, и это ровно то, что делает `lib/e2e-actors.test.ts:29`. Проверка защищает только от забытого аргумента, но не от самоутверждённого доказательства. Пока в репозитории нет ни одного производителя proof, и привилегированные дорожки `roles.spec.ts:42-63` вечно в skip, поэтому ложного прохода сейчас нет. Но когда Phase 16 добавит производителя, правило "доказано сервером" окажется только соглашением. Понижено с Critical, потому что false-pass закрыт, а покрытие честно помечено `BLOCKED`.
**Fix:** В Phase 16 сделать proof непрозрачным (брендированный тип или `unique symbol`, конструктор не экспортируется и вызывается только из модуля, который реально делает серверный probe с одноразовой identity). До этого оставить дорожки `BLOCKED` и не засчитывать skip как pass в `STAB-BASE-02`.

### WR-02: Пиксельный допуск всё ещё широкий; маска скрывает приложение "Сотрудники" целиком (остаток прежнего WR-04)

**File:** `tests/e2e/fixtures/visual-policy.ts:33-40, 65, 84-91`
**Issue:** (1) Desktop-состояния ужесточены до 256 px, но `application:*`, `editor:*`, `promotion:*` и все `motion:*` допускают до 2 300 px (около 0,18% кадра 1440x900). Иконка или кнопка 24x24 (576 px) всё ещё может исчезнуть без падения. (2) У `motion:*` включено `animations: "allow"` вместе с `threshold: 0.3`: порог цвета на пиксель 0,3 против значения по умолчанию 0,2 вместе с 2 300 px допускает заметное смещение оттенка и положения. (3) Для `application:employees` маскируется весь `.personnel-app` (`:87`), то есть содержимое окна "Сотрудники" не сравнивается вообще: проверяется только рамка. Это не "именованная динамическая область", как требовало прежнее исправление, а полное отключение сравнения для этого состояния.
**Fix:** Для application и editor снизить допуск до значения, измеренного на фактическом шуме (например 256-512 px), и маскировать только строки с живыми данными (список сотрудников), а не весь контейнер. Для motion зафиксировать состояние через `page.clock` (как уже сделано) и вернуть `animations: "disabled"` или хотя бы убрать `threshold: 0.3`. Любое изменение допуска сопровождать обновлением evidence; байты утверждённых PNG менять нельзя.

### WR-03: Preflight читает `.env.local`, а Playwright-процесс эти значения не видит

**File:** `scripts/phase15-e2e-preflight.mjs:71-81`, `playwright.config.ts:4-8`, `.env.example:4-9`
**Issue:** `runPreflight()` вызывает `loadEnvConfig()`, который заполняет `process.env` только в дочернем процессе preflight. `playwright.config.ts` запускает его через `execFileSync`, а сам окружение не загружает. Фикстуры (`actors.ts` -> `requireSafeMutationTargetFromEnvironment(process.env)`, `test.ts:26`) читают `process.env` рабочего процесса Playwright. `.env.example` предлагает класть `PORTIA_E2E_*` в тот же env-файл, поэтому режим `mutation` может пройти preflight на значениях из `.env.local` и сразу после этого получить `TARGET_NOT_ISOLATED` в самих тестах, потому что там этих переменных нет. Visitor-дорожка этого не замечает (Next читает `.env.local` сам при `npm run build`), но для mutation-дорожки preflight проверяет не то окружение, которое увидят тесты. Сейчас это скрыто тем, что привилегированные дорожки и так `BLOCKED`.
**Fix:** Вызвать `loadEnvConfig(process.cwd())` в `playwright.config.ts` (до использования `process.env`), либо явно задокументировать, что `PORTIA_E2E_*` задаются только в оболочке, и в mutation-режиме preflight использовать `process.env` без загрузки `.env.local`.

### WR-04: Visitor-preflight принимает любой `*.supabase.co`, включая production, и не использует deny-list

**File:** `scripts/phase15-e2e-preflight.mjs:23-38, 53-55`
**Issue:** `isSupabaseRootUrl` проверяет только форму хоста. Если `PORTIA_E2E_PRODUCTION_PROJECT_IDS` задан и содержит ref проекта из `NEXT_PUBLIC_SUPABASE_URL`, preflight всё равно пропускает запуск, и Playwright соберёт приложение и выполнит visitor-тесты (`/api/content`, `/api/access`, `/api/employees`) против production. Правило CLAUDE.md "Never use production Supabase" остаётся на усмотрение оператора. Visitor-дорожка читает, а не пишет, но рубеж безопасности лишь декларативный.
**Fix:** Когда `PORTIA_E2E_PRODUCTION_PROJECT_IDS` непусто, в `validateVisitorPreflight` извлечь ref из `NEXT_PUBLIC_SUPABASE_URL` и бросить `PreflightError("production-target", [...])` при совпадении. Добавить тест в `lib/e2e-preflight.test.ts`.

### WR-05: Gate версии Node строже, чем `engines`, и отвергает допустимые 22.x

**File:** `scripts/phase15-e2e-preflight.mjs:44-46`
**Issue:** Регулярка `^22\.13\.\d+$` отвергает Node 22.14, 22.15 и т. д., тогда как `package.json` разрешает `>=22.13.0 <23`, а `tests/e2e/README.md` в первой строке называет "22.13.x". Разработчик на валидном Node 22.20 получит `node-version` и не сможет запустить ни один `npm run test:e2e*`. Это пересекается с пометкой CLAUDE.md о том, что у машины по умолчанию Node 24, но 24 отвергается правильно.
**Fix:** Привести к одному источнику правды: либо сравнивать через `semver` с `engines.node`, либо явно оставить пин 22.13.x и записать это в `engines` и README как намеренное ужесточение для baseline-доказательств.

### WR-06: Preflight требует `NEXT_PUBLIC_SUPABASE_ANON_KEY`, хотя приложение принимает и `PUBLISHABLE_KEY`; README расходится с `.env.example`

**File:** `scripts/phase15-e2e-preflight.mjs:6-10, 56-58`, `.env.example:2`, `README.md:31`, `lib/supabase/env.ts:4-5`
**Issue:** `lib/supabase/env.ts` читает `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.example` в этом диапазоне коммитов заменил PUBLISHABLE на ANON, а корневой `README.md:31` по-прежнему предписывает PUBLISHABLE. Оператор, который следует README, имеет рабочее приложение, но preflight падает с `missing-environment` для ANON_KEY. И наоборот, `.env.example` теперь указывает на устаревшее для Supabase имя ключа.
**Fix:** В preflight принимать любое из двух имён (`PUBLISHABLE_KEY` или `ANON_KEY`), вернуть `PUBLISHABLE_KEY` в `.env.example` как основное имя и согласовать корневой README.

## Info

### IN-01: Обращение к внутреннему API Playwright

**File:** `tests/e2e/fixtures/visual-policy.ts:49-53`
**Issue:** `playwright-core/lib/coreBundle` экспортируется в `exports`, но `utils.getComparator` не является публичным API. Версия закреплена (`@playwright/test` 1.64.1), поэтому сейчас всё работает, но при обновлении сравнение может молча перестать собираться. Кроме того, `compareApprovedScreenshot` не пишет actual/diff при падении, в отличие от `toHaveScreenshot`, что ухудшает отладку.
**Fix:** Оставить комментарий-предупреждение с версией и добавить тест на существование `getComparator`; при падении прикреплять `comparison.diff` через `testInfo.attach`.

### IN-02: Дублирование и расхождение драйверов motion между candidates и approved

**File:** `tests/e2e/visual-candidates/motion.spec.ts:7-17, 96-100` и `tests/e2e/visual/motion.spec.ts:10-20, 66-71`
**Issue:** `advanceUntil` скопирована дословно (candidates возвращает `elapsed`, approved ничего). Сценарий "обиды" разный: candidates делает ровно 4 клика, approved до 60 с остановкой по классу `is-offended`. Утверждённые PNG снимались из candidate-пути, а сравниваются тесты через другой цикл, поэтому при изменении тайминга Vivian можно получить кадры с разным числом кликов, но визуально неотличимые.
**Fix:** Вынести `advanceUntil` и сценарий состояний в общий модуль (`tests/e2e/fixtures/motion-driver.ts`) и использовать из обоих путей.

### IN-03: Preflight запускается многократно и требует локальных секретов при внешнем `PORTIA_E2E_BASE_URL`

**File:** `playwright.config.ts:4-8`, `package.json:14-20`
**Issue:** Preflight исполняется в npm-скрипте и ещё раз при загрузке конфига; Playwright перезагружает конфиг в каждом worker-процессе, поэтому порождается лишний `node` и печатается "ready" N раз. При заданном `PORTIA_E2E_BASE_URL` (внешний сервер, без локального build) всё равно требуются `NEXT_PUBLIC_SUPABASE_*` и `PORTIA_PROMOTION_DEVICE_SECRET`, хотя они нужны только `npm run build`.
**Fix:** Оставить одну точку вызова (конфиг), выполнять её только в главном процессе (`process.env.TEST_WORKER_INDEX === undefined`), а при внешнем URL пропускать проверку ключей сборки.

### IN-04: `--promote-approved` использует `setId`, выведенный из HEAD, а не из проверенного authority

**File:** `scripts/phase15-visual-manifest.mjs:349-352`
**Issue:** `promoteApproved()` вызывает `verifyAuthority()`, но затем `collectRows()` без `candidateSetId`/`allowIndex`. Если HEAD не совпадает с коммитом кандидатов, команда падает с `PORTIA_CANDIDATE_SET_MISSING`, пока не задан `PORTIA_VISUAL_SET_ID`. Это fail-closed, но расходится с остальными режимами, которые берут набор из authority, и промоция в чистом checkout без capture невозможна (индекс не читается). Кроме того, путь `candidate.candidateFile` не ограничен каталогом run root; безопасность держится только на сверке SHA-256 с approval.
**Fix:** Передать `candidateSetId: authority.candidateSet` и (если нужно) ограничить `source` путём внутри `tests/e2e/visual-candidates/.runs/`.

### IN-05: Тест `assertVisualDiffAllowed` проверяет арифметику, а не реальный контур

**File:** `lib/e2e-visual-policy.test.ts:19-27`, `tests/e2e/fixtures/visual-policy.ts:146-151`
**Issue:** `assertVisualDiffAllowed` нигде, кроме unit-теста, не вызывается, то есть тест подтверждает, что число больше капа больше капа. Реальное применение допуска (`visualPolicy` и `compareApprovedScreenshot`) в unit-тестах не исполняется, так как требует браузера.
**Fix:** Либо удалить функцию, либо тестировать `visualPolicy` на фиктивном `Page` (форма возвращаемых `mask`, `maxDiffPixels`, `threshold`) и добавить проверку, что потолок не превышен ни одним объявлением.

### IN-06: Перенос состояний window-search на firefox-desktop и остаточное допущение guard

**File:** `tests/e2e/visual/desktop.spec.ts:36-60`, `tests/e2e/fixtures/target-guard.ts:34-83`
**Issue:** (1) Окно-поиск restored/maximized/minimized теперь сравнивается только в `firefox-desktop` (`return` при другом проекте на `:38`). Снимки `chromium-desktop` удалены, хотя README называет `chromium-desktop` каноническим desktop-проектом. Это решение владельца может быть намеренным, но фиксируйте его в `15-FRAME-TEST-MAP.md`. (2) Списки production/isolated проектов по-прежнему задаёт сам оператор; удалённой проверки того, что проект действительно изолирован, нет.
**Fix:** (1) Подтвердить в документации, что authority для window-states firefox, либо вернуть chromium-снимки. (2) Принять как известное допущение или в Phase 16 добавить запрос к Management API с токеном только для чтения.

## Положительные наблюдения

- Диагностика редактирует URL и секреты; allowlist теперь истекает по реальному времени.
- `target-guard.ts` стал полностью fail-closed: отсутствие любого из списков блокирует мутации.
- Верификация промоции привязывает метаданные ревизии через `verifyAuthority()` и точно сверяет байты (`--verify-promotion` проходит локально).
- Режим индекса (`15-CANDIDATE-INDEX.json`) читает кандидатов в чистом checkout и помечает источник ("Source: tracked index (candidate PNG bytes not re-hashed)"), не маскируя ослабленную проверку.
- Прежние невыполненные дорожки честно остаются `BLOCKED/skip`, а не засчитываются как pass.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
