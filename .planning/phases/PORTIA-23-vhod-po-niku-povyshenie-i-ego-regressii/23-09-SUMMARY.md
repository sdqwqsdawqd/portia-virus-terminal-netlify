---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 09
subsystem: auth
tags: [access-gate, fail-closed, supabase-ssr, tdd, gap-closure]

requires:
  - phase: PORTIA-23
    provides: "23-08: editor-first resolveGate, isMissingClosureFunction, accessGateLayout"
provides:
  - "Отсутствующая функция закрытия в базе = закрытие ON: не-редактор получает closed/none и экран заявки"
  - "Редактор с недоступной проверкой при отсутствующей функции получает отказ (503), не рабочий стол"
  - "WR-04: проверенный редактор не видит гостевую карточку, форму и кнопку «ПОДАТЬ ЗАЯВКУ»"
  - "WR-03: форма заявки показывает только известные тексты, строку error сервера или общий текст"
  - "Бюджет запросов опроса /api/access/status закреплён тестом на настоящем клиенте @supabase/ssr"
affects: [PORTIA-23-10, PORTIA-23-11, verify-work 23]

actuals:
  tokens: 6150
  tasks: 3
  commits: 5

plan_head_before: 9a7b0db73ed31ccc5dfd7f0cb18e86cc928a18a1
plan_head_after: d425f5f2710a6926a5a733eef1b71b999011c681

tech-stack:
  added: []
  patterns:
    - "Офлайн-трассер: настоящий createServerClient на https://probe.invalid с подставным fetch, неизвестный запрос падает"
    - "Чистая функция accessSubmitFailure в lib без русского текста; тексты живут в компоненте"

key-files:
  created: []
  modified:
    - lib/access-gate.ts
    - lib/access-gate-view.ts
    - lib/access-gate.test.ts
    - components/portia-access-gate.tsx

key-decisions:
  - "Решение владельца 2026-11-14 (1a): отсутствующая функция закрытия = закрытие ON (fail-closed); отменяет откат на open из 23-08 и D-01"
  - "Редактор первым (23-08) сохранён; непроверяемый редактор при отсутствующей функции получает «Editor verification unavailable.», как при закрытии ON"
  - "Задержку опроса не правим: причины в коде не доказано; замер на dev-сервере остаётся пунктом владельца"

requirements-completed: [ACC-01, ACC-02, ACC-08]

coverage:
  - id: D1
    description: "Отсутствующая функция закрытия даёт закрытое решение со state none и закрытый экран с формой заявки; сквозной трассер на настоящем клиенте, один запрос"
    requirement: ACC-02
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts#tracer: a real Supabase client answering PGRST202 yields the closed request screen with one request (G-PORTIA-23-4)"
        status: pass
      - kind: unit
        ref: "lib/access-gate.test.ts#missing closure function closes the site and keeps the request form (G-PORTIA-23-4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Непроверяемый редактор при отсутствующей функции получает отказ; проверенный редактор по-прежнему входит первым"
    requirement: ACC-08
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts#unavailable or failing editor verification keeps the previous branch behaviour"
        status: pass
      - kind: unit
        ref: "lib/access-gate.test.ts#verified editor gets the desktop before the closure flag is read"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-04: редактору не показываются карточка, форма и кнопка повторного открытия"
    requirement: ACC-08
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts#gate layout: a verified editor never sees the visitor card, form or reopen button (WR-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-03: форма заявки не показывает текст исключения; не-JSON ответ не бросает исключение"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts#request form shows only known or server failure texts, never a raw exception (WR-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Бюджет запросов опроса статуса: 1 / 2 / 4 запроса по ролям, без чтения флага закрытия у редактора"
    verification:
      - kind: unit
        ref: "lib/access-gate.test.ts#status poll network budget: an anonymous visitor makes one request and a signed-in editor never reads the closure flag"
        status: pass
    human_judgment: false
  - id: D6
    description: "Живой экран при неприменённых миграциях, вход редактора в браузере, замер задержки на dev-сервере"
    verification: []
    human_judgment: true
    rationale: "Нужны живой dev-сервер, браузер и реальная база владельца; агент их не запускает (CLAUDE.md, D-72)"

duration: 25min
completed: 2026-11-14
status: complete
---

# Phase PORTIA-23 Plan 09: Закрытый экран при отсутствующей функции закрытия Summary

**Шлюз при отсутствующей в базе функции закрытия закрывает сайт (closed/none, форма заявки), редактор входит первым и не видит гостевую форму, отказ отправки честный и русский; цена опроса статуса измерена и закреплена тестом на настоящем клиенте @supabase/ssr без сети.**

## Performance

- **Duration:** около 25 минут
- **Tasks:** 3 из 3
- **Files modified:** 4 (`lib/access-gate.ts`, `lib/access-gate-view.ts`, `lib/access-gate.test.ts`, `components/portia-access-gate.tsx`)
- **Gap:** G-PORTIA-23-4, часть шлюза. Миграционное значение по умолчанию — в 23-10, ревью и инструкция владельцу — в 23-11.

## Что сделано

1. **Task 1 (tracer).** В `resolveGate` ветка «нет функции закрытия» теперь: `warn` с `{ sqlState }` (один раз на процесс), затем для непроверяемого редактора `Error("Editor verification unavailable.")`, иначе `{ mode: "closed", state: { state: "none" }, allowed: false, level: null, editor: false }`. Токен не читается, `portia_access_resolve` не вызывается. Старая ветка открытого режима удалена, сообщение заменено на «…treating closure as ON (fail-closed) until the access migrations are applied». `isMissingClosureFunction` стал type guard (`error is AccessStoreError`, IN-04, первая половина). Editor-first не менялся. Трассер: настоящий `createServerClient` на `https://probe.invalid` с подставным `fetch`, ответ 404 / `PGRST202` на опрос анонима даёт ровно один запрос, закрытое решение и раскладку desktop=false, showCard=true, showForm=true.
2. **Task 2 (WR-04, WR-03).** `accessGateLayout` знает правило редактора (`desktop` true, `showCard`, `showForm`, `showReopen` false) и получил поле `showReopen`; кнопка «ПОДАТЬ ЗАЯВКУ» рисуется по `layout.showReopen`. Добавлена чистая `accessSubmitFailure` (известный код, затем строка `error` 1–300 символов после trim, иначе общий текст). Компонент читает тело как `response.json().catch(() => null)`, не показывает текст исключения; тексты — в модульной `submitFailureText`.
3. **Task 3 (бюджет опроса).** Тест «status poll network budget…» на настоящем клиенте. Продуктовый код не менялся.

## Измеренный бюджет запросов опроса (офлайн, настоящий клиент)

| Роль | Запросов в Supabase за опрос | Шаги |
|---|---|---|
| Аноним без cookie, закрытие ON или OFF | 1 (POST rpc закрытия) | 1 |
| Посетитель с cookie устройства, закрытие ON | 2 (закрытие, затем разбор токена) | 2 |
| Вошедший владелец-редактор | 4 (GET /auth/v1/user, затем параллельно can_edit, is_owner, GET portia_editors) | 2 |

Флаг закрытия у редактора не читается (editor-first). **Вывод: причина задержки «Проверяем доступ…» в коде не доказана, лишнего последовательного запроса у посетителя нет, исправления нет.** Предположение UAT «editorAccess на каждом опросе замедляет гостя» офлайн опровергнуто: у анонима editorAccess сетевых вызовов не добавляет. Остаются сетевой круг до Supabase и компиляция маршрута по требованию в `npm run dev` — офлайн не измерить.

## Пункт владельца: замер задержки на dev-сервере (ОЖИДАЕТ ВЛАДЕЛЬЦА, не PASS)

1. Перезапустить `npm run dev`, открыть главную.
2. Сравнить время первого и следующих `GET /api/access/status` в логе dev-сервера (Next 16 печатает общее время и долю компиляции) и во вкладке Network DevTools (Timing).
3. Медленный только первый запрос = компиляция по требованию в режиме разработки.
4. Медленные все = сетевой круг до Supabase с машины владельца.
5. Для сравнения можно открыть сборку: `npm run build`, затем `npm run start`.

## TDD (RED / GREEN)

- **Task 1 RED** (`a03d2d4`): 3 теста упали на утверждении планируемого поведения (трассер: фактически `mode: 'open'` вместо `closed`; переписанный тест на три ответа; тест непроверяемого редактора: «Missing expected rejection»). Семантическая оценка: цель выполнилась и упала на нужном утверждении, ошибок загрузки и импорта нет. Классификатор `gsd_run check tdd-red-evidence` не запускался: вывод TAP Node проверен вручную, запись RED не сохранялась. **GREEN** (`7b860cf`): 22 из 22 в `access-gate.test.ts` + `access-closure.test.ts`, tsc 0.
- **Task 2 RED** (`34267b4`): 4 теста упали (трассер и раскладка из-за отсутствующего `showReopen`; тест редактора; тест `accessSubmitFailure` отдаёт default на известных кодах). Чтобы файл тестов загружался, в RED-коммит вошла заглушка `accessSubmitFailure` в `lib/access-gate-view.ts` (ESM-импорт несуществующего имени иначе ломает загрузку всего файла). **GREEN** (`97ef402`): 49 из 49 в четырёх файлах, tsc 0, eslint 0.
- **Task 3** (`d425f5f`): тест-характеризация без изменения кода, прошёл сразу (по плану: код не правится).
- REFACTOR не потребовался.

## Команды и результаты

Использована прямая форма (npm у эталонной Node 22.13.1 сломан), Node v22.13.1:

- `node --experimental-strip-types --test lib/*.test.ts` — код 0, 1919 тестов, 1916 pass, 0 fail, 3 skipped (база: 1915 / 1912 / 0 / 3).
- `node --experimental-strip-types --test lib/access-gate.test.ts` — 16 pass, 0 fail (база: 12).
- `node node_modules/typescript/bin/tsc --noEmit` — код 0.
- `node node_modules/eslint/bin/eslint.js lib/access-gate.ts lib/access-gate-view.ts lib/access-gate.test.ts components/portia-access-gate.tsx` — код 0.
- `git diff --name-only 0046f80ca35c01bb87e1475a0d316c2870484eb8 HEAD -- app/api lib/access-store.ts supabase/migrations lib/editor-access.ts proxy.ts lib/supabase` — пусто (матрица безопасности свежа).

## Угроза T-23-22 вместо T-23-17 (23-08)

Отсутствующая функция закрытия теперь закрывает сайт, непроверяемый редактор получает отказ. Окно устаревшего кэша схемы и удалённой функции больше не открывает сайт (WR-02 снят переходом на fail-closed), путь повышения прав исчез. Остаётся только риск доступности: гость видит закрытый экран, пока функций нет или кэш PostgREST не перезагружен. Остальные сбои закрытия по-прежнему пробрасываются (`failClosedReplies`).

## Статус находок ревью (диспозицию записывает 23-11)

- WR-02: снят fail-closed (T-23-22).
- WR-03: закрыт в коде и тестом.
- WR-04: закрыт в коде и тестом (T-23-23).

## Повторная проверка владельцем (до применения миграций; /gsd-verify-work 23, UAT 2 и 3)

1. Перезапустить `npm run dev`, открыть главную в приватном окне: после «Проверяем доступ…» закрытый экран «Заявка на доступ» с полем «НИК ROBLOX», рабочего стола нет. В логе dev-сервера один раз «PORTIA access gate: closure RPC is missing in the database; treating closure as ON (fail-closed) …».
2. Отправка заявки показывает «Не удалось отправить заявку. Проверьте соединение и повторите.» — таблиц и функций заявок в базе нет (D-72), это честный отказ.
3. «ВХОД ДЛЯ РЕДАКТОРА»: после входа рабочий стол открывается, карточки заявки и кнопки «ПОДАТЬ ЗАЯВКУ» нет.
4. Если вместо экрана заявки виден экран ошибки, в логе будет «PORTIA visitor gate check failed» с причиной (другой код базы, отсутствующий секрет устройства) — остаётся закрытым по решению владельца.

## BLOCKED (не PASS)

- Живой ответ `/api/access/status` при неприменённых миграциях: BLOCKED, нужен dev-сервер и база владельца.
- Вход редактора в браузере, видимость экрана заявки и кнопок: BLOCKED, нужен браузер и авторизованная роль.
- Сборка (`npm run build`): BLOCKED, нет изолированного checkout без реальных `.env` (файлы `.env*` не читались).
- Playwright e2e, физические устройства, живой Postgres/RLS: BLOCKED до своей фазы.
- Замер задержки на dev-сервере: ОЖИДАЕТ ВЛАДЕЛЬЦА.

## Отклонения от плана

- **Заглушка в RED-коммите Task 2** (`34267b4`): добавлена заглушка `accessSubmitFailure` в `lib/access-gate-view.ts`, чтобы тест-файл загружался и падал на утверждениях, а не на ошибке линковки (INVALID_RED). Заменена реализацией в `97ef402`. Заглушек в итоговом коде нет.
- Больше отклонений нет, план выполнен как написан. Правил 1–4 не применялось.

## Known Stubs

Нет.

## Threat Flags

Нет новой сетевой поверхности, путей авторизации или схемных изменений вне регистра T-23-22..T-23-26.

## Commits

- `a03d2d4` test(PORTIA-23-09): failing tracer
- `7b860cf` fix(PORTIA-23-09): missing closure function closes the site
- `34267b4` test(PORTIA-23-09): failing tests WR-04 / WR-03
- `97ef402` fix(PORTIA-23-09): editor layout and honest submit failure
- `d425f5f` test(PORTIA-23-09): status poll network budget

## Self-Check: PASSED
