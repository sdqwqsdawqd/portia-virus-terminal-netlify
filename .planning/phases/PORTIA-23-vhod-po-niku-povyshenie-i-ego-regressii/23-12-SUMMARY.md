---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 12
subsystem: auth
tags: [access-gate, approved-notice, alert-log, rls-review, security-matrix, gap-closure]

requires:
  - phase: PORTIA-23
    provides: "23-11: раунд 2 ревью и матрица на 12eecb1; 23-09: шлюз fail-closed"
provides:
  - "G-PORTIA-23-3-r2 закрыт в коде: одобренный посетитель на рабочем столе без карточки доступа, одно уведомление в стиле квеста на устройство"
  - "G-PORTIA-23-3-log закрыт в коде: каждый unauthorized ответ POST /api/access/request пишет одну строку-тревогу без секретных и личных значений"
  - "Раунд 3 ревью supabase-rls-reviewer на 7cb8702: 0 critical, 0 high, 0 medium, две низких (accepted); свежая матрица безопасности"
affects: [verify-work 23, PORTIA-25]

actuals:
  tokens: 12700
  tasks: 3
  commits: 5

plan_head_before: d98723eced681c1567223fe34f39caefc0461883
plan_head_after: 65f267507e5d7a9e1844b61cb960c5dc0423a235

tech-stack:
  added: []
  patterns:
    - "Чистый помощник ответа (lib/access-request-reply.ts) с type-only импортом: тревога и карта статусов проверяются в node --test без алиасов Next"
    - "Флаг устройства через claimApprovedNotice: любая ошибка localStorage даёт false, уведомление не повторяется при каждой загрузке"

key-files:
  created:
    - lib/access-request-reply.ts
    - lib/access-request-reply.test.ts
  modified:
    - lib/access-gate-view.ts
    - lib/access-gate.test.ts
    - components/portia-access-gate.tsx
    - app/portia.css
    - lib/style-tokens.test.ts
    - app/api/access/request/route.ts
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-RLS-REVIEW.md
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-SECURITY-MATRIX.md

key-decisions:
  - "RLS23-07 (низкая): лог без ограничения частоты при неверной настройке секрета принят (T-23-38): тревога должна сообщать именно об этом состоянии"
  - "RLS23-08 (низкая): тело 503 с unauthorized уже было до 23-12 и вне G-PORTIA-23-3-log; ответ клиенту в этом плане не менялся; владелец может решить позже"

patterns-established:
  - "Ревью обязательно при правке охваченного пути матрицы: красное окно свежести матрицы между задачей кода и задачей ревью закрывается одним коммитом шапки ревью и матрицы"

requirements-completed: [ACC-01, ACC-03]

coverage:
  - id: D1
    description: "Одобренный посетитель с открытым рабочим столом не видит карточку доступа: accessGateLayout даёт showCard=false, showReopen=false, showForm=false, approvedNotice=true; остальные состояния и редактор без изменений"
    requirement: "ACC-03"
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts (раскладка approvedNotice во всех состояниях)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Уведомление «Доступ подтверждён» один раз на устройство: claimApprovedNotice, ключ portia-access-approved-notice-v1, отказ хранилища даёт false"
    requirement: "ACC-03"
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts (claimApprovedNotice, разметка уведомления, Escape, крестик)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Каждый unauthorized ответ маршрута пишет одну константную строку без секретов; ответ клиенту прежний"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "lib/access-request-reply.test.ts (настоящие submitAccessRequest и подпись; проводка маршрута)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ревью supabase-rls-reviewer раунд 3 и свежая матрица на 7cb8702"
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts, lib/phase23-evidence.test.ts"
        status: pass
    human_judgment: true
    rationale: "Статическое ревью выполнил оркестратор через агента; живой Postgres/RLS не выполнялся и остаётся BLOCKED"
  - id: D5
    description: "Вид уведомления и исчезновение карточки в браузере на одобренном устройстве"
    requirement: "ACC-03"
    verification: []
    human_judgment: true
    rationale: "Браузерная приёмка UAT test 3: ОЖИДАЕТ ВЛАДЕЛЬЦА (/gsd-verify-work 23); агент браузер не запускал"

duration: 9min (продолжение после checkpoint ревью; задачи 1-2 в том же плане ~2 min)
completed: 2026-11-14
status: complete
---

# Phase 23 Plan 12: Approved-visitor notice and unauthorized alert Summary

**Одобренный посетитель видит рабочий стол без постоянной карточки доступа и один раз на устройство получает уведомление «Доступ подтверждён» в стиле квеста; каждый unauthorized ответ заявки пишет одну константную строку-тревогу, а раунд 3 ревью RLS и матрица закреплены на 7cb8702.**

## Performance

- **Duration:** около 9 минут на продолжении (после checkpoint ревью); весь план: коммиты с 23:05 до 23:12 UTC
- **Started:** 2026-11-14T23:04Z (по STATE.md; точное начало исполнителя не записано)
- **Completed:** 2026-11-14T23:15Z
- **Tasks:** 3 (Task 1 tracer, Task 2 auto, Task 3 auto)
- **Files modified:** 10 (8 из них код и тесты, 2 документа ревью)

## Accomplishments

- **G-PORTIA-23-3-r2 (код).** `accessGateLayout` получил поле `approvedNotice`. Для одобренного посетителя на рабочем столе (закрытый режим с allowed и state approved, не редактор; или открытый режим со state approved) при любом `cardOpen` раскладка даёт `desktop=true`, `showCard=false`, `showReopen=false`, `showForm=false`, `approvedNotice=true`. Условие монтирования рабочего стола (`mode open` или `allowed`) не менялось (D-06). Для none, pending, rejected, revoked, «Проверяем доступ…», ошибки проверки и редактора значения прежние, `approvedNotice=false`.
- **Уведомление.** `aside` с классами `portia-dialog quest-toast access-approved-toast`, без role на aside; одна строка `sr-only` с `role="status"` («Доступ подтверждён.»); eyebrow «PORTIA // ДОСТУП», заголовок «Доступ подтверждён», текст «Заявка одобрена. Рабочий стол открыт на этом устройстве.»; кнопка «Закрыть уведомление» (×) и Escape (игнорируется в input, textarea, select, contentEditable и при открытом dialog); автофокуса нет, таймера нет. Акцент var(--teal): `.access-approved-toast { border-color: var(--teal-dim); }` и `.access-approved-toast .quest-toast-eyebrow { color: var(--teal); }`.
- **Один раз на устройство.** `claimApprovedNotice` возвращает true только когда localStorage читается и пишется и ключ `portia-access-approved-notice-v1` ещё не равен `1`; любая ошибка хранилища даёт false (уведомления нет, оно не повторяется при каждой загрузке); пишется только значение `1`, без ника и токена.
- **G-PORTIA-23-3-log (код).** `lib/access-request-reply.ts`: `accessSubmitStatus` (карта статусов, прежняя) и `reportAccessSubmit`. Строка тревоги (константа `ACCESS_SUBMIT_UNAUTHORIZED_ALERT`): «PORTIA access request unauthorized: the database refused the submit signature (missing or different submit secret, or server clock skew); check that PORTIA_ACCESS_SUBMIT_SECRET equals the stored submit secret». Пишется ровно один `console.error` на каждый ответ `unauthorized`; другие коды в лог не пишутся. Ответ клиенту прежний: 503, тело `{code: "unauthorized"}`, без Set-Cookie. Маршрут получил только импорт, строку `reportAccessSubmit(result);` и `const status = accessSubmitStatus(result.code);` вместо тернарного выражения (diff подтвердил оркестратор).
- **Ревью и матрица.** Раунд 3 `supabase-rls-reviewer` на `7cb8702c51b50332d8687f21e58bd94ed71ee005`; шапка 23-RLS-REVIEW.md и 23-SECURITY-MATRIX.md названы на одном проверенном commit, `lib/access-request-reply.ts` в охвате, строка маршрута заявки: «Последний коммит» `7cb8702`, находка T-23-37.

## Task Commits

1. **Task 1 (tracer): раскладка, хранилище и уведомление**
   - RED `51b06ae` (test): падающие тесты раскладки, хранилища и разметки в `lib/access-gate.test.ts`
   - GREEN `e748733` (feat): `lib/access-gate-view.ts`, `components/portia-access-gate.tsx`, `app/portia.css`, `lib/style-tokens.test.ts`
2. **Task 2: тревога unauthorized**
   - RED `4796fe4` (test): `lib/access-request-reply.test.ts`
   - GREEN `7cb8702` (feat): `lib/access-request-reply.ts`, `app/api/access/request/route.ts`
3. **Task 3: ревью раунд 3, шапка ревью и матрица** — `65f2675` (docs, одним коммитом два файла)

**Plan metadata:** коммит docs(23-12) со SUMMARY, STATE, ROADMAP, REQUIREMENTS (следующий за `65f2675`).

PLAN_BASE `d98723eced681c1567223fe34f39caefc0461883`; `plan_head_after` в frontmatter измерен на `65f2675` до коммита самого SUMMARY. Файл журнала головы (`gsd-plan-head-before-23-12`) в этой сессии отсутствует (план исполнялся с продолжением), поэтому `commits: 5` измерено как `git rev-list --count PLAN_BASE..65f2675`.

TDD: Task 1 и Task 2 прошли цикл RED (тесты падали по причине отсутствия поведения) и GREEN (тесты зелёные); REFACTOR не понадобился. Между коммитами Task 2 GREEN и Task 3 ожидаемо падал ровно один тест (свежесть матрицы после правки охваченного маршрута); Task 3 закрыл красное окно.

## Таблица стилей: новое закрепление

`PRE_PHASE_PORTIA_CSS_SHA256` в `lib/style-tokens.test.ts` обновлён с `8c05aed42e15d0a9aa0f8b955ec50d20a85f7bbd2b4da9927480de1429b6dc18` на `2e4f25b46ee6327ad428e1c408d79b9ad88f00eacf902993a5ca1f2c1e95ef45` (добавлены два правила `.access-approved-toast`); комментарий у константы поясняет это.

## Раунды ревью

| Раунд | Commit | Кто запускал | Итог |
|---|---|---|---|
| 3 (23-12) | `7cb8702c51b50332d8687f21e58bd94ed71ee005` | оркестратор, инструментом Agent (subagent_type `supabase-rls-reviewer`, только чтение), окно 2026-11-14 23:08-23:10 UTC; у исполнителя инструмента Agent нет, запрос передан по динамическому checkpoint | критических 0, высоких 0, средних 0, низких 2; открытых critical 0, открытых high 0 |

Как работал ревьюер: shell у него не было, `git diff 12eecb1 7cb8702` он выполнить не мог; сравнил маршрут с текстом плана и с тестом проводки `lib/access-request-reply.test.ts:74-86`. Побайтное подтверждение сделал оркестратор: `git diff 12eecb1 7cb8702 -- app/api/access/request/route.ts` показывает только новый импорт, строку `reportAccessSubmit(result);` и замену тернарного статуса на `accessSubmitStatus(result.code)`. Исполнитель дополнительно проверил, что `git diff --name-only 12eecb1 7cb8702` по охваченным путям печатает ровно `app/api/access/request/route.ts` и `lib/access-request-reply.ts`. Ревью исполнитель не писал, запись в 23-RLS-REVIEW.md переведена по-русски без изменения смысла.

Находки и решения (циклов исправлений не было, раундов три):

| ID | Severity | Решение |
|---|---|---|
| RLS23-07 | low | accepted (T-23-38): при неверной настройке каждый анонимный POST, прошедший валидацию, пишет одну короткую строку без лимита; нет оракула; это состояние, о котором тревога и сообщает |
| RLS23-08 | low | accepted: тело 503 с `unauthorized` уже было до 23-12, вне G-PORTIA-23-3-log, ответ клиенту в плане обязан остаться прежним; владелец может позже решить отдавать `unavailable` и сохранить тревогу |

В матрице раздел «Phase 23 security findings» не менялся (находки medium и выше не появились), строка RLS23-04 побайтно прежняя. Финальный проверенный commit в матрице и в шапке ревью: `7cb8702c51b50332d8687f21e58bd94ed71ee005`; «Последний коммит» маршрута `app/api/access/request/route.ts`: `7cb8702`. Promotion secure submit (`lib/portia-promotion-api.ts`) ревьюер как отсутствие тревоги не отметил, в этом плане не трогался.

**BLOCKED ревьюера (ни один пункт не записан как пройденный):** `portia_access_submit_request` реально возвращает unauthorized для отсутствующего, короткого или другого секрета, плохой подписи и времени выпуска вне окна -300/+60 с; `extensions.hmac` и `extensions.digest` есть в целевом проекте и дают тот же hex, что `createHmac` в Node; защищённая вставка секрета владельцем сохраняет его, а `portia_access_secrets` закрыта для anon и authenticated; `PORTIA_ACCESS_SUBMIT_SECRET` на Netlify равен значению в базе; текст PostgREST в `error.message` при сбое RPC; строка тревоги реально видна в логах функций Netlify; полное поведение ответа и cookie на staging.

## Локальные проверки (Node v22.13.1; npm и `npm exec` на этой Node не работают, поэтому прямая форма `node ...`)

| Команда | Код выхода | Числа |
|---|---|---|
| `node --experimental-strip-types --test lib/security-matrix.test.ts lib/phase23-evidence.test.ts` | 0 | 56 tests, 56 pass, 0 fail, 0 skipped |
| проверка записи раунда 3 (`node -e ...`, verify 1 плана) | 0 | «round 3 ok» |
| `node --experimental-strip-types --test lib/*.test.ts` (полный набор, вместо `npm test`) | 0 | 1929 tests, 1926 pass, 0 fail, 3 skipped, 0 cancelled |
| `node node_modules/typescript/bin/tsc --noEmit` (вместо `npm exec tsc`) | 0 | 0 ошибок |
| `node node_modules/eslint/bin/eslint.js .` (вместо `npm run lint`, весь проект) | 0 | 0 errors, 17 warnings (прежний уровень 17) |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | 0 | 49 tests, 49 pass, 0 fail, 0 skipped |
| `node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | «Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» |

Режим `--verify` (по умолчанию) не запускался. Критерии приёмки Task 3: `grep -c "Проверяемый commit: .12eecb1"` в матрице равен 0; `lib/access-request-reply.ts` в матрице встречается 2 раза; `Reviewed commit: .12eecb108f` в ревью 0, `app/api/access/request/route.ts` в ревью 8 раз; `git merge-base --is-ancestor 7cb8702… HEAD` код 0, `git diff --name-only 7cb8702… HEAD` по охваченным путям пуст; тестов 1929 (требовалось не меньше 1929).

## Статус живых дорожек (никогда не PASS)

- Повторная приёмка UAT test 3 в браузере: **ОЖИДАЕТ ВЛАДЕЛЬЦА** (шаг владельца: `/gsd-verify-work 23`, test 3).
- Строка тревоги в логе живого dev-сервера при неверном секрете: **ОЖИДАЕТ ВЛАДЕЛЬЦА**, по желанию (агент `.env*` не читает и сервер с секретами не запускает).
- `npm run build`: **BLOCKED** (Next читает `.env.local`, изолированного checkout без реальных `.env` нет).
- Playwright, браузер, физические устройства: **BLOCKED**.
- Живой Postgres/RLS, роли, staging: **BLOCKED (ENV)**; production: **ОЖИДАЕТ ВЛАДЕЛЬЦА**. SQL и миграции этим планом не менялись, к базе агент не подключался.

## Следующий шаг владельца

`/gsd-verify-work 23`, test 3. Проверить:

- одобренное устройство открывает рабочий стол без карточки справа сверху;
- один раз показывается уведомление «Доступ подтверждён», закрывается × и Escape;
- после перезагрузки уведомления нет;
- ожидание, отказ и отзыв показывают прежние экраны;
- редактор не видит гостевую карточку.

## Decisions Made

- RLS23-07 и RLS23-08 приняты как low (см. выше); ответ клиенту для unauthorized не менялся.
- ACC-03 не отмечен выполненным в REQUIREMENTS.md: браузерная приёмка UAT test 3 ожидает владельца, а правило проекта запрещает записывать неподтверждённое как PASS (см. Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm и `npm exec` не работают на этой Node**
- **Found during:** Task 3, итоговая проверка (и в Task 1-2)
- **Issue:** команды `npm test`, `npm exec tsc`, `npm run lint` из verify недоступны.
- **Fix:** выполнены те же проверки прямым вызовом `node`: `node --experimental-strip-types --test lib/*.test.ts`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`. Содержание проверок то же (скрипт `npm test` = `node --experimental-strip-types --test lib/*.test.ts`).
- **Files modified:** нет
- **Verification:** коды выхода и числа в таблице выше.

**2. [Rule 4-light - Process] ACC-03 не отмечен выполненным**
- **Found during:** обновление REQUIREMENTS.md
- **Issue:** в frontmatter плана `requirements: [ACC-01, ACC-03]`, но ACC-03 (вход на рабочий стол без повторного ввода ника) подтверждается именно браузерной приёмкой UAT test 3, которая ожидает владельца.
- **Fix:** ACC-01 уже Complete; ACC-03 остаётся Pending до `/gsd-verify-work 23`. Копирование `requirements-completed` во frontmatter сохранено по шаблону.

Исполнителю не пришлось вносить правки кода сверх плана: циклов исправлений ревью не было.

**Total deviations:** 2 (1 blocking-обход npm, 1 процессное решение по ACC-03).
**Impact on plan:** на содержание и проверки кода не влияет.

## Issues Encountered

- Агент-исполнитель не имеет инструмента Agent/Task, поэтому Task 3 шёл через динамический checkpoint, как в 23-11; оркестратор запустил ревьюера и возобновил задачу с дословным отчётом.
- Файл журнала головы плана (`gsd-plan-head-before-23-12`) отсутствовал в этой сессии; `commits` измерено от PLAN_BASE.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей авторизации или схемы на границах доверия, не описанных в `<threat_model>` (T-23-37..T-23-41), этот план не добавил.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Код G-PORTIA-23-3-r2 и G-PORTIA-23-3-log готов; ожидается браузерная приёмка владельцем (`/gsd-verify-work 23`, test 3).
- Блокеров для следующего шага нет; живые дорожки остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА.

---
*Phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii*
*Completed: 2026-11-14*

## Self-Check: PASSED
