---
phase: PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 14
subsystem: testing
tags: [playwright, staging, app-states, search, editor-journeys, upload-cache, owner-uat, acceptance-gate]
requires:
  - phase: 19-07
    provides: teardown, residual 0
  - phase: 19-13
    provides: editor rebase, fail-closed, WYSIWYG
provides:
  - tests/e2e/specs/app-states.spec.ts (матрица состояний 8 приложений, сбой только абортом /api)
  - tests/e2e/specs/search-click.spec.ts (click-through 7 типов результата поиска)
  - tests/e2e/specs/editor-journeys.spec.ts (аутентифицированные сценарии редактора и upload/cache на изолированном staging)
  - 19-EVIDENCE.md (матрица, click-through, editor journeys, upload/cache, вердикт владельца)
  - 19-APPS-UAT.md (чек-лист и вердикт владельца PC/phone)
affects: [Phase 20, verify-work PORTIA-19]
actuals:
  tokens: 21500
  tasks: 3
  commits: 3
plan_head_before: 9eaa75b25857a7fdae0c7b3316955eebf2cd25cc
plan_head_after: 82159fd8c781ea795d971279dc8cb632c3a4c802
tech-stack:
  added: []
  patterns:
    - "Сбой собственного /api только абортом или удержанием запроса, ответ не подменяется (assertNoOwnApiFulfilled)."
    - "Состояние без данных на цели = BLOCKED (DATA), а не pass; N/A только по дизайну."
    - "Mutation-lane на изолированном staging с receipt residual 0 и восстановлением portia_content в каждом тесте."
key-files:
  created:
    - tests/e2e/specs/app-states.spec.ts
    - tests/e2e/specs/search-click.spec.ts
    - tests/e2e/specs/editor-journeys.spec.ts
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-APPS-UAT.md
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-playwright-19-14-editor-journeys.json
  modified: []
key-decisions:
  - "Физический вердикт владельца принят из 19-UAT.md (commit 5d7c225, partial): D (физически), F9-F12 и STAB-PROM-15 остаются BLOCKED и не записаны как PASS."
  - "Значок без подписи в портрете 76 px принят владельцем (отступление от UI-SPEC)."
  - "В REQUIREMENTS.md отмечены выполненными только STAB-MEDIA-01..05 и STAB-SEARCH-03; остальные требования плана остаются Pending из-за BLOCKED (DATA/ENV) частей."
requirements-completed: [STAB-MEDIA-01, STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-04, STAB-MEDIA-05, STAB-SEARCH-03]
requirements-pending: [STAB-DESK-08, STAB-APP-01, STAB-APP-02, STAB-APP-03, STAB-APP-04, STAB-APP-05, STAB-APP-06, STAB-APP-07, STAB-APP-08, STAB-APP-09, STAB-APP-10, STAB-SEARCH-01, STAB-SEARCH-02, STAB-SEARCH-04]
coverage:
  - id: D1
    description: "Матрица состояний 8 приложений x 6 состояний x 2 проекта на изолированном staging"
    requirement: STAB-APP-10
    verification:
      - kind: e2e
        ref: "npm run test:e2e -- app-states search-click media-states, chromium-desktop + chromium-phone: 98 тестов, 77 passed, 21 skipped (BLOCKED DATA), 0 failed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Search click-through: app, virus, employee, info, file; guide и broadcast BLOCKED (DATA)"
    requirement: STAB-SEARCH-02
    verification:
      - kind: e2e
        ref: "search-click.spec.ts в прогоне A"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editor journeys и upload/cache на staging (21/21, residual 0)"
    requirement: STAB-APP-07
    verification:
      - kind: e2e
        ref: "npm run test:e2e:mutation -- tests/e2e/specs/editor-journeys.spec.ts, receipt-playwright-19-14-editor-journeys.json"
        status: pass
    human_judgment: false
  - id: D4
    description: "Физический вердикт владельца на PC и iPhone 16 (Firefox)"
    verification: []
    human_judgment: true
    rationale: "Вид, прокрутка, касание и покой иконок на реальных устройствах не доказываются кодом; вердикт в 19-UAT.md и 19-APPS-UAT.md, D-физически и F9-F12 BLOCKED"
duration: multi-session
completed: 2026-11-03
status: complete
---

# Phase PORTIA-19 Plan 14: acceptance gate приложений, поиска, медиа и редактора Summary

**Три browser-spec (состояния 8 приложений, click-through поиска, authenticated editor journeys и upload/cache) прошли на изолированном staging без подмены собственных /api (98 тестов прогона A: 77 passed, 0 failed, 21 BLOCKED по данным; mutation-lane 21/21, residual 0), а владелец на PC и iPhone 16 принял состояния, поиск, медиа, иконки и backstop F1-F8, F13; физический осмотр редактора, reviewer-часть F9-F12 и STAB-PROM-15 остаются BLOCKED и записаны долгом.**

## Что сделано

- Task 1 (tracer, 6da2f94): `app-states.spec.ts` и `search-click.spec.ts`, прогон A на chromium-desktop и chromium-phone, матрица и click-through в `19-EVIDENCE.md`. Прогон A (98 тестов, включая `media-states.spec.ts`): 77 passed, 21 skipped, 0 failed. Все 21 skipped записаны как BLOCKED (DATA) с причиной: на цели нет записей «Справочника» и «Сводки», а пустые состояния остальных приложений нельзя показать без подмены ответа собственного /api.
- Task 2 (1ac0cc5): `editor-journeys.spec.ts`. Mutation-lane на staging (`refHash 01d085e7b9f0`): 21 тест, 21 passed, receipt residual 0. Сценарии: статусы сохранения, 409 с обеими кнопками, «Сохранено 1 из 2», fail-closed «Доступ закрыт», отказ upload по сигнатуре с сохранённым URL, immutable UUID-медиа без повторной загрузки.
- Task 3 (82159fd чек-лист, вердикт этим коммитом): `19-APPS-UAT.md` заполнен по `19-UAT.md`, обе строки вердикта записаны. `19-EVIDENCE.md` дополнен разделом «Вердикт владельца» со ссылкой на исправления по находкам.

## Вердикт владельца

Источник: `19-UAT.md`, commit 5d7c225, status partial: 13 проверок, 11 PASS, 0 issues, 2 BLOCKED. Устройства: PC и iPhone 16 (Firefox), staging.

- PASS владельцем: A, B, C, E, F1-F8, F13. Значок без подписи в портрете 76 px принят (отступление от UI-SPEC).
- D (редактор): автоматика PASS (Lane B), физически BLOCKED (на тот момент не было staging-аккаунта редактора).
- F9-F12 (reviewer «Повышения»): BLOCKED (нет аккаунта проверяющего).
- STAB-PROM-15 (живая приёмка на staging): BLOCKED, долг по варианту 2 владельца.

## Deviations from Plan

### Находки владельца во время UAT (исправлены оркестратором, не коммиты задач плана)

Не входят в `commits` и `plan_head_after` этого плана.

1. **973d354** `fix(19-11)`: `key` перед spread в строках результатов поиска; красное окно React при открытии файла корзины из поиска.
2. **7ca0a35** `fix(employees)`: лист сотрудников читается только в A1:Z35, ранги не обнуляются из-за типизации даты столбца E в gviz.
3. **796e840** `fix(trash)`: на телефоне список растёт со строками, страница прокручивается (iOS не листал вложенный список). Первая попытка 24e0277 отменена в 19468e9.
4. **97b804d** `fix(desktop)`: копии контента и ростера на устройстве привязаны к источнику данных (чужая или непомеченная копия отбрасывается).
5. **5bef0ef** `todo`: переключатель разделов «Информации» на телефоне перенесён в Phase 20 (владелец: кнопка не должна мешать нажатиям).
6. **856c80e** новый staging-прогон `mw0rbyf6_72424cdc` оставлен владельцу (учётные данные во временной папке пользователя), teardown не выполнен.
- Окружение: цикл перезагрузки Next dev («HMR hash mismatch») устранён очисткой `.next/dev`; дефектом продукта не является.

### Прочее

- Task 1 в ходе работы: падения прогонов были в самих spec (диагностика третьей стороны, 5-секундное ожидание живого чтения ростера), исправлены в spec; продуктовых дефектов Task 1-2 не выявили.
- Auth gates: нет.

## Перенесённые долги

1. **STAB-PROM-15**: живая приёмка «Повышения» на staging (шаги 1-9, 11 на PC и phone). Теперь возможна на run `mw0rbyf6_72424cdc`; запуск и решение за владельцем.
2. **F9-F12 и D (физически)**: reviewer-часть «Повышения» и редактор на физических устройствах; теперь возможно на том же run. Также не отмечено владельцем: принятие поведения при отзыве раздела во время правки (7 А, 19-13 open A); DPR 1.25 отдельно не фиксировался.
3. **Переключатель разделов «Информации» на телефоне**: todo Phase 20 (5bef0ef).
4. **Наблюдение для Phase 20**: граничный случай сброса ревизии копии на устройстве при том же источнике данных (same-source revision-reset), замеченный при исправлении 97b804d; в этом плане не разбирался.
5. **`register_attempt` anon grant** (из 19-06): остаётся открытым.
6. BLOCKED (DATA) в матрице: пустые состояния «База вирусов», «Сотрудники», «Информация», «Корзина»; populated и stale у «Справочника» и «Сводки»; поиск типов guide и broadcast. Закроются, когда на цели появятся/исчезнут данные без подмены /api.

## Состояние требований

Отмечены выполненными только те, где есть автоматическое доказательство и (где применимо) PASS владельца: STAB-MEDIA-01..05 и STAB-SEARCH-03.

Остаются Pending: STAB-DESK-08 и STAB-APP-10 (пустые и populated состояния BLOCKED по данным), STAB-APP-01..06 (поведение приложений доказано состояниями и unit-тестами, но поиск и пустые источники по Справочнику и Сводке не покрыты), STAB-APP-07..09 (физический осмотр редактора BLOCKED), STAB-SEARCH-01, -02, -04 (guide и broadcast без данных; удаление записей после poll не доказано в браузере), все STAB-PROM-*. При сомнении выбран статус Pending.

## Known Stubs

Заглушек в изменённых файлах нет.

## Threat Flags

Нет нового security-relevant surface; spec работают только на изолированном staging, receipts без секретов (`scan-evidence` по каталогу фазы: 0 находок, refHash маскирован как `01d085e7b9f0`).

## Self-Check: PASSED

Найдены: три spec, receipt, 19-APPS-UAT.md, коммиты 6da2f94, 1ac0cc5, 82159fd. Вердикт-строки: 2. scan-evidence: 0 находок.
