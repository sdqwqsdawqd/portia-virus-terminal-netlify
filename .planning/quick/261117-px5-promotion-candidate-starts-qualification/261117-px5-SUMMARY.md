---
phase: quick-261117-px5
plan: 01
subsystem: promotion-qualification
tags: [promotion, qualification, supabase-migration-file, rules-text, question-builder, nextjs]
requires:
  - phase: PORTIA-23
    provides: signed participant path portia_promo_secure_current_test and device binding
  - phase: PORTIA-25
    provides: security matrix and RLS review records
provides:
  - candidate-started qualification check (pre-start screen, start only on the button)
  - rules text per qualification transition (column, projection, editor-only save action)
  - question builder dialog and one-line quota summary
affects: [promotion, security-matrix, rls-review]
tech-stack:
  added: []
  patterns: [forward-only migration file pinned by sha256 and applied nowhere, fixed pre-start lines restate enforced supervision only]
key-files:
  created:
    - lib/portia-qualification-rules.ts
    - lib/portia-qualification-rules.test.ts
    - lib/portia-qualification-builder.ts
    - lib/portia-qualification-builder.test.ts
    - components/portia-qualification-question-dialog.tsx
    - supabase/migrations/20261117000000_portia_qualification_rules.sql
  modified:
    - components/portia-promotion.tsx
    - components/portia-promotion-qualification-editor.tsx
    - app/api/promotion/test/route.ts
    - app/api/promotion/banks/route.ts
    - app/portia.css
    - supabase/fingerprint/expected/portia.fingerprint.json
    - tests/e2e/fixtures/data/expected-authz.json
    - tests/e2e/specs/accessibility.spec.ts
    - lib/portia-canonical-parity.test.ts
    - lib/portia-qualification-ui.test.ts
    - lib/portia-promotion-editor.test.ts
    - lib/portia-promotion-api.test.ts
    - lib/phase25-contract.test.ts
    - lib/phase25-evidence.test.ts
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-RLS-REVIEW.md
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-SECURITY-MATRIX.md
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-OWNER-CHECKLIST.md
decisions:
  - "Start is sent only by the candidate button; the mount only reads the attempt (GET) and a failed read or start never marks the attempt as failed."
  - "Saving rules does not touch the bank updated_at, so the bank version and an open preview stay valid."
  - "Without the migration the site works: the candidate sees the fixed lines only, the rules field is disabled with a written reason, a rules save is refused with 503 pending-database."
  - "The executor-run static review is recorded as Round 2 and labelled as not independent."
metrics:
  duration: "about 1 h 20 min"
  completed: 2026-11-17
status: complete
estimate:
  tokens: 160000
  tasks: 3
  confidence: low
actuals:
  tokens: 40500
  tasks: 3
  commits: 6
plan_head_before: 0e5c1a21105bb5f65aea7f5727b5d7735759ff09
plan_head_after: 729e27d37f311663eaab363ba1782acd1646dcad
---

# Quick 261117-px5: кандидат сам начинает квалификацию, правила и компактный конструктор вопросов

**Одной строкой:** проверка квалификации теперь начинается кнопкой «НАЧАТЬ ПРОВЕРКУ» на экране с правилами (15 минут идут только после нажатия), правила пишутся по переходам и хранятся в новом столбце (миграция только файлом), а вопросы собираются в диалоге «+ ВОПРОС» со строкой на вариант и понятной строкой про квоты.

## Что изменилось

**Сторона кандидата** (`components/portia-promotion.tsx`)
- После подтверждения набора проверяющим кандидат видит экран «ПРОВЕРКА ГОТОВА К НАЧАЛУ»: фиксированные строки сайта (15 минут от нажатия, число вопросов, по одному, ответ не изменить, ПК и телефон, что будет по времени) и, если не пусто, блок «ПРАВИЛА ПРОВЕРЯЮЩЕГО». Строка своего устройства отмечена и словами «ваше устройство», не только цветом.
- До кнопки нет запроса start, таймера, heartbeat, слушателей blur/visibility/offline и блокировки рабочего стола. При монтировании идёт только чтение (GET `?attemptId=`): перезагрузка во время теста продолжает его без нового старта.
- Неудачный старт показывает ошибку на этом же экране и оставляет кнопку; неудачная загрузка даёт «ПРОВЕРКА НЕДОСТУПНА» с «ПОВТОРИТЬ». Ни то ни другое не помечает попытку проваленной.
- Тексты карточки обновлены («15 МИНУТ ПОСЛЕ НАЧАЛА», «Квалификационная проверка выдана…»).

**Сторона редактора** (`components/portia-promotion-qualification-editor.tsx`, `components/portia-qualification-question-dialog.tsx`, `lib/portia-qualification-builder.ts`)
- «+ ВОПРОС» и «ИЗМЕНИТЬ» открывают диалог: три кнопки типа (ОДИН ОТВЕТ, НЕСКОЛЬКО, СВОБОДНЫЙ, `aria-pressed`), строка на вариант с отметкой «верно» (радио/флажок), ✕ и «+ ВАРИАНТ», от 2 до 8 вариантов, пустой вариант сохранить нельзя, для свободного ответа поле «Образец ответа для проверяющего». Старой формы под списком и нулевых индексов больше нет. Отмена нового вопроса сохраняет черновик, отмена правки отбрасывает.
- Список банка: компактные строки на всю ширину (чекбокс, бейдж типа, текст до двух строк, число вариантов, кнопки).
- Квоты: одна строка вида «В тесте: 3 с одним ответом · 1 с несколькими · 1 свободный — в банке хватает ✓»; если банк не покрывает, строка называет, чего не хватает, и «СОХРАНИТЬ КВОТЫ» заблокирована этой причиной.
- Блок «ПРАВИЛА ДЛЯ КАНДИДАТА» (до 4000 символов, счётчик, «СОХРАНИТЬ ПРАВИЛА»): сохраняется отдельным действием `save-qualification-rules`, версию банка и открытое превью не трогает. Без банка или без миграции поле отключено с письменной причиной.

**Сервер и база**
- `app/api/promotion/test/route.ts`: закрытая проекция получила `questionCount` (неотрицательное целое) и `rulesText` (строка до 4000, иначе пустая).
- `app/api/promotion/banks/route.ts`: действие `save-qualification-rules` (проверяющий, размер тела до разбора, переход из списка, 4000 символов, ответ `{ id, state }`; без миграции 503 `pending-database`, нет банка 409 `bank-missing`).
- Миграция `supabase/migrations/20261117000000_portia_qualification_rules.sql` (**файл, нигде не применялась**): столбец `rules_text` с проверкой длины; `portia_promo_current_test` отдаёт подготовленную попытку при любом режиме клиента вместе с `questionCount` и `rulesText` (вопроса до старта по-прежнему нет); `portia_promo_bank_state` с `rulesText`; новая `portia_promo_save_qualification_rules` (только вкладка `promo`, `revoke` у public/anon/authenticated, `grant` только authenticated).
- Закрепления обновлены согласованно: golden fingerprint, `expected-authz.json`, sha256 в `lib/portia-canonical-parity.test.ts`.

## Коммиты

| Хеш | Что |
|---|---|
| `15ec64f` | RED: правила, строки до старта, отказ без миграции |
| `358d750` | GREEN Task 1 (трассер): миграция-файл, маршрут, раннер, закрепления |
| `26fe9c2` | RED: модель конструктора и строка квот |
| `f0f7a19` | GREEN: модель конструктора и строка квот |
| `d2e963d` | Task 2: диалог, правила в редакторе, компактный список |
| `729e27d` | Task 3: запись ревью, матрица, чек-лист, тест доказательств |

## Проверки (Node 22.13.1, эталонная)

| Шаг | Результат |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` | tests 2421, pass 2418, fail 0, skipped 3 |
| `node node_modules/typescript/bin/tsc --noEmit` | код 0, ошибок нет |
| `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` | 0 errors, 17 warnings (все прежние, в изменённых файлах новых нет) |
| `lib/phase15-visual-manifest.test.ts` | pass 49, fail 0 |
| `scripts/phase15-visual-manifest.mjs --verify-promotion` | «Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded», код 0 |
| Playwright (`tests/e2e/specs/accessibility.spec.ts`, дорожка qualification window) | **не запускался** (нужен preflight-окружение); спецификация обновлена под экран «до старта» |

## Ревью безопасности

Статическое ревью новой миграции и маршрутов выполнено **самим исполнителем** по инструкции `supabase-rls-reviewer` и записано как **Round 2** в `25-RLS-REVIEW.md` на коммите `d2e963dd9110bdbf174db5b85dc7a29d39518f1c` (тот же коммит в `25-SECURITY-MATRIX.md`). Это **не независимый субагент**. Итог: critical 0, high 0, medium 0; две low записаны и приняты: RLS25-06 (подготовленная попытка читается в любом режиме клиента, режим берётся из запроса, вопроса нет), RLS25-07 (запись правил без сверки версии, побеждает последняя). Независимый запуск `supabase-rls-reviewer` остаётся шагом оркестратора.

## Отклонения от плана

### Автоисправления

**1. [Rule 3 - Blocking] `lib/portia-promotion-api.test.ts`: закрытый список проекции**
- Найдено при: Task 1 (полный прогон).
- Проблема: тест вычисляет `safeProjection` через `new Function` без импортов, `qualificationRulesText` не определена; ожидаемые ключи не включали `rulesText`.
- Исправление: функция передаётся параметром, ключи расширены, добавлены проверки `questionCount`/`rulesText`. Сила проверки не ослаблена.
- Коммит: `358d750`.

**2. [Rule 3 - Blocking] `lib/phase25-contract.test.ts`: «контракт — последняя миграция»**
- Проблема: новая миграция `20261117…` по определению сортируется после контракта Phase 25.
- Исправление: проверка стала «контракт — последняя миграция Phase 25 (префикс 20261115)».
- Коммит: `358d750`.

**3. [Rule 3 - Blocking] `lib/phase25-evidence.test.ts` шире, чем в плане**
- Помимо метки раунда `(quick NNNNNN-xxx)`, две проверки чек-листа владельца (порядок применения и строка статуса на миграцию) теперь охватывают миграции до `20261115000100`: чек-лист — порядок применения Phase 25, и тест требует, чтобы контракт был последним; новая миграция записана в матрице и ревью.
- Коммит: `729e27d`.

**4. [Rule 3 - Blocking] `25-OWNER-CHECKLIST.md`**
- Тест «чек-лист называет проверенный коммит» требует новый коммит ревью в разделе «Ревью»; добавлено примечание (одно предложение: раунд 2 относится к другой миграции, в порядок применения не входит, живые проверки BLOCKED).
- Коммит: `729e27d`.

**5. [Rule 1 - Bug] размер шрифта 10px в CSS** — тест доступности запрещает 9–10px; бейдж типа сразу сделан 11px (`d2e963d`).

### Прочее
- Модель диалога/ряда вариантов вынесена в `lib/portia-qualification-builder.ts` с `setOptionText` и `toggleOptionCorrect` сверх списка в плане (нужны компоненту, покрыты тестом).
- `lib/portia-promotion-reviewer.ts`, `lib/portia-promotion-api.ts`, `lib/promotion-participant.ts` не изменены (`git diff --name-only 0e5c1a2 HEAD` по ним пуст).

## Известных заглушек нет

Stub-паттернов (пустые значения, ведущие в интерфейс, placeholder-тексты без данных) в новых и изменённых файлах нет.

## Что ждёт владельца / остаётся BLOCKED

- Применение миграции `20261117000000_portia_qualification_rules.sql`: сначала на изолированной тестовой ветке, затем в production — **ОЖИДАЕТ ВЛАДЕЛЬЦА** (до применения сайт работает на фиксированных строках; сохранение правил отказывает понятным текстом).
- Живое выполнение новой функции и подготовленной проекции на Postgres/RLS, PostgREST после применения, staging — **BLOCKED (ENV)**; ни одна из этих дорожек не записана как пройденная.
- Прогон «до старта → старт → таймер» на ПК и телефоне, Playwright с окружением — **ожидает владельца / не запускался**.
- Независимый запуск `supabase-rls-reviewer` (оркестратор). Если он найдёт critical/high: исправить новым коммитом, пересчитать sha в `lib/portia-canonical-parity.test.ts`, golden и `expected-authz.json` (миграция нигде не применена), записать Round 3 (тест допускает не больше трёх раундов).
- Эксплуатационное замечание: подтверждённая, но не начатая попытка остаётся `prepared` без срока; проверяющий может отклонить или удалить такой запрос штатными действиями.

## Self-Check: PASSED

- Созданные файлы найдены: `lib/portia-qualification-rules.ts`, `lib/portia-qualification-builder.ts`, `components/portia-qualification-question-dialog.tsx`, `supabase/migrations/20261117000000_portia_qualification_rules.sql`.
- Коммиты найдены в истории: `15ec64f`, `358d750`, `26fe9c2`, `f0f7a19`, `d2e963d`, `729e27d`.
- `git diff --name-only d2e963dd9110bdbf174db5b85dc7a29d39518f1c HEAD -- app/api supabase/migrations lib/portia-qualification-rules.ts` пуст (матрица и ревью называют один и тот же коммит).

## Independent review (orchestrator, supabase-rls-reviewer subagent)

Static review of commits 15ec64f..729e27d by a separate `supabase-rls-reviewer` subagent: **critical 0, high 0, medium 0**.

- LOW-1 (pre-existing): `app/api/promotion/banks/route.ts` reads the whole body before the 64 KB check; reviewer-only, after auth. Fix: `parseLimitedJsonObject`. Open.
- LOW-2: the new migration relies on `create or replace` keeping the restricted ACL; legacy `supabase/portia_setup.sql` / `supabase/phase14_apply.sql` still grant `portia_promo_current_test` to anon, so re-running them after this migration would expose it. Fix: restate revokes/grants in the migration, retire the legacy scripts. Open — owner must not re-run the legacy setup scripts.
- INFO-1: `btrim` keeps tab/newline-only rules when the RPC is called directly (route trims). INFO-2: no audit of who changed rules. INFO-3: GET reports any RPC failure as pending-database.
- BLOCKED (live Postgres): migration applies cleanly, effective ACLs, forbidden for non-promo users, phone prepared attempt visible only to its owner.
