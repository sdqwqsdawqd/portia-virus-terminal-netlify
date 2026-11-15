---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 07
subsystem: owner-docs
tags: [sec-01, sec-02, sec-05, owner-checklist, rollback, release-notes, poll-budget, blocked-live]
status: complete

requires:
  - phase: PORTIA-25 plan 01
    provides: expand migration 20261115000000 (portia_content_read, portia_employees_read)
  - phase: PORTIA-25 plan 03
    provides: employees route behind the gate, server snapshot (5 min / 30 s), no-store
  - phase: PORTIA-25 plan 04
    provides: contract migration 20261115000100, emergency file outside supabase/migrations
provides:
  - "25-OWNER-CHECKLIST.md: 15 owner steps in the D-05/D-06 order, read-only checks, two-level rollback with the D-10 signs, pinned sha256 of expand/contract/emergency, honest status table"
  - "25-RELEASE-NOTES.md: what changed, known limits D-11/D-15, not verified"
  - "25-POLL-BUDGET.md: 14,2 calls per visitor tab per minute (852 per hour), editor 18,2 (1092), day formula, database calls per call, external snapshot"
  - "lib/phase25-evidence.test.ts: checklist order = tracked migrations, hashes = pins = files, step positions, db push only as a prohibition, rollback signs, statuses, secrets"
  - "lib/phase25-poll-budget.test.ts: intervals read from the sources; a change fails until the budget is recalculated"
affects: [25-10 (adds the review/matrix part to phase25-evidence.test.ts and fills the checklist section Ревью)]

actuals:
  tokens: 20000
  tasks: 3
  commits: 3
plan_head_before: a10e0808db21c2ba6612c02711bde403c29d8d47
plan_head_after: ec6cae94ad325d38cd1e9ea24eccc577670bedc9
commits: 3

tech-stack:
  added: []
  patterns:
    - "Owner record checked by a test against the repository (order from git ls-files, hashes from the file, step positions by index)"
    - "Budget numbers recomputed by the test from the interval constants in the sources"

key-files:
  created:
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-OWNER-CHECKLIST.md
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-RELEASE-NOTES.md
    - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-POLL-BUDGET.md
    - lib/phase25-evidence.test.ts
    - lib/phase25-poll-budget.test.ts
  modified: []

key-decisions:
  - "The apply path of this rollout is variant B only (one file per psql, one transaction, migration repair); the checklist forbids db push because it would apply the contract together with the rest (D-06). The word appears only in prohibitions and a test enforces that."
  - "The switch-off operator stands right after file 4 and the switch-on operator after the contract and the editor login check; the CDN purge by the two tags is the step after the switch-on."
  - "Items delivered by plans 25-08 (device cache by person and level) and 25-09 (build scan) are marked as not yet done in the release notes and the checklist, so the owner documents do not claim them."
  - "Poll intervals unchanged; the owner did not answer explicitly, the recommended variant is recorded and the owner may change it (D-24)."

requirements-completed: []  # SEC-01, SEC-02, SEC-05 are not checked off: the live proofs (anonymous refusal, listing, public GET, CDN headers, purge, Storage copy) are BLOCKED / awaiting the owner, and the review is plan 25-10

duration: about 30 min
completed: 2026-11-16

coverage:
  - id: D1
    description: "Owner checklist: sections, apply order equal to the tracked migrations after 20261101000200 (ten), pinned hashes equal the pins and the files, status table with BLOCKED (ENV) / ОЖИДАЕТ ВЛАДЕЛЬЦА"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/phase25-evidence.test.ts (apply order, pinned sha256, status rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owner steps in the D-05/D-06 order: switch-off after file 4, contract after deploy, site check, bulk approval and editor login, switch-on after the contract, purge by two tags last; db push only as a prohibition"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "lib/phase25-evidence.test.ts (step order, db push, secrets by name)"
        status: pass
    human_judgment: true
    rationale: "The text order is proved; whether an owner can follow it on a real project without guessing is a human reading, and none of the steps was executed."
  - id: D3
    description: "Two-level rollback (quick switch-off, emergency: previous deploy first, then the emergency file in one transaction) with the three D-10 signs next to the switch-on step"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "lib/phase25-evidence.test.ts (rollback signs, rollback levels)"
        status: pass
    human_judgment: true
    rationale: "Text order proved only; the rollback was not run on any database or deploy."
  - id: D4
    description: "Live checks (anonymous refusal, listing, public GET, headers, Cache-Status, purge, copy Cache-Control, 404 of the old link) written as owner steps with status BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/phase25-evidence.test.ts (after-apply checks are read-only and marked)"
        status: pass
    human_judgment: true
    rationale: "BLOCKED: no staging, deploy preview or Storage is available to the agent (D-18); the owner performs these."
  - id: D5
    description: "Release notes with the known limits D-11 and D-15 and the not-verified list; poll budget 14,2 / 852 pinned to the source intervals"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/phase25-evidence.test.ts (release notes); lib/phase25-poll-budget.test.ts"
        status: pass
    human_judgment: false

metrics:
  tasks: 3
  files: 5
---

# Phase 25 Plan 07: Owner checklist, release notes and poll budget Summary

Владелец получил проверяемый тестом письменный путь включения и отката закрытия: чек-лист из 15 шагов (выключение после файла 4, контракт после выкладки кода и проверки сайта, включение закрытия отдельным шагом в конце, сброс CDN по двум тегам), релизная заметка с известными ограничениями D-11 и D-15 и офлайн-расчёт нагрузки опроса (14,2 вызова в минуту на вкладку посетителя). Агент ничего не применял и не вызывал.

## Что сделано

**Task 1 (трассер, cec1723).** RED сначала: `lib/phase25-evidence.test.ts` падал, пока документа нет. Затем `25-OWNER-CHECKLIST.md` в виде каркаса: все обязательные разделы, нумерованный «Порядок применения» из десяти файлов (равен `git ls-files` после `20261101000200`, аварийного файла в списке нет), «Закреплённый sha256» для expand, contract и аварийного файла (значения = закрепление в `lib/portia-canonical-parity.test.ts` = файл в LF; аварийный файл там не закреплён и сверяется с файлом), таблица «Статус» (Staging `BLOCKED (ENV)`, Production `ОЖИДАЕТ ВЛАДЕЛЬЦА`, аварийный — «не применять без аварии»). Тест запущен вместе с `lib/portia-canonical-parity.test.ts`: 13 тестов, 0 fail. Tracer gate: `<verify>` автоматический, прогнан повторно до расширения, ошибок нет, расширение продолжено.

**Task 2 (eddd0b2).** Тесты сначала (позиции шагов, `db push`, признаки отката, пометки статусов, секреты, релизная заметка), затем наполнение. Шаги 1–15: файлы 1–3; файл 4; выключение закрытия оператором с `updated_by = coalesce(updated_by, gen_random_uuid())`; файлы 5–8; секрет; `notify pgrst`; файл 9 expand; выкладка кода; проверка сайта на новом коде; массовое одобрение; вход редактора; файл 10 contract; включение закрытия оператором с `true` и три признака D-10 прямо под ним; сброс CDN (`POST https://api.netlify.com/api/v1/purge`, теги `portia-content` и `portia-employees`, токен и id только по именам, лимит два раза в 5 секунд, запасной путь «Clear cache and deploy site»); «сменить адрес картинки». «Откат»: быстрый (оператор выключения) и аварийный (сначала «Publish deploy» предыдущего деплоя, затем аварийный файл через `psql --single-transaction -v ON_ERROR_STOP=1`), диагностика между ними. «Проверки после применения» и «Проверка сайта после применения» — только чтение, каждая с пометкой «BLOCKED (staging) / ОЖИДАЕТ ВЛАДЕЛЬЦА»; в «Статус» добавлена таблица живых проверок. `25-RELEASE-NOTES.md`: «Что изменилось», «Известные ограничения» (D-11, D-15, копия без ссылки после отмены, SEC-07 «Устав»/«Таблица», `purgeCacheTag` на один релиз, TTL снимка `[ASSUMED]`, A7), «Не проверено».

**Task 3 (ec6cae9).** `lib/phase25-poll-budget.test.ts` читает из исходников 5000 (шлюз), `contentSyncMs` 30_000, `editorContentSyncMs` 10_000, `5 * 60 * 1000` (сотрудники) и TTL снимка 5 мин / 30 с, считает 14,2 и 852 для посетителя, 18,2 и 1092 для редактора и находит эти числа в документе; при смене любого интервала падает с подсказкой «пересчитать 25-POLL-BUDGET.md». `25-POLL-BUDGET.md`: таблица, формула «вызовов за сутки ≈ 852 × число вкладок × часов видимости», запросы к базе на вызов (статус 1 или 2, контент 3, сотрудники до 3), внешние Sheets/Roblox через снимок, оговорка о ценах Netlify, фразы D-19 и D-24.

## Проверка

- `node --experimental-strip-types --test lib/phase25-evidence.test.ts lib/phase25-poll-budget.test.ts`: 13 тестов, 13 pass, 0 fail.
- Red-window gate (`node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" --test-skip-pattern="migration coverage: the real matrix has exactly one row" lib/*.test.ts`): 2199 тестов, 2196 pass, 0 fail, 3 skipped (два пропуска по плану, третий прежний).
- `node node_modules/typescript/bin/tsc --noEmit`: 0 ошибок. ESLint по всему дереву: 0 errors, 17 warnings (прежние, вне плана).
- Acceptance Task 1: «Агент не применил ничего» 1; строка `10. \`20261115000100_portia_closure_contract.sql\`` 1; слово PASS в чек-листе 0.
- Acceptance Task 2: оператор `updated_by = coalesce(…) where id = 'main';` 3 раза (выключение, включение, быстрый откат); `api.netlify.com/api/v1/purge` 1; путь аварийного файла 3; «Известные ограничения» в релизной заметке 1.
- Acceptance Task 3: `852` 3, `14,2` 2 в бюджете; `contentSyncMs` 3 в тесте.
- В трёх документах плана слова PASS и префиксов ключей нет; значений секретов и токенов нет, только имена.

## Статус доказательств

- Все живые проверки (анонимный отказ чтения по публичному ключу, листинг и публичный GET `portia-media`, заголовки CDN, `Cache-Status`, сброс по тегам, `Cache-Control` копии, 404 старой ссылки): BLOCKED (staging) / ОЖИДАЕТ ВЛАДЕЛЬЦА. Ни одна не записана как пройденная.
- Применение миграций и включение закрытия: шаги владельца. schema push: BLOCKED — owner step; ни один документ не записывает миграции как применённые.
- Ревью `supabase-rls-reviewer`: план 25-10; раздел «Ревью» чек-листа до него без результата (так задумано).

## Deviations from Plan

Автоправок по Rules 1-4 нет. Отклонения исполнения:

- **[Rule 2 - честность записи] Пометки о неготовых планах.** Релизная заметка и раздел «Что изменится на сайте» сначала описывали кэш устройства `-v2`, правила D-09/D-21 и скан сборки как сделанные, но их доставляют планы 25-08 и 25-09 (в коде пока `-v1`). Эти пункты помечены «(план 25-08)» и «(план 25-09)», в чек-листе добавлено указание применять его к коду после этих планов. Файлы: 25-RELEASE-NOTES.md, 25-OWNER-CHECKLIST.md. Коммит eddd0b2.
- Тест позиций находит шаг применения файла по первому упоминанию имени в тексте шага, а не по заголовку: шаг 4 применяет четыре файла сразу (план называл заголовки «### Шаг N.» без требования имени файла в каждом).
- RED и GREEN каждой задачи закоммичены одним коммитом на задачу (так требует план: один коммит с явными путями).
- Хук проекта дважды блокировал команды (составной bash с heredoc и сообщение коммита со словом, совпавшим с его эвристикой). Обход не применялся: файл теста дополнен через Edit, сообщение коммита переписано другими словами по смыслу, не маскировкой.

**Total deviations:** 1 auto-fixed (Rule 2), остальные процессные. **Impact:** документы владельца не утверждают то, что ещё не сделано.

## Known Stubs

Раздел «Ревью» в `25-OWNER-CHECKLIST.md` намеренно без результата до плана 25-10 (текст говорит об этом, слова об успехе нет). Других заглушек нет.

## Отложено и вопросы владельцу

- Устаревший комментарий `app/api/employees/editor/route.ts:9` («The public /api/employees is CDN-cached by path ...»): файл вне списка файлов плана, не тронут; переформулировать комментарий в плане, который трогает файл (например 25-10).
- A-25-05: реальные записи остались в тестовой фикстуре `lib/testing/portia-content-fixture.ts`; заменять ли их выдуманными — решение владельца.
- A1: фразы и подсказки помощника (`assistantDefaults`) считаются служебным текстом и исключены из маркеров скана 25-09; если это содержимое, нужно отдельное решение.
- Опрос статуса раз в 5 секунд даёт 12 из 14,2 вызовов в минуту (решение Phase 23): оставить или обсудить — вопрос владельцу; интервалы не менялись (D-24).
- Допущения A6 (TTL снимка сотрудников) и A7 (сбрасывает ли деплой Netlify записи `durable`) остаются `[ASSUMED]`; шаг сброса по тегам обязателен.

## Threat Flags

None. Планом добавлены только документы и тесты; новых сетевых точек, путей авторизации и схем нет. T-25-25 закрыт тестом позиций шагов, T-25-26 тестом на PASS, префиксы ключей и JWT, T-25-27 передан владельцу (шаг сброса CDN, BLOCKED до выполнения).

## Self-Check: PASSED

- Файлы на диске: 25-OWNER-CHECKLIST.md, 25-RELEASE-NOTES.md, 25-POLL-BUDGET.md, lib/phase25-evidence.test.ts, lib/phase25-poll-budget.test.ts.
- Коммиты в ветке: cec1723, eddd0b2, ec6cae9.
