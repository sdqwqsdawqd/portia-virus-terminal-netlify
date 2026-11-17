---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 11
subsystem: database
tags: [rls-review, security-matrix, owner-instruction, migration-apply, gap-closure]

requires:
  - phase: PORTIA-23
    provides: "23-09: шлюз fail-closed; 23-10: миграция 20261114000000 (закрытие ON по умолчанию)"
provides:
  - "Раунд 2 ревью supabase-rls-reviewer на 12eecb1: 0 critical, 0 high, 0 medium; две низких находки с решениями"
  - "Свежая матрица безопасности на проверенном commit; красное окно 23-10 закрыто"
  - "23-MIGRATION-APPLY.md: точная инструкция владельцу, закреплённая тестом"
  - "Миграция 20261114000000 заморожена; у D-01 отметка об отмене владельцем"
affects: [verify-work 23, PORTIA-25]

actuals:
  tokens: 15600
  tasks: 3
  commits: 5

plan_head_before: 12eecb108f3c24f5cc0b558a882ddbef09ec2522
plan_head_after: 700cf078fbb0a3d6f9411032c60aed98298b11bd

tech-stack:
  added: []
  patterns:
    - "Инструкция владельцу как проверяемый артефакт: тест сверяет порядок с отслеживаемыми миграциями, хеши с закреплением и файлом, числа функций с эталонным отпечатком"

key-files:
  created:
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-MIGRATION-APPLY.md
  modified:
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-RLS-REVIEW.md
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-SECURITY-MATRIX.md
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-REVIEW-DISPOSITION.md
    - .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-CONTEXT.md
    - lib/phase23-evidence.test.ts
    - lib/portia-canonical-parity.test.ts
    - tests/e2e/fixtures/data/expected-authz.json

key-decisions:
  - "Ревьюера запустил оркестратор инструментом Agent: у исполнителя инструмента Agent/Task не было, он вернул checkpoint с текстом запроса и REVIEW_BASE"
  - "RLS23-05 (low) принята: SQL замороженной миграции не меняется, предупреждение и безопасный оператор выключения с updated_by записаны в инструкцию владельцу"
  - "RLS23-06 (low) исправлена: источник ячеек closure_enabled в expected-authz.json теперь 20261114000000:38"
  - "Миграция 20261114000000 заморожена планом 23-11; отмена D-01 владельцем 2026-11-14 записана в 23-CONTEXT.md"

requirements-completed: [ACC-01, ACC-02, ACC-08]

coverage:
  - id: D1
    description: "Обязательное ревью supabase-rls-reviewer раунд 2 записано, открытых critical/high нет, находки с решениями"
    requirement: ACC-02
    verification:
      - kind: unit
        ref: "lib/phase23-evidence.test.ts#Phase 23 reviewer identifies a committed scope with no open critical or high finding"
        status: pass
    human_judgment: false
  - id: D2
    description: "Матрица безопасности описывает HEAD: проверяемый commit равен проверенному, новая миграция и lib/access-gate.ts в охвате"
    requirement: ACC-02
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts#matrix freshness: the real matrix commit is an ancestor of HEAD and no covered file changed after it"
        status: pass
      - kind: unit
        ref: "lib/security-matrix.test.ts#migration coverage: the real matrix has exactly one row per tracked supabase migration"
        status: pass
      - kind: unit
        ref: "lib/phase23-evidence.test.ts#Phase 23 matrix covers each tracked route and migration exactly once; all live lanes stay blocked"
        status: pass
    human_judgment: false
  - id: D3
    description: "Инструкция владельцу: порядок, хеши, notify, проверки закрытия ON и числа функций из эталона; агент ничего не применял"
    requirement: ACC-08
    verification:
      - kind: unit
        ref: "lib/phase23-evidence.test.ts#Phase 23 apply record: owner order, pinned hashes, cache reload, closure ON checks; the agent applied nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Применение миграций владельцем, живой Postgres/RLS, роли, staging, production, браузер, устройства"
    verification: []
    human_judgment: true
    rationale: "Агент ничего не применяет (D-72, решение владельца 2026-11-14, 2a); повторная приёмка /gsd-verify-work 23 после применения владельцем"

duration: 45min
completed: 2026-11-14
status: complete
---

# Phase PORTIA-23 Plan 11: Ревью, матрица и инструкция владельцу Summary

**Ревью supabase-rls-reviewer раунд 2 на 12eecb1 (0 critical, 0 high, 0 medium) записано, матрица безопасности снова описывает HEAD и красное окно 23-10 закрыто, владелец получил машинно проверяемую инструкцию 23-MIGRATION-APPLY.md по применению миграций 21–23 с проверкой «закрытие ON»; миграция 20261114000000 заморожена.**

Разрыв G-PORTIA-23-4 закрыт в коде и доказательствах (23-09, 23-10, 23-11). Применение миграций владельцем и повторная приёмка остаются впереди.

## Ревью supabase-rls-reviewer (Task 1)

- **Как запускалось:** у исполнителя 23-11 нет инструмента Agent/Task. Он вернул checkpoint с текстом запроса и REVIEW_BASE, ревьюера запустил оркестратор инструментом Agent (subagent_type `supabase-rls-reviewer`) на `12eecb108f3c24f5cc0b558a882ddbef09ec2522` и передал отчёт. Исполнитель ревью не писал; в 23-RLS-REVIEW.md это записано как запуск оркестратора. Отчёт ревьюера английский, в запись он перенесён по-русски по смыслу.
- **Итог раунда 2:** открытых critical 0, открытых high 0, medium 0. Цикл исправлений не потребовался, раунд один.
- **Находки:**
  - RLS23-05 (low): ручной повторный запуск файла 8 (psql, мимо истории CLI) снова включает закрытие, если владелец выключил его вне `portia_access_set_closure`, потому что `updated_by` остаётся пустым. Решение: accepted. SQL замороженной миграции не менялся; в 23-MIGRATION-APPLY.md записано предупреждение, а экстренное выключение ставит `updated_by = coalesce(updated_by, gen_random_uuid())`.
  - RLS23-06 (low): в `tests/e2e/fixtures/data/expected-authz.json` ячейки `portia_access_closure_enabled()` ссылались на устаревшую строку 667 фундамента. Решение: fixed в `d675d73`, источник теперь `20261114000000_portia_access_closure_default_on.sql:38` (исход allow не менялся). Правка вне перечня файлов плана, но в рамках разбора находки ревью; файл не входит в охват матрицы.
- **Заметка об области (не находка):** `resolveGate` вызывается только из `/api/access/status`, серверные маршруты данных закрытие не проверяют. Прежний замысел, передано в Phase 25 (T-23-31).
- **BLOCKED ревьюера (не пройдено):** чистое применение 20261114000000 после 20261113000000 и повторный запуск; реальные ACL, proconfig и `src_sha256` нового тела; тексты PGRST202/42883 развёрнутого PostgREST; доставка NOTIFY после commit и длина окна устаревшего кэша; RLS на таблице настроек для anon/authenticated; `owner-required` и `updated_by` у владельца; шлюз с аутентифицированными ролями.
- **Проверенный commit:** `12eecb108f3c24f5cc0b558a882ddbef09ec2522`. После него в `supabase/migrations`, `lib/access-store.ts`, `lib/access-gate.ts`, `app/api`, `lib/editor-access.ts`, `proxy.ts`, `lib/supabase` изменений нет (`git diff --name-only` пуст).

## Матрица и dispositions (Task 2)

- Шапка 23-RLS-REVIEW.md: «Reviewed commit: `12eecb1…`», строка раннего раунда 23-07, область расширена тремя путями, итог «Open critical: 0. Open high: 0».
- 23-SECURITY-MATRIX.md: «Проверяемый commit» равен проверенному; пункт метода о раунде 2; `lib/access-gate.ts` в охвате (23 пути); строка маршрута статуса (fail-closed, T-23-22); строка фундамента «OFF в этом файле, ON с 20261114000000»; ровно одна строка 20261114000000 (staging BLOCKED (ENV), production ОЖИДАЕТ ВЛАДЕЛЬЦА); строки RLS23-05, RLS23-06; строка окружения с раундом 2. Строка RLS23-04 побайтно прежняя.
- 23-REVIEW-DISPOSITION.md: WR-02 fixed (`23-09 7b860cf fail-closed`), WR-03 и WR-04 fixed (`23-09 97ef402`); open: 8; WR-01, WR-05, WR-06, IN-01..05 остаются open (вне разрыва; IN-04 исправлен частично и остаётся open).
- Красное окно 23-10 закрыто: три теста матрицы снова зелёные.

## Инструкция владельцу (Task 3)

Файл: `.planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-MIGRATION-APPLY.md`. Разделы: «Что изменится на сайте», «Перед началом», «Порядок применения» (восемь файлов 20261104000000 … 20261114000000), «Проверка до применения», «Как применить» (A: CLI `db push` с удалённой целью; B: psql с `ON_ERROR_STOP` и `--single-transaction` плюс `migration repair`), «Секрет подписи заявок», «Перезагрузка кэша схемы», «Проверки после применения» (9 пунктов: 8 версий, 5 таблиц, 18 функций `portia_access_*`, 10 защищённых функций «Повышения», `closure_enabled()` = true, default true, права, секрет без вывода значения, HTTP-проверка кэша, необязательный отпечаток), «Проверка сайта после применения», «Откат и выключение закрытия», «Закреплённый sha256», «Статус», «Ревью», «Что доказано офлайн».

- **Закреплённые хеши (LF-нормализованные файлы):**
  - `20261113000000_portia_access_promotion.sql`: `59877c13f4fadf56d9274fc5ccbf5978c285d882c0a65811da32a0ec08343e81`
  - `20261114000000_portia_access_closure_default_on.sql`: `44c07e2f76baccf06017852fdf50843bae6fc005d889715cc898b4fbdc4c47b4` (заморожена планом 23-11; комментарий «FROZEN by plan 23-11» в `lib/portia-canonical-parity.test.ts`, значение не менялось)
- **Отметка D-01** в 23-CONTEXT.md: «Отменено владельцем 2026-11-14 (G-PORTIA-23-4, ответы 1a/3a)».
- Агент не подключался ни к одной базе и ничего не применял; в записи нет значений секретов и ключей, слова PASS нет.

## TDD (RED / GREEN)

- **RED** (`3c4826a`): тест «Phase 23 apply record: …» в `lib/phase23-evidence.test.ts`. Падает ровно он, на `ENOENT` (записи ещё нет), остальные четыре теста файла зелёные: `# tests 5, # pass 4, # fail 1`. Падение на нужной причине, ошибок загрузки нет. Классификатор `gsd_run check tdd-red-evidence` не запускался, вывод проверен вручную.
- **GREEN** (`700cf07`): запись написана; три файла (`phase23-evidence`, `security-matrix`, `portia-canonical-parity`): 65 тестов, 65 pass, 0 fail.
- REFACTOR не потребовался.

## Команды и результаты (Node v22.13.1, прямая форма)

- Проверка записи раунда (`node -e …`, Task 1): `round ok`, код 0.
- Шлюз red-window после Task 1 (до матрицы): `red-window ok: 3 expected failures`; 1922 теста, 1916 pass, 3 fail, 3 skipped.
- `node --experimental-strip-types --test lib/security-matrix.test.ts lib/phase23-evidence.test.ts` после Task 2: код 0, 55 тестов, 55 pass, 0 fail.
- `node --experimental-strip-types --test --test-reporter=tap lib/*.test.ts` после Task 2: 1922 теста, 1919 pass, 0 fail, 3 skipped.
- После Task 3: `node --experimental-strip-types --test lib/phase23-evidence.test.ts lib/security-matrix.test.ts lib/portia-canonical-parity.test.ts` — 65 pass, 0 fail; весь набор — 1923 теста, 1920 pass, 0 fail, 3 skipped (база 23-10: 1922 / 1916 / 3 / 3; +1 новый тест).
- `node node_modules/typescript/bin/tsc --noEmit` — код 0.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` — код 0, 0 ошибок, 17 предупреждений (базовая линия).
- `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` — 49 тестов, 49 pass, 0 fail.
- `node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion` — код 0, проверено 65 утверждённых снимков, исключено 18. Режим `--verify` по умолчанию не запускался.
- Сборка `npm run build`: BLOCKED. Нет изолированного checkout без реальных `.env`, Next читает `.env.local` сам.
- Приёмочные grep: `FROZEN by plan 23-11` в `lib/portia-canonical-parity.test.ts` — 1; `Отменено владельцем 2026-11-14` в 23-CONTEXT.md — 1; `disposition: open` в 23-REVIEW-DISPOSITION.md — 8; «Проверяемый commit: `0046f80`» в матрице — 0.

## Шаги владельца по порядку (ОЖИДАЕТ ВЛАДЕЛЬЦА)

1. Применить миграции по `23-MIGRATION-APPLY.md`: резервная копия, проверка до применения, восемь файлов по порядку, шаг секрета подписи, `notify pgrst, 'reload schema';`.
2. Выполнить read-only проверки из раздела «Проверки после применения» (8 версий, 5 таблиц, 18 и 10 функций, `closure_enabled()` = true, права, секрет, HTTP-проверка кэша) и проверку сайта.
3. Запустить `/gsd-verify-work 23` для повторной приёмки UAT 2–7. Результаты владельца записываются в GSD только тогда, когда их принесёт владелец.
4. Если нужно, замерить задержку «Проверяем доступ…» на dev-сервере (пункт из 23-09).

## BLOCKED и ожидания (не PASS)

- Применение восьми миграций, секрет подписи, NOTIFY и проверки на базе владельца: ОЖИДАЕТ ВЛАДЕЛЬЦА (решение 2a).
- Живой Postgres/RLS, роли с аутентификацией, конкурентность, staging: BLOCKED (ENV). Production: ОЖИДАЕТ ВЛАДЕЛЬЦА.
- Все пункты BLOCKED из отчёта ревьюера (раздел выше).
- `npm run build`, Playwright, браузер, физические устройства: BLOCKED.
- Закрытие API данных и CDN: Phase 25.

## Отклонения от плана

**1. [Rule 2 - evidence accuracy] Правка источника в expected-authz.json (находка RLS23-06)**
- **Found during:** Task 1, отчёт ревьюера (L2).
- **Fix:** `source` шести ячеек `portia_access_closure_enabled()` заменён на `20261114000000_portia_access_closure_default_on.sql:38`; проверка тестами `phase16-expected-authz`, `access-rls-round2`, `portia-staging-live` (26 тестов, 0 fail, 1 пропуск без стенда).
- **Files modified:** `tests/e2e/fixtures/data/expected-authz.json` (вне перечня файлов плана, вне охвата матрицы).
- **Commit:** `d675d73`

**2. Ревьюера запустил оркестратор, а не исполнитель** (предусмотренный планом путь через checkpoint, не отклонение по существу).

**3. Экстренное выключение закрытия дополнено `updated_by`** в инструкции владельцу, вместо оператора из текста плана: это смягчение RLS23-05. Тест записи оператор не проверяет.

Правил 1, 3 и 4 не применялось.

## Known Stubs

Нет.

## Threat Flags

Нет новой сетевой поверхности вне регистра T-23-32..T-23-36.

## Commits

- `d675d73` fix(23-11): источник прав closure_enabled в фикстуре
- `c9cb049` docs(23-11): ревью supabase-rls-reviewer раунд 2
- `71715b3` docs(23-11): матрица на проверенном commit; WR-02/03/04 fixed
- `3c4826a` test(23-11): проверка записи применения (RED)
- `700cf07` docs(23-11): инструкция владельцу, заморозка миграции, отметка D-01

## Self-Check: PASSED
