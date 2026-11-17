---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 07
subsystem: database-security-closure
tags: [supabase, migration-freeze, apply-record, security-matrix, owner-checkpoint, access-foundation]

requires:
  - phase: PORTIA-21 (plans 21-01..21-06)
    provides: миграция 20261109000000_portia_access_foundation.sql, серверные модули доступа, итог ревью supabase-rls-reviewer на commit 10b5e98
provides:
  - "21-MIGRATION-APPLY.md: порядок применения четырёх миграций, закреплённый sha256, статусы BLOCKED/ОЖИДАЕТ ВЛАДЕЛЬЦА, шаг секрета подписи, проверки владельца, откат, карта D-01..D-10, принятые риски, локальная проверка, подтверждение владельца"
  - "21-SECURITY-MATRIX.md: матрица Phase 21, привязанная к проверенному commit 10b5e98e80947062dc80e8bc20a12fb9692375c4"
  - "lib/security-matrix.test.ts: покрытие миграций и свежесть против матрицы Phase 21, тесты записи применения и привязки commit"
  - "Миграция заморожена: любое изменение только новой forward-only миграцией"
affects: [PORTIA-22, PORTIA-23, PORTIA-25]

requirements-completed: [ACC-09, USR-05, SEC-06]

actuals:
  tokens: 7900
  tasks: 3
  commits: 3

plan_head_before: 395c5f34cc86e93425d40d6bf3752ae8660979f7
plan_head_after: be0227c9a9d935d7bfcff68d3b2ae4dad8503814

tech-stack:
  added: []
  patterns:
    - "запись применения сверяется тестом с закреплённым хешем и с хешем самого файла"
    - "матрица безопасности тянется за проверенным commit ревью; свежесть проверяет git diff по охвату"

key-files:
  created:
    - .planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-MIGRATION-APPLY.md
    - .planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-SECURITY-MATRIX.md
  modified:
    - lib/security-matrix.test.ts
    - lib/portia-canonical-parity.test.ts

key-decisions:
  - "Владелец 2026-11-09 на чекпоинте: «Принято», все 10 принятых рисков подтверждены, отклонённых нет"
  - "Архивная матрица v1.3 остаётся замороженной историей; структура находок, маршруты и D-33 проверяются по ней, покрытие миграций и свежесть по матрице Phase 21"

duration: около 1 часа активной работы
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 07: Заморозка миграции и запись применения Summary

**Миграция доступа заморожена, порядок применения четырёх файлов и все BLOCKED-статусы записаны и защищены тестами, матрица безопасности перенесена на Phase 21 (красное окно закрыто), локальная проверка зелёная, владелец принял риски.**

## Accomplishments

- Заморозка: в `lib/portia-canonical-parity.test.ts` комментарий к закреплению Phase 21 говорит, что файл заморожен этим планом, изменения только новой forward-only миграцией; значение хеша не менялось (`a2c69408...4f7e`, совпадает с реальным хешем файла).
- `21-MIGRATION-APPLY.md`: порядок 20261104000000, 20261104000100, 20261106000000, 20261109000000 (файлы 2 и 3 только вместе); статусы: Phase 21 на staging BLOCKED (ENV), на production ОЖИДАЕТ ВЛАДЕЛЬЦА; шаг секрета подписи (решение 1а) через psql со страховкой длины; проверки владельца после применения; откат только вперёд; карта D-01..D-10 на планы и SQL-объекты; 10 принятых рисков и 4 переноса в Phase 23; итог ревью; раздел «Локальная проверка»; подтверждение владельца. Слова PASS в документе нет.
- `21-SECURITY-MATRIX.md`: проверяемый commit равен «Итоговому проверенному commit» из `21-RLS-REVIEW.md` (`10b5e98e80947062dc80e8bc20a12fb9692375c4`); охват 12 путей v1.3 плюс `lib/nickname.ts`, `lib/access-session.ts`, `lib/access-store.ts`, `lib/access-levels.ts`; 7 строк миграций (шесть из v1.3 без изменений плюс новая); находки RLS21-01..16.
- `lib/security-matrix.test.ts`: `currentMatrixText()`; покрытие миграций, колонка production (теперь и для новой миграции, Staging новой должен содержать BLOCKED и не PASS) и свежесть читают матрицу Phase 21; новые тесты: commit матрицы равен итоговому проверенному commit и в находках нет `open`; порядок миграций и хеш записи равны закреплению и хешу файла; статус без PASS и все обязательные разделы непустые.

## Task Commits

1. **Task 1: заморозка, запись применения, матрица Phase 21, проверки** - `4613fa8` (docs)
2. **Task 2: полная локальная проверка, раздел «Локальная проверка»** - `5377429` (docs)
3. **Task 3: чекпоинт владельца (blocking-human)** - ответ «Принято» записан в `be0227c` (docs)

**Plan metadata:** отдельный коммит с этим SUMMARY (следует за `be0227c`; `plan_head_after` измерен до него).

## Локальная проверка (Node v22.13.1, npm не запускался)

| Команда | Код | Итог |
|---|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` | 0 | 1821 тест, 1818 успешно, 0 красных, 3 пропущено |
| `node node_modules/typescript/bin/tsc --noEmit` | 0 | без ошибок |
| `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` | 0 | 0 ошибок, 17 предупреждений (как в 21-02, новых нет) |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | 0 | 49 из 49 |
| `node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion` | 0 | 65 снимков проверено, 18 исключено; режим `--verify` не запускался |
| `node node_modules/next/dist/bin/next build` | 0 | Next.js 16.4.5, компиляция успешна, 3/3 страниц |

`npm test`, `npm run ...` и `.claude/skills/portia-check/run.sh` не использовались: npm временной Node 22.13.1 сломан (нет `node-gyp`); шаги скрипта выполнены напрямую.

## BLOCKED (никогда не засчитывается как пройденное)

Postgres/RLS на живой базе, staging (отпечаток, живой прогон матрицы ролей), роли с аутентификацией, физические устройства, pgcrypto и совпадение HMAC Node/БД, конкурентность, адаптер Netlify `@netlify/plugin-nextjs` >= 5.16.6 (BLOCKED OWNER), Playwright e2e/visual/mutation (ENV/DATA), все пункты списков BLOCKED в `21-RLS-REVIEW.md`. Production: ОЖИДАЕТ ВЛАДЕЛЬЦА. Ничего не применялось ни в одной базе.

## Deviations from Plan

### Известное отклонение критерия приёмки

**1. [Критерий приёмки Task 1] `git diff --quiet b6e5e3d..HEAD -- .planning/milestones/v1.3-phases` возвращает 1, а не 0**
- **Причина:** коммит `21ef19c` (план 21-02) пересобрал `20-DEPENDENCY-AUDIT.json` и `20-DEPENDENCY-AUDIT.md` в архиве v1.3 по решению владельца «1 — исправить сейчас» (после подъёма next до 16.4.5 подпись аудита Phase 20 устарела; см. `deferred-items.md`, статус RESOLVED).
- **Проверено:** других изменений в архиве нет, `20-SECURITY-MATRIX.md` не тронут, незакоммиченного diff по архиву нет (`git diff --quiet -- .planning/milestones/v1.3-phases` возвращает 0). В плане 21-07 архив не менялся.
- **Влияние:** нет; изменение сделано владельцем осознанно до этого плана.

### Auto-fixed Issues

None - план выполнен как написан, не считая отклонения критерия выше.

## Issues Encountered

- Shell-экранирование длинной правки через `node -e` не сработало (ничего не записалось); правки сделаны инструментом Edit. Проектный guard не срабатывал.

## Known Stubs

None.

## Threat Flags

None: новых сетевых, auth или файловых поверхностей план не добавил (документы и тесты).

## Owner checkpoint

2026-11-09, чекпоинт Task 3 (blocking-human): владелец ответил «Принято»; все 10 пунктов раздела «Принятые риски» подтверждены, ни один не отклонён. Это принятие рисков, а не доказательство работы на живой базе.

## Next Phase Readiness

- Phase 21 закрывается с замороженной, проверенной и неприменённой миграцией, письменным порядком применения для владельца и зелёной локальной проверкой.
- Перед приёмом заявок владелец применяет миграции и вносит секрет подписи (раздел «Секрет подписи заявок»).
- Phase 23 получает четыре обязательных требования (проверка человека или грубый лимит, тревога на каждый `unauthorized`, адрес только из `x-nf-client-connection-ip`, проверка заголовка на Netlify).

## Self-Check: PASSED

- Файлы существуют: `21-MIGRATION-APPLY.md`, `21-SECURITY-MATRIX.md`, `21-07-SUMMARY.md`, `lib/security-matrix.test.ts`, `lib/portia-canonical-parity.test.ts`.
- Коммиты `4613fa8`, `5377429`, `be0227c` являются предками HEAD; измеренный `git rev-list --count 395c5f3..be0227c` равен 3.
- Проверенный код (`supabase/migrations`, `lib/access-store.ts`, `lib/access-session.ts`, `lib/nickname.ts`, `lib/access-levels.ts`) не менялся после `10b5e98`.
- STATE.md и ROADMAP.md в плане не менялись.
