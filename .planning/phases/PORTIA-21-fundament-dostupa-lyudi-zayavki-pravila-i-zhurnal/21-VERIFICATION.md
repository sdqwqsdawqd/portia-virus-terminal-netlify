---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
verified: 2026-11-09T19:00:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-01-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-01-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-02-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-02-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-03-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-03-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-04-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-04-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-05-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-05-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-06-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-06-SUMMARY.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-07-PLAN.md"
  - ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-07-SUMMARY.md"
  - "lib/access-levels.ts"
  - "lib/access-session.ts"
  - "lib/access-store.ts"
  - "lib/nickname.ts"
  - "package-lock.json"
  - "package.json"
  - "supabase/fingerprint/expected/portia.fingerprint.json"
  - "supabase/migrations/20261109000000_portia_access_foundation.sql"
  - "tests/e2e/fixtures/data/expected-authz.json"
covered_digest: "v4:sha256:239772b49761c53a90e4ddf378808d73103669d4b05c4407c4042633ed602c58"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Правила решений зашиты в базе: нельзя одобрить себя, выдать уровень выше своего, изменить владельца; повторное решение возвращает «уже решено»; журнал нельзя изменить и прочитать напрямую (SC 2, USR-05)"
    test: "Применить миграцию на изолированном staging-проекте (порядок и секрет подписи — по 21-MIGRATION-APPLY.md) и прогнать живую матрицу ролей и конкурентные сценарии: два редактора решают одну заявку; редактор решает свою привязанную заявку; редактор трогает человека, привязанного к аккаунту владельца; UPDATE/DELETE/TRUNCATE журнала от привилегированной роли"
    expected: "self-decision и owner-protected поднимаются как исключения; второй решающий получает code=already-decided; журнал отвечает journal-append-only, прямой SELECT от anon/authenticated даёт 42501"
    why_human: "Все 16 контрактных тестов USR-05 читают SQL как текст (access-decisions.test.ts, access-foundation.test.ts); ни одна ветка plpgsql, блокировка, триггер или ACL не исполнялась на Postgres. Присутствие и связность проверены, поведение — нет. BLOCKED по дизайну фазы."
human_verification:
  - test: "Postgres/RLS: применить 20261109000000_portia_access_foundation.sql на изолированном staging и сверить фактические ACL с золотым отпечатком"
    expected: "ACL всех portia_access_* и последовательности журнала совпадают с portia.fingerprint.json; portia_promo_register_attempt и portia_promo_bind_device исполняются только service_role"
    why_human: "Нет доступа к настоящему Postgres; SC 5 (SEC-06) подтверждён офлайн как текст миграции + золотой отпечаток. BLOCKED (ENV)"
  - test: "Роли с аутентификацией: владелец, редактор, редактор с закрытыми вкладками, аноним, посторонний вошедший — вызвать portia_access_set_closure, decide, set_level, revoke, clear_cooldown"
    expected: "set_closure проходит только у владельца (редактор получает owner-required, аноним 42501); decide/set_level/revoke у редактора проходят; у анонима 42501"
    why_human: "portia_is_owner() зависит от JWT-email и настроек Supabase Auth (secure email change, подтверждение почты); офлайн не проверяется. BLOCKED"
  - test: "pgcrypto: HMAC из Node совпадает побайтно с extensions.hmac в БД; запрос select extnamespace::regnamespace from pg_extension where extname = 'pgcrypto' возвращает extensions"
    expected: "Подписанная сервером заявка принимается (code=created); без секрета, с неверной подписью, с просроченным временем — unauthorized"
    why_human: "Формат сообщения подписи сверен только текстом и векторами; работа extensions.hmac при search_path='' не исполнялась (RLS21-13, IN-01). BLOCKED"
  - test: "Владелец: убедиться по логу деплоя Netlify, что @netlify/plugin-nextjs не ниже 5.16.6"
    expected: "Версия адаптера >= 5.16.6"
    why_human: "Advisory Netlify: случай Middleware чинится только адаптером, а в репозитории есть proxy.ts (аналог Middleware в Next 16). Версию адаптера видно только в логе деплоя владельца. BLOCKED (OWNER)"
  - test: "Конкурентность: два одновременных approve/submit на один ник; лимиты D-06 под advisory-замком в READ COMMITTED"
    expected: "Одна победа, второй already-decided/unavailable; лимиты 3/10/200/20 точны"
    why_human: "Требует живого Postgres. BLOCKED"
  - test: "Живые контракты «Повышения» после отзыва register_attempt и bind_device"
    expected: "Подача, повторная заявка и привязка устройства у «Повышения» работают как раньше"
    why_human: "Офлайн доказано только отсутствие вызывающих в app/, components/, lib/, scripts/. Живые контракты BLOCKED (ENV)"
---

# Phase 21: Фундамент доступа — отчёт верификации

**Цель фазы:** В базе и общих модулях лежит вся основа доступа — люди, заявки, уровни 1–5, журнал решений и выключенный по умолчанию флаг закрытия — а поведение сайта для посетителей пока не меняется; заодно закрыты разрыв `register_attempt` и версия `next`.
**Проверено:** 2026-11-09
**Статус:** human_needed
**Повторная верификация:** Нет, первичная

Вывод: цель достигнута в объёме офлайн/статических доказательств, на который сама фаза и запрос ограничили проверку. Блокирующих расхождений нет. Всё, что требует настоящего Postgres/RLS, ролей, staging и production, остаётся BLOCKED и перечислено выше как пункты человеческой проверки. Ни один из этих пунктов не записан как пройденный.

## Достижение цели

### Наблюдаемые истины (критерии успеха из ROADMAP)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | Ник проверяется одним правилом в TS и SQL (латиница, цифры, `_`, 3–20); «Qloxz» и «qloxz» — один человек; тест соответствия зелёный; 2 и 21 символ, пробел, дефис, кириллица отклоняются (ACC-04) | ✓ VERIFIED (офлайн) | `lib/nickname.ts`: `NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/`. SQL: `portia_access_nickname_key` (миграция :36-46) с тем же литералом под `collate "C"`, плюс CHECK на `nickname_key` в people/requests/journal и `unique (nickname_key)`. `access-foundation.test.ts:63-90` покрывает «Qloxz»/«qloxz», `ab`, 21 символ, пробел, дефис, кириллицу, `\n`, zero-width. Тест соответствия сверяет литерал SQL с `NICKNAME_PATTERN.source`. Оговорка: цикл сравнения внутри этого теста тавтологичен (WR-02), поэтому семантика движка Postgres ARE не доказана; исполнение на Postgres — BLOCKED |
| 2 | Правила решений в базе: нельзя одобрить себя, выдать уровень выше своего, изменить владельца; повторное решение → «уже решено»; журнал нельзя изменить и прочитать напрямую; офлайн-контракты + ревью `supabase-rls-reviewer` без блокирующих; Postgres BLOCKED (USR-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Присутствуют и связаны: `portia_access_target_guard` (:354-380) вызывается в `decide`/`set_level`/`revoke`; `already-decided` (:415-417); `level-above-own` (:453, :513); триггеры `journal_append_only` и `no_truncate` (:590-596); таблицы закрыты (RLS on, revoke all, :162-183); журнал выдан service_role только `select, insert`. Ревью выполнено в 3 раунда, итог «без блокирующих замечаний» (`21-RLS-REVIEW.md`:70, :136, :187-191). Но все тесты читают SQL как текст; переходы состояний, замки и триггеры не исполнялись — истина поведенческая, поэтому не VERIFIED и не в счёте. Остаток: заявка без входа не распознаётся как «своя» (принятый риск, подтверждён владельцем) |
| 3 | У каждого человека уровень 1–5 с названиями «Уровень 1…5» из одного модуля; редактор и владелец всегда → уровень 5 независимо от записи о человеке (LVL-01) | ✓ VERIFIED | `lib/access-levels.ts`: `accessLevelLabel` → `Уровень N`; `effectiveAccessLevel` возвращает 5 для `isEditor || isOwner` до чтения `person`. SQL: `level between 1 and 5` (:82), `portia_access_caller_level()` = 5 по `portia_can_edit()` без чтения строк людей (:52-60). `access-levels.test.ts` (8 тестов, в т.ч. «editors and the owner resolve to level 5 whatever person row exists» и SQL-соответствие) зелёные. Функция чистая, исполнена тестом |
| 4 | Флаг закрытия в базе: по умолчанию выключен, меняет только владелец; при выключенном флаге сайт как до фазы — существующие тесты, `tsc`, lint, сборка зелёные (ACC-09) | ✓ VERIFIED (офлайн) | Строка `main` таблицы `portia_access_settings`, `closure_enabled boolean not null default false`, seed `false` с `on conflict do nothing` (:638-653); `set_closure` — первая инструкция `portia_is_owner()` → `owner-required` (:682), `grant execute` только `authenticated` и `service_role` (:693-695). **Сайт не изменился:** `git diff c8cd3cf..HEAD -- app components` пуст (единственное изменение вне `lib`/`supabase`/`tests` — 2 строки `package.json` + lock); `grep` по `app`/`components`/`proxy.ts` на `access-session|access-store|access-levels|lib/nickname|portia_access_|site_closure` — 0 совпадений; `register_attempt`/`bind_device` в `app/`/`components/` не вызываются. Моя прогонка: `lib/*.test.ts` — 1821 тест, 1818 pass, 0 fail, 3 skipped; `tsc --noEmit` код 0; `eslint .` код 0. Сборку `next build` я не запускал (опирался на запись 21-07, строка 7: код 0). Исполнение owner-only на роли владельца — BLOCKED |
| 5 | `register_attempt` недоступна аноним и обычному пользователю напрямую (revoke в миграции; fingerprint и expected-authz обновлены; контракты «Повышения» зелёные); `next` и `eslint-config-next` точно на 16.4.5 отдельным коммитом; сборка и тесты зелёные (SEC-06, SEC-08) | ✓ VERIFIED (офлайн) | SEC-06: миграция :701-702 `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role`; golden fingerprint: `portia_promo_register_attempt` → `acl: [service_role:EXECUTE]`; `expected-authz.json` — ячейки anon/outsider/editor → `42501` с `source ...foundation.sql:701`. Тест SEC-06 (`access-foundation.test.ts:365`) проверяет единичность revoke и отсутствие вызывающих. Расширение D-10 (`bind_device`, :710-711) утверждено владельцем. SEC-08: `package.json` `"next": "16.4.5"`, `"eslint-config-next": "16.4.5"` (без `^`/`~`), lock `node_modules/next` 16.4.5 с integrity `sha512-rmdf…`; установленные `node_modules` — 16.4.5 оба; коммит `255ec54` меняет только `package.json` и `package-lock.json`. Исполнение ACL на Postgres и живые контракты «Повышения» — BLOCKED |

**Оценка:** 4/5 истин подтверждено (1 истина — присутствует, но поведение не исполнялось: см. `behavior_unverified_items`).

### Обязательные артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `supabase/migrations/20261109000000_portia_access_foundation.sql` | Таблицы people/requests/journal/secrets/settings, 12 RPC, revoke SEC-06 | ✓ VERIFIED | 711 строк, содержательный; sha256 `a2c69408…34f7e` совпадает с закреплённым в `lib/portia-canonical-parity.test.ts` и в `21-MIGRATION-APPLY.md`; после заморозки (`4613fa8`) в `supabase`, `lib`, `app`, `components` изменений нет |
| `lib/nickname.ts` | Единое правило ника | ✓ VERIFIED | 31 строка, используется в `access-*.ts` и тестах |
| `lib/access-levels.ts` | Уровни 1–5, названия, правило 5 | ✓ VERIFIED | 44 строки |
| `lib/access-session.ts`, `lib/access-store.ts` | Токен/подпись, типизированные RPC-обёртки | ✓ VERIFIED (серверные модули без потребителей до Фазы 23 — так задумано) | fail-closed; ORPHANED относительно `app/` намеренно (сайт не должен меняться) |
| `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json` | Обновлены вместе с объектами | ✓ VERIFIED | Колонки, ограничения, функции, ACL всех `portia_access_*`; ячейки `register_attempt`/`bind_device` → 42501 |
| `21-MIGRATION-APPLY.md`, `21-SECURITY-MATRIX.md`, `21-RLS-REVIEW.md` | Порядок применения, матрица, ревью | ✓ VERIFIED | Порядок 4 файлов, «Агент не применил ничего», BLOCKED/ОЖИДАЕТ ВЛАДЕЛЬЦА нигде не записаны как PASS |

### Проверка ключевых связей

| Откуда | Куда | Как | Статус | Детали |
|--------|------|-----|--------|--------|
| `lib/nickname.ts` | `portia_access_nickname_key` | литерал регулярки | ✓ WIRED (офлайн) | сверка в `access-foundation.test.ts:86` |
| `lib/access-store.ts` | RPC `portia_access_*` | `accessRpc` имена и параметры | ✓ WIRED | тесты проверяют точные имена параметров и коды ответов |
| `access-session.ts` подпись | `submit_request` | HMAC `access-submit-v1\|origin\|nick\|token\|ip\|issuedAt` | ✓ WIRED (текст/векторы) | побайтное совпадение с `extensions.hmac` — BLOCKED |
| миграция | fingerprint / expected-authz | перепривязанные хеши и номера строк | ✓ WIRED | `portia-migration-fingerprint.test.ts`, `phase16-expected-authz.test.ts` зелёные |
| `app/`, `components/` | новые модули | — | ✓ ОТСУТСТВУЕТ (требуется) | 0 импортов и вызовов; посетительский сайт не затронут |

### Поток данных (уровень 4)

Не применимо: фаза не добавляет отображаемых значений; посетительские маршруты и компоненты не менялись.

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Все unit/контрактные тесты | `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1) | 1821 тест, 1818 pass, 0 fail, 3 skipped | ✓ PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | код 0 | ✓ PASS |
| Lint | `node node_modules/eslint/bin/eslint.js .` | код 0 | ✓ PASS |
| Версии зависимостей | чтение `node_modules/next` и `eslint-config-next` | 16.4.5 / 16.4.5 | ✓ PASS |
| Хеш миграции | `sha256sum` против закреплённого | совпадает | ✓ PASS |
| Сборка | `next build` | не запускал (запись 21-07: код 0) | ? SKIP |
| Playwright e2e/visual, живой staging-набор | — | требует источник данных/окружение | BLOCKED, не пройдено |

3 пропущенных теста — живые staging-наборы без окружения; они учтены как SKIPPED, не как PASS.

### Проверка зондов

Фаза не объявляет probe-скриптов; `scripts/*/tests/probe-*.sh` не требуются.

### Покрытие требований

| Требование | План | Описание | Статус | Доказательство |
|------------|------|----------|--------|----------------|
| ACC-04 | 21-01 | Формат ника Roblox, регистр не создаёт второго человека | ✓ SATISFIED (офлайн) | истина 1 |
| LVL-01 | 21-01 | Уровень 1–5; редакторы и владелец — 5 | ✓ SATISFIED | истина 3 |
| SEC-08 | 21-02 | `next`/`eslint-config-next` 16.4.5 | ✓ SATISFIED; адаптер Netlify ≥ 5.16.6 — BLOCKED (OWNER) | истина 5, `255ec54` |
| USR-05 | 21-03, 21-04, 21-06, 21-07 | Правила решений проверяет база | ⚠️ ПРИСУТСТВУЕТ, исполнение на Postgres BLOCKED | истина 2 |
| ACC-09 | 21-04, 21-07 | Закрытие меняет только владелец; по умолчанию выключено; сайт как раньше | ✓ SATISFIED (офлайн); роль владельца на живой базе BLOCKED | истина 4 |
| SEC-06 | 21-05, 21-06, 21-07 | `register_attempt` не вызывается анонимом и пользователем напрямую | ✓ SATISFIED (офлайн); ACL на Postgres BLOCKED | истина 5 |

Все шесть ID из запроса встречаются в `requirements:` планов 21-01…21-07. ORPHANED-требований нет: `REQUIREMENTS.md` относит к Фазе 21 ровно эти шесть. Замечание по трекингу: в `REQUIREMENTS.md` чекбоксы остаются `[ ]`, а таблица трассируемости — «Pending» (строки 16–64, 112–148); их закрывает оркестратор после решения по статусу фазы.

### Известные отклонения и решения владельца (учтены)

- Критерий 21-07 «архив v1.3 не изменён» **не выполнен**: коммит `21ef19c` пересобрал `20-DEPENDENCY-AUDIT.json/.md` в `.planning/milestones/v1.3-phases/PORTIA-20-…` после подъёма `next` (решение владельца «1»; записано в `deferred-items.md` как RESOLVED). Подтверждено `git log -1 --name-only 21ef19c`: затронуты только эти два файла. Блокером не считаю: отклонение осознанное, подписанное владельцем, а SC фазы его не содержит.
- Проверка дрейфа схемы пропущена (решение «1»); RLS21-01 (подпись сервером), RLS21-02 (отзыв `bind_device`, D-10), «Принято» по 10 принятым рискам — отражены в `21-MIGRATION-APPLY.md`.

### Найденные анти-паттерны

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| `lib/access-foundation.test.ts` | 86-97 | Тавтологичный цикл «parity» (WR-02) | ⚠️ Warning | Тест не поймает расхождение движков; сверка литерала остаётся |
| `lib/phase16-expected-authz.test.ts` / `portia-staging-live.test.ts` | 383-415 / 334-341 | «инертные» пробы, но `set_closure` владельца пишет в `main` (WR-01) | ⚠️ Warning | При живом прогоне на стенде молча выключит флаг; поправить до staging |
| `lib/access-session.ts` | 41-47 | Нет проверки «секрет подписи ≠ секрет устройства» (WR-03) | ⚠️ Warning | Защита держится на комментарии |
| `lib/access-store.ts` | 7-12, 83-101 | Контракт клиента `submit` для Фазы 23 не закреплён (WR-04): анонимный клиент даст `requested_by = null` и отключит защиту self-decision | ⚠️ Warning | Перенести в требования Фазы 23 |
| `lib/access-store.ts`, `access-session.ts` | — | `submitAccessRequest` бросает `Error`, не `AccessStoreError` (WR-05) | ⚠️ Warning | Маршрут Фазы 23 получит 500 на плохой ник |

Маркеров `TBD`/`FIXME`/`XXX` без ссылки в изменённых файлах не искал построчно сверх выборочного grep по `app/`/`components/`; блокеров-долгов не обнаружено. Все 14 находок `21-REVIEW.md` (5 warning, 9 info, 0 critical) числятся `open`; они не блокируют фазу, но WR-01 и WR-04 нужно закрыть до staging и Фазы 23 соответственно. SQL-находки (IN-01, IN-02) допустимо закрывать только новой forward-only миграцией: файл заморожен.

### Требуется проверка человеком

Шесть пунктов перечислены во frontmatter (`human_verification`) и в `behavior_unverified_items`: исполнение миграции и ACL на изолированном staging, роли с аутентификацией, pgcrypto/HMAC, версия адаптера Netlify (особенно важна, т.к. в репозитории есть `proxy.ts`), конкурентность, живые контракты «Повышения». Все — BLOCKED по дизайну фазы; применение на production делает владелец.

### Итог по пробелам

Пробелов, требующих плана доработки (`gaps_found`), нет: ни одна истина не провалена, артефакты не пусты, связи не разорваны, посетительский сайт не затронут. Фаза остаётся в `human_needed` только потому, что поведение базы (USR-05 и сопутствующие ACL/роли) не исполнялось и честно записано как BLOCKED, а не как PASS.

---

_Проверено: 2026-11-09_
_Верификатор: Claude (gsd-verifier)_
