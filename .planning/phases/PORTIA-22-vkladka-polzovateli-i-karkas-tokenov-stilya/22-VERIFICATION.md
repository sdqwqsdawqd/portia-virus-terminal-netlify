---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
verified: 2026-11-12T12:52:55Z
status: human_needed
score: 1/5 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-01-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-01-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-02-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-02-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-03-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-03-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-04-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-04-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-05-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-05-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-06-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-06-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-07-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-07-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-08-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-08-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-09-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-09-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-10-PLAN.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-10-SUMMARY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-MIGRATION-APPLY.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-RLS-REVIEW.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-SECURITY-MATRIX.md"
  - ".planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-STYLE-DIRECTION.md"
  - "app/api/users/route.ts"
  - "components/portia-users-tab.tsx"
  - "lib/access-foundation.test.ts"
  - "lib/access-store.ts"
  - "lib/portia-canonical-parity.test.ts"
  - "lib/security-matrix.test.ts"
  - "lib/style-tokens.test.ts"
  - "lib/users-api.test.ts"
  - "lib/users-api.ts"
  - "lib/users-component.test.ts"
  - "lib/users-model.ts"
  - "lib/users-roster.ts"
  - "lib/users-sql.test.ts"
  - "lib/users-view.ts"
  - "supabase/fingerprint/expected/portia.fingerprint.json"
  - "supabase/migrations/20261110000000_portia_users_tab.sql"
  - "supabase/migrations/20261112000000_portia_access_decision_mark.sql"
  - "tests/e2e/fixtures/data/expected-authz.json"
covered_digest: "v4:sha256:7d945f9aa37e377e395fe09527ef619aaa0f51f6adbfc9817e8aa012bf65088e"
behavior_unverified: 4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/5
  gaps_closed:
    - "SC2: свежая отметка из POST доведена до отображаемой строки после GET с кэшированным roster"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "SC1: редактор видит реальные заявки и людей, порядок и счётчик"
    test: "Открыть вкладку с реальными заявками под редактором на изолированном staging"
    expected: "Ожидающие сверху; группы и счётчик соответствуют базе"
    why_human: "Миграции не применены, локальные тесты используют mock RPC"
  - truth: "SC2: отметка после одиночного одобрения отражает roster в момент решения"
    test: "Изменить roster между GET и POST, одобрить заявку и осмотреть отметку строки после обновления"
    expected: "Строка показывает отметку из POST даже при кэшированном roster в GET"
    why_human: "Новый компонентный тест проверяет regex исходника и не выполняет переход React POST → GET → render"
  - truth: "SC3: решения, журнал, запреты и гонка двух редакторов"
    test: "Выполнить решения и одновременное одобрение одной заявки под двумя редакторами"
    expected: "Второй видит «уже решено», журнал и запреты базы согласованы"
    why_human: "Живые Postgres/RLS и роли не проверялись"
  - truth: "SC4: массовое одобрение владельца и закрытие вкладки редактору"
    test: "На изолированном staging подтвердить bulk при более чем 50 заявках и закрыть вкладку одному редактору"
    expected: "Подходящие заявки получают уровень 2, закрытый редактор видит «Доступ закрыт» и RPC отклоняет доступ"
    why_human: "Живые роли, roster и ACL/RLS не проверялись"
human_verification:
  - test: "SC1: реальные список и счётчик на изолированном staging"
    expected: "Ожидающие сверху; все группы и счётчик верны"
    why_human: "Миграции не применены"
  - test: "SC2: смена roster между загрузкой строки и решением"
    expected: "Видимая отметка равна отметке POST в момент решения"
    why_human: "Компонентный тест статический; браузерный прогон BLOCKED (ENV)"
  - test: "SC3: роли, журнал, запреты и конкурентное решение"
    expected: "База сохраняет инварианты; второй редактор видит «уже решено»"
    why_human: "Нет живого Postgres/RLS"
  - test: "SC4: массовое решение и закрытие вкладки"
    expected: "Уровень 2 для подходящих заявок; закрытый редактор не получает данные"
    why_human: "Нет живых owner/editor ролей"
  - test: "22-07: ширина 320, 390 и 900 px с открытыми группами и окном действий"
    expected: "scrollWidth <= clientWidth"
    why_human: "Backstop truth; браузерная lane BLOCKED (ENV)"
  - test: "22-07: поиск ника длиной 20 символов при 320 px"
    expected: "scrollWidth <= clientWidth"
    why_human: "Backstop truth; браузерная lane BLOCKED (ENV)"
  - test: "Разобрать 18 must-NOT ограничений из PLAN 22-01..22-10 по отдельности"
    expected: "Для каждого ограничение не нарушено; живые Postgres/RLS, роли и устройства не отмечены PASS"
    why_human: "PLAN помечает их flagged-unverified; у test-tier нет wired enforcement descriptor, judgment-tier требует решения человека"
---

# Phase 22: повторная проверка на HEAD d915584

**Цель:** редакторы видят людей и заявки и принимают решения; владелец массово одобряет сотрудников; владелец выбрал направление стиля, а токены объявлены без видимой смены сайта.

**Вердикт:** `human_needed`. Единственный прежний программно наблюдаемый разрыв SC2 закрыт в коде. Реальное поведение вкладки и базы остаётся `BLOCKED (ENV)` по решению владельца «оставить blocked C»; живое выполнение не объявлено PASS. `gaps:` отсутствует, поскольку новый код проводит отметку до строки, а оставшееся требует поведенческой и живой проверки.

## Наблюдаемые истины

| # | Критерий ROADMAP | Статус | Доказательство и граница |
|---|---|---|---|
| 1 | Список, порядок и счётчик заявок | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Вкладка, GET list/count, RPC и представление связаны; живые роли/данные не проверены. |
| 2 | Ник, профиль, тип, отметка при решении, уровни 2/1 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `POST` возвращает `personId`/`tableMark`; `recentDecisionMarks` накладывается на `people.rows` перед `setList`; `buildUsersView` передаёт отметку в PC и телефон. Тест проверяет исходник, а не переход UI. |
| 3 | Решения, журнал, запреты и гонка | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | UI → API → RPC/SQL присутствуют; нет запуска на Postgres с двумя ролями. |
| 4 | Owner bulk и закрытие вкладки | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Кнопка, подтверждение, свежий roster, API и SQL-gate присутствуют; живое исполнение не проверено. |
| 5 | Направления A/B/C, выбор владельца, токены без смены вида | ✓ VERIFIED локально | `22-STYLE-DIRECTION.md` фиксирует ответ владельца C; тесты токенов и digest из предыдущей проверки прошли. |

**Счёт:** 1/5, ещё 4 истины присутствуют в коде, но их поведение не доказано. Для SC2 локальная проводка подтверждена, но UI-переход остаётся без исполняемого теста.

## SC2: проводка данных

| Уровень | Доказательство | Статус |
|---|---|---|
| SQL → RPC | `20261112000000_portia_access_decision_mark.sql:98` возвращает `personId`, `level`, ключ решённой заявки | ✓ код присутствует; Postgres BLOCKED |
| RPC → API | `access-store.ts:147-150` проверяет ответ; `users-api.ts:213-217` перечитывает roster с TTL 0 и выдаёт `tableMark` без ключа в HTTP | ✓ локальные API-тесты проходят |
| POST → GET → UI | `portia-users-tab.tsx:513-515` сохраняет отметку по `personId` на 25 секунд; `:428-437` накладывает её на `people.rows` до `setList` при GET с возможным roster-кэшем 20 секунд | ✓ проводка в коде; поведение не тестировалось |
| Строка → экран | `users-view.ts:204` формирует плашку; `portia-users-tab.tsx:200,325` рисует её в окне телефона и строке PC | ✓ код присутствует |

Идентификаторы согласованы: SQL решения возвращает UUID `person_uuid`, а SQL списка людей строит `people.rows[].id` из `p.id` (`20261110000000_portia_users_tab.sql:125`). При успешном GET строка получает отметку POST даже если roster-кэш другого serverless-инстанса ещё старый. Если GET неуспешен или строка не входит в выборку, обновлённая отметка не появляется; это остаётся границей живой проверки. По истечении 25 секунд наложение удаляется при следующем GET.

## Проверки и качество тестов

| Проверка | Результат | Граница |
|---|---|---|
| Node 22.13.1 `--experimental-strip-types --test lib/users-component.test.ts lib/users-api.test.ts` | 43/43 PASS, 0 skipped | API-тесты используют mock RPC; новый UI-тест делает `assert.match` по исходнику, не запускает React |
| Node 22.13.1 `node_modules/typescript/bin/tsc --noEmit` | PASS | Типы, не runtime |
| Новый `lib/users-component.test.ts` | Активен, не circular; assertion level — source pattern | Недостаточен для доказательства state transition SC2 |
| Anti-pattern scan изменённых файлов | Нет `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`; новых stub не видно | Только `components/portia-users-tab.tsx` и `lib/users-component.test.ts` из d915584 |
| Probe | Для этой фазы не объявлен | N/A |
| Build, браузер, staging | Не запускались | Build читает `.env.local`; миграции и роли по решению владельца BLOCKED |

Предыдущая верификация зафиксировала 28/29 автоматических artifact checks (устаревшее буквальное требование `BLOCKED` в 22-02 после выбора C), 19/19 key links, 12/12 решений CONTEXT и локальные тесты связанных SQL/API/style файлов. На этом проходе повторно проверены код, проводка, целевые тесты и типы; прежние результаты не представлены как новый запуск. Новых несвязанных блокеров Step 7 нет; **Advisory (New Scope, Unevidenced): нет**.

## Требования и ограничения

USR-02/USR-03 теперь имеют полную локальную цепочку SQL → API → UI, но видимый переход после решения требует исполняемого браузерного теста. USR-01, USR-04, USR-06..09 имеют локальные реализации по предыдущей проверке; живое поведение `BLOCKED (ENV)`. UI-01 локально подтверждено. USR-05 относится к Phase 21. Осиротевших требований Phase 22 не обнаружено.

Восемнадцать prohibitions в PLAN 22-01..22-10 содержат `flagged-unverified` в своих `reason`. Test-tier пункты не снабжены wired enforcement descriptor; judgment-tier требуют явной проверки человеком. Все остаются флагами, а не молчаливым PASS. По планам это: 22-01 (2: живые доказательства и применение миграции), 22-02 (2: выбор стиля и неизменность CSS), 22-03 (2: маска email и живые доказательства), 22-04 (1: запрещённые действия), 22-05 (2: журнал и живые доказательства), 22-06 (2: bulk и degraded roster), 22-07 (1: честность browser lane), 22-08 (2: locked decisions и BLOCKED), 22-09 (1: честность apply record), 22-10 (3: выбор стиля, production, честность staging). Каждый пункт требует отдельного человеческого разрешения; группировка выше не меняет статус ни одного.

## Что остаётся BLOCKED

Миграции доступа `20261109000000`, `20261110000000`, `20261112000000` не применялись. Поэтому Postgres/RLS, настоящие owner/editor роли, конкурентность, staging/production, Netlify и физические устройства остаются `BLOCKED (ENV)` / «ОЖИДАЕТ ВЛАДЕЛЬЦА». Браузерный backstop 22-07 для 320/390/900 px и поиска длиной 20 символов также не выполнялся. Эти пункты нельзя превратить в PASS по статическим SQL-тестам или выбору направления C.

_Verifier: gsd-verifier. Отчёт обновлён без коммита; внешние среды и база не затрагивались._
